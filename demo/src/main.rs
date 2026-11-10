//! `make demo`: the nine steps of the spec on a local sandbox.
//!
//! One line per step (`step | expected | got | verdict`), exit code 1 as soon as
//! one line is KO. The funds invariant of the ABI (Σ bonds + fund + credits +
//! missions in progress = Σ deposits − Σ withdrawals) is checked last, after a
//! real withdrawal, so the check has something to subtract.

use anyhow::Result;
use demo::*;
use near_workspaces::AccountId;
use demerit::model::Status;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<()> {
    let fx = bootstrap().await?;
    let mut table = Table::new();
    let mut ledger = Ledger::default();

    // Invariant I2 is re-checked after every step, as the spec requires, not
    // only once at the end.
    let holders = [fx.lea.id(), fx.lea2.id(), fx.client.id(), fx.agent.id(), fx.issuer.id()];
    let mut balanced = 0u8;
    let mut steps = 0u8;
    macro_rules! run {
        ($step:expr) => {{
            $step.await?;
            steps += 1;
            if invariant_holds(&fx, &ledger, &holders).await? {
                balanced += 1;
            }
        }};
    }

    run!(step1_issue(&fx, &mut table, &mut ledger));
    run!(step2_clean(&fx, &mut table));
    run!(step3_medium(&fx, &mut table));
    run!(step4_regeneration(&fx, &mut table));
    run!(step5_severe(&fx, &mut table));
    let open_mission = {
        let mut m = 0u64;
        let fut = async {
            m = step6_suspended(&fx, &mut table).await?;
            Ok::<(), anyhow::Error>(())
        };
        run!(fut);
        m
    };
    run!(step7_identity(&fx, &mut table));
    run!(step8_reinstated(&fx, &mut table, &mut ledger, open_mission));
    run!(step9_soulbound(&fx, &mut table));

    table.verdict(
        "I2 conservation",
        format!("équilibré après chaque étape ({steps})"),
        vec![(
            balanced == steps,
            format!("{balanced}/{steps} étapes équilibrées"),
        )],
    );

    let books = check_funds(&fx, &mut ledger, &holders).await?;
    table.print();
    println!("{}", books.line);
    let ok = table.all_ok() && books.ok;
    let score = format!("{}/{}", table.ok_count(), table.total());
    if ok {
        println!("DEMO OK ({score})");
        Ok(())
    } else {
        println!("DEMO KO ({score})");
        std::process::exit(1)
    }
}

/// Step 1 — Category, platform and licence: six points on probation, one NEAR of bond.
async fn step1_issue(fx: &Fixture, table: &mut Table, ledger: &mut Ledger) -> Result<()> {
    ledger.deposit(BASE_BOND);
    issue_ok(fx, fx.lea.id(), IDENTITY_LEA, BASE_BOND).await?;
    let status = status_of(fx, fx.lea.id()).await?;
    table.verdict(
        "1 issue(lea, 1 NEAR)",
        "6 pts, probation, demerit-1, caution 1 NEAR",
        vec![
            (status.points == 6, format!("{} pts", status.points)),
            (
                status.status == Status::Probation,
                status_label(&status.status).to_string(),
            ),
            (
                status.token_id == TOKEN_ID,
                format!("jeton {}", status.token_id),
            ),
            (
                status.bond == BASE_BOND,
                format!("caution {}", near(status.bond)),
            ),
            (
                status.required_bond == BASE_BOND,
                format!("exigée {}", near(status.required_bond)),
            ),
        ],
    );
    Ok(())
}

/// Step 2 — A mission accepted and closed without a report: paid, `missions_ok` = 1.
async fn step2_clean(fx: &Fixture, table: &mut Table) -> Result<()> {
    let mission = run_mission(fx, &fx.lea, "clean", REWARD).await?;
    let status = status_settled(fx, fx.lea.id(), |s| s.missions_ok == 1).await?;
    table.verdict(
        "2 close clean",
        "missions_ok = 1, 6 pts",
        vec![
            (
                status.missions_ok == 1,
                format!("missions_ok={}", status.missions_ok),
            ),
            (status.points == 6, format!("{} pts", status.points)),
            (
                mission_state(fx, mission).await? == "closed",
                format!("mission {mission} close"),
            ),
        ],
    );
    Ok(())
}

/// Step 3 — A medium report costs three points.
async fn step3_medium(fx: &Fixture, table: &mut Table) -> Result<()> {
    run_mission(fx, &fx.lea, "medium", REWARD).await?;
    let status = status_settled(fx, fx.lea.id(), |s| s.points == 3).await?;
    table.verdict(
        "3 close medium",
        "3 pts",
        vec![
            (status.points == 3, format!("{} pts", status.points)),
            (
                status.invalidations == 0,
                format!("invalidations={}", status.invalidations),
            ),
        ],
    );
    Ok(())
}

/// Step 4 — One point comes back after six months without a report (12 s here).
async fn step4_regeneration(fx: &Fixture, table: &mut Table) -> Result<()> {
    advance_seconds(fx, SIX_MONTHS_S).await?;
    let status = status_of(fx, fx.lea.id()).await?;
    table.verdict(
        "4 +6 mois (12 s)",
        "4 pts : régénération",
        vec![(status.points == 4, format!("{} pts", status.points))],
    );
    Ok(())
}

/// Step 5 — A severe report: zero points, suspension, fund share and client
/// compensation both taken from the bond, coefficient up to 1.25.
async fn step5_severe(fx: &Fixture, table: &mut Table) -> Result<()> {
    let fund_before = fund_of(fx).await?;
    let credit_before = credit_of(fx, fx.client.id()).await?;
    run_mission(fx, &fx.lea, "severe", REWARD).await?;
    let status = status_settled(fx, fx.lea.id(), |s| s.points == 0).await?;
    let fund_gain = fund_of(fx).await?.saturating_sub(fund_before);
    let credit_gain = credit_of(fx, fx.client.id())
        .await?
        .saturating_sub(credit_before);
    let now = clock(fx).await?;
    let suspension = status.suspended_until.saturating_sub(now) / 1_000_000_000;
    let scale = rules();
    let fund_share = BASE_BOND * u128::from(scale.fund_share_pct) / 100;
    table.verdict(
        "5 close severe",
        "0 pt, suspension 6 mois, fonds +0,20, client +0,20, coef 125",
        vec![
            (
                status.points == 0 && status.status == Status::Suspended,
                format!("{} pts {}", status.points, status_label(&status.status)),
            ),
            (
                status.suspended_until > now,
                format!("suspension {suspension} s"),
            ),
            (
                fund_gain == fund_share,
                format!("fonds +{}", near(fund_gain)),
            ),
            (
                credit_gain == scale.severe_compensation,
                format!("client +{}", near(credit_gain)),
            ),
            (
                status.coefficient == 125,
                format!("coef {}", status.coefficient),
            ),
            (
                status.invalidations == 1,
                format!("invalidations={}", status.invalidations),
            ),
        ],
    );
    Ok(())
}

/// Step 6 — Suspended, Léa cannot take a mission; the registry gives the reason. The
/// mission stays open and is the one step 8 will try again.
async fn step6_suspended(fx: &Fixture, table: &mut Table) -> Result<u64> {
    let mission = post(fx, REWARD).await?;
    let attempt = attempt_accept(fx, &fx.lea, mission).await?;
    table.verdict(
        "6 accept sous suspension",
        "refus ERR_LICENSE_SUSPENDED",
        vec![(
            attempt.refused_with(ERR_LICENSE_SUSPENDED),
            attempt.describe(),
        )],
    );
    Ok(mission)
}

/// Step 7 — The same fingerprint cannot open a second licence while the first is
/// suspended. The deposit is the bond the registry demands for that identity.
async fn step7_identity(fx: &Fixture, table: &mut Table) -> Result<()> {
    let required = status_of(fx, fx.lea.id()).await?.required_bond;
    let outcome = issue(fx, fx.lea2.id(), IDENTITY_LEA, required).await?;
    let dump = format!("{outcome:?}");
    let code = code_of(&outcome)
        .or_else(|| {
            if dump.contains("ERR_SOULBOUND") {
                Some("ERR_SOULBOUND".to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| format!("dump: {}", &dump[..dump.len().min(120)]));
    table.verdict(
        "7 lea2, même empreinte",
        "refus ERR_IDENTITY_SUSPENDED",
        vec![(
            !outcome.is_success() && code == ERR_IDENTITY_SUSPENDED,
            format!("code {code}"),
        )],
    );
    Ok(())
}

/// Step 8 — Reinstated on probation, but the bond fell below the bond the risen
/// coefficient now demands: the same mission is refused, then accepted once Léa
/// has topped the bond up.
async fn step8_reinstated(
    fx: &Fixture,
    table: &mut Table,
    ledger: &mut Ledger,
    mission: u64,
) -> Result<()> {
    advance_seconds(fx, SIX_MONTHS_S).await?;
    let before = status_settled(fx, fx.lea.id(), |s| s.points == 6).await?;
    let refused = attempt_accept(fx, &fx.lea, mission).await?;
    let missing = before.required_bond.saturating_sub(before.bond);
    ledger.deposit(missing);
    let top_up = json!({ "category": CATEGORY });
    call_unit(&fx.lea, fx.registry.id(), "top_up_bond", top_up, missing).await?;
    let accepted = attempt_accept(fx, &fx.lea, mission).await?;
    let after = status_of(fx, fx.lea.id()).await?;
    // Close it, so nothing stays escrowed in the platform when funds are checked.
    let close = json!({ "mission_id": mission, "outcome": "clean" });
    call_unit(&fx.client, fx.missions.id(), "close", close, 0).await?;
    table.verdict(
        "8 réhabilitation, caution",
        "6 pts probation, inval. 1, sous-garanti refusé puis accepté",
        vec![
            (
                before.points == 6 && before.status == Status::Probation,
                format!("{} pts {}", before.points, status_label(&before.status)),
            ),
            (
                before.invalidations == 1,
                format!("invalidations={}", before.invalidations),
            ),
            (
                before.under_bonded && before.bond < before.required_bond,
                format!(
                    "sous-garanti {} < {}",
                    near(before.bond),
                    near(before.required_bond)
                ),
            ),
            (
                refused.refused_with(ERR_UNDER_BONDED),
                format!("1er accept: {}", refused.describe()),
            ),
            (
                accepted.accepted(),
                format!("2e accept: {}", accepted.describe()),
            ),
            (
                !after.under_bonded && after.bond == after.required_bond,
                format!(
                    "caution {} = exigée {}",
                    near(after.bond),
                    near(after.required_bond)
                ),
            ),
        ],
    );
    Ok(())
}

/// Step 9 — The licence is a soulbound token: a transfer is refused. NEP-171 transfers
/// carry exactly one yoctoNEAR, so the refusal cannot be blamed on the deposit.
async fn step9_soulbound(fx: &Fixture, table: &mut Table) -> Result<()> {
    let args = json!({
        "receiver_id": fx.client.id(),
        "token_id": TOKEN_ID,
        "approval_id": null,
        "memo": null,
    });
    let outcome = call(&fx.lea, fx.registry.id(), "nft_transfer", args, 1).await?;
    let dump = format!("{:#?}", outcome.failures());
    let failed = outcome.is_failure();
    let has_soulbound = dump.contains("ERR_SOULBOUND");
    let label = if has_soulbound {
        "ERR_SOULBOUND".to_string()
    } else {
        format!("failures: {dump}")
    };
    table.verdict(
        "9 nft_transfer",
        "refus ERR_SOULBOUND",
        vec![(failed && has_soulbound, format!("code {label}"))],
    );
    Ok(())
}

/// What left the registry and what is still held, side by side.
struct Books {
    ok: bool,
    line: String,
}

/// Withdraw the client's compensation, then check invariant I2 of the ABI a
/// last time with the escrow included: every posted mission must be closed.
async fn check_funds(fx: &Fixture, ledger: &mut Ledger, holders: &[&AccountId]) -> Result<Books> {
    let credit = credit_of(fx, fx.client.id()).await?;
    if credit > 0 {
        let withdrawn = call_ok(&fx.client, fx.registry.id(), "withdraw", json!({}), 0).await?;
        if withdrawn.is_success() {
            ledger.withdraw(credit);
        }
    }
    let held = registry_held(fx, holders).await?;
    let fund = fund_of(fx).await?;
    // `escrowed` is not part of the frozen ABI: the demo closes every mission it
    // posts, so a missing view is read as "nothing in progress".
    let escrowed = amount_view(&fx.worker, fx.missions.id(), "escrowed", json!({}))
        .await
        .unwrap_or(0);
    let expected = ledger.deposits.saturating_sub(ledger.withdrawals);
    let ok = held == expected && escrowed == 0;
    let line = format!(
        "funds: fonds {} + cautions et crédits {} + missions {} = {} | versements {} - retraits {} = {} -> {}",
        near(fund),
        near(held.saturating_sub(fund)),
        near(escrowed),
        near(held + escrowed),
        near(ledger.deposits),
        near(ledger.withdrawals),
        near(expected),
        if ok { "OK" } else { "KO" },
    );
    Ok(Books { ok, line })
}

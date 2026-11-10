//! `make attack`: the seven refusals of the spec on a local sandbox.
//!
//! Honest setups for tricky states:
//!
//! - `attack_delegate`: the delegate is first mandated, then revoked, then
//!   mandated again with an `expires_at` already in the past, so the registry
//!   watches a mandate that has ended.
//! - `attack_double_record`: `client` is approved by the issuer as a second
//!   sanctioned platform, because the demo platform `missions` refuses to close
//!   the same mission twice.
//!
//! Rows are printed in the order the states allow, not in the order of the
//! table: the under-bonded withdrawal (row 5) has to come last, since the severe
//! report it needs leaves Léa suspended, and rows 6 and 7 need her healthy.

use anyhow::Result;
use demo::*;
use near_workspaces::result::ExecutionFinalResult;
use serde_json::{json, Value};

#[tokio::main]
async fn main() -> Result<()> {
    let fx = bootstrap().await?;
    issue_ok(&fx, fx.lea.id(), IDENTITY_LEA, BASE_BOND).await?;

    let mut table = Table::new();
    attack_unapproved(&fx, &mut table).await?;
    attack_double_record(&fx, &mut table).await?;
    attack_second_licence(&fx, &mut table).await?;
    attack_transfer(&fx, &mut table).await?;
    attack_delegate(&fx, &mut table).await?;
    attack_suspended_platform(&fx, &mut table).await?;
    attack_withdraw(&fx, &mut table).await?;

    table.print();
    let score = format!("{}/{}", table.ok_count(), table.total());
    if table.all_ok() {
        println!("ATTACK OK ({score})");
        Ok(())
    } else {
        println!("ATTACK KO ({score})");
        std::process::exit(1)
    }
}

/// One row for an attempt that must fail with exactly `expected`.
fn expect_refusal(table: &mut Table, label: &str, expected: &str, outcome: &ExecutionFinalResult) {
    let code = code_of(outcome).unwrap_or_else(|| "aucun".to_string());
    let ok = !outcome.is_success() && code == expected;
    table.verdict(label, expected, vec![(ok, format!("code {code}"))]);
}

/// Step 1 — An account the registry never approved tries to record a mission.
async fn attack_unapproved(fx: &Fixture, table: &mut Table) -> Result<()> {
    let args = record_args(fx.lea.id(), "m-unapproved", "clean", fx.client.id());
    let outcome = call(&fx.lea2, fx.permis.id(), "record_mission", args, 0).await?;
    expect_refusal(
        table,
        "un compte non agréé enregistre une mission",
        ERR_NOT_PLATFORM,
        &outcome,
    );
    Ok(())
}

/// Step 2 — The same mission is recorded twice by the same platform.
/// `client` is approved as a platform here: the registry de-duplicates per
/// platform, and a contract cannot be made to record twice through `close`.
async fn attack_double_record(fx: &Fixture, table: &mut Table) -> Result<()> {
    let approval = json!({ "category": CATEGORY, "account": fx.client.id() });
    call_unit(&fx.issuer, fx.permis.id(), "approve_platform", approval, 0).await?;
    let args = record_args(fx.lea.id(), "m-twice", "clean", fx.client.id());
    // The first recording is the honest one; the second is the attack.
    call_unit(
        &fx.client,
        fx.permis.id(),
        "record_mission",
        args.clone(),
        0,
    )
    .await?;
    let outcome = call(&fx.client, fx.permis.id(), "record_mission", args, 0).await?;
    let label = "la même mission est enregistrée deux fois";
    expect_refusal(table, label, ERR_MISSION_ALREADY_RECORDED, &outcome);
    Ok(())
}

/// Step 3 — A second licence for a fingerprint that already holds one.
async fn attack_second_licence(fx: &Fixture, table: &mut Table) -> Result<()> {
    let required = status_of(fx, fx.lea.id()).await?.required_bond;
    let outcome = issue(fx, fx.lea2.id(), IDENTITY_LEA, required).await?;
    let label = "un second permis pour une empreinte déjà titulaire";
    expect_refusal(table, label, ERR_IDENTITY_ALREADY_LICENSED, &outcome);
    Ok(())
}

/// Step 4 — The holder tries to hand the licence over.
async fn attack_transfer(fx: &Fixture, table: &mut Table) -> Result<()> {
    let args = json!({
        "receiver_id": fx.client.id(),
        "token_id": TOKEN_ID,
        "approval_id": null,
        "memo": null,
    });
    let outcome = call(&fx.lea, fx.permis.id(), "nft_transfer", args, 1).await?;
    expect_refusal(
        table,
        "le titulaire transfère son permis",
        ERR_SOULBOUND,
        &outcome,
    );
    Ok(())
}

/// Step 6 — A delegate without a live mandate takes a mission. The mandate is
/// opened, revoked, then reopened with an expiry in the past, so the registry
/// only has a mandate that ended to look at.
async fn attack_delegate(fx: &Fixture, table: &mut Table) -> Result<()> {
    let mission = post(fx, REWARD).await?;
    let now = clock(fx).await?;
    let mut mandate = json!({ "category": CATEGORY, "delegate": fx.agent.id() });
    mandate["expires_at"] = json!((now + 3_600 * 1_000_000_000).to_string());
    call_unit(&fx.lea, fx.permis.id(), "delegate", mandate.clone(), 0).await?;
    let revoke = json!({ "category": CATEGORY, "delegate": fx.agent.id() });
    call_unit(&fx.lea, fx.permis.id(), "revoke_delegate", revoke, 0).await?;
    // Second trace, already expired. If the registry refuses to write a mandate
    // in the past, the first trace (closed mandate) still carries the refusal.
    mandate["expires_at"] = json!((now - 3_600 * 1_000_000_000).to_string());
    let _ = call(&fx.lea, fx.permis.id(), "delegate", mandate, 0).await?;

    let attempt = attempt_accept(fx, &fx.agent, mission).await?;
    let label = "un délégué révoqué accepte une mission";
    table.verdict(
        label,
        "refus ERR_DELEGATION_EXPIRED",
        vec![(
            attempt.refused_with(ERR_DELEGATION_EXPIRED),
            attempt.describe(),
        )],
    );
    Ok(())
}

/// Step 7 — A platform that took its three warnings can no longer record.
async fn attack_suspended_platform(fx: &Fixture, table: &mut Table) -> Result<()> {
    // The platform under scrutiny is approved first, then warned three times.
    let approval = json!({ "category": CATEGORY, "account": fx.client.id() });
    call_unit(&fx.issuer, fx.permis.id(), "approve_platform", approval, 0).await?;
    let target = json!({ "account": fx.client.id() });
    for _ in 0..3 {
        call_unit(
            &fx.issuer,
            fx.permis.id(),
            "strike_platform",
            target.clone(),
            0,
        )
        .await?;
    }
    let args = json!({ "account": fx.client.id() });
    let platform: Value = view(&fx.worker, fx.permis.id(), "platform", args).await?;
    let active = platform
        .get("active")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let args = record_args(fx.lea.id(), "m-suspended", "clean", fx.client.id());
    let outcome = call(&fx.client, fx.permis.id(), "record_mission", args, 0).await?;
    let code = code_of(&outcome).unwrap_or_else(|| "aucun".to_string());
    let label = "une plateforme suspendue enregistre une mission";
    table.verdict(
        label,
        ERR_PLATFORM_SUSPENDED,
        vec![
            (!active, format!("agrément actif={active}")),
            (
                !outcome.is_success() && code == ERR_PLATFORM_SUSPENDED,
                format!("code {code}"),
            ),
        ],
    );
    Ok(())
}

/// Step 5 — The holder tries to withdraw a bond below the required amount.
/// A severe report puts Léa there: coefficient 1.25 asks for 1.25 NEAR, while
/// the bond has already lost the fund share and the compensation.
async fn attack_withdraw(fx: &Fixture, table: &mut Table) -> Result<()> {
    run_mission(fx, &fx.lea, "severe", REWARD).await?;
    let status = status_settled(fx, fx.lea.id(), |s| s.points == 0).await?;
    let args = json!({ "category": CATEGORY });
    let outcome = call(&fx.lea, fx.permis.id(), "withdraw_bond_excess", args, 0).await?;
    let code = code_of(&outcome).unwrap_or_else(|| "aucun".to_string());
    // A bond already below the requirement has no excess: the registry answers
    // ERR_UNDER_BONDED, or ERR_NOTHING_TO_WITHDRAW if it reads the zero excess
    // first. Both mean the same thing here: nothing leaves the bond.
    let refused =
        !outcome.is_success() && (code == ERR_UNDER_BONDED || code == ERR_NOTHING_TO_WITHDRAW);
    let label = "le titulaire retire sa caution sous le montant exigé";
    table.verdict(
        label,
        ERR_UNDER_BONDED,
        vec![
            (
                status.under_bonded,
                format!(
                    "sous-garanti {} < {}",
                    near(status.bond),
                    near(status.required_bond)
                ),
            ),
            (refused, format!("code {code}")),
        ],
    );
    Ok(())
}

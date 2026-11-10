//! `devnet`: a local NEAR sandbox node that STAYS UP for the public web page.
//!
//! It seeds realistic on-chain state (licence, four recorded missions with
//! clean/light/medium/severe outcomes, a client compensation, a non-empty
//! guarantee fund and a live delegation), writes `out/devnet.json` with every
//! address the page needs, then waits for Ctrl-C (or SIGTERM).
//!
//! All chain helpers come from `demo::lib` (bootstrap, run_mission,
//! advance_seconds, ...): no duplication here. Note that `fast_forward` does
//! not move this sandbox clock: time is bought with blocks via
//! `advance_seconds`.

use std::path::PathBuf;
use std::time::Duration;

use anyhow::{anyhow, ensure, Result};
use demo::*;
use near_workspaces::Account;
use serde_json::{json, Value};

/// Outcomes recorded against Léa, in order: the severe one last, because it
/// suspends the licence and slashes the bond.
const OUTCOMES: [&str; 4] = ["clean", "light", "medium", "severe"];
/// Delegation lifetime, in nanoseconds (30 days of wall time).
const DELEGATION_TTL_NS: u64 = 30 * 24 * 3600 * 1_000_000_000;

fn manifest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../out/devnet.json")
}

/// Issue the licence, then record one mission per outcome class so the page
/// has real reports (light, medium, severe) and a real success streak.
async fn seed_licence_and_reports(fx: &Fixture) -> Result<()> {
    issue_ok(fx, fx.lea.id(), IDENTITY_LEA, BASE_BOND).await?;
    for outcome in OUTCOMES {
        run_mission(fx, &fx.lea, outcome, REWARD).await?;
    }
    Ok(())
}

/// Wait out the suspension, top the slashed bond back up, run one more clean
/// mission and leave one open mission so the platform table shows both states.
async fn rehabilitate(fx: &Fixture) -> Result<()> {
    advance_seconds(fx, SIX_MONTHS_S).await?;
    let status = status_of(fx, fx.lea.id()).await?;
    let missing = status.required_bond.saturating_sub(status.bond);
    if missing > 0 {
        let args = json!({ "category": CATEGORY });
        call_unit(&fx.lea, fx.registry.id(), "top_up_bond", args, missing).await?;
    }
    run_mission(fx, &fx.lea, "clean", REWARD).await?;
    post(fx, REWARD).await?;
    Ok(())
}

/// Create `agent1` under Léa and open a delegation towards it, so the page
/// delegation lookup has a live record to read.
async fn open_delegation(fx: &Fixture) -> Result<Account> {
    let agent = create_account(&fx.lea, "agent1", 5).await?;
    let expires_at = clock(fx).await? + DELEGATION_TTL_NS;
    let args = json!({
        "category": CATEGORY,
        "delegate": agent.id(),
        "expires_at": expires_at.to_string(),
    });
    call_unit(&fx.lea, fx.registry.id(), "delegate", args, 0).await?;
    Ok(agent)
}

/// Fail loudly before publishing the manifest if the seeded state would not
/// give the web page real data to show.
async fn verify_seed(fx: &Fixture, agent: &Account) -> Result<()> {
    let status = status_of(fx, fx.lea.id()).await?;
    ensure!(!status.recent_reports.is_empty(), "no report recorded");
    ensure!(status.missions_ok >= 2, "not enough clean missions");
    ensure!(
        !status.under_bonded && status.bond == status.required_bond,
        "bond {} != required {}",
        near(status.bond),
        near(status.required_bond)
    );
    ensure!(fund_of(fx).await? > 0, "guarantee fund is empty");
    ensure!(
        credit_of(fx, fx.client.id()).await? > 0,
        "client compensation is empty"
    );
    let missions: Vec<Value> = view(&fx.worker, fx.missions.id(), "missions", json!({})).await?;
    ensure!(missions.len() >= 5, "only {} missions", missions.len());
    let query = json!({ "delegate": agent.id(), "category": CATEGORY });
    let delegation: Value = view(&fx.worker, fx.registry.id(), "delegation", query).await?;
    ensure!(delegation.get("holder").is_some(), "delegation missing");
    Ok(())
}

/// Publish out/devnet.json: everything ui-smoke.mjs and `make dev` need.
fn write_manifest(fx: &Fixture, agent: &Account) -> Result<()> {
    let path = manifest_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let manifest = json!({
        "rpc": fx.worker.rpc_addr(),
        "contract": fx.registry.id().as_str(),
        "missions": fx.missions.id().as_str(),
        "issuer": fx.issuer.id().as_str(),
        "lea": fx.lea.id().as_str(),
        "lea2": fx.lea2.id().as_str(),
        "client": fx.client.id().as_str(),
        "agent": agent.id().as_str(),
        "category": CATEGORY,
    });
    std::fs::write(&path, serde_json::to_string_pretty(&manifest)?)?;
    println!("DEVNET READY {}", path.display());
    println!("{manifest}");
    Ok(())
}

/// The sandbox occasionally refuses the very first queries (startup race):
/// retry a few times before giving up, so `make dev` and the ui-smoke are
/// not at the mercy of one bad boot.
async fn start_sandbox() -> Result<Fixture> {
    let mut last: Option<anyhow::Error> = None;
    for attempt in 1..=3 {
        match bootstrap().await {
            Ok(fx) => return Ok(fx),
            Err(e) => {
                eprintln!("sandbox start failed (attempt {attempt}/3): {e}");
                last = Some(e);
                tokio::time::sleep(Duration::from_secs(3)).await;
            }
        }
    }
    Err(last.unwrap_or_else(|| anyhow!("the sandbox did not start")))
}

/// Wait for Ctrl-C or SIGTERM. Returning from here drops the fixture, and the
/// sandbox `Drop` kills the neard child: no orphan node.
async fn wait_for_shutdown() {
    use tokio::signal::unix::{signal, SignalKind};
    let mut term = signal(SignalKind::terminate()).ok();
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        _ = async {
            match term.as_mut() {
                Some(t) => { t.recv().await; }
                None => std::future::pending::<()>().await,
            }
        } => {}
    }
    println!("shutting down: stopping the sandbox node");
}

#[tokio::main]
async fn main() -> Result<()> {
    // Drop any stale manifest so `make dev` waits for THIS node, not a dead one.
    let _ = std::fs::remove_file(manifest_path());

    println!("starting the NEAR sandbox node...");
    let fx = start_sandbox().await?;
    println!("rpc: {}", fx.worker.rpc_addr());

    seed_licence_and_reports(&fx).await?;
    rehabilitate(&fx).await?;
    let agent = open_delegation(&fx).await?;
    verify_seed(&fx, &agent).await?;
    write_manifest(&fx, &agent)?;

    println!("devnet up: press Ctrl-C to stop");
    wait_for_shutdown().await;
    Ok(())
}

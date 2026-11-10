//! Shared sandbox helpers for the two scenario binaries: `demo` (the nine steps
//! of the spec) and `attack` (the seven refusals).
//!
//! Signatures and JSON arguments follow `docs/ABI.md`; the point scale is
//! imported from the contract crate (`Rules::default_scale`).
//!
//! Shared rules:
//! - state changes are signed by the real user, never by the contract;
//! - time moves with `fast_forward`, never with `sleep`;
//! - lazy callbacks are observed by forcing blocks and re-probing views.

use std::path::PathBuf;

use anyhow::{anyhow, bail, ensure};
use near_workspaces::network::Sandbox;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, AccountId, Contract, Worker};
use demerit::model::{Rules, Status, StatusView};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

pub use demerit::errors::{ERR_DELEGATION_EXPIRED, ERR_IDENTITY_ALREADY_LICENSED};
pub use demerit::errors::{ERR_IDENTITY_SUSPENDED, ERR_LICENSE_REVOKED, ERR_LICENSE_SUSPENDED};
pub use demerit::errors::{ERR_MISSION_ALREADY_RECORDED, ERR_NOTHING_TO_WITHDRAW, ERR_NOT_PLATFORM};
pub use demerit::errors::{ERR_PLATFORM_SUSPENDED, ERR_SOULBOUND, ERR_UNDER_BONDED};

pub const ERR_LICENSE_REFUSED: &str = "ERR_LICENSE_REFUSED";
pub const CATEGORY: &str = "coursier";
/// One simulated month. The sandbox produces one block per second, so a short
/// month keeps `make demo` under two minutes: six months = six blocks.
pub const MONTH_NS: u64 = 2_000_000_000;
/// Six simulated months: the regeneration period of the scale.
pub const SIX_MONTHS_S: u64 = 12;
pub const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
pub const BASE_BOND: u128 = NEAR;
pub const REWARD: u128 = NEAR / 10;
pub const IDENTITY_LEA: &str = "fp-lea";
pub const TOKEN_ID: &str = "demerit-1";

const MAX_STEPS: usize = 200;
const MAX_SETTLE: usize = 6;

pub fn rules() -> Rules {
    Rules::default_scale(MONTH_NS)
}

pub fn near(yocto_amount: u128) -> String {
    let whole = yocto_amount / NEAR;
    let frac = (yocto_amount % NEAR) / (NEAR / 10_000);
    format!("{whole}.{frac:04} NEAR")
}

pub fn status_label(status: &Status) -> &'static str {
    match status {
        Status::Probation => "probation",
        Status::Active => "actif",
        Status::Suspended => "suspendu",
        Status::Revoked => "révoqué",
        Status::Renounced => "renoncé",
    }
}

pub fn find_code(text: &str) -> Option<String> {
    let rest = &text[text.find("ERR_")?..];
    let end = rest
        .find(|c: char| !(c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_'))
        .unwrap_or(rest.len());
    Some(rest[..end].to_string())
}

pub fn code_of(outcome: &ExecutionFinalResult) -> Option<String> {
    find_code(&format!("{outcome:?}"))
}

pub fn wasm_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!(
        "../target/wasm32-unknown-unknown/release/{name}.wasm"
    ))
}

pub fn read_wasm(name: &str) -> anyhow::Result<Vec<u8>> {
    let p = wasm_path(name);
    std::fs::read(&p).map_err(|e| anyhow!("cannot read {}: {e} (run `make build`)", p.display()))
}

pub fn ensure_sandbox_bin() {
    if std::env::var_os("NEAR_SANDBOX_BIN_PATH").is_some() {
        return;
    }
    if let Some(home) = std::env::var_os("HOME") {
        let candidate = PathBuf::from(home).join(".local/near-sandbox/near-sandbox");
        if candidate.is_file() {
            std::env::set_var("NEAR_SANDBOX_BIN_PATH", candidate);
        }
    }
}

pub async fn sandbox() -> anyhow::Result<Worker<Sandbox>> {
    ensure_sandbox_bin();
    near_workspaces::sandbox()
        .await
        .map_err(|e| anyhow!("cannot start the sandbox: {e}"))
}

pub async fn create_account(
    parent: &Account,
    name: &str,
    near_amount: u128,
) -> anyhow::Result<Account> {
    parent
        .create_subaccount(name)
        .initial_balance(NearToken::from_near(near_amount))
        .transact()
        .await
        .map_err(|e| anyhow!("create {name}: {e}"))?
        .into_result()
        .map_err(|f| anyhow!("create {name}: {f:?}"))
}

pub async fn deploy_contract(
    root: &Account,
    name: &str,
    wasm_name: &str,
) -> anyhow::Result<Contract> {
    let account = create_account(root, name, 50).await?;
    let wasm = read_wasm(wasm_name)?;
    account
        .deploy(&wasm)
        .await
        .map_err(|e| anyhow!("deploy {name}: {e}"))?
        .into_result()
        .map_err(|f| anyhow!("deploy {name}: {f:?}"))
}

pub struct Fixture {
    pub worker: Worker<Sandbox>,
    pub issuer: Account,
    pub registry: Contract,
    pub missions: Contract,
    pub lea: Account,
    pub lea2: Account,
    pub client: Account,
    pub agent: Account,
}

pub fn category_args() -> Value {
    json!({ "id": CATEGORY, "rules": rules(), "base_bond": BASE_BOND.to_string() })
}

pub fn record_args(
    actor: &AccountId,
    mission_id: &str,
    outcome: &str,
    client: &AccountId,
) -> Value {
    json!({
        "actor": actor,
        "category": CATEGORY,
        "mission_id": mission_id,
        "outcome": outcome,
        "client": client,
        "evidence": format!("sha256:demerit-demo/{mission_id}"),
    })
}

pub async fn bootstrap() -> anyhow::Result<Fixture> {
    let worker = sandbox().await?;
    let root = worker.root_account().map_err(|e| anyhow!("root: {e}"))?;
    let (issuer, registry) = (
        create_account(&root, "issuer", 100).await?,
        deploy_contract(&root, "demerit", "demerit").await?,
    );
    let (missions, lea) = (
        deploy_contract(&root, "missions", "missions").await?,
        create_account(&root, "lea", 100).await?,
    );
    let (lea2, client) = (
        create_account(&root, "lea2", 100).await?,
        create_account(&root, "client", 100).await?,
    );
    let agent = create_account(&root, "agent-lea", 100).await?;

    call_unit(&issuer, registry.id(), "new", json!({}), 0).await?;
    let platform = json!({ "registry": registry.id(), "category": CATEGORY, "min_points": null });
    call_unit(&issuer, missions.id(), "new", platform, 0).await?;
    call_unit(&issuer, registry.id(), "create_category", category_args(), 0).await?;
    let approval = json!({ "category": CATEGORY, "account": missions.id() });
    call_unit(&issuer, registry.id(), "approve_platform", approval, 0).await?;
    Ok(Fixture {
        worker,
        issuer,
        registry,
        missions,
        lea,
        lea2,
        client,
        agent,
    })
}

pub async fn call(
    account: &Account,
    contract: &AccountId,
    method: &str,
    args: Value,
    deposit: u128,
) -> anyhow::Result<ExecutionFinalResult> {
    account
        .call(contract, method)
        .args_json(args)
        .deposit(NearToken::from_yoctonear(deposit))
        .max_gas()
        .transact()
        .await
        .map_err(|e| anyhow!("{method} as {}: {e}", account.id()))
}

pub async fn call_ok(
    account: &Account,
    contract: &AccountId,
    method: &str,
    args: Value,
    deposit: u128,
) -> anyhow::Result<ExecutionFinalResult> {
    let outcome = call(account, contract, method, args, deposit).await?;
    let code = code_of(&outcome).unwrap_or_else(|| "unknown".to_string());
    ensure!(
        outcome.is_success(),
        "{method} refused for {}: {code}",
        account.id()
    );
    Ok(outcome)
}

pub async fn call_unit(
    account: &Account,
    contract: &AccountId,
    method: &str,
    args: Value,
    deposit: u128,
) -> anyhow::Result<()> {
    call_ok(account, contract, method, args, deposit)
        .await
        .map(|_| ())
}

pub async fn view<T: DeserializeOwned>(
    worker: &Worker<Sandbox>,
    contract: &AccountId,
    method: &str,
    args: Value,
) -> anyhow::Result<T> {
    let details = worker.view(contract, method).args_json(args).await;
    details
        .map_err(|e| anyhow!("view {method}: {e}"))?
        .json::<T>()
        .map_err(|e| anyhow!("view {method}: {e}"))
}

pub async fn amount_view(
    worker: &Worker<Sandbox>,
    contract: &AccountId,
    method: &str,
    args: Value,
) -> anyhow::Result<u128> {
    match view::<Value>(worker, contract, method, args).await? {
        Value::String(t) => t.parse().map_err(|_| anyhow!("{method}: bad amount {t}")),
        Value::Number(n) => n
            .as_u64()
            .map(u128::from)
            .ok_or_else(|| anyhow!("{method}: {n}")),
        other => bail!("{method}: bad amount {other}"),
    }
}

pub async fn status_of(fx: &Fixture, account: &AccountId) -> anyhow::Result<StatusView> {
    view(
        &fx.worker,
        fx.registry.id(),
        "status",
        json!({ "account": account, "category": CATEGORY }),
    )
    .await
}

pub async fn status_settled(
    fx: &Fixture,
    account: &AccountId,
    want: impl Fn(&StatusView) -> bool,
) -> anyhow::Result<StatusView> {
    let mut last = status_of(fx, account).await?;
    for _ in 0..MAX_SETTLE {
        if want(&last) {
            return Ok(last);
        }
        fx.worker
            .fast_forward(1)
            .await
            .map_err(|e| anyhow!("ff: {e}"))?;
        last = status_of(fx, account).await?;
    }
    bail!(
        "{account} not settled (pts={}, ok={})",
        last.points,
        last.missions_ok
    )
}

pub async fn fund_of(fx: &Fixture) -> anyhow::Result<u128> {
    amount_view(&fx.worker, fx.registry.id(), "fund", json!({})).await
}

pub async fn credit_of(fx: &Fixture, account: &AccountId) -> anyhow::Result<u128> {
    amount_view(
        &fx.worker,
        fx.registry.id(),
        "credit",
        json!({ "account": account }),
    )
    .await
}

pub async fn clock(fx: &Fixture) -> anyhow::Result<u64> {
    // Permis returns U64, serialized as a decimal string in JSON.
    let raw: String = view(&fx.worker, fx.registry.id(), "clock", json!({})).await?;
    raw.parse::<u64>()
        .map_err(|e| anyhow!("parse clock {raw}: {e}"))
}

/// Advance the chain clock. The sandbox produces one block per transaction, so
/// time is bought with transactions: each no-op call moves the clock forward.
pub async fn advance_until(fx: &Fixture, target_ns: u64) -> anyhow::Result<u64> {
    let start = clock(fx).await?;
    if start >= target_ns {
        return Ok(start);
    }
    for _ in 0..MAX_STEPS {
        let now = clock(fx).await?;
        if now >= target_ns {
            return Ok(now);
        }
        // A call that changes nothing still produces a block, and a block is a second.
        let _ = fx
            .issuer
            .call(fx.registry.id(), "categories")
            .transact()
            .await;
    }
    let final_now = clock(fx).await?;
    if final_now >= target_ns {
        Ok(final_now)
    } else {
        bail!("clock reached {final_now} ns, needed {target_ns} ns")
    }
}

pub async fn advance_seconds(fx: &Fixture, seconds: u64) -> anyhow::Result<()> {
    let target = clock(fx).await? + seconds.saturating_mul(1_000_000_000);
    advance_until(fx, target).await.map(|_| ())
}

pub async fn issue(
    fx: &Fixture,
    holder: &AccountId,
    identity: &str,
    deposit: u128,
) -> anyhow::Result<ExecutionFinalResult> {
    let args = json!({ "account": holder, "category": CATEGORY, "identity": identity });
    call(&fx.issuer, fx.registry.id(), "issue", args, deposit).await
}

pub async fn issue_ok(
    fx: &Fixture,
    holder: &AccountId,
    identity: &str,
    deposit: u128,
) -> anyhow::Result<()> {
    let outcome = issue(fx, holder, identity, deposit).await?;
    ensure!(
        outcome.is_success(),
        "issue refused: {}",
        code_of(&outcome).unwrap_or_else(|| "unknown".to_string())
    );
    Ok(())
}

pub async fn post(fx: &Fixture, reward: u128) -> anyhow::Result<u64> {
    let args = json!({ "reward": reward.to_string() });
    let outcome = call_ok(&fx.client, fx.missions.id(), "post", args, reward).await?;
    outcome.json::<u64>().map_err(|e| anyhow!("post: {e}"))
}

pub async fn mission_state(fx: &Fixture, mission_id: u64) -> anyhow::Result<String> {
    let args = json!({ "mission_id": mission_id });
    let value: Value = view(&fx.worker, fx.missions.id(), "mission", args).await?;
    Ok(value
        .get("state")
        .and_then(|s| s.as_str())
        .unwrap_or("?")
        .to_string())
}

pub struct Attempt {
    pub mission_state: String,
    pub call_code: Option<String>,
    pub registry_code: Option<String>,
}

impl Attempt {
    pub fn accepted(&self) -> bool {
        matches!(self.mission_state.as_str(), "taken" | "closed")
    }

    pub fn refused_with(&self, expected: &str) -> bool {
        if self.accepted() {
            return false;
        }
        let seen = self.registry_code.as_deref().or(self.call_code.as_deref());
        match seen {
            Some(c) => c == expected || (c == ERR_LICENSE_REFUSED && self.registry_code.is_none()),
            None => false,
        }
    }

    pub fn describe(&self) -> String {
        let mut parts = vec![format!("état={}", self.mission_state)];
        if let Some(c) = &self.call_code {
            parts.push(format!("accept={c}"));
        }
        if let Some(c) = &self.registry_code {
            parts.push(format!("registre={c}"));
        }
        parts.join(" ")
    }
}

pub async fn registry_code(fx: &Fixture, account: &AccountId) -> Option<String> {
    let req = json!({
        "min_points": 0, "min_missions": 0, "max_invalidations": 255,
        "min_age_months": 0, "max_coefficient": 350,
    });
    for r in [req, json!({})] {
        let args = json!({ "account": account, "category": CATEGORY, "requirements": r });
        if let Ok(v) = view::<Value>(&fx.worker, fx.registry.id(), "check", args).await {
            if let Some(c) = v.get("code").and_then(|c| c.as_str()) {
                return Some(c.to_string());
            }
        }
    }
    None
}

pub async fn attempt_accept(
    fx: &Fixture,
    who: &Account,
    mission_id: u64,
) -> anyhow::Result<Attempt> {
    let outcome = call(
        who,
        fx.missions.id(),
        "accept",
        json!({ "mission_id": mission_id }),
        0,
    )
    .await?;
    let call_code = code_of(&outcome);
    let mut state = mission_state(fx, mission_id).await?;
    for _ in 0..MAX_SETTLE {
        if state != "open" {
            break;
        }
        fx.worker
            .fast_forward(1)
            .await
            .map_err(|e| anyhow!("ff: {e}"))?;
        state = mission_state(fx, mission_id).await?;
    }
    Ok(Attempt {
        mission_state: state,
        call_code,
        registry_code: registry_code(fx, who.id()).await,
    })
}

pub async fn run_mission(
    fx: &Fixture,
    holder: &Account,
    outcome: &str,
    reward: u128,
) -> anyhow::Result<u64> {
    let mission_id = post(fx, reward).await?;
    let attempt = attempt_accept(fx, holder, mission_id).await?;
    ensure!(attempt.accepted(), "accept refused: {}", attempt.describe());
    let args = json!({ "mission_id": mission_id, "outcome": outcome });
    call_unit(&fx.client, fx.missions.id(), "close", args, 0).await?;
    Ok(mission_id)
}

struct Row {
    label: String,
    expected: String,
    facts: Vec<(bool, String)>,
}

pub struct Table {
    rows: Vec<Row>,
}

impl Table {
    pub fn new() -> Self {
        Self { rows: Vec::new() }
    }

    pub fn verdict(
        &mut self,
        label: impl Into<String>,
        expected: impl Into<String>,
        facts: Vec<(bool, String)>,
    ) {
        self.rows.push(Row {
            label: label.into(),
            expected: expected.into(),
            facts,
        });
    }

    pub fn ok_count(&self) -> usize {
        self.rows.iter().filter(|r| r.ok()).count()
    }

    pub fn total(&self) -> usize {
        self.rows.len()
    }

    pub fn all_ok(&self) -> bool {
        self.rows.iter().all(|r| r.ok())
    }

    pub fn print(&self) {
        let got: Vec<String> = self.rows.iter().map(|r| r.got()).collect();
        let mut w = ["step".len(), "expected".len(), "got".len()];
        for (r, g) in self.rows.iter().zip(&got) {
            w[0] = w[0].max(r.label.len());
            w[1] = w[1].max(r.expected.len());
            w[2] = w[2].max(g.len());
        }
        let line = |a: &str, b: &str, c: &str, d: &str| {
            println!(
                "{a:w0$} | {b:w1$} | {c:w2$} | {d}",
                w0 = w[0],
                w1 = w[1],
                w2 = w[2]
            )
        };
        line("step", "expected", "got", "verdict");
        println!(
            "{}-+-{}-+-{}-+-------",
            "-".repeat(w[0]),
            "-".repeat(w[1]),
            "-".repeat(w[2])
        );
        for (r, g) in self.rows.iter().zip(&got) {
            line(&r.label, &r.expected, g, if r.ok() { "OK" } else { "KO" });
        }
    }
}

impl Default for Table {
    fn default() -> Self {
        Self::new()
    }
}

impl Row {
    fn ok(&self) -> bool {
        self.facts.iter().all(|(passed, _)| *passed)
    }

    fn got(&self) -> String {
        let parts: Vec<&str> = self.facts.iter().map(|(_, text)| text.as_str()).collect();
        parts.join(" · ")
    }
}

#[derive(Default)]
pub struct Ledger {
    pub deposits: u128,
    pub withdrawals: u128,
}

impl Ledger {
    pub fn deposit(&mut self, yocto_amount: u128) {
        self.deposits = self.deposits.saturating_add(yocto_amount);
    }

    pub fn withdraw(&mut self, yocto_amount: u128) {
        self.withdrawals = self.withdrawals.saturating_add(yocto_amount);
    }
}

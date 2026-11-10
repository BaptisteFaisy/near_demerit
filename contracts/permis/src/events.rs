//! NEP-297 events. Every issuer action leaves a public trace in the logs, so
//! that the licence holder can audit the register without being trusted.

use near_sdk::env;
use serde_json::{json, Value};

const STANDARD: &str = "nep297";
const VERSION: &str = "1.0.0";

pub fn emit(kind: &str, data: Value) {
    let payload = json!({
        "standard": STANDARD,
        "version": VERSION,
        "event": kind,
        "data": data,
    });
    env::log_str(&format!("EVENT_JSON:{}", payload));
}

pub fn license_issued(holder: &str, category: &str, identity: &str, points: u8) {
    emit(
        "license_issued",
        json!({"holder": holder, "category": category, "identity": identity, "points": points}),
    );
}

pub fn points_changed(holder: &str, category: &str, before: u8, after: u8, reason: &str) {
    emit(
        "points_changed",
        json!({"holder": holder, "category": category, "before": before, "after": after, "reason": reason}),
    );
}

pub fn mission_recorded(
    holder: &str,
    category: &str,
    mission_id: &str,
    outcome: &str,
    client: &str,
) {
    emit(
        "mission_recorded",
        json!({"holder": holder, "category": category, "mission_id": mission_id, "outcome": outcome, "client": client}),
    );
}

pub fn license_suspended(holder: &str, category: &str, until: u64) {
    emit(
        "license_suspended",
        json!({"holder": holder, "category": category, "until": until}),
    );
}

pub fn license_reinstated(holder: &str, category: &str) {
    emit(
        "license_reinstated",
        json!({"holder": holder, "category": category}),
    );
}

pub fn bond_slashed(holder: &str, category: &str, amount: u128, to_fund: u128) {
    emit(
        "bond_slashed",
        json!({"holder": holder, "category": category, "amount": amount.to_string(), "fund": to_fund.to_string()}),
    );
}

pub fn client_compensated(holder: &str, client: &str, amount: u128, mission_id: &str) {
    emit(
        "client_compensated",
        json!({"holder": holder, "client": client, "amount": amount.to_string(), "mission_id": mission_id}),
    );
}

pub fn contest_opened(holder: &str, category: &str, mission_id: &str, deposit: u128) {
    emit(
        "contest_opened",
        json!({"holder": holder, "category": category, "mission_id": mission_id, "deposit": deposit.to_string()}),
    );
}

pub fn contest_resolved(holder: &str, category: &str, mission_id: &str, upheld: bool) {
    emit(
        "contest_resolved",
        json!({"holder": holder, "category": category, "mission_id": mission_id, "upheld": upheld}),
    );
}

pub fn platform_struck(account: &str, warnings: u8, suspended: bool) {
    emit(
        "platform_struck",
        json!({"account": account, "warnings": warnings, "suspended": suspended}),
    );
}

pub fn delegation_changed(holder: &str, category: &str, delegate: &str, active: bool) {
    emit(
        "delegation_changed",
        json!({"holder": holder, "category": category, "delegate": delegate, "active": active}),
    );
}

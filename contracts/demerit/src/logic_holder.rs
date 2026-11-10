//! What the holder can do: bond, delegations, contests, stage, renounce.

use near_sdk::{env, AccountId};

use crate::errors::*;
use crate::events;
use crate::model::*;
use crate::rules;
use crate::state::now;
use crate::Demerit;

pub fn top_up_bond(registry: &mut Demerit, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = registry.live(&holder, &category);
    let amount = registry.deposit();
    license.bond += amount;
    registry.save(license);
}

pub fn withdraw_bond_excess(registry: &mut Demerit, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = registry.live(&holder, &category);
    let def = registry.category(&category);
    let dossier = registry.dossier(&license.identity);
    let required = rules::required_bond(def.base_bond, dossier.coefficient);
    if license.bond < required {
        // The bond is already below what the coefficient demands: refusing with
        // ERR_UNDER_BONDED tells the holder to top up, not to wait.
        env::panic_str(ERR_UNDER_BONDED);
    }
    if license.bond == required {
        env::panic_str(ERR_NOTHING_TO_WITHDRAW);
    }
    let excess = license.bond - required;
    license.bond = required;
    registry.save(license);
    registry.pay_out(&holder, excess);
}

pub fn delegate(registry: &mut Demerit, category: String, delegate: AccountId, expires_at: u64) {
    let holder = env::predecessor_account_id();
    let _ = registry.live(&holder, &category);
    registry.delegations.insert(
        &format!("{}|{}", delegate, category),
        &Delegation {
            holder: holder.clone(),
            delegate: delegate.clone(),
            category: category.clone(),
            expires_at,
        },
    );
    events::delegation_changed(holder.as_ref(), &category, delegate.as_ref(), true);
}

pub fn revoke_delegate(registry: &mut Demerit, category: String, delegate: AccountId) {
    let holder = env::predecessor_account_id();
    let _ = registry.live(&holder, &category);
    registry
        .delegations
        .remove(&format!("{}|{}", delegate, category));
    events::delegation_changed(holder.as_ref(), &category, delegate.as_ref(), false);
}

/// Open a contest on a recorded report, inside the window, with a deposit.
pub fn contest(registry: &mut Demerit, category: String, mission_id: String) {
    let holder = env::predecessor_account_id();
    let mut license = registry.live(&holder, &category);
    let def = registry.category(&category);
    let rules = registry.rules_of(&def, license.rules_version);
    let deposit = registry.deposit();
    if deposit < rules.contest_deposit {
        env::panic_str(ERR_CONTEST_DEPOSIT_TOO_SMALL);
    }
    let ckey = format!("{}/{}", category, mission_id);
    if registry.contests.get(&ckey).map(|c| c.open).unwrap_or(false) {
        env::panic_str(ERR_ALREADY_CONTESTED);
    }
    let at = now();
    let window = rules.contest_window_seconds.saturating_mul(1_000_000_000);
    let report = license
        .reports
        .iter_mut()
        .rev()
        .find(|r| r.mission_id == mission_id && r.state == ReportState::Applied)
        .unwrap_or_else(|| env::panic_str(ERR_NO_CONTEST));
    if at.saturating_sub(report.at) > window {
        env::panic_str(ERR_CONTEST_WINDOW_CLOSED);
    }
    report.state = ReportState::Contested;
    let platform = registry
        .report_platform
        .get(&ckey)
        .unwrap_or_else(|| env::panic_str(ERR_NO_CONTEST));
    registry.contests.insert(
        &ckey,
        &Contest {
            category: category.clone(),
            mission_id: mission_id.clone(),
            claimant: holder.clone(),
            platform,
            deposit,
            opened_at: at,
            open: true,
        },
    );
    registry.save(license);
    events::contest_opened(holder.as_ref(), &category, &mission_id, deposit);
}

/// +4 points after a clean streak, once a year.
pub fn claim_stage(registry: &mut Demerit, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = registry.live(&holder, &category);
    let def = registry.category(&category);
    let rules = registry.rules_of(&def, license.rules_version);
    let at = now();
    let year = rules.months(12);
    let too_soon = license.last_stage_at > 0 && at.saturating_sub(license.last_stage_at) < year;
    if too_soon || license.streak_ok < rules.stage_streak {
        env::panic_str(ERR_STAGE_NOT_ELIGIBLE);
    }
    let e = rules::materialize(&mut license, &rules, at);
    license.points = e.points.saturating_add(rules.stage_points).min(e.cap);
    license.last_stage_at = at;
    license.streak_ok = 0;
    let after = license.points;
    registry.save(license);
    events::points_changed(holder.as_ref(), &category, e.points, after, "stage");
}

/// Hand the licence back: the bond goes to the credit, after no claim.
pub fn renounce(registry: &mut Demerit, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = registry.live(&holder, &category);
    license.renounced = true;
    let bond = license.bond;
    license.bond = 0;
    registry.add_credit(&holder, bond);
    registry.release_identity(&license);
    registry.save(license);
    events::emit(
        "license_renounced",
        near_sdk::serde_json::json!({"holder": holder.to_string(), "category": category}),
    );
}

pub fn withdraw(registry: &mut Demerit) {
    let account = env::predecessor_account_id();
    let amount = registry.credits.get(&account).unwrap_or(0);
    if amount == 0 {
        env::panic_str(ERR_NOTHING_TO_WITHDRAW);
    }
    registry.credits.remove(&account);
    registry.credit_total = registry.credit_total.saturating_sub(amount);
    registry.pay_out(&account, amount);
}

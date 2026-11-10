//! What the holder can do: bond, delegations, contests, stage, renounce.

use near_sdk::{env, AccountId};

use crate::errors::*;
use crate::events;
use crate::model::*;
use crate::rules;
use crate::state::now;
use crate::Permis;

pub fn top_up_bond(permis: &mut Permis, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = permis.live(&holder, &category);
    let amount = permis.deposit();
    license.bond += amount;
    permis.save(license);
}

pub fn withdraw_bond_excess(permis: &mut Permis, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = permis.live(&holder, &category);
    let def = permis.category(&category);
    let dossier = permis.dossier(&license.identity);
    let required = rules::required_bond(def.base_bond, dossier.coefficient);
    if license.bond <= required {
        env::panic_str(ERR_NOTHING_TO_WITHDRAW);
    }
    let excess = license.bond - required;
    license.bond = required;
    permis.save(license);
    permis.pay_out(&holder, excess);
}

pub fn delegate(permis: &mut Permis, category: String, delegate: AccountId, expires_at: u64) {
    let holder = env::predecessor_account_id();
    let _ = permis.live(&holder, &category);
    permis.delegations.insert(
        &format!("{}|{}", delegate, category),
        &Delegation {
            holder: holder.clone(),
            delegate: delegate.clone(),
            category: category.clone(),
            expires_at,
        },
    );
    events::delegation_changed(&holder.to_string(), &category, &delegate.to_string(), true);
}

pub fn revoke_delegate(permis: &mut Permis, category: String, delegate: AccountId) {
    let holder = env::predecessor_account_id();
    let _ = permis.live(&holder, &category);
    permis
        .delegations
        .remove(&format!("{}|{}", delegate, category));
    events::delegation_changed(&holder.to_string(), &category, &delegate.to_string(), false);
}

/// Open a contest on a recorded report, inside the window, with a deposit.
pub fn contest(permis: &mut Permis, category: String, mission_id: String) {
    let holder = env::predecessor_account_id();
    let mut license = permis.live(&holder, &category);
    let def = permis.category(&category);
    let rules = permis.rules_of(&def, license.rules_version);
    let deposit = permis.deposit();
    if deposit < rules.contest_deposit {
        env::panic_str(ERR_CONTEST_DEPOSIT_TOO_SMALL);
    }
    let ckey = format!("{}/{}", category, mission_id);
    if permis.contests.get(&ckey).map(|c| c.open).unwrap_or(false) {
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
    let platform = permis
        .report_platform
        .get(&ckey)
        .unwrap_or_else(|| env::panic_str(ERR_NO_CONTEST));
    permis.contests.insert(
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
    permis.save(license);
    events::contest_opened(&holder.to_string(), &category, &mission_id, deposit);
}

/// +4 points after a clean streak, once a year.
pub fn claim_stage(permis: &mut Permis, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = permis.live(&holder, &category);
    let def = permis.category(&category);
    let rules = permis.rules_of(&def, license.rules_version);
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
    permis.save(license);
    events::points_changed(&holder.to_string(), &category, e.points, after, "stage");
}

/// Hand the licence back: the bond goes to the credit, after no claim.
pub fn renounce(permis: &mut Permis, category: String) {
    let holder = env::predecessor_account_id();
    let mut license = permis.live(&holder, &category);
    license.renounced = true;
    let bond = license.bond;
    license.bond = 0;
    permis.add_credit(&holder, bond);
    permis.release_identity(&license);
    permis.save(license);
    events::emit(
        "license_renounced",
        near_sdk::serde_json::json!({"holder": holder.to_string(), "category": category}),
    );
}

pub fn withdraw(permis: &mut Permis) {
    let account = env::predecessor_account_id();
    let amount = permis.credits.get(&account).unwrap_or(0);
    if amount == 0 {
        env::panic_str(ERR_NOTHING_TO_WITHDRAW);
    }
    permis.credits.remove(&account);
    permis.credit_total = permis.credit_total.saturating_sub(amount);
    permis.pay_out(&account, amount);
}

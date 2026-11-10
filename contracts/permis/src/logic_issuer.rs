//! Issuer entry points: categories, platforms, issuance, revocation, contests.

use near_sdk::json_types::U128;
use near_sdk::{env, AccountId};

use crate::errors::*;
use crate::events;
use crate::model::*;
use crate::rules;
use crate::state::{assert_issuer, now};
use crate::Permis;

pub fn create_category(permis: &mut Permis, id: String, rules: Rules, base_bond: U128) {
    assert_issuer(permis);
    if permis.categories.get(&id).is_some() {
        env::panic_str(ERR_CATEGORY_EXISTS);
    }
    let category = Category {
        id: id.clone(),
        issuer: permis.issuer.clone(),
        base_bond: base_bond.0,
        versions: vec![rules],
    };
    permis.categories.insert(&id, &category);
    permis.order.push(id);
}

/// A new scale is a new version; the previous one keeps judging old reports.
pub fn publish_rules(permis: &mut Permis, category: String, rules: Rules) -> u32 {
    assert_issuer(permis);
    let mut def = permis.category(&category);
    def.versions.push(rules);
    let version = def.version();
    permis.categories.insert(&category, &def);
    version
}

pub fn approve_platform(permis: &mut Permis, category: String, account: AccountId) {
    assert_issuer(permis);
    let _ = permis.category(&category);
    permis.platforms.insert(
        &account,
        &Platform {
            active: true,
            warnings: 0,
            approved_at: now(),
        },
    );
}

pub fn issue(permis: &mut Permis, account: AccountId, category: String, identity: String) {
    assert_issuer(permis);
    let def = permis.category(&category);
    let rules = permis.rules_of(&def, def.version());
    let dossier = permis.dossier(&identity);
    if dossier.revoked {
        env::panic_str(ERR_IDENTITY_REVOKED);
    }
    assert_identity_free(permis, &identity, &category);
    let required = rules::required_bond(def.base_bond, dossier.coefficient);
    let deposit = permis.deposit();
    if deposit < required {
        env::panic_str(ERR_BOND_TOO_SMALL);
    }
    let license = new_probationary(
        permis,
        &account,
        &category,
        &identity,
        &rules,
        required,
        dossier.invalidations,
    );
    let token_id = license.token_id.clone();
    register_license(permis, &account, &token_id, license, required, deposit);
    events::license_issued(
        &account.to_string(),
        &category,
        &identity,
        rules.probation_points,
    );
}

/// A brand-new licence starts in probation, at the category's probation cap.
fn new_probationary(
    permis: &Permis,
    account: &AccountId,
    category: &str,
    identity: &str,
    rules: &Rules,
    bond: u128,
    inherited_invalidations: u32,
) -> License {
    let at = now();
    License {
        token_id: format!("permis-{}", permis.next_id + 1),
        holder: account.clone(),
        category: category.to_string(),
        identity: identity.to_string(),
        points: rules.probation_points,
        cap: rules.probation_points,
        issued_at: at,
        last_report_at: at,
        last_invalidation_at: 0,
        regen_anchor: at,
        reinstated_at: 0,
        suspended_until: 0,
        invalidations: inherited_invalidations,
        missions_ok: 0,
        missions_flagged: 0,
        streak_ok: 0,
        last_stage_at: 0,
        bond,
        rules_version: permis.category(category).version(),
        revoked: false,
        renounced: false,
        reports: Vec::new(),
    }
}

/// Index the licence, mark the identity live, and credit any excess deposit.
fn register_license(
    permis: &mut Permis,
    account: &AccountId,
    token_id: &str,
    license: License,
    required: u128,
    deposit: u128,
) {
    let identity = license.identity.clone();
    let category = license.category.clone();
    permis.next_id += 1;
    permis.save(license);
    let mut ids = permis.owned.get(account).unwrap_or_default();
    ids.push(token_id.to_string());
    permis.owned.insert(account, &ids);
    permis
        .by_identity
        .insert(&identity_key(&identity, &category), &token_id.to_string());
    let mut dossier = permis.dossier(&identity);
    dossier.live_count += 1;
    permis.save_dossier(dossier);
    permis.add_credit(account, deposit - required);
}

pub fn identity_key(identity: &str, category: &str) -> String {
    format!("{}|{}", identity, category)
}

fn assert_identity_free(permis: &Permis, identity: &str, category: &str) {
    let live_id = permis.by_identity.get(&identity_key(identity, category));
    let Some(token_id) = live_id else { return };
    let license = permis.tokens.get(&token_id);
    if let Some(l) = license {
        if !l.revoked && !l.renounced {
            let suspended = l.suspended_until > now();
            env::panic_str(if suspended {
                ERR_IDENTITY_SUSPENDED
            } else {
                ERR_IDENTITY_ALREADY_LICENSED
            });
        }
    }
}

pub fn revoke_license(permis: &mut Permis, account: AccountId, category: String, reason: String) {
    assert_issuer(permis);
    let mut license = permis.live(&account, &category);
    license.revoked = true;
    permis.fund += license.bond;
    license.bond = 0;
    let mut dossier = permis.dossier(&license.identity);
    dossier.revoked = true;
    permis.save_dossier(dossier);
    permis.release_identity(&license);
    permis.save(license);
    events::emit(
        "license_revoked",
        near_sdk::serde_json::json!({
            "holder": account.to_string(), "category": category, "reason": reason
        }),
    );
}

/// Third strike against a platform suspends its approval.
pub fn strike_platform(permis: &mut Permis, account: &AccountId) {
    assert_issuer(permis);
    let mut platform = permis
        .platforms
        .get(account)
        .unwrap_or_else(|| env::panic_str(ERR_NOT_PLATFORM));
    platform.warnings = platform.warnings.saturating_add(1);
    let limit = permis
        .order
        .first()
        .map(|id| permis.category(id).versions[0].platform_strike_limit)
        .unwrap_or(3);
    if platform.warnings >= limit {
        platform.active = false;
    }
    let suspended = !platform.active;
    permis.platforms.insert(account, &platform);
    events::platform_struck(&account.to_string(), platform.warnings, suspended);
}

pub fn resolve_contest(permis: &mut Permis, category: String, mission_id: String, upheld: bool) {
    assert_issuer(permis);
    let ckey = format!("{}/{}", category, mission_id);
    let mut contest = permis
        .contests
        .get(&ckey)
        .unwrap_or_else(|| env::panic_str(ERR_NO_CONTEST));
    if !contest.open {
        env::panic_str(ERR_NO_CONTEST);
    }
    contest.open = false;
    let claimant = contest.claimant.clone();
    let platform = contest.platform.clone();
    let deposit = contest.deposit;
    let mut license = permis.live(&claimant, &category);
    let slot = license
        .reports
        .iter()
        .position(|r| r.mission_id == mission_id && r.state != ReportState::Cancelled)
        .unwrap_or_else(|| env::panic_str(ERR_NO_CONTEST));
    if upheld {
        license.reports[slot].state = ReportState::Upheld;
        permis.fund += deposit;
    } else {
        license.reports[slot].state = ReportState::Cancelled;
        let lost = license.reports[slot].points_lost as u32;
        let cap = license.cap as u32;
        license.points = ((license.points as u32).saturating_add(lost)).min(cap) as u8;
        // A cancelled report cannot keep a suspension alive.
        if license.suspended_until > 0 {
            license.suspended_until = 0;
            license.reinstated_at = now();
            license.last_invalidation_at = 0;
        }
        let refund = license.reports[slot].slashed.min(permis.fund);
        license.bond += refund;
        permis.fund -= refund;
        permis.add_credit(&claimant, deposit);
    }
    permis.save(license);
    permis.contests.insert(&ckey, &contest);
    events::contest_resolved(&claimant.to_string(), &category, &mission_id, upheld);
    if !upheld {
        strike_platform(permis, &platform);
    }
}

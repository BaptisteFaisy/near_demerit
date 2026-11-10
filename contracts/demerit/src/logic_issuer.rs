//! Issuer entry points: categories, platforms, issuance, revocation, contests.

use near_sdk::json_types::U128;
use near_sdk::{env, AccountId};

use crate::errors::*;
use crate::events;
use crate::model::*;
use crate::rules;
use crate::state::{assert_issuer, now};
use crate::Demerit;

pub fn create_category(registry: &mut Demerit, id: String, rules: Rules, base_bond: U128) {
    assert_issuer(registry);
    if registry.categories.get(&id).is_some() {
        env::panic_str(ERR_CATEGORY_EXISTS);
    }
    let category = Category {
        id: id.clone(),
        issuer: registry.issuer.clone(),
        base_bond: base_bond.0,
        versions: vec![rules],
    };
    registry.categories.insert(&id, &category);
    registry.order.push(id);
}

/// A new scale is a new version; the previous one keeps judging old reports.
pub fn publish_rules(registry: &mut Demerit, category: String, rules: Rules) -> u32 {
    assert_issuer(registry);
    let mut def = registry.category(&category);
    def.versions.push(rules);
    let version = def.version();
    registry.categories.insert(&category, &def);
    version
}

pub fn approve_platform(registry: &mut Demerit, category: String, account: AccountId) {
    assert_issuer(registry);
    let _ = registry.category(&category);
    registry.platforms.insert(
        &account,
        &Platform {
            active: true,
            warnings: 0,
            approved_at: now(),
            category: category.clone(),
        },
    );
}

pub fn issue(registry: &mut Demerit, account: AccountId, category: String, identity: String) {
    assert_issuer(registry);
    let def = registry.category(&category);
    let rules = registry.rules_of(&def, def.version());
    let dossier = registry.dossier(&identity);
    if dossier.revoked {
        env::panic_str(ERR_IDENTITY_REVOKED);
    }
    assert_identity_free(registry, &identity, &category);
    let required = rules::required_bond(def.base_bond, dossier.coefficient);
    let deposit = registry.deposit();
    if deposit < required {
        env::panic_str(ERR_BOND_TOO_SMALL);
    }
    let license = new_probationary(
        registry,
        &account,
        &category,
        &identity,
        &rules,
        required,
        dossier.invalidations,
    );
    let token_id = license.token_id.clone();
    register_license(registry, &account, &token_id, license, required, deposit);
    events::license_issued(
        account.as_ref(),
        &category,
        &identity,
        rules.probation_points,
    );
}

/// A brand-new licence starts in probation, at the category's probation cap.
fn new_probationary(
    registry: &Demerit,
    account: &AccountId,
    category: &str,
    identity: &str,
    rules: &Rules,
    bond: u128,
    inherited_invalidations: u32,
) -> License {
    let at = now();
    License {
        token_id: format!("demerit-{}", registry.next_id + 1),
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
        rules_version: registry.category(category).version(),
        revoked: false,
        renounced: false,
        reports: Vec::new(),
    }
}

/// Index the licence, mark the identity live, and credit any excess deposit.
fn register_license(
    registry: &mut Demerit,
    account: &AccountId,
    token_id: &str,
    license: License,
    required: u128,
    deposit: u128,
) {
    let identity = license.identity.clone();
    let category = license.category.clone();
    registry.next_id += 1;
    registry.save(license);
    let mut ids = registry.owned.get(account).unwrap_or_default();
    ids.push(token_id.to_string());
    registry.owned.insert(account, &ids);
    registry
        .by_identity
        .insert(&identity_key(&identity, &category), &token_id.to_string());
    let mut dossier = registry.dossier(&identity);
    dossier.live_count += 1;
    registry.save_dossier(dossier);
    registry.add_credit(account, deposit - required);
}

pub fn identity_key(identity: &str, category: &str) -> String {
    format!("{}|{}", identity, category)
}

fn assert_identity_free(registry: &Demerit, identity: &str, category: &str) {
    let live_id = registry.by_identity.get(&identity_key(identity, category));
    let Some(token_id) = live_id else { return };
    let license = registry.tokens.get(&token_id);
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

pub fn revoke_license(registry: &mut Demerit, account: AccountId, category: String, reason: String) {
    assert_issuer(registry);
    let mut license = registry.live(&account, &category);
    license.revoked = true;
    registry.fund += license.bond;
    license.bond = 0;
    let mut dossier = registry.dossier(&license.identity);
    dossier.revoked = true;
    registry.save_dossier(dossier);
    registry.release_identity(&license);
    registry.save(license);
    events::emit(
        "license_revoked",
        near_sdk::serde_json::json!({
            "holder": account.to_string(), "category": category, "reason": reason
        }),
    );
}

/// The strike limit of a category's current scale, 3 if the category is gone.
fn strike_limit(registry: &Demerit, category: &str) -> u8 {
    registry
        .categories
        .get(&category.to_string())
        .and_then(|c| c.rules(None).map(|r| r.platform_strike_limit))
        .unwrap_or(3)
}

/// Third strike against a platform suspends its approval.
pub fn strike_platform(registry: &mut Demerit, account: &AccountId) {
    assert_issuer(registry);
    let mut platform = registry
        .platforms
        .get(account)
        .unwrap_or_else(|| env::panic_str(ERR_NOT_PLATFORM));
    platform.warnings = platform.warnings.saturating_add(1);
    let limit = strike_limit(registry, &platform.category);
    if platform.warnings >= limit {
        platform.active = false;
    }
    let suspended = !platform.active;
    registry.platforms.insert(account, &platform);
    events::platform_struck(account.as_ref(), platform.warnings, suspended);
}

pub fn resolve_contest(registry: &mut Demerit, category: String, mission_id: String, upheld: bool) {
    assert_issuer(registry);
    let ckey = format!("{}/{}", category, mission_id);
    let mut contest = registry
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
    let mut license = registry.live(&claimant, &category);
    let slot = license
        .reports
        .iter()
        .position(|r| r.mission_id == mission_id && r.state != ReportState::Cancelled)
        .unwrap_or_else(|| env::panic_str(ERR_NO_CONTEST));
    if upheld {
        license.reports[slot].state = ReportState::Upheld;
        registry.fund += deposit;
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
        let refund = license.reports[slot].slashed.min(registry.fund);
        license.bond += refund;
        registry.fund -= refund;
        registry.add_credit(&claimant, deposit);
    }
    registry.save(license);
    registry.contests.insert(&ckey, &contest);
    events::contest_resolved(claimant.as_ref(), &category, &mission_id, upheld);
    if !upheld {
        strike_platform(registry, &platform);
    }
}

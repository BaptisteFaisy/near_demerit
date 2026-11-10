//! One mission is recorded once per platform. Everything else follows from it.

use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, AccountId};

use crate::errors::*;
use crate::events;
use crate::model::*;
use crate::rules;
use crate::state::{mission_key, now};
use crate::Demerit;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct RecordView {
    pub holder: AccountId,
    pub token_id: String,
    pub points_before: u8,
    pub points: u8,
    pub suspended_until: u64,
    pub invalidated: bool,
    pub compensation: u128,
    pub fund_share: u128,
    pub coefficient: BasisPoints,
    pub under_bonded: bool,
}

pub fn record_mission(
    registry: &mut Demerit,
    actor: AccountId,
    category: String,
    mission_id: String,
    outcome: String,
    client: AccountId,
    _evidence: String,
) -> RecordView {
    let platform = env::predecessor_account_id();
    let registered = registry
        .platforms
        .get(&platform)
        .unwrap_or_else(|| env::panic_str(ERR_NOT_PLATFORM));
    if !registered.active {
        env::panic_str(ERR_PLATFORM_SUSPENDED);
    }
    let mkey = mission_key(&platform, &mission_id);
    if registry.seen.get(&mkey).is_some() {
        env::panic_str(ERR_MISSION_ALREADY_RECORDED);
    }
    let class = OutcomeClass::parse(&outcome).unwrap_or_else(|| env::panic_str(ERR_BAD_OUTCOME));
    let holder = registry
        .resolve(&actor, &category)
        .unwrap_or_else(|code| env::panic_str(&code));
    let mut license = registry.live(&holder, &category);
    let def = registry.category(&category);
    // A report is judged by the scale in force when it arrives.
    let rules = registry.rules_of(&def, def.version());
    let at = now();
    let effect = rules::apply_outcome(&mut license, &rules, at, class, &mission_id);
    let mut dossier = registry.dossier(&license.identity);

    let mut compensation = 0u128;
    let mut fund_share = 0u128;
    if class == OutcomeClass::Severe {
        let (slashed, paid, share) = slash(registry, &mut license, &rules);
        compensation = paid;
        fund_share = share;
        if let Some(last) = license.reports.last_mut() {
            last.slashed = slashed;
        }
        rules::bump_coefficient(&mut dossier.coefficient);
        registry.add_credit(&client, compensation);
        events::bond_slashed(holder.as_ref(), &category, slashed, fund_share);
        if compensation > 0 {
            events::client_compensated(holder.as_ref(), client.as_ref(), compensation, &mission_id);
        }
        if effect.invalidated {
            dossier.invalidations = dossier.invalidations.saturating_add(1);
        }
    } else if class == OutcomeClass::Clean
        && at.saturating_sub(license.last_report_at) >= rules.months(12)
    {
        rules::relax_coefficient(&mut dossier.coefficient);
    }

    let required = rules::required_bond(def.base_bond, dossier.coefficient);
    let under_bonded = license.bond < required;
    registry.seen.insert(&mkey, &());
    registry
        .report_platform
        .insert(&format!("{}/{}", category, mission_id), &platform);
    registry.save_dossier(dossier.clone());
    let view = RecordView {
        holder: holder.clone(),
        token_id: license.token_id.clone(),
        points_before: effect.before,
        points: effect.after,
        suspended_until: effect.suspended_until,
        invalidated: effect.invalidated,
        compensation,
        fund_share,
        coefficient: dossier.coefficient,
        under_bonded,
    };
    registry.save(license);

    events::mission_recorded(
        holder.as_ref(),
        &category,
        &mission_id,
        class.as_str(),
        client.as_ref(),
    );
    events::points_changed(
        holder.as_ref(),
        &category,
        effect.before,
        effect.after,
        class.as_str(),
    );
    if effect.invalidated {
        events::license_suspended(holder.as_ref(), &category, effect.suspended_until);
    }
    view
}

/// Compensation to the client and the share that feeds the guarantee fund.
/// Both come off the bond, and never below zero.
fn slash(registry: &mut Demerit, license: &mut License, rules: &Rules) -> (u128, u128, u128) {
    let before = license.bond;
    let fund_share = before.saturating_mul(rules.fund_share_pct as u128) / 100;
    let compensation = rules.severe_compensation.min(before - fund_share);
    license.bond = before - fund_share - compensation;
    registry.fund += fund_share;
    (fund_share + compensation, compensation, fund_share)
}

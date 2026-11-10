//! Read side. Everything here is computed at the instant of the call: no view
//! ever returns a stale balance.

use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

use crate::errors::*;
use crate::model::*;
use crate::rules;
use crate::state::now;
use crate::Permis;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Requirements {
    pub min_points: Option<u8>,
    pub min_missions: Option<u64>,
    pub max_invalidations: Option<u32>,
    pub min_age_months: Option<u32>,
    pub max_coefficient: Option<BasisPoints>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct CheckResult {
    pub allowed: bool,
    pub code: Option<String>,
    pub points: u8,
    pub status: Status,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct DelegationView {
    pub holder: AccountId,
    pub delegate: AccountId,
    pub category: String,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct PlatformView {
    pub account: AccountId,
    pub active: bool,
    pub warnings: u8,
    pub approved_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct CategoryView {
    pub id: String,
    pub issuer: AccountId,
    pub base_bond: U128,
    pub version: u32,
    pub rules: Vec<Rules>,
}

/// Everything the eligibility check needs, bundled so the helper stays readable.
struct CheckCtx<'a> {
    license: &'a License,
    e: &'a rules::Effective,
    status: Status,
    required: u128,
    now: u64,
    rules: &'a Rules,
    dossier: &'a Dossier,
}

impl Permis {
    /// The licence of `account`, following a delegation when there is one.
    pub fn resolve(&self, account: &AccountId, category: &str) -> Result<AccountId, String> {
        if self.has_live(account, category) {
            return Ok(account.clone());
        }
        match self.delegation_of(account, category) {
            Some(d) if d.expires_at > now() => Ok(d.holder),
            Some(_) => Err(ERR_DELEGATION_EXPIRED.to_string()),
            None => Err(ERR_NO_LICENSE.to_string()),
        }
    }

    pub fn has_live(&self, holder: &AccountId, category: &str) -> bool {
        self.owned
            .get(holder)
            .unwrap_or_default()
            .into_iter()
            .any(|id| {
                self.tokens
                    .get(&id)
                    .map(|l| l.category == category && !l.revoked && !l.renounced)
                    .unwrap_or(false)
            })
    }

    pub fn status_of(&self, holder: &AccountId, category: &str) -> StatusView {
        let license = self.live(holder, category);
        let category_def = self.category(category);
        let rules = self.rules_of(&category_def, license.rules_version);
        let now = now();
        let e = rules::effective(&license, &rules, now);
        let dossier = self.dossier(&license.identity);
        let required = rules::required_bond(category_def.base_bond, dossier.coefficient);
        let status = rules::status(&license, &rules, &e, now);
        let under_bonded = license.bond < required;
        StatusView {
            holder: license.holder.clone(),
            category: license.category.clone(),
            token_id: license.token_id.clone(),
            status,
            points: e.points,
            cap: e.cap,
            identity: license.identity.clone(),
            coefficient: dossier.coefficient,
            bond: license.bond,
            required_bond: required,
            under_bonded,
            invalidations: license.invalidations,
            missions_ok: license.missions_ok,
            missions_flagged: license.missions_flagged,
            streak_ok: license.streak_ok,
            suspended_until: license.suspended_until,
            next_regen_at: rules::next_regen_at(&license, &rules, now),
            next_cap_gain_at: rules::next_cap_gain_at(&license, &rules, now),
            allowed: !under_bonded
                && matches!(status, Status::Probation | Status::Active)
                && e.points > 0,
            reasons: vec![],
            recent_reports: license.reports.clone(),
        }
    }

    pub fn check_against(
        &self,
        account: &AccountId,
        category: &str,
        req: &Requirements,
    ) -> CheckResult {
        let holder = match self.resolve(account, category) {
            Ok(h) => h,
            Err(code) => {
                return CheckResult {
                    allowed: false,
                    code: Some(code),
                    points: 0,
                    status: Status::Revoked,
                }
            }
        };
        let license = self.live(&holder, category);
        let category_def = self.category(category);
        let rules = self.rules_of(&category_def, license.rules_version);
        let now = now();
        let e = rules::effective(&license, &rules, now);
        let dossier = self.dossier(&license.identity);
        let status = rules::status(&license, &rules, &e, now);
        let required = rules::required_bond(category_def.base_bond, dossier.coefficient);
        let ctx = CheckCtx {
            license: &license,
            e: &e,
            status,
            required,
            now,
            rules: &rules,
            dossier: &dossier,
        };
        let failure = self.first_failure(&ctx, req);
        CheckResult {
            allowed: failure.is_none(),
            code: failure,
            points: e.points,
            status,
        }
    }

    fn first_failure(&self, ctx: &CheckCtx, req: &Requirements) -> Option<String> {
        let CheckCtx {
            license,
            e,
            status,
            required,
            now,
            rules,
            dossier,
        } = *ctx;
        let code = match status {
            Status::Revoked => ERR_LICENSE_REVOKED,
            Status::Renounced => ERR_NO_LICENSE,
            Status::Suspended => ERR_LICENSE_SUSPENDED,
            _ if e.points == 0 => ERR_LICENSE_SUSPENDED,
            _ if license.bond < required => ERR_UNDER_BONDED,
            _ if dossier.revoked => ERR_LICENSE_REVOKED,
            _ if req.min_points.map(|m| e.points < m).unwrap_or(false) => ERR_POINTS_TOO_LOW,
            _ if req
                .min_missions
                .map(|m| license.missions_ok < m)
                .unwrap_or(false) =>
            {
                ERR_MISSIONS_TOO_FEW
            }
            _ if req
                .max_invalidations
                .map(|m| license.invalidations > m)
                .unwrap_or(false) =>
            {
                ERR_INVALIDATIONS_TOO_MANY
            }
            _ if req
                .min_age_months
                .map(|m| now.saturating_sub(license.issued_at) < rules.months(m))
                .unwrap_or(false) =>
            {
                ERR_LICENSE_TOO_YOUNG
            }
            _ if req
                .max_coefficient
                .map(|m| dossier.coefficient > m)
                .unwrap_or(false) =>
            {
                ERR_COEFFICIENT_TOO_HIGH
            }
            _ => return None,
        };
        Some(code.to_string())
    }

    pub fn delegation_of(&self, delegate: &AccountId, category: &str) -> Option<DelegationView> {
        self.delegations
            .get(&format!("{}|{}", delegate, category))
            .map(|d| DelegationView {
                holder: d.holder,
                delegate: d.delegate,
                category: d.category,
                expires_at: d.expires_at,
            })
    }

    pub fn category_view(&self, id: &str) -> CategoryView {
        let c = self.category(id);
        CategoryView {
            id: c.id.clone(),
            issuer: c.issuer.clone(),
            base_bond: U128(c.base_bond),
            version: c.version(),
            rules: c.versions.clone(),
        }
    }
}

//! Contract state and the helpers every entry point shares.

use near_sdk::{env, AccountId, NearToken, Promise};

use crate::errors::*;
use crate::model::*;
use crate::Demerit;

// ---------------------------------------------------------------------------
// Small helpers. Every entry point goes through them, so a rule is written once.
// ---------------------------------------------------------------------------

pub fn now() -> u64 {
    env::block_timestamp()
}

pub fn key(holder: &AccountId, category: &str) -> String {
    format!("{}|{}", holder, category)
}

pub fn mission_key(platform: &AccountId, mission_id: &str) -> String {
    format!("{}/{}", platform, mission_id)
}

pub fn assert_issuer(registry: &Demerit) {
    if env::predecessor_account_id() != registry.issuer {
        env::panic_str(ERR_NOT_ISSUER);
    }
}

impl Demerit {
    pub fn category(&self, id: &str) -> Category {
        self.categories
            .get(&id.to_string())
            .unwrap_or_else(|| env::panic_str(ERR_UNKNOWN_CATEGORY))
    }

    pub fn rules_of(&self, category: &Category, version: u32) -> Rules {
        category
            .rules(Some(version))
            .cloned()
            .unwrap_or_else(|| env::panic_str(ERR_UNKNOWN_CATEGORY))
    }

    pub fn dossier(&self, identity: &str) -> Dossier {
        self.dossiers.get(&identity.to_string()).unwrap_or(Dossier {
            identity: identity.to_string(),
            invalidations: 0,
            revoked: false,
            coefficient: 100,
            live_count: 0,
        })
    }

    pub fn save_dossier(&mut self, dossier: Dossier) {
        self.dossiers.insert(&dossier.identity.clone(), &dossier);
    }

    /// A live licence for (holder, category), or a panic.
    pub fn live(&self, holder: &AccountId, category: &str) -> License {
        let ids = self.owned.get(holder).unwrap_or_default();
        for id in ids {
            if let Some(l) = self.tokens.get(&id) {
                if l.category == category && !l.revoked && !l.renounced {
                    return l;
                }
            }
        }
        env::panic_str(ERR_NO_LICENSE)
    }

    pub fn save(&mut self, license: License) {
        self.tokens.insert(&license.token_id.clone(), &license);
    }

    /// Remove a licence from the live index, keeping its history in `tokens`.
    pub fn release_identity(&mut self, license: &License) {
        if self.by_identity.get(&license.identity) == Some(license.token_id.clone()) {
            self.by_identity.remove(&license.identity);
        }
        let mut dossier = self.dossier(&license.identity);
        dossier.live_count = dossier.live_count.saturating_sub(1);
        self.save_dossier(dossier);
    }

    pub fn add_credit(&mut self, account: &AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        let current = self.credits.get(account).unwrap_or(0);
        self.credits.insert(account, &(current + amount));
        self.credit_total += amount;
    }

    pub fn pay_out(&mut self, account: &AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        Promise::new(account.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .detach();
    }

    pub fn required_bond(
        &self,
        category: &Category,
        rules_version: u32,
        coefficient: BasisPoints,
    ) -> u128 {
        let _ = rules_version;
        crate::rules::required_bond(category.base_bond, coefficient)
    }

    /// I2: bonds + fund + credits must equal what came in minus what went out.
    pub fn total_bond(&self) -> u128 {
        self.tokens.iter().map(|(_, l)| l.bond).sum()
    }

    pub fn total_credit(&self) -> u128 {
        self.credit_total
    }

    pub fn deposit(&self) -> u128 {
        env::attached_deposit().as_yoctonear()
    }
}

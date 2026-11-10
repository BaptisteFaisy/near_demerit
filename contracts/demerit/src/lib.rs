//! Demerit à points — a non-transferable professional licence.
//!
//! Points fall when a real client reports a mission, and come back with time.
//! At zero, every platform that asks is refused, and the bond indemnifies the
//! client. The dossier follows the verified identity, not the account.
//!
//! The rules live in `rules.rs` as pure functions, so the same code is used by
//! the contract, the sandbox scenarios and the simulation.

pub mod errors;
pub mod events;
pub mod logic_holder;
pub mod logic_issuer;
pub mod model;
pub mod nft;
pub mod record;
pub mod rules;
pub mod state;
pub mod views;

#[cfg(test)]
mod tests;

use near_sdk::borsh::{self, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::json_types::U128;
use near_sdk::{env, near, AccountId, BorshStorageKey, PanicOnDefault, Promise};

use errors::*;
use model::*;
use state::now;
use views::{CategoryView, CheckResult, DelegationView, PlatformView, Requirements};

#[derive(BorshStorageKey, BorshSerialize)]
pub enum Key {
    Categories,
    Tokens,
    Owned,
    ByIdentity,
    Dossiers,
    Platforms,
    Seen,
    Delegations,
    Contests,
    Credits,
    ReportPlatform,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Demerit {
    pub issuer: AccountId,
    pub categories: LookupMap<String, Category>,
    pub order: Vec<String>,
    pub tokens: UnorderedMap<String, License>,
    /// holder -> token ids, so NEP-181 answers without scanning everything.
    pub owned: LookupMap<AccountId, Vec<String>>,
    /// identity fingerprint -> token id of the live licence.
    pub by_identity: LookupMap<String, String>,
    pub dossiers: LookupMap<String, Dossier>,
    pub platforms: LookupMap<AccountId, Platform>,
    /// "<platform>/<mission_id>" -> already recorded.
    pub seen: LookupMap<String, ()>,
    /// "<delegate>/<category>" -> delegation.
    pub delegations: LookupMap<String, Delegation>,
    /// "<category>/<mission_id>" -> contest.
    pub contests: LookupMap<String, Contest>,
    pub credits: LookupMap<AccountId, u128>,
    /// Sum of `credits`, kept in step by `add_credit`, so I2 stays checkable.
    pub credit_total: u128,
    /// "<category>/<mission_id>" -> platform that recorded it (for contests).
    pub report_platform: LookupMap<String, AccountId>,
    pub fund: u128,
    pub next_id: u64,
}

#[near]
impl Demerit {
    /// The deployer is the issuer: it verifies identities off chain.
    #[init]
    pub fn new() -> Self {
        Self {
            issuer: env::predecessor_account_id(),
            categories: LookupMap::new(Key::Categories),
            order: Vec::new(),
            tokens: UnorderedMap::new(Key::Tokens),
            owned: LookupMap::new(Key::Owned),
            by_identity: LookupMap::new(Key::ByIdentity),
            dossiers: LookupMap::new(Key::Dossiers),
            platforms: LookupMap::new(Key::Platforms),
            seen: LookupMap::new(Key::Seen),
            delegations: LookupMap::new(Key::Delegations),
            contests: LookupMap::new(Key::Contests),
            credits: LookupMap::new(Key::Credits),
            report_platform: LookupMap::new(Key::ReportPlatform),
            fund: 0,
            credit_total: 0,
            next_id: 0,
        }
    }

    // -- issuer ------------------------------------------------------------

    pub fn create_category(&mut self, id: String, rules: Rules, base_bond: U128) {
        logic_issuer::create_category(self, id, rules, base_bond);
    }

    pub fn publish_rules(&mut self, category: String, rules: Rules) -> u32 {
        logic_issuer::publish_rules(self, category, rules)
    }

    pub fn approve_platform(&mut self, category: String, account: AccountId) {
        logic_issuer::approve_platform(self, category, account);
    }

    #[payable]
    pub fn issue(&mut self, account: AccountId, category: String, identity: String) {
        logic_issuer::issue(self, account, category, identity);
    }

    pub fn revoke_license(&mut self, account: AccountId, category: String, reason: String) {
        logic_issuer::revoke_license(self, account, category, reason);
    }

    pub fn resolve_contest(&mut self, category: String, mission_id: String, upheld: bool) {
        logic_issuer::resolve_contest(self, category, mission_id, upheld);
    }

    /// The issuer may warn a platform by hand; three warnings end its approval.
    pub fn strike_platform(&mut self, account: AccountId) {
        logic_issuer::strike_platform(self, &account);
    }

    // -- platform ----------------------------------------------------------

    pub fn record_mission(
        &mut self,
        actor: AccountId,
        category: String,
        mission_id: String,
        outcome: String,
        client: AccountId,
        evidence: String,
    ) -> record::RecordView {
        record::record_mission(self, actor, category, mission_id, outcome, client, evidence)
    }

    // -- holder ------------------------------------------------------------

    #[payable]
    pub fn top_up_bond(&mut self, category: String) {
        logic_holder::top_up_bond(self, category);
    }

    pub fn withdraw_bond_excess(&mut self, category: String) {
        logic_holder::withdraw_bond_excess(self, category);
    }

    pub fn delegate(&mut self, category: String, delegate: AccountId, expires_at: U64) {
        logic_holder::delegate(self, category, delegate, expires_at.0);
    }

    pub fn revoke_delegate(&mut self, category: String, delegate: AccountId) {
        logic_holder::revoke_delegate(self, category, delegate);
    }

    #[payable]
    pub fn contest(&mut self, category: String, mission_id: String) {
        logic_holder::contest(self, category, mission_id);
    }

    pub fn claim_stage(&mut self, category: String) {
        logic_holder::claim_stage(self, category);
    }

    pub fn renounce(&mut self, category: String) {
        logic_holder::renounce(self, category);
    }

    pub fn withdraw(&mut self) {
        logic_holder::withdraw(self);
    }

    // -- views -------------------------------------------------------------

    pub fn status(&self, account: AccountId, category: String) -> StatusView {
        self.status_of(&account, &category)
    }

    pub fn is_allowed(&self, account: AccountId, category: String, min_points: Option<u8>) -> bool {
        let req = Requirements {
            min_points,
            min_missions: None,
            max_invalidations: None,
            min_age_months: None,
            max_coefficient: None,
        };
        self.check_against(&account, &category, &req).allowed
    }

    pub fn check(
        &self,
        account: AccountId,
        category: String,
        requirements: Requirements,
    ) -> CheckResult {
        self.check_against(&account, &category, &requirements)
    }

    /// The full stored licence, by token id (NEP-171 `nft_token` is the
    /// computed view; this one is the raw record).
    pub fn license(&self, token_id: String) -> License {
        self.tokens.get(&token_id).expect(ERR_NO_LICENSE)
    }

    /// The live licence of a holder in a category, raw record included.
    pub fn license_of(&self, account: AccountId, category: String) -> License {
        self.live(&account, &category)
    }

    pub fn platform(&self, account: AccountId) -> PlatformView {
        let p = self.platforms.get(&account).unwrap_or(Platform {
            active: false,
            warnings: 0,
            approved_at: 0,
        });
        PlatformView {
            account,
            active: p.active,
            warnings: p.warnings,
            approved_at: p.approved_at,
        }
    }

    pub fn delegation(&self, delegate: AccountId, category: String) -> Option<DelegationView> {
        self.delegation_of(&delegate, &category)
    }

    pub fn fund(&self) -> U128 {
        U128(self.fund)
    }

    pub fn credit(&self, account: AccountId) -> U128 {
        U128(self.credits.get(&account).unwrap_or(0))
    }

    pub fn rules(&self, category: String, version: Option<u32>) -> Rules {
        let def = self.category(&category);
        self.rules_of(&def, version.unwrap_or_else(|| def.version()))
    }

    pub fn categories(&self) -> Vec<CategoryView> {
        self.order.iter().map(|id| self.category_view(id)).collect()
    }

    pub fn clock(&self) -> U64 {
        U64(now())
    }

    pub fn issuer(&self) -> AccountId {
        self.issuer.clone()
    }

    // -- NEP-171 / NEP-181 / NEP-393 --------------------------------------

    pub fn nft_metadata(&self) -> nft::NftMetadata {
        nft::metadata()
    }

    pub fn nft_token(&self, token_id: String) -> Option<nft::NftToken> {
        self.tokens.get(&token_id).map(|_| self.token_of(&token_id))
    }

    pub fn nft_tokens(&self, from_index: Option<U64>, limit: Option<u64>) -> Vec<nft::NftToken> {
        self.tokens_page(from_index.map(|v| v.0).unwrap_or(0), limit.unwrap_or(50))
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U64 {
        U64(self.owned.get(&account_id).unwrap_or_default().len() as u64)
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U64>,
        limit: Option<u64>,
    ) -> Vec<nft::NftToken> {
        self.tokens_of_owner(
            &account_id,
            from_index.map(|v| v.0).unwrap_or(0),
            limit.unwrap_or(50),
        )
    }

    /// A licence is bound to its holder: there is no way to move one.
    /// NEP-171 requires exactly 1 yoctoNEAR attached; mark payable so the panic
    /// reason is ERR_SOULBOUND, never "doesn't accept deposit".
    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        let _ = (receiver_id, token_id, approval_id, memo);
        env::panic_str(ERR_SOULBOUND);
    }

    #[payable]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> Promise {
        let _ = (receiver_id, token_id, approval_id, memo, msg);
        env::panic_str(ERR_SOULBOUND);
    }
}

pub use near_sdk::json_types::U64;

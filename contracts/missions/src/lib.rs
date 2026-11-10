//! `missions` — the demo platform of "Permis à points".
//!
//! A poster publishes a mission and escrows the reward in this contract. A
//! worker accepts it; the platform asks the `permis` registry cross-contract
//! (`is_allowed`) and assigns the mission **inside the callback**. When the work
//! is done the poster closes the mission: the worker is paid, then the registry
//! is told (`record_mission`) so points and counters move.
//!
//! Design notes
//! - `accept` never decides anything itself: `permis.is_allowed` is called with
//!   a **static** gas budget (`GAS_IS_ALLOWED`) and the decision is applied by
//!   `on_allowed` (`Promise::then`, `#[private]`, `#[callback_result]`).
//! - `is_allowed` is a plain `bool` view, so no refusal *code* can travel back
//!   through the callback: a refusal is reported as `ERR_LICENSE_REFUSED`. The
//!   detailed codes of docs/ABI.md §3 (`ERR_LICENSE_SUSPENDED`,
//!   `ERR_UNDER_BONDED`, `ERR_DELEGATION_EXPIRED`, `ERR_LICENSE_REVOKED`) come
//!   from `permis.check`; switching to it would only require reading
//!   `{ allowed, code }` instead of a bool.
//! - No storage deposit is charged: the demo writes a few small records per
//!   account, paid by the platform's own balance. The escrowed rewards are
//!   accounted separately (`escrowed`), so the demo can assert invariant I2.

use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::U128;
use near_sdk::{
    env, ext_contract, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError,
};

mod events;
mod model;

use model::{ConfigView, Mission, MissionState, MissionView};

// ---------------------------------------------------------------------------
// Refusal codes. `permis` codes are reused verbatim; the ones below are local
// to this contract (docs/ABI.md §3 lists the registry ones).
// ---------------------------------------------------------------------------

/// `is_allowed` answered `false` (see the module note about the lost code).
pub const ERR_LICENSE_REFUSED: &str = "ERR_LICENSE_REFUSED";
/// The cross-contract call to `permis` failed (no such method, gas, panic).
pub const ERR_LICENSE_CHECK_FAILED: &str = "ERR_LICENSE_CHECK_FAILED";
/// The mission is already closed: closing is not idempotent.
pub const ERR_MISSION_CLOSED: &str = "ERR_MISSION_CLOSED";
pub const ERR_UNKNOWN_MISSION: &str = "ERR_UNKNOWN_MISSION";
pub const ERR_NOT_POSTER: &str = "ERR_NOT_POSTER";
pub const ERR_MISSION_NOT_TAKEN: &str = "ERR_MISSION_NOT_TAKEN";
pub const ERR_MISSION_ALREADY_TAKEN: &str = "ERR_MISSION_ALREADY_TAKEN";
pub const ERR_REWARD_TOO_SMALL: &str = "ERR_REWARD_TOO_SMALL";
pub const ERR_REWARD_ZERO: &str = "ERR_REWARD_ZERO";
pub const ERR_BAD_OUTCOME: &str = "ERR_BAD_OUTCOME";

/// Outcomes accepted by `permis.record_mission` (docs/ABI.md §1).
const OUTCOMES: [&str; 4] = ["clean", "light", "medium", "severe"];

// Static gas budgets: never inherited from the caller's remaining gas.
pub const GAS_IS_ALLOWED: Gas = Gas::from_tgas(10);
pub const GAS_ON_ALLOWED: Gas = Gas::from_tgas(15);
pub const GAS_RECORD_MISSION: Gas = Gas::from_tgas(30);

/// The slice of the `permis` ABI this platform talks to (docs/ABI.md §1).
#[ext_contract(ext_permis)]
pub trait Permis {
    /// Pure view: `bool`, computed at call time.
    fn is_allowed(&self, account: AccountId, category: String, min_points: Option<u8>) -> bool;
    /// Mutating: moves points and counters, may compensate the client.
    fn record_mission(
        &mut self,
        actor: AccountId,
        category: String,
        mission_id: String,
        outcome: String,
        client: AccountId,
        evidence: String,
    );
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Registry this platform interrogates and reports to.
    pub permis: AccountId,
    /// Licence category required to accept a mission here.
    pub category: String,
    /// Optional extra floor on points, forwarded to `is_allowed`.
    pub min_points: Option<u8>,
    /// Poster of record: the account that deployed the platform.
    pub operator: AccountId,
    /// Monotonic mission id, starting at 1.
    pub next_id: u64,
    pub missions: UnorderedMap<u64, Mission>,
    /// Sum of the rewards still escrowed (paid missions excluded).
    pub escrowed: u128,
}

#[near]
impl Contract {
    #[init]
    pub fn new(permis: AccountId, category: String, min_points: Option<u8>) -> Self {
        Self {
            permis,
            category,
            min_points,
            operator: env::predecessor_account_id(),
            next_id: 1,
            missions: UnorderedMap::new(b"m".to_vec()),
            escrowed: 0,
        }
    }

    // -- poster side --------------------------------------------------------

    /// Publish a mission. The attached deposit must cover the reward; the reward
    /// stays in this contract until `close` (any excess is a buffer for the demo,
    /// not credited to the poster). Returns the new mission id.
    #[payable]
    pub fn post(&mut self, reward: U128) -> u64 {
        let reward = reward.0;
        if reward == 0 {
            env::panic_str(ERR_REWARD_ZERO);
        }
        if env::attached_deposit().as_yoctonear() < reward {
            env::panic_str(ERR_REWARD_TOO_SMALL);
        }
        let id = self.next_id;
        self.next_id += 1;
        let mission = Mission {
            id,
            poster: env::predecessor_account_id(),
            worker: None,
            reward,
            state: MissionState::Open,
            outcome: None,
            created_at: env::block_timestamp(),
            taken_at: None,
            closed_at: None,
        };
        self.missions.insert(&id, &mission);
        self.escrowed += reward;
        events::mission_posted(&mission);
        id
    }

    /// Close a taken mission: announce `Closed`, pay the worker, then tell the
    /// registry. The state is written first, so a replayed `close` hits
    /// `ERR_MISSION_CLOSED` instead of paying twice.
    pub fn close(&mut self, mission_id: u64, outcome: String) -> Promise {
        let mut mission = self.mission_or_panic(mission_id);
        if env::predecessor_account_id() != mission.poster {
            env::panic_str(ERR_NOT_POSTER);
        }
        self.assert_closable(mission.state);
        if !OUTCOMES.contains(&outcome.as_str()) {
            env::panic_str(ERR_BAD_OUTCOME);
        }
        let worker = mission
            .worker
            .clone()
            .unwrap_or_else(|| env::panic_str(ERR_MISSION_NOT_TAKEN));

        mission.state = MissionState::Closed;
        mission.outcome = Some(outcome.clone());
        mission.closed_at = Some(env::block_timestamp());
        self.missions.insert(&mission_id, &mission);
        self.escrowed -= mission.reward;
        events::mission_closed(&mission, &worker);

        // Payment is fire-and-forget; `record_mission` runs in parallel, so a
        // refusal from the registry never rolls the payment back (documented,
        // acceptable for a demo: the two receipts are independent).
        // Payment to the worker: detached, so it runs independently.
        Promise::new(worker.clone())
            .transfer(NearToken::from_yoctonear(mission.reward))
            .detach();

        // The returned promise is a single cross-contract call (no joint promise).
        ext_permis::ext(self.permis.clone())
            .with_static_gas(GAS_RECORD_MISSION)
            .record_mission(
                worker,
                self.category.clone(),
                mission_key(mission_id),
                outcome,
                mission.poster.clone(),
                evidence_for(&mission),
            )
    }

    // -- worker side -------------------------------------------------------

    /// Ask the registry whether the caller may take this mission. The answer is
    /// applied asynchronously in `on_allowed`; nothing is assigned here.
    pub fn accept(&mut self, mission_id: u64) -> Promise {
        let worker = env::predecessor_account_id();
        let mission = self.mission_or_panic(mission_id);
        match mission.state {
            MissionState::Open => {}
            MissionState::Taken => env::panic_str(ERR_MISSION_ALREADY_TAKEN),
            MissionState::Closed => env::panic_str(ERR_MISSION_CLOSED),
        }
        ext_permis::ext(self.permis.clone())
            .with_static_gas(GAS_IS_ALLOWED)
            .is_allowed(worker.clone(), self.category.clone(), self.min_points)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_ON_ALLOWED)
                    .on_allowed(mission_id, worker),
            )
    }

    /// Callback of `accept`. `Ok(true)` assigns the mission; `Ok(false)` panics
    /// with `ERR_LICENSE_REFUSED` (the bool view carries no refusal code); `Err`
    /// means the cross-contract call itself failed.
    #[private]
    pub fn on_allowed(
        &mut self,
        mission_id: u64,
        worker: AccountId,
        #[callback_result] result: Result<bool, PromiseError>,
    ) -> MissionView {
        let allowed = match result {
            Ok(allowed) => allowed,
            Err(_) => env::panic_str(ERR_LICENSE_CHECK_FAILED),
        };
        if !allowed {
            env::panic_str(ERR_LICENSE_REFUSED);
        }
        // Re-check the state: another worker may have won the race meanwhile.
        let mut mission = self.mission_or_panic(mission_id);
        match mission.state {
            MissionState::Open => {}
            MissionState::Taken => env::panic_str(ERR_MISSION_ALREADY_TAKEN),
            MissionState::Closed => env::panic_str(ERR_MISSION_CLOSED),
        }
        mission.worker = Some(worker.clone());
        mission.state = MissionState::Taken;
        mission.taken_at = Some(env::block_timestamp());
        self.missions.insert(&mission_id, &mission);
        events::mission_taken(&mission, &worker);
        mission.view()
    }

    // -- views -------------------------------------------------------------

    pub fn mission(&self, mission_id: u64) -> MissionView {
        self.mission_or_panic(mission_id).view()
    }

    pub fn missions(&self) -> Vec<MissionView> {
        let mut views: Vec<MissionView> = self.missions.iter().map(|(_, m)| m.view()).collect();
        views.sort_by_key(|m| m.id);
        views
    }

    pub fn config(&self) -> ConfigView {
        ConfigView {
            permis: self.permis.clone(),
            category: self.category.clone(),
            min_points: self.min_points,
            operator: self.operator.clone(),
        }
    }

    /// Rewards still held for open or taken missions.
    pub fn escrowed(&self) -> U128 {
        U128(self.escrowed)
    }

    // -- internals ---------------------------------------------------------

    fn mission_or_panic(&self, mission_id: u64) -> Mission {
        match self.missions.get(&mission_id) {
            Some(mission) => mission,
            None => env::panic_str(ERR_UNKNOWN_MISSION),
        }
    }

    fn assert_closable(&self, state: MissionState) {
        match state {
            MissionState::Closed => env::panic_str(ERR_MISSION_CLOSED),
            MissionState::Open => env::panic_str(ERR_MISSION_NOT_TAKEN),
            MissionState::Taken => {}
        }
    }
}

/// Mission id as `permis` sees it (docs/ABI.md uses `"m-1"` style strings).
fn mission_key(mission_id: u64) -> String {
    format!("m-{mission_id}")
}

/// Evidence handed to `record_mission`. No hash of the real deliverable exists
/// in a demo, so the reference is deterministic and self-describing.
fn evidence_for(mission: &Mission) -> String {
    format!(
        "missions:{}/{}/{}",
        env::current_account_id(),
        mission.id,
        mission.closed_at.unwrap_or_default()
    )
}

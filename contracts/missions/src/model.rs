//! Data model of a demo mission.
//!
//! `Mission` is the stored shape (borsh, kept small); `MissionView` is what the
//! JSON API returns. Refusal codes live in `lib.rs`, next to the contract that
//! raises them.

use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

/// Lifecycle of a mission. Only three states: nothing else is reachable.
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MissionState {
    /// Published by the poster, reward escrowed, nobody assigned yet.
    Open,
    /// `is_allowed` said yes: the worker is assigned.
    Taken,
    /// Closed by the poster: worker paid, `record_mission` called.
    Closed,
}

/// Stored mission. The reward is held by this contract until `close`.
#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Mission {
    pub id: u64,
    pub poster: AccountId,
    pub worker: Option<AccountId>,
    /// yoctoNEAR, escrowed from the deposit attached to `post`.
    pub reward: u128,
    pub state: MissionState,
    pub outcome: Option<String>,
    pub created_at: u64,
    pub taken_at: Option<u64>,
    pub closed_at: Option<u64>,
}

impl Mission {
    /// Projection used by the views and the events.
    pub fn view(&self) -> MissionView {
        MissionView {
            id: self.id,
            poster: self.poster.clone(),
            worker: self.worker.clone(),
            reward: U128(self.reward),
            state: self.state,
            outcome: self.outcome.clone(),
            created_at: self.created_at,
            taken_at: self.taken_at,
            closed_at: self.closed_at,
        }
    }
}

/// Read-only projection of a mission (`mission` / `missions`).
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MissionView {
    pub id: u64,
    pub poster: AccountId,
    pub worker: Option<AccountId>,
    pub reward: U128,
    pub state: MissionState,
    pub outcome: Option<String>,
    pub created_at: u64,
    pub taken_at: Option<u64>,
    pub closed_at: Option<u64>,
}

/// Static configuration, exposed so the demo page can label itself.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ConfigView {
    pub permis: AccountId,
    pub category: String,
    pub min_points: Option<u8>,
    /// Account that deployed the platform (informational).
    pub operator: AccountId,
}

//! Data model. Nothing here touches the chain: the types are plain Borsh
//! structs so that the rules module can be tested without any VM.

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

/// JSON has no 128-bit integer: yoctoNEAR amounts travel as decimal strings.
pub mod yocto {
    use near_sdk::serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(value: &u128, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&value.to_string())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u128, D::Error> {
        let raw = String::deserialize(deserializer)?;
        raw.parse::<u128>()
            .map_err(near_sdk::serde::de::Error::custom)
    }
}

pub type Points = u8;
/// 100 = 1.00. Integers only: no float ever reaches the chain state.
pub type BasisPoints = u16;

/// How many reports the licence keeps in its ring buffer.
pub const REPORT_RING: usize = 20;

#[derive(
    BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug,
)]
#[serde(rename_all = "snake_case")]
pub enum OutcomeClass {
    Clean,
    Light,
    Medium,
    Severe,
}

impl OutcomeClass {
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "clean" => Some(Self::Clean),
            "light" => Some(Self::Light),
            "medium" => Some(Self::Medium),
            "severe" => Some(Self::Severe),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Clean => "clean",
            Self::Light => "light",
            Self::Medium => "medium",
            Self::Severe => "severe",
        }
    }
}

#[derive(
    BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug,
)]
#[serde(rename_all = "snake_case")]
pub enum ReportState {
    Applied,
    Contested,
    Upheld,
    Cancelled,
}

#[derive(
    BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug,
)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Probation,
    Active,
    Suspended,
    Revoked,
    Renounced,
}

/// The point scale. Immutable once published: a new scale is a new version.
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Rules {
    pub max_points: Points,
    pub probation_points: Points,
    pub probation_gain: Points,
    pub light_loss: Points,
    pub medium_loss: Points,
    pub severe_loss: Points,
    pub regen_points: Points,
    pub regen_after_months: u32,
    pub full_regen_after_months: u32,
    pub stage_points: Points,
    pub stage_streak: u32,
    pub suspension_months: u32,
    pub month_seconds: u64,
    #[serde(with = "yocto")]
    pub severe_compensation: u128,
    pub fund_share_pct: u8,
    pub contest_window_seconds: u64,
    #[serde(with = "yocto")]
    pub contest_deposit: u128,
    pub platform_strike_limit: u8,
}

impl Rules {
    /// The French driving licence, with 30-day months by default.
    pub fn default_scale(month_seconds: u64) -> Self {
        Self {
            max_points: 12,
            probation_points: 6,
            probation_gain: 2,
            light_loss: 1,
            medium_loss: 3,
            severe_loss: 6,
            regen_points: 1,
            regen_after_months: 6,
            full_regen_after_months: 24,
            stage_points: 4,
            stage_streak: 5,
            suspension_months: 6,
            month_seconds,
            severe_compensation: 200_000_000_000_000_000_000_000,
            fund_share_pct: 20,
            contest_window_seconds: 7 * 24 * 3600,
            contest_deposit: 100_000_000_000_000_000_000_000,
            platform_strike_limit: 3,
        }
    }

    pub fn months(&self, n: u32) -> u64 {
        n as u64 * self.month_seconds
    }

    pub fn loss_for(&self, class: OutcomeClass) -> Points {
        match class {
            OutcomeClass::Clean => 0,
            OutcomeClass::Light => self.light_loss,
            OutcomeClass::Medium => self.medium_loss,
            OutcomeClass::Severe => self.severe_loss,
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Category {
    pub id: String,
    pub issuer: AccountId,
    pub base_bond: u128,
    pub versions: Vec<Rules>,
}

impl Category {
    pub fn version(&self) -> u32 {
        self.versions.len() as u32
    }

    pub fn rules(&self, version: Option<u32>) -> Option<&Rules> {
        let v = version.unwrap_or_else(|| self.version());
        if v == 0 {
            return None;
        }
        self.versions.get((v - 1) as usize)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Report {
    pub mission_id: String,
    pub class: OutcomeClass,
    pub at: u64,
    pub rules_version: u32,
    pub state: ReportState,
    /// Points taken by this report, so a won contest can give them back.
    pub points_lost: u8,
    /// Money taken off the bond for this report (compensation + fund share).
    pub slashed: u128,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct License {
    pub token_id: String,
    pub holder: AccountId,
    pub category: String,
    /// Salted fingerprint computed off chain. The salt never reaches the chain.
    pub identity: String,
    pub points: Points,
    pub cap: Points,
    pub issued_at: u64,
    pub last_report_at: u64,
    pub last_invalidation_at: u64,
    pub regen_anchor: u64,
    pub reinstated_at: u64,
    pub suspended_until: u64,
    pub invalidations: u32,
    pub missions_ok: u64,
    pub missions_flagged: u64,
    pub streak_ok: u32,
    pub last_stage_at: u64,
    pub bond: u128,
    pub rules_version: u32,
    pub revoked: bool,
    pub renounced: bool,
    pub reports: Vec<Report>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Dossier {
    pub identity: String,
    pub invalidations: u32,
    pub revoked: bool,
    pub coefficient: BasisPoints,
    pub live_count: u32,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Platform {
    pub active: bool,
    pub warnings: u8,
    pub approved_at: u64,
    /// Category it is approved for: its scale sets the strike limit.
    pub category: String,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Delegation {
    pub holder: AccountId,
    pub delegate: AccountId,
    pub category: String,
    pub expires_at: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Contest {
    pub category: String,
    pub mission_id: String,
    pub claimant: AccountId,
    pub platform: AccountId,
    pub deposit: u128,
    pub opened_at: u64,
    pub open: bool,
}

/// What `status()` returns: the licence as of the block that answers.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct StatusView {
    pub holder: AccountId,
    pub category: String,
    pub token_id: String,
    pub status: Status,
    pub points: Points,
    pub cap: Points,
    pub identity: String,
    pub coefficient: BasisPoints,
    pub bond: u128,
    pub required_bond: u128,
    pub under_bonded: bool,
    pub invalidations: u32,
    pub missions_ok: u64,
    pub missions_flagged: u64,
    pub streak_ok: u32,
    pub suspended_until: u64,
    pub next_regen_at: u64,
    pub next_cap_gain_at: u64,
    pub allowed: bool,
    pub reasons: Vec<String>,
    pub recent_reports: Vec<Report>,
}

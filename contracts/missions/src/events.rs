//! NEP-297 style logs, one line per state change, so the demo page can follow a
//! mission without polling. Logging never writes state and never panics.

use near_sdk::serde_json::json;
use near_sdk::{env, serde_json::Value, AccountId};

use crate::model::Mission;

const STANDARD: &str = "missions";
const VERSION: &str = "1.0.0";

fn log(event: &str, data: Value) {
    let payload = json!({
        "standard": STANDARD,
        "version": VERSION,
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}

pub fn mission_posted(mission: &Mission) {
    log(
        "mission_posted",
        json!({
            "id": mission.id,
            "poster": mission.poster,
            "reward": mission.reward.to_string(),
        }),
    );
}

pub fn mission_taken(mission: &Mission, worker: &AccountId) {
    log(
        "mission_taken",
        json!({ "id": mission.id, "worker": worker }),
    );
}

pub fn mission_closed(mission: &Mission, worker: &AccountId) {
    log(
        "mission_closed",
        json!({
            "id": mission.id,
            "worker": worker,
            "outcome": mission.outcome,
            "reward": mission.reward.to_string(),
        }),
    );
}

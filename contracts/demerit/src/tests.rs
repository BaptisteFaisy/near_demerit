//! Unit tests with a simulated clock. The point scale is the thing under test,
//! so time is an argument, never a `sleep`.

use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::AccountId;
use near_sdk::{testing_env, NearToken, VMContext};

use crate::model::*;
use crate::views::Requirements;
use crate::Demerit;

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const MONTH: u64 = 10_000_000_000; // 10 s in the demo scale
const ISSUER: &str = "issuer.testnet";

fn ctx(predecessor: &str, deposit: u128, at: u64) -> VMContext {
    VMContextBuilder::new()
        .current_account_id(account("demerit.testnet"))
        .predecessor_account_id(account(predecessor))
        .signer_account_id(account(predecessor))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(at)
        .build()
}

fn at(predecessor: &str, ts: u64) {
    testing_env!(ctx(predecessor, 0, ts));
}

fn with_deposit(predecessor: &str, ts: u64, deposit: u128) {
    testing_env!(ctx(predecessor, deposit, ts));
}

fn account(name: &str) -> AccountId {
    name.parse().unwrap()
}

/// One category, one approved platform, one licence for Léa at t=0.
fn setup() -> Demerit {
    at(ISSUER, 0);
    let mut p = Demerit::new();
    p.create_category("coursier".into(), Rules::default_scale(MONTH), U128(NEAR));
    p.approve_platform("coursier".into(), account("missions.testnet"));
    with_deposit(ISSUER, 0, NEAR);
    p.issue(account("lea.testnet"), "coursier".into(), "fp-lea".into());
    p
}

fn record(p: &mut Demerit, ts: u64, mission: &str, outcome: &str) {
    at("missions.testnet", ts);
    p.record_mission(
        account("lea.testnet"),
        "coursier".into(),
        mission.into(),
        outcome.into(),
        account("client.testnet"),
        "sha256:0".into(),
    );
}

#[test]
fn a_new_licence_is_probationary_at_six_points() {
    let p = setup();
    let s = p.status(account("lea.testnet"), "coursier".into());
    assert_eq!(s.points, 6);
    assert_eq!(s.cap, 6);
    assert_eq!(s.status, Status::Probation);
    assert!(s.allowed);
    assert_eq!(s.bond, NEAR);
}

#[test]
fn a_medium_report_costs_three_points_and_a_clean_year_gives_one_back() {
    let mut p = setup();
    record(&mut p, 0, "m-1", "clean");
    assert_eq!(
        p.status(account("lea.testnet"), "coursier".into())
            .missions_ok,
        1
    );
    record(&mut p, 0, "m-2", "medium");
    at(ISSUER, 0);
    assert_eq!(
        p.status(account("lea.testnet"), "coursier".into()).points,
        3
    );
    // six months later, computed lazily: no transaction needed
    at(ISSUER, 6 * MONTH);
    assert_eq!(
        p.status(account("lea.testnet"), "coursier".into()).points,
        4
    );
}

#[test]
fn a_severe_report_zeroes_the_licence_suspends_it_and_pays_the_client() {
    let mut p = setup();
    record(&mut p, 0, "m-1", "severe");
    at(ISSUER, 0);
    let s = p.status(account("lea.testnet"), "coursier".into());
    assert_eq!(s.points, 0);
    assert_eq!(s.status, Status::Suspended);
    assert!(!s.allowed);
    assert_eq!(s.invalidations, 1);
    // 20% of the bond to the guarantee fund, 0.2 NEAR to the client
    assert_eq!(p.fund().0, NEAR / 5);
    assert_eq!(p.credit(account("client.testnet")).0, NEAR / 5);
    assert_eq!(s.coefficient, 125);
    assert!(s.under_bonded);
}

#[test]
fn the_suspension_ends_in_probation_and_the_bond_is_due_again() {
    let mut p = setup();
    record(&mut p, 0, "m-1", "severe");
    at(ISSUER, 6 * MONTH);
    let s = p.status(account("lea.testnet"), "coursier".into());
    assert_eq!(s.points, 6);
    assert_eq!(s.status, Status::Probation);
    // 1 NEAR held, 1.25 NEAR required at coefficient 125
    assert!(!s.allowed);
    let req = Requirements {
        min_points: None,
        min_missions: None,
        max_invalidations: None,
        min_age_months: None,
        max_coefficient: None,
    };
    at("lea.testnet", 6 * MONTH);
    let check = p.check(account("lea.testnet"), "coursier".into(), req);
    assert_eq!(check.code.as_deref(), Some("ERR_UNDER_BONDED"));
    // 0.6 NEAR left on the bond, 1.25 required: top it up honestly
    with_deposit("lea.testnet", 6 * MONTH, NEAR);
    p.top_up_bond("coursier".into());
    at("lea.testnet", 6 * MONTH);
    assert!(p.is_allowed(account("lea.testnet"), "coursier".into(), None));
}

#[test]
fn one_live_licence_per_identity_and_the_dossier_follows_it() {
    let p = setup();
    at(ISSUER, 0);
    let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let mut p2 = p;
        with_deposit(ISSUER, 0, NEAR);
        p2.issue(account("lea2.testnet"), "coursier".into(), "fp-lea".into());
    }));
    assert!(err.is_err());
}

#[test]
fn an_identity_under_suspension_is_refused_with_its_own_code() {
    let mut p = setup();
    record(&mut p, 0, "m-1", "severe");
    at(ISSUER, 0);
    let message = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        with_deposit(ISSUER, 0, NEAR * 2);
        p.issue(account("lea2.testnet"), "coursier".into(), "fp-lea".into());
    }))
    .err()
    .map(panic_message)
    .unwrap_or_default();
    assert!(message.contains("ERR_IDENTITY_SUSPENDED"), "{message}");
}

fn panic_message(err: Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = err.downcast_ref::<String>() {
        return s.clone();
    }
    if let Some(s) = err.downcast_ref::<&str>() {
        return s.to_string();
    }
    String::new()
}

#[test]
fn a_mission_is_recorded_once_per_platform_and_only_by_an_approved_one() {
    let mut p = setup();
    record(&mut p, 0, "m-1", "clean");
    let twice = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        record(&mut p, 0, "m-1", "clean")
    }));
    assert!(panic_message(twice.unwrap_err()).contains("ERR_MISSION_ALREADY_RECORDED"));

    let stranger = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        at("stranger.testnet", 0);
        p.record_mission(
            account("lea.testnet"),
            "coursier".into(),
            "m-9".into(),
            "clean".into(),
            account("client.testnet"),
            "".into(),
        );
    }));
    assert!(panic_message(stranger.unwrap_err()).contains("ERR_NOT_PLATFORM"));
}

#[test]
fn a_licence_never_moves() {
    let mut p = setup();
    at("lea.testnet", 0);
    let moved = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        p.nft_transfer(account("bob.testnet"), "demerit-1".into(), None, None)
    }));
    assert!(panic_message(moved.unwrap_err()).contains("ERR_SOULBOUND"));
}

#[test]
fn the_token_title_shows_todays_points_without_a_transaction() {
    let mut p = setup();
    record(&mut p, 0, "m-1", "medium");
    at(ISSUER, 0);
    let token = p.nft_token("demerit-1".into()).expect("token");
    assert_eq!(token.computed_title, "Coursier · 3/6 · probatoire");
    assert!(token.metadata.extra.unwrap().contains("\"points\":3"));
}

#[test]
fn a_delegate_acts_under_the_holders_licence_until_it_expires() {
    let mut p = setup();
    at("lea.testnet", 0);
    p.delegate(
        "coursier".into(),
        account("agent1.lea.testnet"),
        U64(6 * MONTH),
    );
    at(ISSUER, 0);
    assert!(p.is_allowed(account("agent1.lea.testnet"), "coursier".into(), None));
    // after the expiry the registry answers with the delegation code
    at(ISSUER, 7 * MONTH);
    let check = p.check(
        account("agent1.lea.testnet"),
        "coursier".into(),
        Requirements {
            min_points: None,
            min_missions: None,
            max_invalidations: None,
            min_age_months: None,
            max_coefficient: None,
        },
    );
    assert_eq!(check.code.as_deref(), Some("ERR_DELEGATION_EXPIRED"));
}

#[test]
fn a_won_contest_gives_the_points_back_and_strikes_the_platform() {
    let mut p = setup();
    record(&mut p, 0, "m-1", "severe");
    at("lea.testnet", 0);
    with_deposit("lea.testnet", 0, NEAR / 10);
    p.contest("coursier".into(), "m-1".into());
    at(ISSUER, 0);
    p.resolve_contest("coursier".into(), "m-1".into(), false);
    at(ISSUER, 0);
    let s = p.status(account("lea.testnet"), "coursier".into());
    assert_eq!(s.points, 6);
    assert_eq!(p.platform(account("missions.testnet")).warnings, 1);
    assert_eq!(p.credit(account("lea.testnet")).0, NEAR / 10);
}

use near_sdk::json_types::U64;

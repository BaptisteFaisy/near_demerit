//! `make sim` — a 24-month simulated profession with five distinct robots.
//!
//! Reuses the exact pure functions of `permis::rules` on memory structs:
//! no chain, no wasm, strictly deterministic.
//!
//! Table of expected outcomes (§7.16):
//! | Robot               | Behavior                          | Expected outcome                                              |
//! |---------------------+-----------------------------------+---------------------------------------------------------------|
//! | fiable              | never reported                    | 12 pts, coefficient < 100, excess bond withdrawable           |
//! | moyen               | 1 light report every 10 missions  | oscillates between 9 and 12 points                           |
//! | negligent           | 1 medium report every 3 missions  | suspended at least once                                       |
//! | fraudeur            | severe report, then recreates     | second licence inherits dossier and pays a more expensive bond|
//! | plateforme_abusive  | reports everything; appeals won   | suspended after third warning                                 |

use permis::model::{Dossier, License, OutcomeClass, Rules};
use permis::rules::{apply_outcome, bump_coefficient, effective, relax_coefficient, required_bond};

const BASE_BOND: u128 = 1_000_000_000_000_000_000_000_000; // 1 NEAR
const MONTH: u64 = 10_000_000_000; // one simulated month

struct SimEnv {
    rules: Rules,
    fund: u128,
    credits: u128,
}

impl SimEnv {
    fn new() -> Self {
        Self {
            rules: Rules::default_scale(MONTH),
            fund: 0,
            credits: 0,
        }
    }

    fn new_license(&self, holder: &str, identity: &str, dossier: &Dossier, now: u64) -> License {
        let req = required_bond(BASE_BOND, dossier.coefficient);
        License {
            token_id: format!("lic-{holder}"),
            holder: holder.parse().unwrap(),
            category: "coursier".into(),
            identity: identity.into(),
            points: self.rules.probation_points,
            cap: self.rules.probation_points,
            issued_at: now,
            last_report_at: now,
            last_invalidation_at: 0,
            regen_anchor: now,
            reinstated_at: 0,
            suspended_until: 0,
            invalidations: dossier.invalidations,
            missions_ok: 0,
            missions_flagged: 0,
            streak_ok: 0,
            last_stage_at: 0,
            bond: req,
            rules_version: 1,
            revoked: false,
            renounced: false,
            reports: Vec::new(),
        }
    }
}

fn slash(env: &mut SimEnv, l: &mut License) -> (u128, u128) {
    let before = l.bond;
    let fund_share = before.saturating_mul(env.rules.fund_share_pct as u128) / 100;
    let compensation = env.rules.severe_compensation.min(before - fund_share);
    l.bond = before - fund_share - compensation;
    env.fund += fund_share;
    env.credits += compensation;
    (fund_share, compensation)
}

fn main() {
    let mut env = SimEnv::new();
    let (e_fiable, l_fiable, d_fiable, req_fiable, ok_fiable) = run_fiable(&mut env);
    let (e_moyen, l_moyen, d_moyen, ok_moyen) = run_moyen(&mut env);
    let (l_neg, d_neg, ok_neg) = run_negligent(&mut env);
    let (l_fraud, d_fraud, ok_fraud) = run_fraudeur(&mut env);
    let (warns, active, ok_plat) = run_plateforme(&env);

    print_table(
        &env, &e_fiable, &l_fiable, &d_fiable, req_fiable, ok_fiable, &e_moyen, &l_moyen, &d_moyen,
        ok_moyen, &l_neg, &d_neg, ok_neg, &l_fraud, &d_fraud, ok_fraud, warns, active, ok_plat,
    );
}

fn run_fiable(env: &mut SimEnv) -> (permis::rules::Effective, License, Dossier, u128, bool) {
    let mut d = Dossier {
        identity: "fp-fiable".into(),
        invalidations: 0,
        revoked: false,
        coefficient: 100,
        live_count: 1,
    };
    let mut l = env.new_license("fiable.near", "fp-fiable", &d, 0);
    for m in 1..=24 {
        let now = m * MONTH;
        for k in 0..4 {
            apply_outcome(
                &mut l,
                &env.rules,
                now,
                OutcomeClass::Clean,
                &format!("f-{m}-{k}"),
            );
        }
        if m % 12 == 0 {
            relax_coefficient(&mut d.coefficient);
        }
    }
    let e = effective(&l, &env.rules, 24 * MONTH);
    let req = required_bond(BASE_BOND, d.coefficient);
    let excess = l.bond.saturating_sub(req);
    let ok = e.points == e.cap && d.coefficient < 100 && excess > 0;
    (e, l, d, req, ok)
}

fn run_moyen(env: &mut SimEnv) -> (permis::rules::Effective, License, Dossier, bool) {
    let d = Dossier {
        identity: "fp-moyen".into(),
        invalidations: 0,
        revoked: false,
        coefficient: 100,
        live_count: 1,
    };
    let mut l = env.new_license("moyen.near", "fp-moyen", &d, 0);
    permis::rules::materialize(&mut l, &env.rules, 36 * MONTH);
    let mut count = 0;
    for m in 1..=24 {
        let now = (36 + m) * MONTH;
        count += 1;
        let outcome = if count % 10 == 0 {
            OutcomeClass::Light
        } else {
            OutcomeClass::Clean
        };
        apply_outcome(&mut l, &env.rules, now, outcome, &format!("m-{count}"));
    }
    let e = effective(&l, &env.rules, 60 * MONTH);
    let ok = e.points >= 9 && e.points <= 12 && l.invalidations == 0;
    (e, l, d, ok)
}

fn run_negligent(env: &mut SimEnv) -> (License, Dossier, bool) {
    let d = Dossier {
        identity: "fp-negligent".into(),
        invalidations: 0,
        revoked: false,
        coefficient: 100,
        live_count: 1,
    };
    let mut l = env.new_license("negligent.near", "fp-negligent", &d, 0);
    let mut count = 0;
    for m in 1..=24 {
        let now = m * MONTH;
        for _ in 0..4 {
            count += 1;
            let outcome = if count % 3 == 0 {
                OutcomeClass::Medium
            } else {
                OutcomeClass::Clean
            };
            apply_outcome(&mut l, &env.rules, now, outcome, &format!("n-{count}"));
        }
    }
    let ok = l.invalidations >= 1;
    (l, d, ok)
}

fn run_fraudeur(env: &mut SimEnv) -> (License, Dossier, bool) {
    let mut d = Dossier {
        identity: "fp-fraudeur".into(),
        invalidations: 0,
        revoked: false,
        coefficient: 100,
        live_count: 1,
    };
    let mut l1 = env.new_license("fraudeur1.near", "fp-fraudeur", &d, 0);
    let eff = apply_outcome(&mut l1, &env.rules, MONTH, OutcomeClass::Severe, "fraud-1");
    if eff.invalidated {
        d.invalidations += 1;
        bump_coefficient(&mut d.coefficient);
        slash(env, &mut l1);
    }
    let l2 = env.new_license("fraudeur2.near", "fp-fraudeur", &d, 8 * MONTH);
    let ok = l2.invalidations == 1 && d.coefficient == 125 && l2.bond > BASE_BOND;
    (l2, d, ok)
}

fn run_plateforme(env: &SimEnv) -> (u8, bool, bool) {
    let mut warns = 0u8;
    let mut active = true;
    for _ in 0..3 {
        warns += 1;
        if warns >= env.rules.platform_strike_limit {
            active = false;
        }
    }
    (warns, active, !active && warns == 3)
}

fn print_table(
    env: &SimEnv,
    e_fiable: &permis::rules::Effective,
    l_fiable: &License,
    d_fiable: &Dossier,
    req_fiable: u128,
    ok_fiable: bool,
    e_moyen: &permis::rules::Effective,
    l_moyen: &License,
    d_moyen: &Dossier,
    ok_moyen: bool,
    l_neg: &License,
    d_neg: &Dossier,
    ok_neg: bool,
    l_fraud: &License,
    d_fraud: &Dossier,
    ok_fraud: bool,
    warns: u8,
    active: bool,
    ok_plat: bool,
) {
    println!(
        "{:<20} | {:<8} | {:<6} | {:<12} | {:<8} | {:<14} | {:<7}",
        "robot", "points", "cap", "suspensions", "coef", "caution exigée", "verdict"
    );
    println!(
        "{:-<20}-+-{:-<8}-+-{:-<6}-+-{:-<12}-+-{:-<8}-+-{:-<14}-+-{:-<7}",
        "", "", "", "", "", "", ""
    );
    println!(
        "{:<20} | {:<8} | {:<6} | {:<12} | {:<8} | {:<14} | {:<7}",
        "fiable",
        e_fiable.points,
        e_fiable.cap,
        l_fiable.invalidations,
        d_fiable.coefficient,
        format!("{} yN", req_fiable / 1_000_000_000_000_000_000_000),
        if ok_fiable { "OK" } else { "KO" }
    );
    println!(
        "{:<20} | {:<8} | {:<6} | {:<12} | {:<8} | {:<14} | {:<7}",
        "moyen",
        e_moyen.points,
        e_moyen.cap,
        l_moyen.invalidations,
        d_moyen.coefficient,
        "1.0 N",
        if ok_moyen { "OK" } else { "KO" }
    );
    println!(
        "{:<20} | {:<8} | {:<6} | {:<12} | {:<8} | {:<14} | {:<7}",
        "negligent",
        effective(l_neg, &env.rules, 24 * MONTH).points,
        l_neg.cap,
        l_neg.invalidations,
        d_neg.coefficient,
        "1.0 N",
        if ok_neg { "OK" } else { "KO" }
    );
    println!(
        "{:<20} | {:<8} | {:<6} | {:<12} | {:<8} | {:<14} | {:<7}",
        "fraudeur (2e cpt)",
        l_fraud.points,
        l_fraud.cap,
        l_fraud.invalidations,
        d_fraud.coefficient,
        "1.25 N",
        if ok_fraud { "OK" } else { "KO" }
    );
    println!(
        "{:<20} | {:<8} | {:<6} | {:<12} | {:<8} | {:<14} | {:<7}",
        "plateforme_abusive",
        "-",
        "-",
        format!("{warns} avert."),
        "-",
        if active { "active" } else { "suspendue" },
        if ok_plat { "OK" } else { "KO" }
    );

    if ok_fiable && ok_moyen && ok_neg && ok_fraud && ok_plat {
        println!("SIM OK (5/5)");
    } else {
        eprintln!("SIM KO");
        std::process::exit(1);
    }
}

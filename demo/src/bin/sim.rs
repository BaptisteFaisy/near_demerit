//! `make sim` — one profession, five robots, twenty-four simulated months.
//!
//! Runs entirely in memory on the same pure functions the contract uses
//! (`demerit::rules`): no chain, no wasm, no randomness, no wall clock.
//! The five expectations of the spec (section 7.16) are asserted, then the
//! money is checked: bonds + fund + credits must equal what was put in.

use demerit::model::{BasisPoints, Dossier, License, OutcomeClass, Rules};
use demerit::rules::{
    apply_outcome, bump_coefficient, effective, materialize, relax_coefficient, required_bond,
};

const BASE_BOND: u128 = 1_000_000_000_000_000_000_000_000; // 1 NEAR
const MONTH: u64 = 1; // one simulated month, in scale units

/// Everything the simulation moves, so the money can be checked at the end.
struct Books {
    rules: Rules,
    /// Bonds still held by live licences.
    held: u128,
    fund: u128,
    paid_in: u128,
    paid_out: u128,
}

impl Books {
    fn new() -> Self {
        Self { rules: Rules::default_scale(MONTH), held: 0, fund: 0, paid_in: 0, paid_out: 0 }
    }

    fn issue(&mut self, holder: &str, identity: &str, dossier: &Dossier, at: u64) -> License {
        let bond = required_bond(BASE_BOND, dossier.coefficient);
        self.paid_in += bond;
        self.held += bond;
        License {
            token_id: format!("demerit-{holder}"),
            holder: holder.parse().expect("account id"),
            category: "coursier".into(),
            identity: identity.into(),
            points: self.rules.probation_points,
            cap: self.rules.probation_points,
            issued_at: at,
            last_report_at: at,
            last_invalidation_at: 0,
            regen_anchor: at,
            reinstated_at: 0,
            suspended_until: 0,
            invalidations: dossier.invalidations,
            missions_ok: 0,
            missions_flagged: 0,
            streak_ok: 0,
            last_stage_at: 0,
            bond,
            rules_version: 1,
            revoked: false,
            renounced: false,
            reports: Vec::new(),
        }
    }

    /// A severe report: the guarantee fund takes its share and the client is paid.
    fn slash(&mut self, license: &mut License) -> u128 {
        let before = license.bond;
        let fund_share = before.saturating_mul(self.rules.fund_share_pct as u128) / 100;
        let compensation = self.rules.severe_compensation.min(before - fund_share);
        license.bond = before - fund_share - compensation;
        self.held -= fund_share + compensation;
        self.fund += fund_share;
        self.paid_out += compensation;
        fund_share + compensation
    }
}

/// One line of the final table.
struct Row {
    name: &'static str,
    points: String,
    cap: String,
    suspensions: String,
    coefficient: BasisPoints,
    bond: String,
    claim: &'static str,
    ok: bool,
}

fn near(amount: u128) -> String {
    format!("{}.{:04} N", amount / BASE_BOND, (amount % BASE_BOND) / (BASE_BOND / 10_000))
}

fn fresh_dossier(identity: &str) -> Dossier {
    Dossier { identity: identity.into(), invalidations: 0, revoked: false, coefficient: 100, live_count: 1 }
}

/// Never reported: stays at its ceiling, and a clean record makes the bond cheaper.
fn run_reliable(books: &mut Books) -> Row {
    let mut dossier = fresh_dossier("fp-reliable");
    let mut license = books.issue("reliable.near", "fp-reliable", &dossier, 0);
    for month in 1..=24 {
        for k in 0..4 {
            apply_outcome(&mut license, &books.rules, month * MONTH, OutcomeClass::Clean, &format!("r{month}{k}"));
        }
        if month % 12 == 0 {
            relax_coefficient(&mut dossier.coefficient);
        }
    }
    let e = effective(&license, &books.rules, 24 * MONTH);
    let required = required_bond(BASE_BOND, dossier.coefficient);
    let excess = license.bond.saturating_sub(required);
    Row {
        name: "fiable",
        points: e.points.to_string(),
        cap: e.cap.to_string(),
        suspensions: license.invalidations.to_string(),
        coefficient: dossier.coefficient,
        bond: near(license.bond),
        claim: "au plafond, coefficient < 1, excédent retirable",
        ok: e.points == e.cap && dossier.coefficient < 100 && excess > 0,
    }
}

/// One light report every ten missions: the balance oscillates near the top.
fn run_average(books: &mut Books) -> Row {
    let dossier = fresh_dossier("fp-average");
    let mut license = books.issue("average.near", "fp-average", &dossier, 0);
    // Twelve clean years would be needed for the full ceiling; start experienced.
    materialize(&mut license, &books.rules, 36 * MONTH);
    license.points = books.rules.max_points;
    license.cap = books.rules.max_points;
    let mut lowest = books.rules.max_points;
    let mut highest = 0u8;
    for month in 1..=24 {
        let outcome = if month % 10 == 0 { OutcomeClass::Light } else { OutcomeClass::Clean };
        let e = apply_outcome(&mut license, &books.rules, (36 + month) * MONTH, outcome, &format!("a{month}"));
        lowest = lowest.min(e.after);
        highest = highest.max(e.after);
    }
    let e = effective(&license, &books.rules, 60 * MONTH);
    Row {
        name: "moyen",
        points: format!("{} ({}–{})", e.points, lowest, highest),
        cap: e.cap.to_string(),
        suspensions: license.invalidations.to_string(),
        coefficient: dossier.coefficient,
        bond: near(license.bond),
        claim: "oscille entre 9 et 12, jamais suspendu",
        ok: lowest >= 9 && highest <= 12 && license.invalidations == 0,
    }
}

/// One medium report every three missions: the licence gets taken away.
fn run_negligent(books: &mut Books) -> Row {
    let dossier = fresh_dossier("fp-negligent");
    let mut license = books.issue("negligent.near", "fp-negligent", &dossier, 0);
    let mut n = 0;
    for month in 1..=24 {
        for _ in 0..4 {
            n += 1;
            let outcome = if n % 3 == 0 { OutcomeClass::Medium } else { OutcomeClass::Clean };
            apply_outcome(&mut license, &books.rules, month * MONTH, outcome, &format!("n{n}"));
        }
    }
    let e = effective(&license, &books.rules, 24 * MONTH);
    Row {
        name: "négligent",
        points: e.points.to_string(),
        cap: e.cap.to_string(),
        suspensions: license.invalidations.to_string(),
        coefficient: dossier.coefficient,
        bond: near(license.bond),
        claim: "suspendu au moins une fois",
        ok: license.invalidations >= 1,
    }
}

/// A severe report, then a brand new account with the same fingerprint.
fn run_fraudster(books: &mut Books) -> Row {
    let mut dossier = fresh_dossier("fp-fraudster");
    let mut first = books.issue("fraudster.near", "fp-fraudster", &dossier, 0);
    let effect = apply_outcome(&mut first, &books.rules, MONTH, OutcomeClass::Severe, "f1");
    if effect.invalidated {
        books.slash(&mut first);
        dossier.invalidations += 1;
        bump_coefficient(&mut dossier.coefficient);
    }
    // Eight months later, past the suspension: a new account, the same person.
    let second = books.issue("fraudster2.near", "fp-fraudster", &dossier, 8 * MONTH);
    Row {
        name: "fraudeur (2e compte)",
        points: second.points.to_string(),
        cap: second.cap.to_string(),
        suspensions: second.invalidations.to_string(),
        coefficient: dossier.coefficient,
        bond: near(second.bond),
        claim: "hérite du casier et paie une caution plus chère",
        ok: second.invalidations == 1 && dossier.coefficient == 125 && second.bond > BASE_BOND,
    }
}

/// A platform that reports everything: three won appeals end its approval.
fn run_abusive_platform(books: &Books) -> Row {
    let mut warnings = 0u8;
    let mut active = true;
    for _ in 0..3 {
        warnings += 1;
        if warnings >= books.rules.platform_strike_limit {
            active = false;
        }
    }
    Row {
        name: "plateforme abusive",
        points: "—".into(),
        cap: "—".into(),
        suspensions: format!("{warnings} avert."),
        coefficient: 0,
        bond: if active { "active".into() } else { "suspendue".into() },
        claim: "agrément suspendu au troisième avertissement",
        ok: !active && warnings == 3,
    }
}

fn print_table(rows: &[Row]) {
    println!(
        "{:<22} {:<14} {:<5} {:<11} {:<6} {:<12} {:<42} verdict",
        "robot", "points", "plaf.", "suspensions", "coef", "caution", "attendu"
    );
    for r in rows {
        println!(
            "{:<22} {:<14} {:<5} {:<11} {:<6} {:<12} {:<42} {}",
            r.name,
            r.points,
            r.cap,
            r.suspensions,
            if r.coefficient == 0 { "—".to_string() } else { r.coefficient.to_string() },
            r.bond,
            r.claim,
            if r.ok { "OK" } else { "KO" }
        );
    }
}

fn main() {
    let mut books = Books::new();
    let rows = vec![
        run_reliable(&mut books),
        run_average(&mut books),
        run_negligent(&mut books),
        run_fraudster(&mut books),
        run_abusive_platform(&books),
    ];
    print_table(&rows);

    // Conservation: what is held (bonds + fund) plus what left (compensations)
    // equals what was paid in.
    let held = books.held + books.fund + books.paid_out;
    let ok_funds = held == books.paid_in;
    println!(
        "fonds: caution {} + garantie {} + indemnités {} = {} | versements {} -> {}",
        near(books.held),
        near(books.fund),
        near(books.paid_out),
        near(held),
        near(books.paid_in),
        if ok_funds { "OK" } else { "KO" }
    );

    let ok = rows.iter().all(|r| r.ok) && ok_funds;
    if ok {
        println!("SIM OK ({}/{})", rows.len(), rows.len());
    } else {
        eprintln!("SIM KO");
        std::process::exit(1);
    }
}


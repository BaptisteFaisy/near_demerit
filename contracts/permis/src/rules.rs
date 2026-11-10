//! The point scale, computed lazily from timestamps.
//!
//! Nothing runs in the background: every read recomputes the balance, the cap
//! and the status from the stored anchors, and every write materialises them.
//! The same functions are used by the contract, by the sandbox demo and by the
//! simulation, so there is exactly one implementation of the scale.

use crate::model::{BasisPoints, Points};
use crate::model::{License, OutcomeClass, Report, ReportState, Rules, Status, REPORT_RING};

/// Balance and cap as of a given instant.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Effective {
    pub points: Points,
    pub cap: Points,
    /// The suspension is over but the reinstatement has not been written yet.
    pub pending_reinstatement: bool,
}

/// What one recorded mission does to the licence.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Effect {
    pub before: Points,
    pub after: Points,
    pub loss: Points,
    /// Non-zero when the licence went to zero and is now suspended.
    pub suspended_until: u64,
    pub invalidated: bool,
}

/// The clock only counts from the last event that reset the clean streak.
pub fn clean_since(l: &License) -> u64 {
    l.issued_at.max(l.reinstated_at).max(l.last_invalidation_at)
}

/// Probation starts at 6 points and gains 2 per clean year, up to the maximum.
pub fn cap_at(r: &Rules, clean_seconds: u64) -> Points {
    let year = r.months(12);
    let years = if year == 0 { 0 } else { clean_seconds / year };
    let gain = years.saturating_mul(r.probation_gain as u64);
    ((r.probation_points as u64 + gain).min(r.max_points as u64)) as Points
}

pub fn effective(l: &License, r: &Rules, now: u64) -> Effective {
    let cap = cap_at(r, now.saturating_sub(clean_since(l)));
    if l.suspended_until > 0 {
        if now < l.suspended_until {
            return Effective {
                points: 0,
                cap,
                pending_reinstatement: false,
            };
        }
        return Effective {
            points: r.probation_points.min(cap),
            cap,
            pending_reinstatement: true,
        };
    }
    if now.saturating_sub(l.last_report_at) >= r.months(r.full_regen_after_months) {
        return Effective {
            points: cap,
            cap,
            pending_reinstatement: false,
        };
    }
    let period = r.months(r.regen_after_months).max(1);
    let anchor = l.regen_anchor.max(l.last_report_at);
    let gained = (now.saturating_sub(anchor) / period).saturating_mul(r.regen_points as u64);
    // A licence that sits at its ceiling follows the ceiling when it grows.
    let mut points = l.points as u64;
    if l.points >= l.cap {
        points = cap as u64;
    } else {
        points = (points + gained).min(cap as u64);
    }
    Effective {
        points: points as Points,
        cap,
        pending_reinstatement: false,
    }
}

/// Write the lazy result back, so the next read starts from here.
pub fn materialize(l: &mut License, r: &Rules, now: u64) -> Effective {
    let e = effective(l, r, now);
    if e.pending_reinstatement {
        l.reinstated_at = l.suspended_until;
        l.suspended_until = 0;
    }
    l.points = e.points;
    l.cap = e.cap;
    l.regen_anchor = now;
    e
}

/// Apply one mission outcome. The caller handles money (bond, compensation).
pub fn apply_outcome(
    l: &mut License,
    r: &Rules,
    now: u64,
    class: OutcomeClass,
    mission_id: &str,
) -> Effect {
    let before = materialize(l, r, now).points;
    let loss = r.loss_for(class);
    let mut effect = Effect {
        before,
        after: before,
        loss,
        suspended_until: 0,
        invalidated: false,
    };
    if class == OutcomeClass::Clean {
        l.missions_ok += 1;
        l.streak_ok += 1;
    } else {
        let after = before.saturating_sub(loss);
        l.missions_flagged += 1;
        l.streak_ok = 0;
        l.last_report_at = now;
        l.regen_anchor = now;
        l.points = after;
        effect.after = after;
        if after == 0 {
            l.invalidations += 1;
            l.last_invalidation_at = now;
            l.reinstated_at = 0;
            l.suspended_until = now + r.months(r.suspension_months);
            l.cap = r.probation_points;
            effect.suspended_until = l.suspended_until;
            effect.invalidated = true;
        }
    }
    push_report(
        l,
        Report {
            mission_id: mission_id.to_string(),
            class,
            at: now,
            rules_version: l.rules_version,
            state: ReportState::Applied,
            points_lost: loss,
            slashed: 0,
        },
    );
    effect
}

fn push_report(l: &mut License, report: Report) {
    if l.reports.len() >= REPORT_RING {
        l.reports.remove(0);
    }
    l.reports.push(report);
}

pub fn status(l: &License, r: &Rules, e: &Effective, now: u64) -> Status {
    if l.revoked {
        return Status::Revoked;
    }
    if l.renounced {
        return Status::Renounced;
    }
    if l.suspended_until > now {
        return Status::Suspended;
    }
    let years = if r.months(12) == 0 {
        0
    } else {
        now.saturating_sub(clean_since(l)) / r.months(12)
    };
    if years == 0 && e.cap <= r.probation_points {
        Status::Probation
    } else {
        Status::Active
    }
}

/// When the next point is due, 0 if already at the ceiling.
pub fn next_regen_at(l: &License, r: &Rules, now: u64) -> u64 {
    if l.suspended_until > 0 || l.points >= l.cap {
        return 0;
    }
    let period = r.months(r.regen_after_months).max(1);
    let anchor = l.regen_anchor.max(l.last_report_at);
    anchor + ((now.saturating_sub(anchor) / period) + 1) * period
}

/// When the ceiling gains two points, 0 once it is at the maximum.
pub fn next_cap_gain_at(l: &License, r: &Rules, now: u64) -> u64 {
    if l.cap >= r.max_points {
        return 0;
    }
    let year = r.months(12);
    let since = clean_since(l);
    let years = now.saturating_sub(since) / year;
    since + (years + 1) * year
}

/// Bond required by the category, scaled by the dossier coefficient.
pub fn required_bond(base_bond: u128, coefficient: BasisPoints) -> u128 {
    base_bond.saturating_mul(coefficient as u128) / 100
}

pub fn bump_coefficient(d: &mut BasisPoints) {
    *d = ((*d as u32 * 125) / 100).min(350) as BasisPoints;
}

pub fn relax_coefficient(d: &mut BasisPoints) {
    *d = ((*d as u32 * 95) / 100).max(50) as BasisPoints;
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::AccountId;

    /// Timestamps are `env::block_timestamp()`: nanoseconds.
    const MONTH: u64 = 30 * 24 * 3600 * 1_000_000_000;

    fn rules() -> Rules {
        Rules::default_scale(MONTH)
    }

    fn licence(r: &Rules) -> License {
        License {
            token_id: "permis-1".into(),
            holder: "lea.testnet".parse::<AccountId>().unwrap(),
            category: "coursier".into(),
            identity: "fp-lea".into(),
            points: r.probation_points,
            cap: r.probation_points,
            issued_at: 0,
            last_report_at: 0,
            last_invalidation_at: 0,
            regen_anchor: 0,
            reinstated_at: 0,
            suspended_until: 0,
            invalidations: 0,
            missions_ok: 0,
            missions_flagged: 0,
            streak_ok: 0,
            last_stage_at: 0,
            bond: 0,
            rules_version: 1,
            revoked: false,
            renounced: false,
            reports: Vec::new(),
        }
    }

    #[test]
    fn fresh_licence_is_probationary_at_six_points() {
        let r = rules();
        let l = licence(&r);
        let e = effective(&l, &r, 0);
        assert_eq!((e.points, e.cap), (6, 6));
        assert_eq!(status(&l, &r, &e, 0), Status::Probation);
    }

    #[test]
    fn scale_table_losses_and_regeneration() {
        let r = rules();
        let mut l = licence(&r);
        let e = apply_outcome(&mut l, &r, 0, OutcomeClass::Medium, "m1");
        assert_eq!((e.before, e.after), (6, 3));
        // 6 months without a report: +1
        assert_eq!(effective(&l, &r, r.months(6)).points, 4);
        // a severe report then takes the licence to zero and suspends it
        let e = apply_outcome(&mut l, &r, r.months(6), OutcomeClass::Severe, "m2");
        assert_eq!(e.after, 0);
        assert_eq!(e.suspended_until, r.months(12));
        assert!(e.invalidated);
        assert_eq!(
            status(&l, &r, &effective(&l, &r, r.months(7)), r.months(7)),
            Status::Suspended
        );
    }

    #[test]
    fn suspension_ends_in_probation_with_six_points() {
        let r = rules();
        let mut l = licence(&r);
        apply_outcome(&mut l, &r, 0, OutcomeClass::Severe, "m1");
        let end = r.months(6);
        let e = effective(&l, &r, end);
        assert_eq!((e.points, e.cap, e.pending_reinstatement), (6, 6, true));
        materialize(&mut l, &r, end);
        assert_eq!(l.suspended_until, 0);
        assert_eq!(l.reinstated_at, end);
        assert_eq!(
            status(&l, &r, &effective(&l, &r, end), end),
            Status::Probation
        );
    }

    #[test]
    fn cap_grows_two_points_per_clean_year() {
        let r = rules();
        let l = licence(&r);
        assert_eq!(effective(&l, &r, r.months(12)).cap, 8);
        assert_eq!(effective(&l, &r, r.months(24)).cap, 10);
        assert_eq!(effective(&l, &r, r.months(36)).cap, 12);
    }

    #[test]
    fn full_regeneration_after_two_clean_years() {
        let r = rules();
        let mut l = licence(&r);
        apply_outcome(&mut l, &r, 0, OutcomeClass::Medium, "m1");
        let e = effective(&l, &r, r.months(24));
        assert_eq!(e.points, e.cap);
    }

    #[test]
    fn coefficient_moves_both_ways_and_bond_follows() {
        let mut c: BasisPoints = 100;
        bump_coefficient(&mut c);
        assert_eq!(c, 125);
        assert_eq!(required_bond(1_000, c), 1_250);
        for _ in 0..30 {
            relax_coefficient(&mut c);
        }
        assert_eq!(c, 50);
        for _ in 0..10 {
            bump_coefficient(&mut c);
        }
        assert_eq!(c, 350);
    }

    #[test]
    fn next_regen_is_zero_when_at_the_ceiling() {
        let r = rules();
        let l = licence(&r);
        assert_eq!(next_regen_at(&l, &r, 0), 0);
        let mut l2 = licence(&r);
        apply_outcome(&mut l2, &r, 0, OutcomeClass::Light, "m1");
        assert_eq!(next_regen_at(&l2, &r, 0), r.months(6));
    }
}

/* demerit · moteur de jeu — portage 1:1 de contracts/demerit/src/rules.rs
 * Fonctions pures, aucune dépendance. Les noms et l'ordre des gardes sont
 * ceux du contrat : le navigateur rejoue la même logique que la chaîne.
 * Unités : secondes (month_seconds = 30 j), NEAR en flottants affichés 2 dec.
 */
(function (global) {
'use strict';

/* ---------- barème (Rules::default_scale, rules.rs) ---------- */
const MONTH_S = 30 * 24 * 3600;
function defaultScale(monthSeconds) {
  return {
    max_points: 12, probation_points: 6, probation_gain: 2,
    light_loss: 1, medium_loss: 3, severe_loss: 6,
    regen_points: 1, regen_after_months: 6, full_regen_after_months: 24,
    stage_points: 4, stage_streak: 5, suspension_months: 6,
    month_seconds: monthSeconds || MONTH_S,
    severe_compensation: 0.2, fund_share_pct: 20,
    contest_window_seconds: 7 * 24 * 3600, contest_deposit: 0.1,
    platform_strike_limit: 3
  };
}
const months = (r, n) => n * r.month_seconds;
const LOSS = { clean: 0, light: 1, medium: 3, severe: 6 };
const lossFor = (r, c) => c === 'clean' ? 0 : c === 'light' ? r.light_loss : c === 'medium' ? r.medium_loss : r.severe_loss;

/* ---------- codes de refus (errors.rs) ---------- */
const ERR = {
  SOULBOUND: 'ERR_SOULBOUND', NOT_ISSUER: 'ERR_NOT_ISSUER', NOT_PLATFORM: 'ERR_NOT_PLATFORM',
  PLATFORM_SUSPENDED: 'ERR_PLATFORM_SUSPENDED', MISSION_ALREADY_RECORDED: 'ERR_MISSION_ALREADY_RECORDED',
  NO_LICENSE: 'ERR_NO_LICENSE', LICENSE_SUSPENDED: 'ERR_LICENSE_SUSPENDED',
  IDENTITY_SUSPENDED: 'ERR_IDENTITY_SUSPENDED', IDENTITY_ALREADY_LICENSED: 'ERR_IDENTITY_ALREADY_LICENSED',
  IDENTITY_REVOKED: 'ERR_IDENTITY_REVOKED', UNDER_BONDED: 'ERR_UNDER_BONDED',
  DELEGATION_EXPIRED: 'ERR_DELEGATION_EXPIRED', CONTEST_WINDOW_CLOSED: 'ERR_CONTEST_WINDOW_CLOSED',
  CONTEST_DEPOSIT_TOO_SMALL: 'ERR_CONTEST_DEPOSIT_TOO_SMALL', ALREADY_CONTESTED: 'ERR_ALREADY_CONTESTED',
  NO_CONTEST: 'ERR_NO_CONTEST', STAGE_NOT_ELIGIBLE: 'ERR_STAGE_NOT_ELIGIBLE',
  CATEGORY_EXISTS: 'ERR_CATEGORY_EXISTS', UNKNOWN_CATEGORY: 'ERR_UNKNOWN_CATEGORY',
  BOND_TOO_SMALL: 'ERR_BOND_TOO_SMALL', NOTHING_TO_WITHDRAW: 'ERR_NOTHING_TO_WITHDRAW',
  BAD_OUTCOME: 'ERR_BAD_OUTCOME', LICENSE_REVOKED: 'ERR_LICENSE_REVOKED',
  POINTS_TOO_LOW: 'ERR_POINTS_TOO_LOW', MISSIONS_TOO_FEW: 'ERR_MISSIONS_TOO_FEW',
  INVALIDATIONS_TOO_MANY: 'ERR_INVALIDATIONS_TOO_MANY', LICENSE_TOO_YOUNG: 'ERR_LICENSE_TOO_YOUNG',
  COEFFICIENT_TOO_HIGH: 'ERR_COEFFICIENT_TOO_HIGH', NOT_POSTER: 'ERR_NOT_POSTER',
  MISSION_CLOSED: 'ERR_MISSION_CLOSED', MISSION_NOT_TAKEN: 'ERR_MISSION_NOT_TAKEN',
  UNKNOWN_MISSION: 'ERR_UNKNOWN_MISSION', MISSION_ALREADY_TAKEN: 'ERR_MISSION_ALREADY_TAKEN',
  REWARD_TOO_SMALL: 'ERR_REWARD_TOO_SMALL'
};

/* ---------- fabriques d'état ---------- */
function newLicense(o) {
  return Object.assign({
    token_id: '', holder: '', category: 'coursier', identity: '',
    points: 6, cap: 6, issued_at: 0, last_report_at: 0, last_invalidation_at: 0,
    regen_anchor: 0, reinstated_at: 0, suspended_until: 0, invalidations: 0,
    missions_ok: 0, missions_flagged: 0, streak_ok: 0, last_stage_at: 0,
    bond: 0, rules_version: 1, revoked: false, renounced: false, reports: []
  }, o);
}
const newDossier = id => ({ identity: id, invalidations: 0, revoked: false, coefficient: 100, live_count: 0 });

/* ---------- rules.rs : calcul paresseux ---------- */
const cleanSince = l => Math.max(l.issued_at, l.reinstated_at, l.last_invalidation_at);

function capAt(r, cleanSeconds) {
  const year = months(r, 12);
  const years = year > 0 ? Math.floor(cleanSeconds / year) : 0;
  return Math.min(r.probation_points + years * r.probation_gain, r.max_points);
}

function effective(l, r, now) {
  const cap = capAt(r, Math.max(0, now - cleanSince(l)));
  if (l.suspended_until > 0) {
    if (now < l.suspended_until) return { points: 0, cap, pending_reinstatement: false };
    return { points: Math.min(r.probation_points, cap), cap, pending_reinstatement: true };
  }
  if (now - l.last_report_at >= months(r, r.full_regen_after_months)) return { points: cap, cap, pending_reinstatement: false };
  const period = Math.max(1, months(r, r.regen_after_months));
  const anchor = Math.max(l.regen_anchor, l.last_report_at);
  const gained = Math.floor(Math.max(0, now - anchor) / period) * r.regen_points;
  let points = l.points;
  if (l.points >= l.cap) points = cap;                      // suit son plafond
  else points = Math.min(l.points + gained, cap);
  return { points, cap, pending_reinstatement: false };
}

function materialize(l, r, now) {
  const e = effective(l, r, now);
  if (e.pending_reinstatement) { l.reinstated_at = l.suspended_until; l.suspended_until = 0; }
  l.points = e.points; l.cap = e.cap; l.regen_anchor = now;
  return e;
}

function pushReport(l, rep) { l.reports.push(rep); if (l.reports.length > 20) l.reports.shift(); }

function applyOutcome(l, r, now, cls, missionId) {
  const before = materialize(l, r, now).points;
  const loss = lossFor(r, cls);
  const eff = { before, after: before, loss, suspended_until: 0, invalidated: false };
  if (cls === 'clean') { l.missions_ok += 1; l.streak_ok += 1; }
  else {
    const after = Math.max(0, before - loss);
    l.missions_flagged += 1; l.streak_ok = 0;
    l.last_report_at = now; l.regen_anchor = now; l.points = after; eff.after = after;
    if (after === 0) {
      l.invalidations += 1; l.last_invalidation_at = now; l.reinstated_at = 0;
      l.suspended_until = now + months(r, r.suspension_months);
      l.cap = r.probation_points;
      eff.suspended_until = l.suspended_until; eff.invalidated = true;
    }
  }
  pushReport(l, { mission_id: missionId, class: cls, at: now, rules_version: l.rules_version, state: 'applied', points_lost: loss, slashed: 0 });
  return eff;
}

function statusOf(l, r, e, now) {
  if (l.revoked) return 'revoque';
  if (l.renounced) return 'rendu';
  if (l.suspended_until > now) return 'suspendu';
  const y = months(r, 12);
  const years = y === 0 ? 0 : Math.floor(Math.max(0, now - cleanSince(l)) / y);
  return (years === 0 && e.cap <= r.probation_points) ? 'probation' : 'actif';
}

const nextRegenAt = (l, r, now) => {
  if (l.suspended_until > 0 || l.points >= l.cap) return 0;
  const p = Math.max(1, months(r, r.regen_after_months));
  const a = Math.max(l.regen_anchor, l.last_report_at);
  return a + (Math.floor(Math.max(0, now - a) / p) + 1) * p;
};
const nextCapGainAt = (l, r, now) => {
  if (l.cap >= r.max_points) return 0;
  const y = months(r, 12), s = cleanSince(l);
  const years = Math.floor(Math.max(0, now - s) / y);
  return s + (years + 1) * y;
};

/* ---------- argent ---------- */
const requiredBond = (base, coef) => base * coef / 100;
const bumpCoef = d => { d.coefficient = Math.min(350, Math.floor(d.coefficient * 125 / 100)); };
const relaxCoef = d => { d.coefficient = Math.max(50, Math.floor(d.coefficient * 95 / 100)); };

/* ---------- vues (views.rs) ---------- */
function firstFailure(l, e, st, required, now, r, dossier, req) {
  if (st === 'revoque') return ERR.LICENSE_REVOKED;
  if (st === 'rendu') return ERR.NO_LICENSE;
  if (st === 'suspendu') return ERR.LICENSE_SUSPENDED;
  if (e.points === 0) return ERR.LICENSE_SUSPENDED;
  if (l.bond < required - 1e-9) return ERR.UNDER_BONDED;
  if (dossier.revoked) return ERR.LICENSE_REVOKED;
  if (req.min_points != null && e.points < req.min_points) return ERR.POINTS_TOO_LOW;
  if (req.min_missions != null && l.missions_ok < req.min_missions) return ERR.MISSIONS_TOO_FEW;
  if (req.max_invalidations != null && l.invalidations > req.max_invalidations) return ERR.INVALIDATIONS_TOO_MANY;
  if (req.min_age_months != null && (now - l.issued_at) < months(r, req.min_age_months)) return ERR.LICENSE_TOO_YOUNG;
  if (req.max_coefficient != null && dossier.coefficient > req.max_coefficient) return ERR.COEFFICIENT_TOO_HIGH;
  return null;
}

/* ================= Le monde ================= */
function World(opt) {
  opt = opt || {};
  this.r = defaultScale(opt.monthSeconds);
  this.now = 0;
  this.issuer = 'issuer.testnet';
  this.categories = { coursier: { id: 'coursier', issuer: this.issuer, base_bond: 1, versions: [this.r] } };
  this.licenses = {};          // token_id -> License
  this.owned = {};             // holder -> [token_id]
  this.byIdentity = {};        // identity|category -> token_id
  this.dossiers = {};          // identity -> Dossier
  this.platforms = {};         // account -> Platform
  this.seen = {};              // platform/mission_id -> true
  this.delegations = {};       // delegate|category -> Delegation
  this.contests = {};          // category/mission_id -> Contest
  this.reportPlatform = {};    // category/mission_id -> platform
  this.credits = {};           // account -> NEAR
  this.fund = 0;
  this.nextId = 0;
  this.missions = {};          // id -> Mission (contrat missions)
  this.nextMission = 1;
  this.escrowed = 0;
  this.deposits = 0; this.withdrawals = 0;
  this.log = [];
}

World.prototype.rules = function (cat) {
  const c = this.categories[cat];
  if (!c) throw ERR.UNKNOWN_CATEGORY;
  return c.versions[c.versions.length - 1];
};
World.prototype.dossier = function (id) {
  if (!this.dossiers[id]) this.dossiers[id] = newDossier(id);
  return this.dossiers[id];
};
World.prototype.emit = function (ev, data) { this.log.push({ ev, data, at: this.now }); };
World.prototype.credit = function (acc, amt) { if (amt <= 0) return; this.credits[acc] = (this.credits[acc] || 0) + amt; };
World.prototype.live = function (holder, cat) {
  const ids = this.owned[holder] || [];
  for (const id of ids) { const l = this.licenses[id]; if (l && l.category === cat && !l.revoked && !l.renounced) return l; }
  return null;
};
World.prototype.hasLive = function (holder, cat) { return !!this.live(holder, cat); };
World.prototype.delegationOf = function (del, cat) { return this.delegations[del + '|' + cat] || null; };
World.prototype.resolve = function (acc, cat) {
  if (this.hasLive(acc, cat)) return { ok: acc };
  const d = this.delegationOf(acc, cat);
  if (d && d.expires_at > this.now) return { ok: d.holder };
  if (d) return { err: ERR.DELEGATION_EXPIRED };
  return { err: ERR.NO_LICENSE };
};

/* ---------- émetteur (logic_issuer.rs) ---------- */
World.prototype.issue = function (caller, account, category, identity, deposit) {
  if (caller !== this.issuer) throw ERR.NOT_ISSUER;
  const def = this.categories[category]; if (!def) throw ERR.UNKNOWN_CATEGORY;
  const r = this.rules(category);
  const d = this.dossier(identity);
  if (d.revoked) throw ERR.IDENTITY_REVOKED;
  const key = identity + '|' + category;
  const existing = this.byIdentity[key];
  if (existing && this.licenses[existing]) {
    const l = this.licenses[existing];
    if (!l.revoked && !l.renounced) throw (l.suspended_until > this.now) ? ERR.IDENTITY_SUSPENDED : ERR.IDENTITY_ALREADY_LICENSED;
  }
  const required = requiredBond(def.base_bond, d.coefficient);
  if (deposit < required - 1e-9) throw ERR.BOND_TOO_SMALL;
  this.nextId += 1;
  const lic = newLicense({
    token_id: 'demerit-' + this.nextId, holder: account, category, identity,
    points: r.probation_points, cap: r.probation_points,
    issued_at: this.now, last_report_at: this.now, regen_anchor: this.now,
    invalidations: d.invalidations, bond: required, rules_version: def.versions.length
  });
  this.licenses[lic.token_id] = lic;
  (this.owned[account] = this.owned[account] || []).push(lic.token_id);
  this.byIdentity[key] = lic.token_id;
  d.live_count += 1;
  this.deposits += deposit;
  this.credit(account, deposit - required);
  this.emit('license_issued', { holder: account, category, identity, points: r.probation_points });
  return lic;
};

World.prototype.approvePlatform = function (caller, category, account) {
  if (caller !== this.issuer) throw ERR.NOT_ISSUER;
  if (!this.categories[category]) throw ERR.UNKNOWN_CATEGORY;
  this.platforms[account] = { active: true, warnings: 0, approved_at: this.now, category };
  this.emit('platform_approved', { account, category });
};

World.prototype.strikePlatform = function (caller, account) {
  if (caller !== this.issuer) throw ERR.NOT_ISSUER;
  const p = this.platforms[account]; if (!p) throw ERR.NOT_PLATFORM;
  p.warnings += 1;
  const limit = (this.categories[p.category] ? this.rules(p.category).platform_strike_limit : 3);
  if (p.warnings >= limit) p.active = false;
  this.emit('platform_struck', { account, warnings: p.warnings, suspended: !p.active });
};

World.prototype.revokeLicense = function (caller, account, category, reason) {
  if (caller !== this.issuer) throw ERR.NOT_ISSUER;
  const l = this.live(account, category); if (!l) throw ERR.NO_LICENSE;
  l.revoked = true; this.fund += l.bond; l.bond = 0;
  this.dossier(l.identity).revoked = true;
  this.emit('license_revoked', { holder: account, category, reason });
};

World.prototype.resolveContest = function (caller, category, missionId, upheld) {
  if (caller !== this.issuer) throw ERR.NOT_ISSUER;
  const k = category + '/' + missionId;
  const c = this.contests[k]; if (!c || !c.open) throw ERR.NO_CONTEST;
  c.open = false;
  const l = this.live(c.claimant, category); if (!l) throw ERR.NO_LICENSE;
  const i = l.reports.findIndex(r => r.mission_id === missionId && r.state !== 'cancelled');
  if (i < 0) throw ERR.NO_CONTEST;
  if (upheld) { l.reports[i].state = 'upheld'; this.fund += c.deposit; }
  else {
    l.reports[i].state = 'cancelled';
    l.points = Math.min(l.cap, l.points + l.reports[i].points_lost);
    if (l.suspended_until > 0) { l.suspended_until = 0; l.reinstated_at = this.now; l.last_invalidation_at = 0; }
    const refund = Math.min(l.reports[i].slashed, this.fund);
    l.bond += refund; this.fund -= refund;
    this.credit(c.claimant, c.deposit);
  }
  this.emit('contest_resolved', { claimant: c.claimant, category, mission_id: missionId, upheld });
  if (!upheld) this.strikePlatform(this.issuer, c.platform);
};

/* ---------- plateforme (record.rs) ---------- */
World.prototype.recordMission = function (platform, actor, category, missionId, outcome, client) {
  const p = this.platforms[platform]; if (!p) throw ERR.NOT_PLATFORM;
  if (!p.active) throw ERR.PLATFORM_SUSPENDED;
  const mk = platform + '/' + missionId;
  if (this.seen[mk]) throw ERR.MISSION_ALREADY_RECORDED;
  if (!LOSS.hasOwnProperty(outcome)) throw ERR.BAD_OUTCOME;
  const res = this.resolve(actor, category); if (res.err) throw res.err;
  const l = this.live(res.ok, category); if (!l) throw ERR.NO_LICENSE;
  const def = this.categories[category], r = def.versions[def.versions.length - 1];
  const eff = applyOutcome(l, r, this.now, outcome, missionId);
  const d = this.dossier(l.identity);
  let compensation = 0, fundShare = 0;
  if (outcome === 'severe') {
    const before = l.bond;
    fundShare = before * r.fund_share_pct / 100;
    compensation = Math.min(r.severe_compensation, before - fundShare);
    l.bond = before - fundShare - compensation;
    this.fund += fundShare;
    if (l.reports.length) l.reports[l.reports.length - 1].slashed = fundShare + compensation;
    bumpCoef(d);
    this.credit(client, compensation);
    this.emit('bond_slashed', { holder: res.ok, category, amount: fundShare + compensation, fund: fundShare });
    if (compensation > 0) this.emit('client_compensated', { holder: res.ok, client, amount: compensation, mission_id: missionId });
    if (eff.invalidated) d.invalidations += 1;
  } else if (outcome === 'clean' && (this.now - l.last_report_at) >= months(r, 12)) {
    relaxCoef(d);
  }
  this.seen[mk] = true;
  this.reportPlatform[category + '/' + missionId] = platform;
  this.emit('mission_recorded', { holder: res.ok, category, mission_id: missionId, outcome, client });
  this.emit('points_changed', { holder: res.ok, category, before: eff.before, after: eff.after, reason: outcome });
  if (eff.invalidated) this.emit('license_suspended', { holder: res.ok, category, until: eff.suspended_until });
  return { holder: res.ok, points_before: eff.before, points: eff.after, suspended_until: eff.suspended_until, invalidated: eff.invalidated, compensation, fund_share: fundShare, coefficient: d.coefficient, under_bonded: l.bond < requiredBond(def.base_bond, d.coefficient) - 1e-9 };
};

/* ---------- titulaire (logic_holder.rs) ---------- */
World.prototype.topUpBond = function (holder, category, amount) {
  const l = this.live(holder, category); if (!l) throw ERR.NO_LICENSE;
  l.bond += amount; this.deposits += amount;
  this.emit('bond_topped_up', { holder, category, amount });
  return l.bond;
};
World.prototype.withdrawBondExcess = function (holder, category) {
  const l = this.live(holder, category); if (!l) throw ERR.NO_LICENSE;
  const req = requiredBond(this.categories[category].base_bond, this.dossier(l.identity).coefficient);
  if (l.bond < req - 1e-9) throw ERR.UNDER_BONDED;
  if (Math.abs(l.bond - req) < 1e-9) throw ERR.NOTHING_TO_WITHDRAW;
  const ex = l.bond - req; l.bond = req;
  this.withdrawals += ex; this.emit('bond_excess_withdrawn', { holder, amount: ex });
  return ex;
};
World.prototype.delegate = function (holder, category, delegate, expiresAt) {
  if (!this.live(holder, category)) throw ERR.NO_LICENSE;
  this.delegations[delegate + '|' + category] = { holder, delegate, category, expires_at: expiresAt };
  this.emit('delegation_changed', { holder, category, delegate, active: true });
};
World.prototype.revokeDelegate = function (holder, category, delegate) {
  if (!this.live(holder, category)) throw ERR.NO_LICENSE;
  delete this.delegations[delegate + '|' + category];
  this.emit('delegation_changed', { holder, category, delegate, active: false });
};
World.prototype.contest = function (holder, category, missionId, deposit) {
  const l = this.live(holder, category); if (!l) throw ERR.NO_LICENSE;
  const r = this.rules(category);
  if (deposit < r.contest_deposit - 1e-9) throw ERR.CONTEST_DEPOSIT_TOO_SMALL;
  const k = category + '/' + missionId;
  if (this.contests[k] && this.contests[k].open) throw ERR.ALREADY_CONTESTED;
  const rep = [...l.reports].reverse().find(x => x.mission_id === missionId && x.state === 'applied');
  if (!rep) throw ERR.NO_CONTEST;
  if (this.now - rep.at > r.contest_window_seconds) throw ERR.CONTEST_WINDOW_CLOSED;
  rep.state = 'contested';
  const plat = this.reportPlatform[k]; if (!plat) throw ERR.NO_CONTEST;
  this.contests[k] = { category, mission_id: missionId, claimant: holder, platform: plat, deposit, opened_at: this.now, open: true };
  this.deposits += deposit;
  this.emit('contest_opened', { holder, category, mission_id: missionId, deposit });
};
World.prototype.claimStage = function (holder, category) {
  const l = this.live(holder, category); if (!l) throw ERR.NO_LICENSE;
  const r = this.rules(category);
  const tooSoon = l.last_stage_at > 0 && (this.now - l.last_stage_at) < months(r, 12);
  if (tooSoon || l.streak_ok < r.stage_streak) throw ERR.STAGE_NOT_ELIGIBLE;
  const e = materialize(l, r, this.now);
  const before = l.points;
  l.points = Math.min(e.cap, e.points + r.stage_points);
  l.last_stage_at = this.now; l.streak_ok = 0;
  this.emit('points_changed', { holder, category, before, after: l.points, reason: 'stage' });
  return l.points;
};
World.prototype.renounce = function (holder, category) {
  const l = this.live(holder, category); if (!l) throw ERR.NO_LICENSE;
  l.renounced = true; const b = l.bond; l.bond = 0;
  this.credit(holder, b);
  delete this.byIdentity[l.identity + '|' + category];
  this.dossier(l.identity).live_count = Math.max(0, this.dossier(l.identity).live_count - 1);
  this.emit('license_renounced', { holder, category });
};
World.prototype.withdraw = function (acc) {
  const amt = this.credits[acc] || 0;
  if (amt <= 0) throw ERR.NOTHING_TO_WITHDRAW;
  delete this.credits[acc]; this.withdrawals += amt;
  this.emit('withdrawn', { account: acc, amount: amt });
  return amt;
};
World.prototype.nftTransfer = function () { throw ERR.SOULBOUND; };

/* ---------- contrat missions (missions/src/lib.rs) ---------- */
World.prototype.post = function (poster, reward, deposit) {
  if (deposit < reward - 1e-9) throw ERR.REWARD_TOO_SMALL;
  const id = this.nextMission++;
  this.missions[id] = { id, poster, worker: null, reward, state: 'open', outcome: null, created_at: this.now, taken_at: null, closed_at: null };
  this.escrowed += reward; this.deposits += deposit;
  this.emit('mission_posted', { id, poster, reward });
  return id;
};
World.prototype.accept = function (worker, missionId, category, minPoints) {
  const m = this.missions[missionId]; if (!m) throw ERR.UNKNOWN_MISSION;
  if (m.state === 'taken') throw ERR.MISSION_ALREADY_TAKEN;
  if (m.state === 'closed') throw ERR.MISSION_CLOSED;
  const v = this.check(worker, category, { min_points: minPoints == null ? null : minPoints });
  if (!v.allowed) throw v.code;                        /* on_allowed(false) */
  m.worker = worker; m.state = 'taken'; m.taken_at = this.now;
  this.emit('mission_taken', { id: missionId, worker });
  return m;
};
World.prototype.close = function (caller, missionId, outcome) {
  const m = this.missions[missionId]; if (!m) throw ERR.UNKNOWN_MISSION;
  if (caller !== m.poster) throw ERR.NOT_POSTER;
  if (m.state === 'closed') throw ERR.MISSION_CLOSED;
  if (m.state === 'open') throw ERR.MISSION_NOT_TAKEN;
  if (!LOSS.hasOwnProperty(outcome)) throw ERR.BAD_OUTCOME;
  m.state = 'closed'; m.outcome = outcome; m.closed_at = this.now;
  this.escrowed -= m.reward;
  this.emit('mission_closed', { id: missionId, outcome, worker: m.worker });
  const rec = this.recordMission('missions.testnet', m.worker, 'coursier', 'm-' + missionId, outcome, m.poster);
  this.withdrawals += m.reward;
  return { mission: m, record: rec };
};

/* ---------- vues ---------- */
World.prototype.status = function (account, category) {
  const l = this.live(account, category); if (!l) return null;
  const def = this.categories[category], r = def.versions[def.versions.length - 1];
  const e = effective(l, r, this.now);
  const d = this.dossier(l.identity);
  const req = requiredBond(def.base_bond, d.coefficient);
  const st = statusOf(l, r, e, this.now);
  return {
    holder: l.holder, category: l.category, token_id: l.token_id, status: st,
    points: e.points, cap: e.cap, identity: l.identity, coefficient: d.coefficient,
    bond: l.bond, required_bond: req, under_bonded: l.bond < req - 1e-9,
    invalidations: l.invalidations, missions_ok: l.missions_ok, missions_flagged: l.missions_flagged,
    streak_ok: l.streak_ok, suspended_until: l.suspended_until,
    next_regen_at: nextRegenAt(l, r, this.now), next_cap_gain_at: nextCapGainAt(l, r, this.now),
    allowed: !(l.bond < req - 1e-9) && (st === 'probation' || st === 'actif') && e.points > 0,
    recent_reports: l.reports.slice()
  };
};
World.prototype.check = function (account, category, requirements) {
  const req = requirements || {};
  const res = this.resolve(account, category);
  if (res.err) return { allowed: false, code: res.err, points: 0, status: 'revoque' };
  const l = this.live(res.ok, category);
  const def = this.categories[category], r = def.versions[def.versions.length - 1];
  const e = effective(l, r, this.now);
  const d = this.dossier(l.identity);
  const st = statusOf(l, r, e, this.now);
  const required = requiredBond(def.base_bond, d.coefficient);
  const code = firstFailure(l, e, st, required, this.now, r, d, req);
  return { allowed: !code, code, points: e.points, status: st };
};
World.prototype.isAllowed = function (account, category, minPoints) {
  return this.check(account, category, { min_points: minPoints == null ? null : minPoints }).allowed;
};
World.prototype.nftToken = function (tokenId) {
  const l = this.licenses[tokenId]; if (!l) return null;
  const s = this.status(l.holder, l.category);
  const word = s.status === 'probation' ? 'probatoire' : s.status === 'suspendu' ? 'suspendu' : s.status === 'revoque' ? 'révoqué' : s.status === 'rendu' ? 'rendu' : 'valide';
  const cat = l.category.charAt(0).toUpperCase() + l.category.slice(1);
  const title = cat + ' · ' + s.points + '/' + s.cap + ' · ' + word;
  return {
    token_id: l.token_id, owner_id: l.holder, computed_title: title,
    metadata: {
      spec: 'nft-1.0.0', name: 'Demerit à points', symbol: 'DEMERIT', copies: 1,
      issued_at: String(l.issued_at), updated_at: String(this.now),
      extra: JSON.stringify({ points: s.points, cap: s.cap, status: s.status, coefficient: s.coefficient, bond: s.bond.toFixed(4), required_bond: s.required_bond.toFixed(4), invalidations: s.invalidations, missions_ok: s.missions_ok, next_regen_at: s.next_regen_at, category: l.category })
    }
  };
};
/* invariant I2 : cautions + fonds + crédits + missions en cours = dépôts − retraits */
World.prototype.invariant = function () {
  let bonds = 0; for (const k in this.licenses) bonds += this.licenses[k].bond;
  let credits = 0; for (const k in this.credits) credits += this.credits[k];
  const left = bonds + this.fund + credits + this.escrowed;
  const right = this.deposits - this.withdrawals;
  return { bonds, fund: this.fund, credits, escrowed: this.escrowed, left, right, ok: Math.abs(left - right) < 1e-6 };
};
World.prototype.advanceMonths = function (n) { this.now += months(this.r, n); };

global.DEMERIT = { World, ERR, defaultScale, effective, capAt, statusOf, requiredBond, LOSS, months: (r, n) => months(r, n) };
})(typeof window !== 'undefined' ? window : globalThis);

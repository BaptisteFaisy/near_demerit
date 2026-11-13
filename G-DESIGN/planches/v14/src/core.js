/* demerit · V14 — socle. Scénario certifié (demo/src/main.rs) en 18 temps, chrome du site, terminal, rapport headless.
   Contrat planche : window.SCENE = { init(api), sync(state, beat), beat(b, api) -> Promise }. */
(function () {
'use strict';
const Q = new URLSearchParams(location.search);
const AUTO = Q.get('auto') === '1';
const SPEED = Math.max(.25, parseFloat(Q.get('speed')) || 1);
const STOP = Q.get('stop');
const AT = (Q.get('at') || '').split(':');
const errors = [];
addEventListener('error', e => errors.push(String(e.message || e)));
addEventListener('unhandledrejection', e => errors.push('promise: ' + String((e.reason && e.reason.message) || e.reason)));

/* ---------- horloge unique (pause, vitesse, saut, filet headless) ---------- */
const C = { t: 0, paused: false, jobs: new Set(), last: performance.now(), hooks: [], seen: 0 };
function tick() {
  const n = performance.now(); const dt = Math.min(n - C.last, 100); C.last = n; C.seen = n;
  if (!C.paused) { C.t += dt * SPEED; for (const j of [...C.jobs]) if (j(C.t)) C.jobs.delete(j); }
  for (const h of C.hooks) h(C.t, C.paused ? 0 : dt * Math.min(SPEED, 4));
}
(function loop() { tick(); requestAnimationFrame(loop); })();
setInterval(() => { if (performance.now() - C.seen > 120) tick(); }, 16);
const wait = ms => new Promise(r => { const t0 = C.t; C.jobs.add(t => t - t0 >= ms && (r(), true)); });
const E = {
  lin: k => k, out: k => 1 - Math.pow(1 - k, 3), in: k => k * k * k,
  io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  expo: k => k === 1 ? 1 : 1 - Math.pow(2, -9 * k),
  back: k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
};
const tween = (ms, fn, ease) => new Promise(r => { const t0 = C.t; const e = ease || E.io; fn(e(0));
  C.jobs.add(t => { const k = Math.min(1, (t - t0) / ms); fn(e(k)); return k >= 1 && (r(), true); }); });
const lerp = (a, b, k) => a + (b - a) * k;
const fmt = x => (Math.round(x * 100) / 100).toFixed(2).replace('.', ',');
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

/* ---------- données réelles du dépôt ---------- */
const P = {
  issuer:   { n: 'ÉMETTEUR', a: 'issuer.testnet', does: 'vérifie · délivre · agrée · tranche' },
  platform: { n: 'PLATEFORME', a: 'missions.testnet', does: 'interroge le permis · enregistre l’issue' },
  pro:      { n: 'PROFESSIONNELLE', a: 'lea.testnet', does: 'Léa, coursier · détient le jeton + la caution' },
  client:   { n: 'CLIENT', a: 'client.testnet', does: 'paie · note · est indemnisé directement' },
  registry: { n: 'REGISTRE PUBLIC', a: 'demerit.testnet', does: 'points, caution, casier · lecture gratuite' },
  fund:     { n: 'FONDS DE GARANTIE', a: 'fund()', does: '20 % de chaque ponction · caisse commune' }
};
const K = {
  tx:  { n: 'transaction', g: '<circle cx="8" cy="8" r="4.6" fill="currentColor"/>' },
  view:{ n: 'vue gratuite', g: '<circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
  xcc: { n: 'inter-contrats', g: '<circle cx="5.4" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10.6" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
  pay: { n: 'paiement', g: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.1 10.8V5.2L9.9 10.8V5.2" fill="none" stroke="currentColor" stroke-width="1.3"/>' },
  no:  { n: 'refus', g: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2"/>' },
  off: { n: 'hors chaîne', g: '<path d="M1.5 8h13" stroke="currentColor" stroke-width="1.7" stroke-dasharray="2.4 2.4"/>' }
};
const S0 = { pts: 0, cap: 12, status: '—', bond: 0, req: 0, coef: 1, fund: 0, credit: 0, wallet: 0, ok: 0, inval: 0, month: 0, token: '' };

const cmd = s => ['cmd', s], out = s => ['out', s], ev = s => ['ev', s], er = s => ['err', s], com = s => ['com', s], row = s => ['row', s], ok = s => ['ok', s];
const BEATS = [
  { id: '0a', step: 0, title: 'IDENTITÉ VÉRIFIÉE', kind: 'off', from: 'issuer', to: 'pro', call: 'empreinte fp-lea', big: 'fp-lea',
    term: [com('# hors chaîne — l’émetteur vérifie la pièce de Léa, coursier'), out('empreinte = sha256(sel ‖ identité) → fp-lea')], set: {} },
  { id: '0b', step: 0, title: 'BARÈME PUBLIÉ', kind: 'tx', from: 'issuer', to: 'registry', call: 'create_category · approve_platform', big: '12',
    term: [cmd('near call demerit.testnet create_category \'{"id":"coursier"}\' --accountId issuer.testnet'), cmd('near call demerit.testnet approve_platform \'{"category":"coursier","account":"missions.testnet"}\''), out('barème v1 · 12 pts · probation 6 · caution de base 1 Ⓝ')], set: {} },
  { id: '1', step: 1, title: 'PERMIS DÉLIVRÉ', kind: 'tx', from: 'issuer', to: 'registry', call: 'issue(lea, 1 Ⓝ)', big: '6',
    term: [cmd('near call demerit.testnet issue \'{"account":"lea.testnet","category":"coursier","identity":"fp-lea"}\' --deposit 1'), ev('EVENT license_issued · demerit-1'), row('1 issue(lea, 1 NEAR)      | 6 pts · probation · demerit-1 · caution 1,00 | OK')],
    set: { pts: 6, status: 'probation', bond: 1, req: 1, token: 'demerit-1' } },
  { id: '2a', step: 2, title: 'MISSION PUBLIÉE', kind: 'tx', from: 'client', to: 'platform', call: 'post(0,10 Ⓝ)', big: '0,10',
    term: [cmd('near call missions.testnet post --deposit 0.1 --accountId client.testnet'), out('mission 1 · récompense 0,10 Ⓝ')], set: {} },
  { id: '2b', step: 2, title: 'PORTE OUVERTE', kind: 'xcc', from: 'platform', to: 'registry', call: 'accept → is_allowed', big: 'OUI',
    term: [cmd('near call missions.testnet accept \'{"mission_id":1}\' --accountId lea.testnet'), out('  ↳ xcc demerit.testnet.is_allowed(lea.testnet, coursier) · 10 Tgas'), ok('  ↳ on_allowed(true) → mission 1 attribuée')], set: {} },
  { id: '2c', step: 2, title: 'MISSION PROPRE', kind: 'pay', from: 'platform', to: 'pro', call: 'close(clean) → 0,10 Ⓝ', big: '+0,10',
    term: [cmd('near call missions.testnet close \'{"mission_id":1,"outcome":"clean"}\' --accountId client.testnet'), out('  ↳ 0,10 Ⓝ → lea.testnet · xcc record_mission(clean)'), ev('EVENT mission_recorded'), row('2 close clean             | missions_ok=1 · 6 pts                        | OK')],
    set: { ok: 1 } },
  { id: '3', step: 3, title: 'SIGNALEMENT MOYEN', kind: 'tx', from: 'client', to: 'registry', call: 'close(medium) → record_mission', big: '−3',
    term: [com('# mission 2 : publiée, acceptée, payée'), cmd('near call missions.testnet close \'{"mission_id":2,"outcome":"medium"}\' --accountId client.testnet'), ev('EVENT points_changed 6 → 3'), row('3 close medium            | 3 pts                                        | OK')],
    set: { pts: 3 } },
  { id: '4', step: 4, title: '6 MOIS PROPRES', kind: 'view', from: 'registry', to: 'pro', call: 'status — aucune transaction', big: '+1',
    term: [com('# +6 mois (12 s en démo) — aucune transaction'), cmd('near view demerit.testnet status \'{"account":"lea.testnet","category":"coursier"}\''), out('{ points: 4, cap: 6, status: "Probation" }'), row('4 +6 mois (12 s)          | 4 pts : régénération                         | OK')],
    set: { pts: 4, month: 6 } },
  { id: '5a', step: 5, title: 'SIGNALEMENT GRAVE', kind: 'tx', from: 'client', to: 'registry', call: 'close(severe) → record_mission', big: '0',
    term: [com('# mission 3 : publiée, acceptée, payée'), cmd('near call missions.testnet close \'{"mission_id":3,"outcome":"severe"}\' --accountId client.testnet'), ev('EVENT points_changed 4 → 0'), ev('EVENT license_suspended · 6 mois')],
    set: { pts: 0, status: 'suspendu', inval: 1 } },
  { id: '5b', step: 5, title: 'LA CAUTION PAIE', kind: 'pay', from: 'registry', to: 'client', call: 'bond_slashed → client + fonds', big: '0,20',
    term: [ev('EVENT bond_slashed 0,40 Ⓝ'), ev('EVENT client_compensated 0,20 Ⓝ → client.testnet'), out('fonds +0,20 Ⓝ · coefficient 1,00 → 1,25 · caution 0,60 · exigée 1,25'), row('5 close severe            | 0 pt · suspension 6 mois · fonds +0,20 · client +0,20 · coef 125 | OK')],
    set: { bond: .6, fund: .2, credit: .2, coef: 1.25, req: 1.25 } },
  { id: '6', step: 6, title: 'PORTE FERMÉE', kind: 'no', from: 'platform', to: 'pro', call: 'accept → is_allowed', big: 'ERR_LICENSE_SUSPENDED',
    term: [cmd('near call missions.testnet accept \'{"mission_id":4}\' --accountId lea.testnet'), out('  ↳ xcc is_allowed → false'), er('✕ ERR_LICENSE_SUSPENDED'), row('6 accept sous suspension  | refus ERR_LICENSE_SUSPENDED                  | OK')], set: {} },
  { id: '7', step: 7, title: 'COMPTE RECRÉÉ', kind: 'no', from: 'registry', to: 'issuer', call: 'issue(lea2, même empreinte)', big: 'ERR_IDENTITY_SUSPENDED',
    term: [cmd('near call demerit.testnet issue \'{"account":"lea2.testnet","category":"coursier","identity":"fp-lea"}\' --deposit 1.25'), er('✕ ERR_IDENTITY_SUSPENDED'), com('# le casier suit l’empreinte, pas le compte'), row('7 lea2, même empreinte    | refus ERR_IDENTITY_SUSPENDED                 | OK')], set: {} },
  { id: '8a', step: 8, title: 'RÉHABILITATION', kind: 'view', from: 'registry', to: 'pro', call: 'check — aucune transaction', big: '6',
    term: [com('# +6 mois — aucune transaction'), cmd('near view demerit.testnet check \'{"account":"lea.testnet","category":"coursier"}\''), out('{ allowed: false, code: "ERR_UNDER_BONDED", points: 6, status: "Probation" }')],
    set: { pts: 6, status: 'probation', month: 12 } },
  { id: '8b', step: 8, title: 'SOUS-GARANTIE', kind: 'no', from: 'platform', to: 'pro', call: 'accept → is_allowed', big: 'ERR_UNDER_BONDED',
    term: [cmd('near call missions.testnet accept \'{"mission_id":4}\' --accountId lea.testnet'), er('✕ ERR_UNDER_BONDED · caution 0,60 < exigée 1,25')], set: {} },
  { id: '8c', step: 8, title: 'COMPLÉMENT', kind: 'pay', from: 'pro', to: 'registry', call: 'top_up_bond +0,65 Ⓝ', big: '+0,65',
    term: [cmd('near call demerit.testnet top_up_bond \'{"category":"coursier"}\' --deposit 0.65 --accountId lea.testnet'), out('caution 1,25 = exigée 1,25')], set: { bond: 1.25 } },
  { id: '8d', step: 8, title: 'PORTE ROUVERTE', kind: 'xcc', from: 'platform', to: 'registry', call: 'accept → is_allowed', big: 'OUI',
    term: [cmd('near call missions.testnet accept \'{"mission_id":4}\' --accountId lea.testnet'), ok('  ↳ on_allowed(true) → mission 4 attribuée, close propre'), row('8 réhabilitation, caution | 6 pts probation · inval. 1 · refusé puis accepté | OK')],
    set: { ok: 2 } },
  { id: '9', step: 9, title: 'NON TRANSFÉRABLE', kind: 'no', from: 'registry', to: 'pro', call: 'nft_transfer', big: 'ERR_SOULBOUND',
    term: [cmd('near call demerit.testnet nft_transfer \'{"receiver_id":"client.testnet","token_id":"demerit-1"}\' --depositYocto 1 --accountId lea.testnet'), er('✕ ERR_SOULBOUND'), row('9 nft_transfer            | refus ERR_SOULBOUND                          | OK')], set: {} },
  { id: '10', step: 10, title: 'COMPTES JUSTES', kind: 'pay', from: 'registry', to: 'client', call: 'withdraw → 0,20 Ⓝ', big: '10/10',
    term: [cmd('near call demerit.testnet withdraw --accountId client.testnet'), out('  ↳ 0,20 Ⓝ → client.testnet'), row('I2 conservation          | 9/9 étapes équilibrées                       | OK'), out('funds: fonds 0,20 + cautions et crédits 1,25 + missions 0,00 = 1,45 | versements 1,65 − retraits 0,20 = 1,45 -> OK'), ok('DEMO OK (10/10)')],
    set: { credit: 0, wallet: .2 } }
];
/* les 9 étapes (+ préparation + bilan) : ce que le bouton va jouer, expliqué avant d’être joué */
const STEPS = [
  { n: 'PRÉPARER', k: 'off', d: 'L’émetteur vérifie Léa hors chaîne, publie le barème 12 pts et agrée la plateforme.' },
  { n: 'DÉLIVRER', k: 'tx', d: 'issue(lea, 1 Ⓝ) → jeton demerit-1, 6 pts probatoires, caution 1,00 Ⓝ bloquée.' },
  { n: 'TRAVAILLER', k: 'xcc', d: 'Mission 0,10 Ⓝ publiée, is_allowed répond OUI, mission propre payée.' },
  { n: 'FAUTE MOYENNE', k: 'tx', d: 'Le client signale : −3 points. Il en reste 3 sur 12.' },
  { n: 'TEMPS', k: 'view', d: '+6 mois sans faute : 4 pts. Aucune transaction, la lecture recalcule.' },
  { n: 'FAUTE GRAVE', k: 'pay', d: '−6 → 0 pt, suspension 6 mois. La caution paie : client +0,20 Ⓝ, fonds +0,20 Ⓝ.' },
  { n: 'REFUS', k: 'no', d: 'Toute plateforme interrogée répond ERR_LICENSE_SUSPENDED. La porte est fermée partout.' },
  { n: 'COMPTE RECRÉÉ', k: 'no', d: 'lea2.testnet, même empreinte → ERR_IDENTITY_SUSPENDED. Le casier suit la personne.' },
  { n: 'RETOUR', k: 'pay', d: '+6 mois → 6 pts. Sous-garantie : refus. top_up_bond +0,65 Ⓝ → la porte se rouvre.' },
  { n: 'INVENDABLE', k: 'no', d: 'nft_transfer → ERR_SOULBOUND. La réputation ne s’achète pas.' },
  { n: 'BILAN', k: 'pay', d: 'Le client retire 0,20 Ⓝ. Invariant I2 vérifié : DEMO OK (10/10).' }
];
const ANNEX = {
  calls: {
    issuer: ['create_category', 'publish_rules', 'approve_platform', 'issue', 'resolve_contest', 'strike_platform', 'revoke_license'],
    platform: ['post', 'accept', 'close', 'record_mission'],
    pro: ['top_up_bond', 'withdraw_bond_excess', 'delegate', 'revoke_delegate', 'contest', 'claim_stage', 'renounce', 'withdraw'],
    client: ['post', 'close', 'withdraw'],
    registry: ['status', 'is_allowed', 'check', 'license', 'platform', 'delegation', 'fund', 'credit', 'rules', 'categories', 'clock', 'issuer', 'nft_token', 'nft_tokens_for_owner'],
    fund: ['bond_slashed 20 %', 'dépôt de recours perdu', 'recours gagné : rembourse']
  },
  errs: ['ERR_SOULBOUND', 'ERR_NOT_ISSUER', 'ERR_NOT_PLATFORM', 'ERR_PLATFORM_SUSPENDED', 'ERR_MISSION_ALREADY_RECORDED', 'ERR_NO_LICENSE', 'ERR_LICENSE_SUSPENDED', 'ERR_IDENTITY_SUSPENDED', 'ERR_IDENTITY_ALREADY_LICENSED', 'ERR_UNDER_BONDED', 'ERR_DELEGATION_EXPIRED', 'ERR_CONTEST_WINDOW_CLOSED', 'ERR_STAGE_NOT_ELIGIBLE', 'ERR_POINTS_TOO_LOW', 'ERR_MISSIONS_TOO_FEW', 'ERR_INVALIDATIONS_TOO_MANY', 'ERR_LICENSE_TOO_YOUNG', 'ERR_COEFFICIENT_TOO_HIGH', 'ERR_LICENSE_REVOKED', '+10'],
  events: ['license_issued', 'mission_recorded', 'points_changed', 'license_suspended', 'license_reinstated', 'bond_slashed', 'client_compensated', 'contest_opened', 'contest_resolved', 'platform_struck', 'delegation_changed', 'license_revoked', 'license_renounced'],
  rules: [['12', 'points max'], ['6', 'en probation'], ['+2', 'plafond / an propre'], ['−1', 'léger'], ['−3', 'moyen'], ['−6', 'grave'], ['+1', '6 mois propres'], ['24', 'mois → plafond plein'], ['+4', 'stage · 5 missions'], ['6', 'mois de suspension à 0'], ['×1,25', 'coef. par faute grave'], ['×0,95', 'coef. par an propre'], ['20 %', 'de la ponction → fonds'], ['0,20 Ⓝ', 'indemnité client'], ['0,10 Ⓝ', 'dépôt de recours'], ['7 j', 'fenêtre de recours'], ['3', 'avertissements → plateforme dés-agréée']],
  bench: [['make build', 15, 'BUILD OK'], ['make test', 10, '18 tests'], ['make demo', 60, '10/10'], ['make attack', 20, '7/7'], ['make sim', 30, '5/5 · 24 mois'], ['make dev', 40, 'nœud + page'], ['make web-smoke', 5, '11/11'], ['make web-ui-smoke', 60, 'UI'], ['make testnet-dry', 2, 'à blanc'], ['make testnet', 300, 'déployé']],
  near: [['lea.testnet', 'comptes nommés'], ['agent1.lea.testnet', 'délégation = sous-compte'], ['10 Tgas', 'is_allowed à chaque mission'], ['0 gas', 'vues sans compte']],
  uses: ['coursier', 'agent IA délégué', 'artisan', 'chauffeur', 'auditeur', 'garde d’enfants']
};

/* ---------- état ---------- */
let S = { ...S0 }; let idx = -1; let playing = false; let runId = 0; let done = false;
const titleOf = s => s.token ? 'Coursier · ' + s.pts + '/12 · ' + (s.status === 'suspendu' ? 'suspendu' : s.status === 'probation' ? 'probation' : 'valide') : '—';
const view = s => ({ pts: String(s.pts), cap: '12', status: s.status, bond: fmt(s.bond), req: fmt(s.req), coef: fmt(s.coef), fund: fmt(s.fund), client: fmt(s.credit + s.wallet), ok: String(s.ok), inval: String(s.inval), month: String(s.month), token: s.token || '—', title: titleOf(s) });
function stateAt(i) { const s = { ...S0 }; for (let k = 0; k <= i; k++) Object.assign(s, BEATS[k].set); return s; }

/* ---------- chiffres ---------- */
let MANUAL = false;
function bind() {
  const v = view(S), r = document.documentElement;
  const show = idx >= 0 || MANUAL;
  const set = (id, txt) => { const e = $(id); if (e && e.textContent !== txt) e.textContent = txt; };
  set('#mx-pts b', show ? v.pts : '—');
  set('#mx-bond b', show ? v.bond : '—');
  set('#mx-bond u', 'exigée ' + (show ? v.req : '—'));
  set('#mx-client b', show ? v.client : '—');
  set('#mx-fund b', show ? v.fund : '—');
  r.dataset.status = S.status; r.dataset.pts = S.pts; r.dataset.live = show ? '1' : '0';
  r.dataset.under = S.token && S.bond < S.req ? '1' : '0';
  const g = $('#go .gprog u'); if (g) g.style.transform = 'scaleX(' + ((idx + 1) / BEATS.length).toFixed(3) + ')';
}

/* ---------- terminal ---------- */
const term = {
  el: null,
  clear() { if (this.el) this.el.innerHTML = ''; },
  add(cls, txt) { if (!this.el) return null; const d = document.createElement('div'); d.className = 'tl ' + cls;
    d.textContent = (cls === 'cmd' ? '$ ' : '') + txt; this.el.appendChild(d); this.el.scrollTop = this.el.scrollHeight; return d; },
  async type(lines, id) {
    for (const [cls, txt] of lines) {
      if (id !== runId) return;
      if (cls === 'cmd' && this.el) {
        const d = this.add('cmd', ''); const full = '$ ' + txt;
        await tween(Math.min(620, full.length * 6), k => { d.textContent = full.slice(0, Math.round(full.length * k)); }, E.lin);
        d.textContent = full;
      } else this.add(cls, txt);
      this.el && (this.el.scrollTop = this.el.scrollHeight);
      await wait(cls === 'err' || cls === 'ok' ? 300 : 150);
    }
  },
  dump(i) { this.clear(); for (let k = 0; k <= i; k++) for (const [c, t] of BEATS[k].term) this.add(c, t); }
};

/* ---------- chrome ---------- */
const glyph = k => '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">' + K[k].g + '</svg>';
function chrome() {
  const kd = $('#kinds');
  if (kd) kd.innerHTML = Object.keys(K).map(k => '<span class="kd" data-k="' + k + '">' + glyph(k) + K[k].n + '</span>').join('');
  const st = $('#steps');
  if (st) st.innerHTML = STEPS.map((s, i) => '<button class="stp" data-s="' + i + '" title="' + s.n + ' — ' + s.d + '"><i>' + (i === 0 ? '·' : i === 10 ? '✓' : i) + '</i><b>' + s.n + '</b></button>').join('');
  if (st) st.addEventListener('click', e => { const b = e.target.closest('.stp'); if (b) jump(BEATS.findIndex(x => x.step === +b.dataset.s) - 1, true); });
  const pr = $('#parties');
  if (pr) pr.innerHTML = Object.keys(P).map((k, i) => '<div class="pt" data-pt="' + k + '"><h4><s>0' + (i + 1) + '</s>' + P[k].n + '</h4><p>' + P[k].a + '</p><i>' + P[k].does + '</i></div>').join('');
  const cd = $('#cards');
  if (cd) cd.innerHTML = STEPS.map((s, i) => '<article class="cd" data-c="' + i + '"><span class="k"></span><span class="n">' + (i === 0 ? '·' : i === 10 ? '✓' : i) + '<i>/9</i></span><h5>' + s.n + '</h5><p>' + s.d + '</p></article>').join('');
  const mx = Math.log(300);
  const bn = $('#bench');
  if (bn) bn.innerHTML = ANNEX.bench.map(b => '<div class="bn"><code>' + b[0] + '</code><b>' + (b[1] >= 300 ? '~5 min' : '~' + b[1] + ' s') + '</b><span><u style="width:' + Math.max(4, Math.log(b[1] + 1) / mx * 100).toFixed(0) + '%"></u></span><i>' + b[2] + '</i></div>').join('');
  annexe();
}
function annexe() {
  const ax = $('#annexe'); if (!ax) return;
  const chips = a => a.map(x => '<span>' + x + '</span>').join('');
  ax.innerHTML =
    '<section class="ax"><h2>Un jeton qui <b>ouvre</b>, qui <b>perd</b>, qui <b>paie</b>, qui <b>ne se vend pas</b>.</h2>' +
    '<div class="ax-nums">' + ANNEX.rules.map(r => '<p><b>' + r[0] + '</b><i>' + r[1] + '</i></p>').join('') + '</div></section>' +
    '<section class="ax"><h3>LES 6 PARTIES <i>qui appelle quoi · docs/ABI.md</i></h3><div class="ax-cols">' +
    Object.keys(P).map(k => '<div><h4>' + P[k].n + '<i>' + P[k].a + '</i></h4><div class="chips' + (k === 'registry' ? ' hollow' : '') + '">' + chips(ANNEX.calls[k]) + '</div></div>').join('') + '</div></section>' +
    '<section class="ax"><h3>REFUS <i>codes constants, assertables</i></h3><div class="chips solid">' + chips(ANNEX.errs) + '</div></section>' +
    '<section class="ax"><h3>ÉVÉNEMENTS <i>NEP-297</i></h3><div class="chips">' + chips(ANNEX.events) + '</div></section>' +
    '<section class="ax"><h3>POURQUOI NEAR</h3><div class="ax-nums">' + ANNEX.near.map(r => '<p><b>' + r[0] + '</b><i>' + r[1] + '</i></p>').join('') + '</div></section>' +
    '<section class="ax"><h3>MÊME JETON, AUTRES MÉTIERS</h3><div class="chips">' + chips(ANNEX.uses) + '</div></section>';
}
function caption(b) {
  const r = document.documentElement;
  r.dataset.kind = b ? b.kind : ''; r.dataset.beat = b ? b.id : ''; r.dataset.step = b && b.step !== undefined ? b.step : '';
  const set = (s, t) => { const e = $(s); if (e) e.innerHTML = t; };
  set('#cap-n', b && b.step !== undefined ? (b.step === 0 ? '0' : b.step === 10 ? '✓' : b.step) + '<i>/9</i>' : '');
  set('#cap-t', b ? b.title : '');
  set('#cap-k', b ? glyph(b.kind) + K[b.kind].n : '');
  set('#cap-w', b && P[b.from] && P[b.to] ? P[b.from].n + ' <s>→</s> ' + P[b.to].n : '');
  set('#cap-c', b ? b.call : '');
  $$('.kd').forEach(e => e.classList.toggle('on', !!b && e.dataset.k === b.kind));
  $$('.stp').forEach(e => { const s = +e.dataset.s; e.classList.toggle('on', !!b && s === b.step); e.classList.toggle('past', !!b && b.step !== undefined && s < b.step); });
  $$('.pt').forEach(e => e.classList.toggle('on', !!b && (e.dataset.pt === b.from || e.dataset.pt === b.to)));
  $$('.cd').forEach(e => e.classList.toggle('done', !!b && b.step !== undefined && +e.dataset.c <= b.step));
}
function panelTitles() {
  const t = $('#pan-a-t'), i = $('#pan-a-i');
  if (!t) return;
  const isLive = document.documentElement.dataset.play === 'live';
  if (isLive) { t.textContent = 'TERMINAL'; i.textContent = 'vues gratuites · JSON-RPC testnet'; }
  else if (MANUAL) { t.textContent = 'TERMINAL'; i.textContent = 'vos appels, un par un'; }
  else if (idx < 0) { t.textContent = 'PROGRAMME'; i.textContent = '9 étapes · 18 temps · make demo'; }
  else { t.textContent = 'TERMINAL'; i.textContent = 'near-cli-rs · bac à sable'; }
}
function btn() {
  const g = $('#go'); if (!g) return;
  const isLive = document.documentElement.dataset.play === 'live';
  if (isLive) {
    g.dataset.mode = 'manual'; g.innerHTML = 'RAFRAÎCHIR LA CHAÎNE<span class="gprog"><u></u></span>';
    document.documentElement.dataset.run = 'manual'; panelTitles(); return;
  }
  if (MANUAL) {
    g.dataset.mode = 'manual'; g.innerHTML = 'RÉINITIALISER<span class="gprog"><u></u></span>';
    document.documentElement.dataset.run = 'manual'; panelTitles(); return;
  }
  g.dataset.mode = done ? 'done' : playing ? (C.paused ? 'paused' : 'playing') : 'idle';
  g.innerHTML = (done ? 'REJOUER' : playing ? (C.paused ? 'REPRENDRE' : 'PAUSE') : (idx >= 0 ? 'CONTINUER' : 'LANCER LE SCÉNARIO')) + '<span class="gprog"><u></u></span>';
  document.documentElement.dataset.run = g.dataset.mode; panelTitles();
}

/* ---------- lecteur ---------- */
const api = { P, K, BEATS, STEPS, ANNEX, E, wait, tween, lerp, fmt, $, $$, glyph, clock: C, speed: SPEED, onFrame: f => C.hooks.push(f), get state() { return S; }, view: () => view(S) };
function jump(i, thenPlay) {
  runId++; C.jobs.clear(); C.paused = false; playing = false; done = false; idx = i;
  S = i >= 0 ? stateAt(i) : { ...S0 };
  term.dump(i); caption(i >= 0 ? BEATS[i] : null); bind(); SCENE.sync(S, i >= 0 ? BEATS[i] : null); btn();
  delete document.documentElement.dataset.done;
  if (thenPlay) play();
}
async function play() {
  if (playing) return; if (idx >= BEATS.length - 1) jump(-1);
  playing = true; const id = ++runId; btn();
  while (idx < BEATS.length - 1) {
    const b = BEATS[idx + 1]; idx++;
    const prev = { ...S }; let committed = false;
    const commit = keys => { const patch = {}; for (const k in b.set) if (!keys || keys.includes(k)) patch[k] = b.set[k];
      S = { ...S, ...patch }; if (!keys) committed = true; bind(); };
    caption(b); bind();
    if (AT[0] === b.id) wait(+AT[1] || 0).then(() => { C.paused = true; document.documentElement.dataset.stopped = b.id; });
    await Promise.all([SCENE.beat(b, { ...api, prev, next: { ...prev, ...b.set }, commit }), term.type(b.term, id)]);
    if (id !== runId) return;
    if (!committed) commit();
    await wait(b.hold || 620);
    if (id !== runId) return;
    if (STOP === b.id) { playing = false; document.documentElement.dataset.stopped = b.id; return; }
  }
  playing = false; done = true; btn(); report();
}
function report() {
  const v = view(S);
  const txt = s => { const e = $(s); return e ? e.textContent.trim() : null; };
  const dom = { pts: txt('#mx-pts b'), bond: txt('#mx-bond b'), client: txt('#mx-client b'), fund: txt('#mx-fund b') };
  const good = S.pts === 6 && v.bond === '1,25' && v.client === '0,20' && v.fund === '0,20' && S.status === 'probation'
    && dom.pts === '6' && dom.bond === '1,25' && dom.client === '0,20' && dom.fund === '0,20' && errors.length === 0;
  const res = { ok: good, beats: idx + 1, of: BEATS.length, state: v, dom, termLines: term.el ? term.el.children.length : 0,
    lastLine: term.el && term.el.lastChild ? term.el.lastChild.textContent : '', errors };
  let pre = $('#result');
  if (!pre) { pre = document.createElement('script'); pre.type = 'application/json'; pre.id = 'result'; document.body.appendChild(pre); }
  pre.textContent = JSON.stringify(res); document.documentElement.dataset.done = good ? 'ok' : 'ko'; window.__demerit = res;
}
function toggle() { if (!playing) play(); else { C.paused = !C.paused; btn(); } }

/* ---------- mode de jeu : SCÉNARIO (certifié) · MANUEL (bac à sable jouable) · LIVE (testnet) ---------- */
function setPlay(m) {
  const isLive = m === 'live';
  MANUAL = m === 'manuel';
  document.documentElement.dataset.play = m;
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  if (MANUAL || isLive) {
    runId++; C.jobs.clear(); C.paused = false; playing = false; done = false; idx = -1; S = { ...S0 };
    term.clear(); caption(null); bind(); btn();
    if (MANUAL) {
      if (window.LIVE) window.LIVE.teardown();
      if (window.MANUEL) { try { window.MANUEL.init(); } catch (e) { errors.push('manuel: ' + (e && e.message ? e.message : e)); document.documentElement.dataset.manuelErr = String(e && e.message ? e.message : e); } }
    } else {
      if (window.MANUEL) window.MANUEL.teardown();
      if (window.LIVE) { try { window.LIVE.init(); } catch (e) { errors.push('live: ' + (e && e.message ? e.message : e)); document.documentElement.dataset.liveErr = String(e && e.message ? e.message : e); } }
    }
  } else {
    if (window.MANUEL) window.MANUEL.teardown();
    if (window.LIVE) window.LIVE.teardown();
    jump(-1);
  }
}
/* API publique : le mode manuel peint dans le même shell */
window.CORE = {
  api, P, K, BEATS, STEPS, ANNEX,
  get state() { return S; },
  paint(snap, meta) { S = Object.assign({}, S, snap); bind(); caption(meta || null); try { SCENE.sync(S, meta || null); } catch (e) { errors.push('sync: ' + e.message); } },
  print(lines) { lines.forEach(l => term.add(l[0], l[1])); },
  async type(lines) { await term.type(lines, runId); },
  stamp: (t, c) => stampBig(t, c),
  setPlay, get manual() { return MANUAL; },
  get errors() { return errors; }
};
function stampBig(txt, cls) { const b = $('#big'); if (!b) return; b.className = cls || 'code'; b.textContent = txt;
  api.tween(180, k => { b.style.opacity = k; b.style.transform = 'translate(-50%,-50%) scale(' + (1.5 - .5 * k) + ')'; }, api.E.out)
    .then(() => api.wait(900)).then(() => api.tween(280, k => { b.style.opacity = 1 - k; }, api.E.in)); }

addEventListener('DOMContentLoaded', () => {
  try {
    term.el = $('#term');
    document.documentElement.dataset.mode = Q.get('mode') === 'live' ? 'live' : 'sandbox';
    document.documentElement.dataset.play = 'scenario';
    chrome();
    if (Q.get('only') === 'annexe') [...document.body.children].forEach(e => { if (e.id !== 'annexe' && e.tagName !== 'SCRIPT') e.style.display = 'none'; });
    try { SCENE.init(api); SCENE.sync(S, null); } catch (e) { errors.push('init: ' + e.message); }
    bind(); caption(null); btn();
    const g = $('#go'); if (g) g.addEventListener('click', () => {
      const p = document.documentElement.dataset.play;
      if (p === 'live') { if (window.LIVE) window.LIVE.refresh(); return; }
      if (MANUAL) { if (window.MANUEL) window.MANUEL.reset(); return; }
      if (done) jump(-1, true); else toggle();
    });
    const mb = $('#modes'); if (mb) mb.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPlay(b.dataset.m); });
    addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); if (MANUAL) return; if (done) jump(-1, true); else toggle(); } });
    if (Q.get('live') === '1') setPlay('live');
    else if (Q.get('manuel') === '1') setPlay('manuel');
    else if (AUTO) play();
  } catch (e) {
    const msg = 'dcl: ' + (e && e.message ? e.message : e);
    errors.push(msg); document.documentElement.dataset.dclErr = msg;
  }
});
})();

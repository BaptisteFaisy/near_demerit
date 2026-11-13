/* demerit · V14 — manuel.js : le mode « à vous de jouer ».
   Le moteur est window.DEMERIT = portage 1:1 de contracts/demerit/src/rules.rs (vérifié 23/23 contre
   les vecteurs Rust de `cargo test`). Chaque bouton exécute un vrai appel et renvoie le vrai code
   de refus : rien n'est simulé à la main. Les 15 objectifs et les 7 attaques de `make attack`
   sont jouables. */
(function (global) {
'use strict';
const { World, ERR } = global.DEMERIT;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const CAT = 'coursier', ISS = 'issuer.testnet', PLAT = 'missions.testnet';
const LEA = 'lea.testnet', CLI = 'client.testnet', LEA2 = 'lea2.testnet', AG = 'agent1.lea.testnet';
const MO = 30 * 24 * 3600;

let W = null, F = {}, role = 'issuer', logMark = 0, lastMission = null, lastContest = null, built = false;
const ROLES = [{ id: 'issuer', n: 'ÉMETTEUR' }, { id: 'platform', n: 'PLATEFORME' }, { id: 'pro', n: 'PROFESSIONNELLE' },
  { id: 'client', n: 'CLIENT' }, { id: 'registry', n: 'REGISTRE' }, { id: 'time', n: 'TEMPS' }];

/* ---------- état du monde → état du shell ---------- */
function snap() {
  const st = W.status(LEA, CAT);
  const s = st || { points: 0, cap: 12, status: '—', bond: 0, required_bond: 0, coefficient: 100, invalidations: 0, missions_ok: 0, token_id: '' };
  const dossier = W.dossier('fp-lea');
  return {
    pts: s.points, cap: s.cap, status: s.status, bond: s.bond, req: s.required_bond,
    coef: (dossier ? dossier.coefficient : 100) / 100, fund: W.fund, credit: W.credits[CLI] || 0,
    wallet: F.withdrawn || 0, ok: s.missions_ok || 0, inval: s.invalidations || 0,
    month: Math.floor(W.now / MO), token: s.token_id || ''
  };
}
const openMissions = () => Object.keys(W.missions).map(k => W.missions[k]).filter(m => m.state === 'open');
const takenMissions = () => Object.keys(W.missions).map(k => W.missions[k]).filter(m => m.state === 'taken');
const lastOpen = () => { const o = openMissions(); return o.length ? o[o.length - 1].id : null; };
const lastTaken = () => { const t = takenMissions(); return t.length ? t[t.length - 1].id : null; };

/* ---------- actions : une par appel réel du contrat ---------- */
const ACTS = [
  { id: 'kyc', role: 'issuer', label: "Vérifier l'identité de Léa", call: 'kyc (hors chaîne)', kind: 'off', from: 'issuer', to: 'pro',
    term: ['# hors chaîne — KYC de Léa, coursier', 'empreinte = sha256(sel ‖ identité) → fp-lea'],
    run: () => { F.kyc = true; return 'fp-lea'; } },

  { id: 'approve', role: 'issuer', label: 'Agréer la plateforme', call: 'approve_platform', kind: 'tx', from: 'issuer', to: 'registry',
    need: () => F.kyc, needTxt: 'identité vérifiée',
    term: ['approve_platform {"category":"coursier","account":"missions.testnet"}'],
    run: () => { W.approvePlatform(ISS, CAT, PLAT); return 'plateforme agréée'; } },

  { id: 'issue', role: 'issuer', label: 'Délivrer le permis à 1 Ⓝ', call: 'issue', kind: 'tx', from: 'issuer', to: 'registry',
    need: () => !W.hasLive(LEA, CAT), needTxt: 'un permis vivant existe déjà',
    term: ['issue {"account":"lea.testnet","category":"coursier","identity":"fp-lea"} --deposit 1'],
    run: () => { const l = W.issue(ISS, LEA, CAT, 'fp-lea', 1); return 'jeton ' + l.token_id + ' · 6 points · caution 1,00 Ⓝ'; } },

  { id: 'issue2', role: 'issuer', label: 'Délivrer à lea2 (même empreinte)', call: 'issue', kind: 'no', from: 'issuer', to: 'registry',
    term: ['issue {"account":"lea2.testnet","category":"coursier","identity":"fp-lea"} --deposit 1.25'],
    run: () => { const l = W.issue(ISS, LEA2, CAT, 'fp-lea', 1.25); return 'jeton ' + l.token_id; } },

  { id: 'resolve_up', role: 'issuer', label: 'Trancher le recours : confirmer', call: 'resolve_contest', kind: 'tx', from: 'issuer', to: 'registry',
    need: () => !!lastContest, needTxt: 'aucun recours ouvert',
    term: ['resolve_contest {"mission_id":"' + lastContest + '","upheld":true}'],
    run: () => { W.resolveContest(ISS, CAT, lastContest, true); return 'faute confirmée'; } },

  { id: 'resolve_down', role: 'issuer', label: 'Trancher le recours : annuler', call: 'resolve_contest', kind: 'tx', from: 'issuer', to: 'registry',
    need: () => !!lastContest, needTxt: 'aucun recours ouvert',
    term: ['resolve_contest {"mission_id":"' + lastContest + '","upheld":false}'],
    run: () => { W.resolveContest(ISS, CAT, lastContest, false); return 'faute annulée, points rendus'; } },

  { id: 'strike', role: 'issuer', label: 'Avertir la plateforme', call: 'strike_platform', kind: 'tx', from: 'issuer', to: 'platform',
    term: ['strike_platform {"account":"missions.testnet"}'],
    run: () => { W.strikePlatform(ISS, PLAT); return 'avertissement ' + (W.platforms[PLAT].warnings) + '/3'; } },

  { id: 'revoke', role: 'issuer', label: 'Révoquer le permis', call: 'revoke_license', kind: 'tx', from: 'issuer', to: 'registry',
    need: () => W.hasLive(LEA, CAT), needTxt: 'aucun permis vivant',
    term: ['revoke_license {"account":"lea.testnet","category":"coursier","reason":"..."}'],
    run: () => { W.revokeLicense(ISS, LEA, CAT, 'sanction'); return 'permis révoqué'; } },

  { id: 'post', role: 'client', label: 'Publier une mission à 0,10 Ⓝ', call: 'post', kind: 'tx', from: 'client', to: 'platform',
    term: ['missions.post {"reward":"0.1"} --deposit 0.1'],
    run: () => { const id = W.post(CLI, 0.1, 0.1); lastMission = id; return 'mission ' + id + ' · 0,10 Ⓝ sous séquestre'; } },

  { id: 'close_clean', role: 'client', label: 'Clôturer : mission propre', call: 'close(clean)', kind: 'tx', from: 'client', to: 'registry',
    need: () => !!lastTaken(), needTxt: 'aucune mission acceptée',
    term: () => ['missions.close {"mission_id":"' + lastTaken() + '","outcome":"clean"}'],
    run: () => { const r = W.close(CLI, lastTaken(), 'clean'); return '0,10 Ⓝ vers ' + r.mission.worker + ' · points inchangés'; } },

  { id: 'close_medium', role: 'client', label: 'Clôturer : faute moyenne (−3)', call: 'close(medium)', kind: 'tx', from: 'client', to: 'registry',
    need: () => !!lastTaken(), needTxt: 'aucune mission acceptée',
    term: () => ['missions.close {"mission_id":"' + lastTaken() + '","outcome":"medium"}'],
    run: () => { const r = W.close(CLI, lastTaken(), 'medium'); F.medium = true; return '−3 points · ' + r.record.points + ' restants'; } },

  { id: 'close_severe', role: 'client', label: 'Clôturer : faute grave (−6)', call: 'close(severe)', kind: 'tx', from: 'client', to: 'registry',
    need: () => !!lastTaken(), needTxt: 'aucune mission acceptée',
    term: () => ['missions.close {"mission_id":"' + lastTaken() + '","outcome":"severe"}'],
    run: () => { const r = W.close(CLI, lastTaken(), 'severe'); F.severe = true; return '−6 points · caution ponctionnée'; } },

  { id: 'withdraw', role: 'client', label: "Retirer l'indemnité", call: 'withdraw', kind: 'pay', from: 'client', to: 'registry',
    need: () => (W.credits[CLI] || 0) > 0, needTxt: "aucune indemnité en attente",
    term: ['withdraw {} sign-as client.testnet'],
    run: () => { const amt = W.credits[CLI]; W.withdraw(CLI); F.compensated = true; F.withdrawn = (F.withdrawn || 0) + amt; return amt.toFixed(2).replace('.', ',') + ' Ⓝ → client.testnet'; } },

  { id: 'accept', role: 'pro', label: 'Accepter la mission', call: 'accept → is_allowed', kind: 'xcc', from: 'pro', to: 'registry',
    need: () => !!lastOpen(), needTxt: 'aucune mission à prendre',
    term: () => ['missions.accept {"mission_id":"' + lastOpen() + '"}', '  ↳ xcc demerit.is_allowed → 10 Tgas → on_allowed'],
    run: () => { const m = W.accept(LEA, lastOpen(), CAT, null); F.accepted = true; return 'mission ' + m.id + ' attribuée'; } },

  { id: 'topup', role: 'pro', label: 'Compléter la caution (+0,65 Ⓝ)', call: 'top_up_bond', kind: 'pay', from: 'pro', to: 'registry',
    need: () => W.hasLive(LEA, CAT), needTxt: 'aucun permis vivant',
    term: ['top_up_bond {"category":"coursier"} --deposit 0.65'],
    run: () => { W.topUpBond(LEA, CAT, 0.65); F.back = true; return 'caution complétée'; } },

  { id: 'excess', role: 'pro', label: "Retirer l'excédent de caution", call: 'withdraw_bond_excess', kind: 'pay', from: 'registry', to: 'pro',
    need: () => { const st = W.status(LEA, CAT); return !!st && st.bond > st.required_bond + 1e-9; }, needTxt: 'pas d’excédent',
    term: ['withdraw_bond_excess {"category":"coursier"}'],
    run: () => { const v = W.withdrawBondExcess(LEA, CAT); return v.toFixed(2).replace('.', ',') + ' Ⓝ récupérés'; } },

  { id: 'delegate', role: 'pro', label: 'Déléguer à agent1.lea', call: 'delegate', kind: 'tx', from: 'pro', to: 'registry',
    need: () => W.hasLive(LEA, CAT), needTxt: 'aucun permis vivant',
    term: ['delegate {"delegate":"agent1.lea.testnet","expires_at":+90 j}'],
    run: () => { W.delegate(LEA, CAT, AG, W.now + 90 * 86400); return 'flotte : agent1.lea.testnet répond pour Léa'; } },

  { id: 'revoke_delegate', role: 'pro', label: 'Révoquer la délégation', call: 'revoke_delegate', kind: 'tx', from: 'pro', to: 'registry',
    need: () => !!W.delegationOf(AG, CAT), needTxt: 'aucune délégation',
    term: ['revoke_delegate {"delegate":"agent1.lea.testnet"}'],
    run: () => { W.revokeDelegate(LEA, CAT, AG); return 'délégation révoquée'; } },

  { id: 'stage', role: 'pro', label: 'Réclamer le stage (+4)', call: 'claim_stage', kind: 'tx', from: 'pro', to: 'registry',
    need: () => { const st = W.status(LEA, CAT); return !!st && st.streak_ok >= 5; }, needTxt: '5 missions propres d’affilée',
    term: ['claim_stage {"category":"coursier"}'],
    run: () => { W.claimStage(LEA, CAT); return '+4 points'; } },

  { id: 'contest', role: 'pro', label: 'Contester (dépôt 0,10 Ⓝ)', call: 'contest', kind: 'tx', from: 'pro', to: 'registry',
    need: () => { const st = W.status(LEA, CAT); return !!st && st.recent_reports.some(r => r.state === 'applied' && r.class !== 'clean'); },
    needTxt: 'aucun signalement à contester',
    term: ['contest {"mission_id":"?"} --deposit 0.1'],
    run: () => { const id = lastTaken() || (lastMission || 1); W.contest(LEA, CAT, id, 0.1); lastContest = id; return 'recours ouvert · fenêtre 7 jours'; } },

  { id: 'transfer', role: 'pro', label: 'Vendre le permis', call: 'nft_transfer', kind: 'no', from: 'pro', to: 'client',
    need: () => W.hasLive(LEA, CAT), needTxt: 'aucun permis vivant',
    term: ['nft_transfer {"receiver_id":"client.testnet","token_id":"demerit-1"} --depositYocto 1'],
    run: () => { W.nftTransfer(); return 'vendu'; } },

  { id: 'renounce', role: 'pro', label: 'Renoncer au permis', call: 'renounce', kind: 'tx', from: 'pro', to: 'registry',
    need: () => W.hasLive(LEA, CAT), needTxt: 'aucun permis vivant',
    term: ['renounce {"category":"coursier"}'],
    run: () => { W.renounce(LEA, CAT); return 'permis rendu'; } },

  { id: 'record', role: 'platform', label: 'Enregistrer le résultat', call: 'record_mission', kind: 'tx', from: 'platform', to: 'registry',
    need: () => !!lastTaken(), needTxt: 'aucune mission en cours',
    term: ['record_mission {"category":"coursier","outcome":"clean"} sign-as missions.testnet'],
    run: () => { const rec = W.recordMission(PLAT, LEA, CAT, 'm-' + lastTaken(), 'clean', CLI); return 'points ' + rec.before + ' → ' + rec.after; } },

  { id: 'v_status', role: 'registry', label: 'status()', call: 'view status', kind: 'view', from: 'registry', to: 'pro',
    term: ['view status {"account":"lea.testnet","category":"coursier"}'],
    run: () => { const s = W.status(LEA, CAT); return s ? JSON.stringify({ points: s.points, cap: s.cap, status: s.status }) : 'null'; } },

  { id: 'v_check', role: 'registry', label: 'check()', call: 'view check', kind: 'view', from: 'registry', to: 'pro',
    term: ['view check {"account":"lea.testnet","category":"coursier"}'],
    run: () => { const c = W.check(LEA, CAT, { min_points: 3 }); return JSON.stringify(c); } },

  { id: 'v_allowed', role: 'registry', label: 'is_allowed()', call: 'view is_allowed', kind: 'view', from: 'registry', to: 'pro',
    term: ['view is_allowed {"account":"lea.testnet","category":"coursier"}'],
    run: () => { const a = W.isAllowed(LEA, CAT, null); return a ? 'true' : 'false'; } },

  { id: 'v_nft', role: 'registry', label: 'nft_token()', call: 'view nft_token', kind: 'view', from: 'registry', to: 'registry',
    term: ['view nft_token {"token_id":"demerit-1"}'],
    run: () => { const s = W.status(LEA, CAT); return s ? s.token_id : 'null'; } },

  { id: 'm6', role: 'time', label: 'Avancer de 6 mois (zéro transaction)', call: 'le temps passe', kind: 'view', from: 'registry', to: 'pro',
    term: ['# +6 mois — aucune transaction, la lecture recalcule'],
    run: () => { const before = (W.status(LEA, CAT) || {}).points || 0; W.advanceMonths(6); const after = (W.status(LEA, CAT) || {}).points || 0;
      if (after > before) F.regen = true; return 'points ' + before + ' → ' + after; } }
];

/* ---------- les 7 attaques de `make attack` ---------- */
const ATKS = [
  { id: 'a1', label: 'Enregistrer sans agrément', run: () => { W.recordMission('pirate.testnet', LEA, CAT, 'm-1', 'clean', CLI); return 'accepté'; },
    accept: [ERR.NOT_PLATFORM] },
  { id: 'a2', label: 'Enregistrer deux fois', need: () => Object.keys(W.seen).length > 0, needTxt: 'une mission déjà enregistrée',
    run: () => { const id = lastTaken() || 1; W.recordMission(PLAT, LEA, CAT, 'm-' + id, 'clean', CLI); W.recordMission(PLAT, LEA, CAT, 'm-' + id, 'clean', CLI); return 'accepté'; },
    accept: [ERR.MISSION_ALREADY_RECORDED] },
  { id: 'a3', label: 'Second permis, même empreinte', need: () => W.hasLive(LEA, CAT), needTxt: 'un permis vivant',
    run: () => { W.issue(ISS, 'lea3.testnet', CAT, 'fp-lea', 5); return 'accepté'; },
    accept: [ERR.IDENTITY_ALREADY_LICENSED, ERR.IDENTITY_SUSPENDED] },
  { id: 'a4', label: 'Transférer le permis', need: () => W.hasLive(LEA, CAT), needTxt: 'un permis vivant',
    run: () => { W.nftTransfer(); return 'accepté'; }, accept: [ERR.SOULBOUND] },
  { id: 'a5', label: 'Soutirer la caution', need: () => W.hasLive(LEA, CAT), needTxt: 'un permis vivant',
    run: () => { W.withdrawBondExcess(LEA, CAT); return 'accepté'; }, accept: [ERR.UNDER_BONDED, ERR.NOTHING_TO_WITHDRAW] },
  { id: 'a6', label: 'Délégué révoqué accepte', need: () => true,
    setup: () => { W.delegations[AG + '|' + CAT] = { holder: LEA, delegate: AG, category: CAT, expires_at: W.now - 1 }; if (!lastOpen()) W.post(CLI, 0.1, 0.1); },
    run: () => { const id = lastOpen(); W.accept(AG, id, CAT, null); return 'accepté'; }, accept: [ERR.DELEGATION_EXPIRED, ERR.NO_LICENSE] },
  { id: 'a7', label: 'Plateforme suspendue enregistre', need: () => true,
    setup: () => { if (!W.platforms[PLAT]) W.platforms[PLAT] = { active: true, warnings: 0, approved_at: 0, category: CAT };
      const p = W.platforms[PLAT]; while (p.active) { p.warnings += 1; if (p.warnings >= W.r.platform_strike_limit) p.active = false; } },
    teardown: () => { W.approvePlatform(ISS, CAT, PLAT); },
    run: () => { W.recordMission(PLAT, LEA, CAT, 'm-x', 'clean', CLI); return 'accepté'; }, accept: [ERR.PLATFORM_SUSPENDED] }
];

/* ---------- objectifs ---------- */
const OBJS = [
  { id: 'kyc', n: 'KYC', test: () => F.kyc },
  { id: 'approve', n: 'plateforme agréée', test: () => !!(W.platforms[PLAT] && W.platforms[PLAT].active) },
  { id: 'issue', n: 'permis délivré', test: () => W.hasLive(LEA, CAT) },
  { id: 'post', n: 'mission publiée', test: () => Object.keys(W.missions).length > 0 },
  { id: 'work', n: 'mission acceptée', test: () => F.accepted },
  { id: 'clean', n: 'mission propre', test: () => (W.status(LEA, CAT) || {}).missions_ok >= 1 },
  { id: 'medium', n: 'faute moyenne', test: () => F.medium },
  { id: 'regen', n: 'le temps répare', test: () => F.regen },
  { id: 'severe', n: 'zéro point', test: () => F.severe },
  { id: 'compensated', n: 'client indemnisé', test: () => (W.credits[CLI] || 0) > 0 || F.compensated },
  { id: 'refused', n: 'refusé', test: () => F.refused },
  { id: 'identity', n: 'le casier suit', test: () => F.identity },
  { id: 'soulbound', n: 'invendable', test: () => F.soulbound },
  { id: 'back', n: 'revenu', test: () => F.back && W.isAllowed(LEA, CAT, null) },
  { id: 'i2', n: 'comptes justes', test: () => W.invariant().ok }
];

/* ---------- interface ---------- */
function buildUI() {
  const roles = $('#roles');
  roles.innerHTML = ROLES.map(r => '<button data-r="' + r.id + '"' + (r.id === role ? ' class="on"' : '') + '>' + r.n + '</button>').join('');
  roles.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { role = b.dataset.r; buildUI(); } });
  const ob = $('#objs');
  ob.innerHTML = OBJS.map(o => '<span class="ob" data-o="' + o.id + '">' + o.n + '</span>').join('');
  const at = $('#atks');
  at.innerHTML = ATKS.map(a => '<button class="atk" data-a="' + a.id + '">' + a.label + '</button>').join('');
  at.addEventListener('click', e => { const b = e.target.closest('button'); if (b) runAttack(b.dataset.a, b); });
  renderActions();
}
function renderActions() {
  const box = $('#acts');
  const list = ACTS.filter(a => a.role === role);
  box.innerHTML = list.map(a => {
    const ok = !a.need || a.need();
    const why = ok ? '' : (a.needTxt || 'précondition');
    return '<button class="act k-' + a.kind + (ok ? '' : ' off') + '" data-i="' + a.id + '"' + (ok ? '' : ' title="' + why + '"') + '>' +
      '<i></i><b>' + a.label + '</b><code>' + a.call + '</code>' + (ok ? '' : '<em>' + why + '</em>') + '</button>';
  }).join('');
  box.onclick = e => { const b = e.target.closest('.act'); if (b && !b.classList.contains('off')) runAct(b.dataset.i); };
}
function renderGoals() {
  let n = 0;
  OBJS.forEach(o => { const el = $('[data-o="' + o.id + '"]'); if (!el) return; const ok = !!o.test(); el.classList.toggle('ok', ok); if (ok) n++; });
  const c = $('#obj-n'); if (c) c.textContent = n + '/' + OBJS.length;
  let k = 0;
  ATKS.forEach(a => { const el = $('[data-a="' + a.id + '"]'); if (!el) return; const ok = a.accept.some(c => c === F['atk_' + a.id]); el.classList.toggle('ok', ok); if (ok) k++; });
  const c2 = $('#atk-n'); if (c2) c2.textContent = k + '/' + ATKS.length + ' refusées';
}
function paint() {
  const s = snap();
  global.CORE.paint(s, null);
  renderGoals();
}
async function typeLines(lines, cls) {
  for (const l of lines) {
    global.CORE.print([[cls || 'out', l]]);
    await global.CORE.api.wait(110);
  }
}
function eventsSince() {
  const out = [];
  for (let i = logMark; i < W.log.length; i++) out.push('EVENT ' + W.log[i].ev + ' · ' + JSON.stringify(W.log[i].data));
  logMark = W.log.length;
  return out;
}
async function runAct(id) {
  const a = ACTS.find(x => x.id === id); if (!a) return;
  const meta = { id: 'm-' + id, title: a.label, kind: a.kind, from: a.from, to: a.to, call: a.call };
  global.CORE.paint(snap(), meta);
  await typeLines(typeof a.term === 'function' ? a.term() : a.term, 'cmd');
  let out = '', code = null;
  try { out = a.run(); }
  catch (e) { code = String(e && e.message ? e.message : e); }
  logMark = W.log.length;
  if (code) {
    if (code === ERR.LICENSE_SUSPENDED || code === ERR.UNDER_BONDED) F.refused = true;
    if (code === ERR.IDENTITY_SUSPENDED || code === ERR.IDENTITY_ALREADY_LICENSED) F.identity = true;
    if (code === ERR.SOULBOUND) F.soulbound = true;
    global.CORE.print([['err', '✕ ' + code]]);
    global.CORE.stamp(code, 'code');
    await global.CORE.api.wait(500);
  } else {
    global.CORE.print([['ok', '✓ ' + out]]);
    global.CORE.stamp(out.length > 26 ? out.slice(0, 26) : out, 'num');
  }
  paint();
  const i2 = W.invariant();
  global.CORE.print([['com', 'invariant I2 : ' + (i2.ok ? 'équilibré (' + i2.left.toFixed(2) + ')' : 'ÉCART ' + i2.left.toFixed(2) + ' ≠ ' + i2.right.toFixed(2))]]);
  if (global.SCENE && global.SCENE.manual) global.SCENE.manual(snap(), meta);
}
async function runAttack(id, btn) {
  const a = ATKS.find(x => x.id === id); if (!a) return;
  if (a.need && !a.need()) { btn.classList.add('off'); return; }
  if (a.setup) a.setup();
  let code = null;
  try { a.run(); } catch (e) { code = String(e && e.message ? e.message : e); }
  if (a.teardown) a.teardown();
  if (code && a.accept.indexOf(code) >= 0) {
    F['atk_' + a.id] = code;
    global.CORE.print([['err', '✕ ' + code + '  (attaque refusée)']]);
    global.CORE.stamp(code, 'code');
    await global.CORE.api.wait(420);
  } else {
    global.CORE.print([['out', code ? ('✕ ' + code) : '!! acceptée — le contrat n’a pas refusé']]);
  }
  paint();
}

/* ---------- API appelée par le core ---------- */
const AUTO_M = new URLSearchParams(location.search).get('manuel') === '1';
async function script() {
  const seq = ['kyc', 'approve', 'issue', 'post', 'accept', 'close_clean', 'post', 'accept', 'close_medium',
    'm6', 'post', 'accept', 'close_severe', 'withdraw', 'post', 'accept', 'issue2', 'm6', 'post', 'accept', 'topup', 'accept', 'transfer'];
  let n = 0, fatal = null;
  try {
    for (const id of seq) { const a = ACTS.find(x => x.id === id); if (!a) continue; role = a.role; await runAct(id); n++; }
    for (const a of ATKS) { const el = $('[data-a="' + a.id + '"]'); await runAttack(a.id, el || { classList: { add() { } } }); n++; }
  } catch (e) { fatal = String(e && e.message ? e.message : e); }
  const objs = OBJS.filter(o => { try { return o.test(); } catch (e) { return false; } }).length;
  const missing = OBJS.filter(o => { try { return !o.test(); } catch (e) { return true; } }).map(o => o.id);
  const atks = ATKS.filter(a => F['atk_' + a.id]).length;
  const i2 = W.invariant(), s = snap();
  const txt = sel => { const e = $(sel); return e ? e.textContent.trim() : null; };
  const dom = { pts: txt('#mx-pts b'), bond: txt('#mx-bond b'), client: txt('#mx-client b'), fund: txt('#mx-fund b') };
  const ok = !fatal && objs === OBJS.length && atks === ATKS.length && i2.ok && dom.pts === '6' && dom.bond === '1,25' && dom.client === '0,20' && dom.fund === '0,20';
  const res = { ok, mode: 'manuel', beats: n, of: seq.length + ATKS.length, objectives: objs, objectiveTotal: OBJS.length,
    attacks: atks, attackTotal: ATKS.length, invariant: i2.ok, state: s, dom, fatal, missing,
    termLines: $('#term') ? $('#term').children.length : 0, lastLine: $('#term') && $('#term').lastChild ? $('#term').lastChild.textContent : '',
    errors: (global.CORE.errors || []).slice() };
  let pre = $('#result');
  if (!pre) { pre = document.createElement('script'); pre.type = 'application/json'; pre.id = 'result'; document.body.appendChild(pre); }
  pre.textContent = JSON.stringify(res); document.documentElement.dataset.done = ok ? 'ok' : 'ko'; window.__demerit = res;
}
global.MANUEL = {
  init() {
    document.documentElement.dataset.manuel = '1';
    if (!built) { built = true; W = new World({ monthSeconds: MO }); }
    else this.reset(true);
    buildUI();
    global.CORE.print([['com', '# bac à sable — le moteur est le portage 1:1 de rules.rs (23/23 vecteurs Rust)']]);
    global.CORE.print([['out', 'cliquez un rôle, puis une action : chaque bouton est un vrai appel du contrat']]);
    paint();
    if (AUTO_M) script();
  },
  reset(keep) {
    W = new World({ monthSeconds: MO }); F = {}; logMark = 0; lastMission = null; lastContest = null;
    if (!keep) { const t = $('#term'); if (t) t.innerHTML = ''; }
    paint();
  },
  teardown() { }
};
})(typeof window !== 'undefined' ? window : globalThis);

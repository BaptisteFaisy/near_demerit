/* demerit — web app (option A). Every button runs the real contract rules (moteur.js is a 1:1 port of
   contracts/demerit/src/*.rs + contracts/missions/src/lib.rs) and prints the matching on-chain calls.
   The public check page can also read the live registry on NEAR testnet (JSON-RPC, no wallet). */
(function () {
'use strict';
const { World } = window.DEMERIT;
const CAT = 'coursier', PF = 'platform.demerit.testnet', REG = 'ledger.demerit.testnet';
const w = new World();
const $ = s => document.querySelector(s);
const V = window.DemeritViews;
const esc = V.esc, N = V.N, BOX = V.BOX, PAGE = V.PAGE, ICON = V.ICON;

/* ---------- mode: demo (simulation) | live (real testnet) ---------- */
const MODE_KEY = 'demerit.mode';
const Live = window.DemeritLive;
const Chain = window.DemeritChain;
const Txs = window.DemeritTxs;
const STATUS_EN = {
  probation: 'Probation', probatoire: 'Probation', actif: 'Active', active: 'Active', valide: 'Active',
  suspendu: 'Suspended', suspended: 'Suspended', revoque: 'Revoked', revoked: 'Revoked',
  rendu: 'Renounced', renounced: 'Renounced'
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
};
const query = new URLSearchParams(location.search);
const mode = () => (query.get('mode') || store.get(MODE_KEY) || 'demo') === 'live' ? 'live' : 'demo';
const isLive = () => ui.mode === 'live';
/* Same shape whether the numbers come from the simulation or from the chain. */
const norm = s => s ? Object.assign({}, s, {
  status: STATUS_EN[s.status] || s.status,
  bond: Number(s.bond), required_bond: Number(s.required_bond)
}) : null;

/* ---------- people ---------- */
const PEOPLE = {
  lea:  { name: 'Léa Martin', acct: 'lea.demerit.testnet', role: 'Courier', ini: 'LM', cls: '', id: 'fp-lea', pages: ['licence', 'jobs', 'wallet', 'check'] },
  sam:  { name: 'Sam Okafor', acct: 'client.demerit.testnet', role: 'Customer', ini: 'SO', cls: 'c', pages: ['orders', 'wallet', 'check'] },
  lea2: { name: 'Léa Martin', acct: 'lea2.demerit.testnet', role: 'New account', ini: 'LM', cls: 'n', id: 'fp-lea', pages: ['licence', 'check'] }
};
/* ---------- plain-English refusals ---------- */
function why(code) {
  const s = w.status('lea.demerit.testnet', CAT);
  return ({
    ERR_LICENSE_SUSPENDED: ['Your licence is suspended', 'Zero points: no platform can give you jobs until ' + date(s ? s.suspended_until : 0) + '.'],
    ERR_UNDER_BONDED: ['Your deposit is too low', 'You have ' + N(s && s.bond) + ' Ⓝ locked, but ' + N(s && s.required_bond) + ' Ⓝ is now required. Top it up to work again.'],
    ERR_IDENTITY_SUSPENDED: ['Same person, same record', 'This identity already holds a suspended licence. A new account does not erase it.'],
    ERR_IDENTITY_ALREADY_LICENSED: ['You already have a licence', 'One live licence per person.'],
    ERR_SOULBOUND: ['A licence cannot be sold', 'It belongs to the person who earned it. Transfers are refused by the contract.'],
    ERR_NO_LICENSE: ['You need a licence first', 'Platforms only give jobs to licensed couriers.'],
    ERR_NOTHING_TO_WITHDRAW: ['Nothing to withdraw', '']
  }[code]) || ['Refused', ''];
}

/* ---------- time (sandbox clock) ---------- */
const T0 = Date.UTC(2026, 10, 13);
const date = s => new Date(T0 + s * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const monthLabel = () => new Date(T0 + w.now * 1000).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/* ---------- on-chain log ---------- */
/* One formatter for every event, demo and live alike (web/events.js). */
const EV = window.DemeritEvents;
function logLine(cls, html) {
  const ol = $('#log'), li = document.createElement('li'); li.className = 'new'; li.innerHTML = '<span class="' + cls + '">' + html + '</span>';
  ol.appendChild(li); while (ol.children.length > 7) ol.removeChild(ol.firstChild);
}
function call(signer, target, method, args, fn, opts = {}) {
  const before = w.log.length;
  logLine('c', '$ ' + esc(signer) + ' → ' + esc(target) + '.' + method + '(' + esc(args || '') + ')' + (opts.dep ? ' · deposit ' + opts.dep + ' Ⓝ' : ''));
  if (opts.xcc) logLine('x', '  ↳ cross-contract call: ' + REG + '.is_allowed(' + esc(signer) + ') · 10 Tgas · callback on_allowed');
  try {
    const v = fn();
    for (const e of w.log.slice(before)) { logLine('e', '  EVENT ' + esc(EV.format(e.ev, e.data))); }
    if (opts.xcc) logLine('o', '  ✓ is_allowed → true · mission assigned');
    else logLine('o', '  ✓ ok');
    refresh(); return { ok: true, v };
  } catch (err) {
    const code = typeof err === 'string' ? err : (err && err.message) || 'ERR';
    if (opts.xcc) logLine('x', '  ↳ is_allowed → false');
    logLine('r', '  ✕ ' + esc(code));
    refresh(); return { ok: false, code };
  }
}
function view(method, args, fn) {
  logLine('m', '$ near view ' + REG + ' ' + method + '(' + esc(args) + ') · free · no account · no gas');
  return fn();
}
function refresh() { const i = w.invariant(); $('#inv').textContent = 'I2 ' + (i.ok ? '✓' : '✕') + ' every NEAR accounted · ' + N(i.left) + ' Ⓝ'; }

/* ---------- world setup: the issuer approves the delivery platform; other customers post jobs ---------- */
w.approvePlatform(w.issuer, CAT, PF);
const JOB = {};
function seedJob(poster, title, route, reward) { const id = w.post(poster, reward, reward); JOB[id] = { title, route }; return id; }
seedJob('nora.demerit.testnet', 'Lunch order · 2 bags', 'Café Lomi → Rue Saint-Maur', 0.12);
seedJob('studio9.demerit.testnet', 'Documents · signature', 'Studio 9 → Place de Clichy', 0.08);
w.log.length = 0;

/* ---------- ui state ---------- */
const ui = {
  who: 'lea', page: 'licence', check: {}, delivered: {}, banner: null, liveAcct: 'lea.demerit.testnet', checked: null,
  mode: mode(),
  chain: { status: {}, missions: [], credit: '0', fund: '0', loading: false, error: null }
};
const me = () => PEOPLE[ui.who];
const licOf = acct => isLive() ? norm(ui.chain.status[acct]) : norm(w.status(acct, CAT));

function toast(title, body, cls) {
  const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.innerHTML = '<b>' + esc(title) + '</b>' + (body ? esc(body) : '');
  const box = $('#toasts'); box.appendChild(t); while (box.children.length > 2) box.removeChild(box.firstChild); setTimeout(() => t.remove(), 4200);
}

/* ---------- header / nav ---------- */
function renderChrome() {
  const p = me();
  $('#acctAv').textContent = p.ini; $('#acctAv').className = 'av ' + p.cls;
  $('#acctName').textContent = p.name; $('#acctId').textContent = p.acct;
  $('#modes').innerHTML = ['demo', 'live'].map(m =>
    '<button data-mode="' + m + '" class="' + (ui.mode === m ? 'on' : '') + '">' + (m === 'demo' ? 'Demo' : 'Live testnet') + '</button>').join('');
  const badge = $('#chainMode');
  if (badge) { badge.textContent = isLive() ? '● live · ' + REG : 'sandbox · same code as testnet'; badge.classList.toggle('on', isLive()); }
  $('#side').innerHTML = p.pages.map(k => {
    const badge = k === 'jobs' ? openJobs().length : k === 'orders' ? toRate().length : 0;
    return '<a href="#/' + k + '" data-page="' + k + '" class="' + (ui.page === k ? 'on' : '') + '">' + ICON[k] + PAGE[k] + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</a>';
  }).join('') + '<div class="clock"><small>' + (isLive() ? 'Chain time' : 'Sandbox time') + '</small><b id="month">' + (isLive() ? new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : monthLabel()) + '</b>' +
    (isLive() ? '<span class="muted" style="font-size:12px">Points are recomputed from timestamps at read time.</span>' : '<button class="btn sm" id="ff">Fast-forward 6 months</button>') + '</div>';
  $('#acctMenu').innerHTML = '<div class="mh">Switch account</div>' + Object.keys(PEOPLE).map(k => {
    const q = PEOPLE[k]; return '<button class="mi' + (k === ui.who ? ' cur' : '') + '" data-who="' + k + '"><span class="av ' + q.cls + '">' + q.ini + '</span><span class="an"><b>' + q.name + ' · ' + q.role + '</b><i>' + q.acct + '</i></span></button>';
  }).join('');
}
const openJobs = () => Object.values(w.missions).filter(m => m.state === 'open');
const myJobs = () => Object.values(w.missions).filter(m => m.worker === me().acct);
const samJobs = () => Object.values(w.missions).filter(m => m.poster === 'client.demerit.testnet');
const toRate = () => samJobs().filter(m => m.state === 'taken' && ui.delivered[m.id]);

/* ---------- pages ---------- */
function bannerHTML() {
  const b = ui.banner; if (!b) return '';
  return '<div class="ban ' + b.cls + '"><div><b>' + esc(b.title) + '</b>' + esc(b.body) + (b.code ? ' <span class="code">' + esc(b.code) + '</span>' : '') + '</div></div>';
}
const P = {
  licence() {
    const p = me(), s = licOf(p.acct);
    const reps = s ? s.recent_reports.slice().reverse() : [];
    const OUT = { clean: ['On time', 'ok', '0'], light: ['Late', 'warn', '−1'], medium: ['Damaged parcel', 'warn', '−3'], severe: ['Lost parcel', 'no', '−6'] };
    return '<div class="ph"><div><h1>My licence</h1><p>' + (s ? 'Any platform reads this before giving you a job. It is free to read, for anyone.' : 'Get licensed once, work on every platform that checks demerit.') + '</p></div></div>' + bannerHTML() + chainBanner() +
      '<div class="grid2"><div style="display:flex;flex-direction:column;gap:16px">' + V.licenceCard(s, p, isLive() ? V.realDate : date) +
      (s ? '<div style="display:flex;gap:10px"><button class="btn" id="agent">Add an AI agent</button><button class="btn dan" id="sell">Transfer licence</button></div>' : '') + '</div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px;min-height:0"><b style="font:600 17px var(--display)">Record</b>' +
      (reps.length ? reps.slice(0, 5).map(r => { const o = OUT[r.class] || [r.class, '', '']; return '<div style="display:flex;align-items:center;gap:10px;font-size:15px"><span class="pill ' + o[1] + '">' + o[2] + ' pts</span><span>' + o[0] + '</span><span class="sp" style="flex:1"></span><span class="muted mono" style="font-size:13px">' + esc(r.mission_id) + '</span></div>'; }).join('')
        : '<p class="muted" style="margin:0">' + (s ? 'No jobs yet.' : 'Your record follows your identity, not your account.') + '</p>') +
      (s && s.invalidations ? '<p style="margin:6px 0 0;font-size:14px" class="muted">Licence invalidated ' + s.invalidations + '× · deposit price raised to ×' + (s.coefficient / 100).toFixed(2) + '</p>' : '') + '</div></div>';
  },
  jobs() {
    if (isLive()) return V.liveJobs(liveCtx());
    const mine = myJobs().filter(m => m.state === 'taken'), open = openJobs();
    const row = (m, act) => { const j = JOB[m.id] || {}; const ck = ui.check[m.id];
      return '<div class="job" data-job="' + m.id + '"><div class="ic">' + BOX + '</div><div><h3>' + esc(j.title || 'Delivery #' + m.id) + '</h3><p>' + esc(j.route || '') + ' · posted by ' + esc(m.poster) + '</p></div>' +
        '<div class="act"><div class="rw">' + N(m.reward) + ' Ⓝ<small>reward in escrow</small></div>' + act + '</div>' +
        (ck === 'wait' ? '<div class="ck"><span class="spin"></span>Checking your licence on NEAR… <span class="mono muted">platform.demerit.testnet → ledger.demerit.testnet.is_allowed</span></div>'
          : ck && ck.ok ? '<div class="ck ok">✓ Licence valid — the job is yours.</div>'
          : ck && ck.no ? '<div class="ck no"><b>✕ ' + esc(why(ck.no)[0]) + '.</b>&nbsp;' + esc(why(ck.no)[1]) + ' <span class="code">' + esc(ck.no) + '</span></div>' : '') + '</div>'; };
    return '<div class="ph"><div><h1>Jobs</h1><p>Deliveries near you. Accepting asks the demerit registry if you are allowed.</p></div></div>' + bannerHTML() +
      '<div class="jobs">' +
      mine.map(m => row(m, ui.delivered[m.id] ? '<span class="pill">Waiting for rating</span>' : '<button class="btn pri" data-deliver="' + m.id + '">Mark as delivered</button>')).join('') +
      open.slice().reverse().slice(0, 4).map(m => row(m, '<button class="btn pri" data-accept="' + m.id + '">Accept</button>')).join('') +
      (!mine.length && !open.length ? '<div class="card muted">No jobs right now.</div>' : '') + '</div>';
  },
  orders() {
    if (isLive()) return V.liveOrders(liveCtx());
    const js = samJobs().slice().reverse();
    const RATE = '<div class="rate"><button class="btn" data-rate="clean">On time <em>0</em></button><button class="btn" data-rate="light">Late <em>−1</em></button><button class="btn" data-rate="medium">Damaged <em>−3</em></button><button class="btn dan" data-rate="severe">Lost parcel <em>−6</em></button></div>';
    const OUTW = { clean: 'Rated: on time', light: 'Rated: late', medium: 'Rated: damaged (−3 points)', severe: 'Rated: lost parcel (−6 points)' };
    return '<div class="ph"><div><h1>My deliveries</h1><p>Post a delivery, then rate the courier. A serious fault is refunded from the courier\'s deposit.</p></div><span class="sp"></span><button class="btn pri" id="post">Post a delivery · 0.10 Ⓝ</button></div>' + bannerHTML() +
      '<div class="jobs">' + js.slice(0, 4).map(m => { const j = JOB[m.id] || {};
        const st = m.state === 'open' ? '<span class="pill">Waiting for a courier</span>' : m.state === 'taken' && !ui.delivered[m.id] ? '<span class="pill acc">On the way · ' + esc(m.worker) + '</span>' : m.state === 'taken' ? '<span class="pill ok">Delivered by ' + esc(m.worker) + '</span>' : '<span class="pill">' + OUTW[m.outcome] + '</span>';
        return '<div class="job" data-job="' + m.id + '"><div class="ic">' + BOX + '</div><div><h3>' + esc(j.title) + '</h3><p>' + esc(j.route) + '</p></div><div class="act">' + st + '</div>' + (m.state === 'taken' && ui.delivered[m.id] ? '<div style="grid-column:1/-1">' + RATE.replace(/data-rate=/g, 'data-mid="' + m.id + '" data-rate=') + '</div>' : '') + '</div>';
      }).join('') + (js.length ? '' : '<div class="card muted">No deliveries yet.</div>') + '</div>';
  },
  wallet() {
    if (isLive()) return V.liveWallet(liveCtx());
    if (ui.who === 'sam') {
      const c = w.credits['client.demerit.testnet'] || 0, paid = ui.samWithdrawn || 0;
      return '<div class="ph"><div><h1>Wallet</h1><p>When a courier causes a serious fault, the contract pays you from their deposit. No claim, no support ticket.</p></div></div>' + bannerHTML() +
        '<div class="stats"><div class="stat"><small>Compensation available</small><b id="comp">' + N(c) + ' <span>Ⓝ</span></b></div><div class="stat"><small>Withdrawn</small><b>' + N(paid) + ' <span>Ⓝ</span></b></div><div class="stat"><small>Paid by</small><b style="font-size:20px;margin-top:12px">courier deposit</b></div></div>' +
        '<div><button class="btn pri" id="withdraw">Withdraw ' + N(c) + ' Ⓝ</button></div>';
    }
    const s = licOf('lea.demerit.testnet');
    const earned = Object.values(w.missions).filter(m => m.worker === 'lea.demerit.testnet' && m.state === 'closed').reduce((a, m) => a + m.reward, 0);
    const need = s ? Math.max(0, s.required_bond - s.bond) : 0;
    return '<div class="ph"><div><h1>Wallet</h1><p>Your deposit backs your work. Good years lower it; serious faults raise it.</p></div></div>' + bannerHTML() +
      '<div class="stats"><div class="stat"><small>Earned from deliveries</small><b>' + N(earned) + ' <span>Ⓝ</span></b></div>' +
      '<div class="stat"><small>Deposit locked</small><b id="bond">' + N(s && s.bond) + ' <span>Ⓝ</span></b><div class="bar"><i style="width:' + (s ? Math.min(100, s.bond / 1.5 * 100) : 0) + '%"></i><u style="left:' + (s ? s.required_bond / 1.5 * 100 : 0) + '%"></u></div></div>' +
      '<div class="stat"><small>Required deposit</small><b>' + N(s && s.required_bond) + ' <span>Ⓝ</span></b><small style="margin-top:8px">price factor ×' + (s ? (s.coefficient / 100).toFixed(2) : '1.00') + '</small></div></div>' +
      '<div style="display:flex;gap:10px"><button class="btn pri" id="topup"' + (need > 0 ? '' : '') + '>Top up deposit' + (need > 0 ? ' · +' + N(need) + ' Ⓝ' : '') + '</button></div>';
  },
  check() {
    const r = ui.checked;
    return '<div class="ph"><div><h1>Public check</h1><p>Anyone can verify a licence: no wallet, no account, no fee.</p></div></div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:14px"><div class="search"><input id="q" value="' + esc(ui.liveAcct) + '" spellcheck="false"><button class="btn pri" id="doCheck">Check</button></div>' +
      '<span class="muted" style="font-size:14px">Reads <span class="mono">ledger.demerit.testnet</span> on NEAR testnet, live, through public JSON-RPC.</span></div>' +
      (r === 'wait' ? '<div class="card"><span class="spin" style="display:inline-block;vertical-align:middle"></span>&nbsp; Reading NEAR testnet…</div>' : r && r.err ? '<div class="ban no"><div><b>Could not read testnet</b>' + esc(r.err) + '</div></div>' : r ? V.checkCard(r) : '');
  }
};
/* ---------- live pages (real chain data) ---------- */
function render() {
  const p = me(); if (!p.pages.includes(ui.page)) ui.page = p.pages[0];
  renderChrome(); $('#main').innerHTML = P[ui.page]();
}

/* ---------- live testnet read (public check) ---------- */
async function liveStatus(acct) {
  try {
    return await Live.status(acct);
  } catch (e) {
    return { err: 'No licence for ' + acct + ' on testnet, or the network is down.' };
  }
}

/* ---------- live mode: read the chain, never sign it ---------- */
function chainBanner() {
  if (!isLive()) return '';
  if (ui.chain.loading) return '<div class="ban info"><div><b>Reading NEAR testnet…</b> free view calls on ' + REG + '</div></div>';
  if (ui.chain.error) return '<div class="ban no"><div><b>Testnet unreachable</b>' + esc(ui.chain.error) + '</div></div>';
  return '<div class="ban info"><div><b>Live mode</b> every number on this page is read from ' + REG + ' on NEAR testnet, right now.</div></div>';
}

/* Context handed to the shared views for the live pages. */
function liveCtx() {
  return {
    me, licOf, bannerHTML, chainBanner,
    missions: () => ui.chain.missions,
    credit: () => ui.chain.credit,
    fund: () => ui.chain.fund,
    toNear: Chain.toNear,
    platform: PF
  };
}

async function loadLive() {
  if (!isLive()) return;
  ui.chain.loading = true; ui.chain.error = null; render();
  logLine('m', '$ near view ' + REG + ' status({account: "…"}) · testnet · free · no wallet');
  try {
    const accounts = Object.keys(PEOPLE).map(k => PEOPLE[k].acct);
    ui.chain.status = await Live.statuses(accounts);
    ui.chain.missions = await Live.missions();
    ui.chain.credit = await Live.credit('client.demerit.testnet');
    ui.chain.fund = await Live.fund();
    const s = ui.chain.status[me().acct];
    if (s) logLine('o', '  → ' + s.points + '/' + s.cap + ' points · ' + s.status + ' · deposit ' + s.bond + '/' + s.required_bond + ' Ⓝ · price factor ×' + (s.coefficient / 100).toFixed(2));
    logLine('o', '  → ' + (ui.chain.missions || []).length + ' missions on ' + PF + ' · guarantee fund ' + ui.chain.fund + ' Ⓝ');
  } catch (e) {
    ui.chain.error = (e && e.message) || String(e);
    logLine('r', '  ✕ ' + esc(ui.chain.error));
  }
  ui.chain.loading = false; render();
  loadLiveTxs();
}

/* The real transactions of the two contracts: hash, explorer link and the
   events the contracts wrote. The page never signs, it only reads. */
async function loadLiveTxs() {
  if (!isLive()) return;
  try {
    const txs = await Txs.recent(6);
    if (!txs.length) { logLine('m', '# no transaction to show yet on the two contracts'); return; }
    logLine('m', '# the ' + txs.length + ' latest transactions of ' + REG + ' and ' + PF);
    txs.forEach(tx => Txs.lines(tx).forEach(l => logLine(l.cls, esc(l.text))));
  } catch (e) {
    logLine('r', '  ✕ transactions unavailable: ' + esc((e && e.message) || String(e)));
  }
}

function setMode(m) {
  ui.mode = m === 'live' ? 'live' : 'demo';
  store.set(MODE_KEY, ui.mode);
  if (ui.mode === 'live') loadLive(); else render();
}

/* A write action in live mode: the page holds no key, so it hands over the
   exact command to run, plus a wallet link when one can be built. */
function openIntent(spec) {
  const m = $('#modal');
  m.innerHTML = '<div class="dlg"><h2>' + esc(spec.label || spec.method) + '</h2>' +
    '<p class="muted" style="margin:0 0 14px">' + esc(spec.hint || 'This page never holds a key: run the command yourself, or sign it with your wallet.') + '</p>' +
    '<pre class="cmd"><code>' + esc(DemeritActions.command(spec)) + '</code></pre>' +
    '<div class="row"><button class="btn" id="copyCmd">Copy</button><button class="btn" id="walletBtn">Sign with MyNearWallet</button><span class="sp"></span><button class="btn" id="mx">Close</button></div>' +
    '<div id="walletOut" class="muted" style="font-size:13px;margin-top:10px"></div></div>';
  m.hidden = false;
  $('#copyCmd').onclick = () => {
    const cmd = DemeritActions.command(spec);
    if (navigator.clipboard) navigator.clipboard.writeText(cmd).then(() => { $('#walletOut').textContent = 'Command copied.'; });
    else $('#walletOut').textContent = cmd;
  };
  $('#walletBtn').onclick = () => {
    $('#walletOut').textContent = 'Building the wallet link…';
    DemeritActions.walletUrl(spec).then(url => {
      $('#walletOut').innerHTML = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">Open MyNearWallet</a> (check the signing account)' : 'Wallet link unavailable: use the command above.';
    });
  };
}

/* ---------- actions ---------- */
function modal(html) { const m = $('#modal'); m.innerHTML = '<div class="dlg">' + html + '</div>'; m.hidden = false; }
function closeModal() { $('#modal').hidden = true; }
function getLicence() {
  const p = me();
  modal('<h2>Get your courier licence</h2><p class="muted" style="margin:0">Two steps. Your ID never goes on chain.</p><div class="steps"><i class="on"></i><i></i></div>' +
    '<div class="idcard"><div class="ph"></div><div><b style="font-size:17px">' + esc(p.name) + '</b><br><span class="muted">ID card · checked by the Paris Courier Board</span></div></div>' +
    '<div class="row"><button class="btn" id="mx">Cancel</button><button class="btn pri" id="verify">Verify my identity</button></div>');
}
function verifyId() {
  const p = me();
  logLine('m', '# off chain — the issuer checks the ID of ' + esc(p.name) + ' and keeps the salt');
  logLine('m', '  fingerprint = hash(salt ‖ identity) → ' + p.id);
  modal('<h2>Lock your deposit</h2><p class="muted" style="margin:0">Identity verified. Fingerprint <span class="fp">' + p.id + '</span> — a salted hash, nothing personal.</p><div class="steps"><i class="on"></i><i class="on"></i></div>' +
    '<div class="card" style="display:flex;align-items:center;gap:14px"><b style="font:700 34px var(--display)">1.00 Ⓝ</b><span class="muted">deposit, locked in the licence. It repays clients if you cause a serious fault.</span></div>' +
    '<div class="row"><button class="btn" id="mx">Cancel</button><button class="btn pri" id="issue">Lock 1 Ⓝ and get my licence</button></div>');
}
function issue() {
  const p = me(); closeModal();
  if (isLive()) return openIntent({
    contract: REG, method: 'issue', args: { account: p.acct, category: CAT, identity: p.id },
    deposit: '1', signer: 'issuer.demerit.testnet',
    label: 'Issue the licence to ' + p.acct,
    hint: 'Only the issuer can issue a licence: it checks the identity off chain and keeps the salt. The 1 Ⓝ deposit is locked in the licence.'
  });
  const r = call('issuer.demerit.testnet', REG, 'issue', '{account: "' + p.acct + '", identity: "' + p.id + '"}', () => w.issue(w.issuer, p.acct, CAT, p.id, 1), { dep: '1' });
  if (r.ok) { ui.banner = null; toast('Licence issued', '6 points on probation · 1 Ⓝ deposit locked.', 'ok'); }
  else { const y = why(r.code); ui.banner = { cls: 'no', title: y[0] + '.', body: ' ' + y[1], code: r.code }; toast(y[0], y[1], 'no'); }
  render();
}
function accept(id) {
  if (isLive()) return openIntent({
    contract: PF, method: 'accept', args: { mission_id: id }, signer: 'lea.demerit.testnet',
    label: 'Accept delivery #' + id,
    hint: 'The platform calls ' + REG + '.is_allowed() first. If the licence is refused, the job is not assigned.'
  });
  ui.check[id] = 'wait'; ui.banner = null; render();
  setTimeout(() => {
    const r = call('lea.demerit.testnet', PF, 'accept', '{mission_id: ' + id + '}', () => w.accept('lea.demerit.testnet', id, CAT), { xcc: true });
    ui.check[id] = r.ok ? { ok: true } : { no: r.code };
    if (!r.ok) toast(why(r.code)[0], why(r.code)[1], 'no');
    render();
  }, 1100);
}
function deliver(id) { ui.delivered[id] = true; delete ui.check[id]; toast('Marked as delivered', 'Sam will rate the delivery.', 'ok'); render(); }
function post() {
  if (isLive()) return openIntent({
    contract: PF, method: 'post', args: { reward: '100000000000000000000000' }, deposit: '0.1', signer: 'client.demerit.testnet',
    label: 'Post a delivery · 0.10 Ⓝ',
    hint: 'The 0.10 Ⓝ is held in escrow by the platform contract and paid to the courier when the delivery closes.'
  });
  const n = samJobs().length;
  const T = [['Parcel · 1.2 kg', '11 Rue Oberkampf → 4 Place de la Bastille'], ['Flowers · fragile', 'Marché aux Fleurs → Rue de Rivoli'], ['Laptop · high value', 'Rue de Rennes → Avenue de France'], ['Groceries · 3 bags', 'Rue Cler → Rue de Grenelle'], ['Keys · urgent', 'Gare de Lyon → Rue de Charonne']][n % 5];
  const r = call('client.demerit.testnet', PF, 'post', '{reward: 0.10}', () => w.post('client.demerit.testnet', 0.1, 0.1), { dep: '0.10' });
  if (r.ok) { JOB[r.v] = { title: T[0], route: T[1] }; toast('Delivery posted', '0.10 Ⓝ held in escrow by the platform contract.', 'ok'); }
  render();
}
function rate(id, outcome) {
  if (isLive()) return openIntent({
    contract: PF, method: 'close', args: { mission_id: id, outcome: outcome }, signer: 'client.demerit.testnet',
    label: 'Rate delivery #' + id + ' — ' + outcome,
    hint: 'The platform pays the courier, then calls ' + REG + '.record_mission(): points are removed and a serious fault refunds you from the deposit.'
  });
  const s0 = licOf('lea.demerit.testnet');
  const r = call('client.demerit.testnet', PF, 'close', '{mission_id: ' + id + ', outcome: "' + outcome + '"}', () => w.close('client.demerit.testnet', id, outcome));
  if (r.ok) { logLine('x', '  ↳ cross-contract call: ' + PF + ' → ' + REG + '.record_mission · courier paid ' + N(w.missions[id].reward) + ' Ⓝ');
    const s1 = licOf('lea.demerit.testnet'), lost = (s0 ? s0.points : 0) - (s1 ? s1.points : 0);
    if (outcome === 'severe') { const c = w.credits['client.demerit.testnet'] || 0; ui.banner = { cls: 'ok', title: 'You were compensated ' + N(c) + ' Ⓝ.', body: ' Paid from the courier\'s deposit by the contract. Withdraw it from your wallet.' }; toast('Compensated ' + N(c) + ' Ⓝ', 'From the courier\'s deposit.', 'ok'); }
    else toast('Thanks for rating', lost ? 'The courier lost ' + lost + ' points.' : 'The courier keeps every point.', lost ? 'no' : 'ok');
  }
  render();
}
function topup() {
  const s = licOf('lea.demerit.testnet'); const need = s ? Math.max(0.01, Math.round((s.required_bond - s.bond) * 100) / 100) : 0;
  if (isLive()) return openIntent({
    contract: REG, method: 'top_up_bond', args: { category: CAT }, deposit: String(need), signer: 'lea.demerit.testnet',
    label: 'Top up deposit · +' + N(need) + ' Ⓝ',
    hint: 'While the deposit is under the required amount, every platform refuses the licence.'
  });
  const r = call('lea.demerit.testnet', REG, 'top_up_bond', '{category: "courier"}', () => w.topUpBond('lea.demerit.testnet', CAT, need), { dep: N(need) });
  if (r.ok) { ui.banner = { cls: 'ok', title: 'Deposit topped up.', body: ' ' + N(s.bond + need) + ' Ⓝ locked — you can take jobs again.' }; toast('Deposit topped up', '+' + N(need) + ' Ⓝ', 'ok'); }
  render();
}
function sell() {
  if (isLive()) return openIntent({
    contract: REG, method: 'nft_transfer', args: { receiver_id: 'client.demerit.testnet', token_id: 'demerit-1' },
    deposit: '0.000000000000000000000001', signer: 'lea.demerit.testnet',
    label: 'Try to sell the licence',
    hint: 'The contract refuses with ERR_SOULBOUND: a licence never changes hands. Run it to see the refusal.'
  });
  const r = call('lea.demerit.testnet', REG, 'nft_transfer', '{receiver_id: "client.demerit.testnet", token_id: "demerit-1"}', () => w.nftTransfer(), { dep: '1 yocto' });
  const y = why(r.code); ui.banner = { cls: 'no', title: y[0] + '.', body: ' ' + y[1], code: r.code }; toast(y[0], y[1], 'no'); render();
}
function agent() {
  if (isLive()) return openIntent({
    contract: REG, method: 'delegate', args: { category: CAT, delegate: 'agent1.lea.demerit.testnet', expires_at: Math.floor(Date.now() / 1000) + 90 * 86400 },
    signer: 'lea.demerit.testnet',
    label: 'Delegate to an AI agent',
    hint: 'agent1.lea.demerit.testnet is a NEAR sub-account with a limited key. Its faults cost your points, and a suspension of yours stops it too.'
  });
  const r = call('lea.demerit.testnet', REG, 'delegate', '{delegate: "agent1.lea.demerit.testnet", expires: "+90 days"}', () => w.delegate('lea.demerit.testnet', CAT, 'agent1.lea.demerit.testnet', w.now + 90 * 86400));
  if (r.ok) { ui.banner = { cls: 'info', title: 'agent1.lea.demerit.testnet can now take jobs under your licence.', body: ' A NEAR sub-account with a limited key. Its faults cost your points.' }; toast('AI agent added', 'agent1.lea.demerit.testnet · 90 days', 'ok'); }
  render();
}
function withdraw() {
  if (isLive()) return openIntent({
    contract: REG, method: 'withdraw', args: {}, signer: 'client.demerit.testnet',
    label: 'Withdraw compensation',
    hint: 'Moves your credit to your account. Every NEAR stays accounted for (invariant I2).'
  });
  const c = w.credits['client.demerit.testnet'] || 0;
  const r = call('client.demerit.testnet', REG, 'withdraw', '', () => w.withdraw('client.demerit.testnet'));
  if (r.ok) { ui.samWithdrawn = (ui.samWithdrawn || 0) + c; ui.banner = { cls: 'ok', title: N(c) + ' Ⓝ sent to your wallet.', body: ' Every NEAR is accounted for.' }; toast('Withdrawn', N(c) + ' Ⓝ', 'ok'); }
  render();
}
function fastForward() {
  const s0 = licOf('lea.demerit.testnet');
  w.advanceMonths(6);
  const s1 = licOf('lea.demerit.testnet');
  logLine('m', '# 6 months later — no transaction sent');
  if (s1) view('status', '{account: "lea.demerit.testnet"}', () => logLine('o', '  → ' + s1.points + ' points · ' + (s1.status === 'suspendu' ? 'suspended' : s1.status) + ' · recomputed from timestamps at read time'));
  const d = s1 && s0 ? s1.points - s0.points : 0;
  toast('6 months later', d > 0 ? 'Léa regained ' + d + ' point' + (d > 1 ? 's' : '') + ' — without a single transaction.' : 'Time passes.', 'ok');
  ui.banner = null; render();
}
async function doCheck() {
  const q = ($('#q').value || '').trim(); ui.liveAcct = q; ui.checked = 'wait'; render();
  logLine('m', '$ near view ledger.demerit.testnet status({account: "' + esc(q) + '"}) · testnet · free · no wallet');
  const r = await liveStatus(q); ui.checked = r;
  if (!r.err) logLine('o', '  → ' + r.points + '/' + r.cap + ' points · ' + r.status + ' · deposit ' + N(r.bond) + ' Ⓝ');
  render();
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button,a'); if (!t) { $('#acctMenu').hidden = true; return; }
  if (t.id === 'acctBtn') { $('#acctMenu').hidden = !$('#acctMenu').hidden; return; }
  $('#acctMenu').hidden = true;
  if (t.dataset.who) { ui.who = t.dataset.who; ui.banner = null; ui.page = PEOPLE[ui.who].pages[0]; location.hash = '#/' + ui.page; render(); return; }
  if (t.dataset.page) { e.preventDefault(); ui.page = t.dataset.page; ui.banner = null; location.hash = '#/' + ui.page; render(); return; }
  if (t.dataset.mode) return setMode(t.dataset.mode);
  if (t.dataset.accept) return accept(+t.dataset.accept);
  if (t.dataset.deliver) return deliver(+t.dataset.deliver);
  if (t.dataset.rate) return rate(+t.dataset.mid, t.dataset.rate);
  if (t.dataset.intentAccept) return accept(+t.dataset.intentAccept);
  if (t.dataset.intentPost) return post();
  if (t.dataset.intentWithdraw) return withdraw();
  if (t.dataset.intentTopup) return topup();
  ({ getLic: getLicence, mx: closeModal, verify: verifyId, issue, post, topup, sell, agent, withdraw, ff: fastForward, doCheck }[t.id] || (() => {}))();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'q') doCheck(); });
const h = location.hash.replace('#/', ''); if (PEOPLE.lea.pages.includes(h)) ui.page = h;
logLine('m', '# demerit · two Rust contracts: ' + REG + ' (licence registry) and ' + PF + ' (delivery platform)');
refresh(); render();
if (isLive()) loadLive();
window.__demerit = { w, ui };
})();

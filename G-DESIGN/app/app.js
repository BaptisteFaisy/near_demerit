/* demerit — web app (option A). Every button runs the real contract rules (moteur.js is a 1:1 port of
   contracts/demerit/src/*.rs + contracts/missions/src/lib.rs) and prints the matching on-chain calls.
   The public check page can also read the live registry on NEAR testnet (JSON-RPC, no wallet). */
(function () {
'use strict';
const { World } = window.DEMERIT;
const CAT = 'coursier', PF = 'missions.testnet', REG = 'demerit.testnet';
const w = new World();
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const N = x => (Math.round((x || 0) * 100) / 100).toFixed(2);

/* ---------- people ---------- */
const PEOPLE = {
  lea:  { name: 'Léa Martin', acct: 'lea.testnet', role: 'Courier', ini: 'LM', cls: '', id: 'fp-lea', pages: ['licence', 'jobs', 'wallet', 'check'] },
  sam:  { name: 'Sam Okafor', acct: 'client.testnet', role: 'Customer', ini: 'SO', cls: 'c', pages: ['orders', 'wallet', 'check'] },
  lea2: { name: 'Léa Martin', acct: 'lea2.testnet', role: 'New account', ini: 'LM', cls: 'n', id: 'fp-lea', pages: ['licence', 'check'] }
};
const PAGE = { licence: 'My licence', jobs: 'Jobs', orders: 'My deliveries', wallet: 'Wallet', check: 'Public check' };
const ICON = {
  licence: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="12" r="2.4"/><path d="M14 10h4M14 14h3"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/></svg>',
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 9h18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>'
};
const BOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/></svg>';

/* ---------- plain-English refusals ---------- */
function why(code) {
  const s = w.status('lea.testnet', CAT);
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
const EV = {
  license_issued: e => 'license_issued · ' + e.holder + ' · ' + e.points + ' points', mission_posted: e => 'mission_posted · #' + e.id + ' · ' + N(e.reward) + ' Ⓝ in escrow',
  mission_taken: e => 'mission_taken · #' + e.id, mission_closed: e => 'mission_closed · #' + e.id + ' · ' + e.outcome,
  mission_recorded: e => 'mission_recorded', points_changed: e => 'points_changed · ' + e.before + ' → ' + e.after,
  license_suspended: () => 'license_suspended · 6 months', bond_slashed: e => 'bond_slashed · ' + N(e.amount) + ' Ⓝ',
  client_compensated: e => 'client_compensated · ' + N(e.amount) + ' Ⓝ → ' + e.client, bond_topped_up: e => 'bond_topped_up · ' + N(e.amount) + ' Ⓝ',
  delegation_changed: e => 'delegation_changed · ' + e.delegate, withdrawn: e => 'withdrawn · ' + N(e.amount) + ' Ⓝ → ' + e.account, platform_approved: e => 'platform_approved · ' + e.account
};
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
    for (const e of w.log.slice(before)) { const f = EV[e.ev]; logLine('e', '  EVENT ' + esc(f ? f(e.data || {}) : e.ev)); }
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
seedJob('nora.testnet', 'Lunch order · 2 bags', 'Café Lomi → Rue Saint-Maur', 0.12);
seedJob('studio9.testnet', 'Documents · signature', 'Studio 9 → Place de Clichy', 0.08);
w.log.length = 0;

/* ---------- ui state ---------- */
const ui = { who: 'lea', page: 'licence', check: {}, delivered: {}, banner: null, live: null, liveAcct: 'lea.demerit.testnet', checked: null };
const me = () => PEOPLE[ui.who];
const licOf = acct => w.status(acct, CAT);

function toast(title, body, cls) {
  const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.innerHTML = '<b>' + esc(title) + '</b>' + (body ? esc(body) : '');
  const box = $('#toasts'); box.appendChild(t); while (box.children.length > 2) box.removeChild(box.firstChild); setTimeout(() => t.remove(), 4200);
}

/* ---------- header / nav ---------- */
function renderChrome() {
  const p = me();
  $('#acctAv').textContent = p.ini; $('#acctAv').className = 'av ' + p.cls;
  $('#acctName').textContent = p.name; $('#acctId').textContent = p.acct;
  $('#side').innerHTML = p.pages.map(k => {
    const badge = k === 'jobs' ? openJobs().length : k === 'orders' ? toRate().length : 0;
    return '<a href="#/' + k + '" data-page="' + k + '" class="' + (ui.page === k ? 'on' : '') + '">' + ICON[k] + PAGE[k] + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</a>';
  }).join('') + '<div class="clock"><small>Sandbox time</small><b id="month">' + monthLabel() + '</b><button class="btn sm" id="ff">Fast-forward 6 months</button></div>';
  $('#acctMenu').innerHTML = '<div class="mh">Switch account</div>' + Object.keys(PEOPLE).map(k => {
    const q = PEOPLE[k]; return '<button class="mi' + (k === ui.who ? ' cur' : '') + '" data-who="' + k + '"><span class="av ' + q.cls + '">' + q.ini + '</span><span class="an"><b>' + q.name + ' · ' + q.role + '</b><i>' + q.acct + '</i></span></button>';
  }).join('');
}
const openJobs = () => Object.values(w.missions).filter(m => m.state === 'open');
const myJobs = () => Object.values(w.missions).filter(m => m.worker === me().acct);
const samJobs = () => Object.values(w.missions).filter(m => m.poster === 'client.testnet');
const toRate = () => samJobs().filter(m => m.state === 'taken' && ui.delivered[m.id]);

/* ---------- pages ---------- */
function licenceCard(s, p) {
  if (!s) return '<div class="lic empty"><div class="lic-h"><b>No licence yet</b></div><p style="margin:12px 0 18px;font-size:16px;color:var(--ink2)">A demerit licence lets any platform check, in one call, that you are allowed to work. It starts at 6 points on probation and needs a 1 Ⓝ deposit.</p><button class="btn pri" id="getLic">Get my courier licence</button></div>';
  const sus = s.status === 'suspendu', st = sus ? 'Suspended' : s.status === 'probation' ? 'Probation' : 'Active';
  const segs = Array.from({ length: 12 }, (_, i) => '<i class="' + (i < s.points ? 'on' : i < s.cap ? 'cap' : '') + '"></i>').join('');
  return '<div class="lic ' + (sus ? 'sus' : '') + '"><div class="lic-h"><b>Courier licence</b><span class="sp"></span><span class="soul">Soulbound NFT · NEP-171</span></div>' +
    '<div class="lic-id">' + esc(p.name) + ' · ' + esc(s.holder) + ' · ' + esc(s.token_id) + '</div>' +
    '<div class="lic-pts"><b id="pts">' + s.points + '</b><span>/ 12 points</span><span class="pill ' + (sus ? 'no' : 'acc') + '" style="background:rgba(255,255,255,.18);color:#fff">' + st + '</span></div>' +
    '<div class="segs">' + segs + '</div>' +
    '<div class="lic-f"><div>Deposit<b>' + N(s.bond) + ' / ' + N(s.required_bond) + ' Ⓝ</b></div><div>Price factor<b>×' + (s.coefficient / 100).toFixed(2) + '</b></div><div>Jobs done<b>' + s.missions_ok + '</b></div><div>' + (sus ? 'Suspended until<b>' + date(s.suspended_until) + '</b>' : 'Next point<b>' + (s.next_regen_at ? date(s.next_regen_at) : 'full') + '</b>') + '</div></div></div>';
}
function bannerHTML() {
  const b = ui.banner; if (!b) return '';
  return '<div class="ban ' + b.cls + '"><div><b>' + esc(b.title) + '</b>' + esc(b.body) + (b.code ? ' <span class="code">' + esc(b.code) + '</span>' : '') + '</div></div>';
}
const P = {
  licence() {
    const p = me(), s = licOf(p.acct);
    const reps = s ? s.recent_reports.slice().reverse() : [];
    const OUT = { clean: ['On time', 'ok', '0'], light: ['Late', 'warn', '−1'], medium: ['Damaged parcel', 'warn', '−3'], severe: ['Lost parcel', 'no', '−6'] };
    return '<div class="ph"><div><h1>My licence</h1><p>' + (s ? 'Any platform reads this before giving you a job. It is free to read, for anyone.' : 'Get licensed once, work on every platform that checks demerit.') + '</p></div></div>' + bannerHTML() +
      '<div class="grid2"><div style="display:flex;flex-direction:column;gap:16px">' + licenceCard(s, p) +
      (s ? '<div style="display:flex;gap:10px"><button class="btn" id="agent">Add an AI agent</button><button class="btn dan" id="sell">Transfer licence</button></div>' : '') + '</div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px;min-height:0"><b style="font:600 17px var(--display)">Record</b>' +
      (reps.length ? reps.slice(0, 5).map(r => { const o = OUT[r.class] || [r.class, '', '']; return '<div style="display:flex;align-items:center;gap:10px;font-size:15px"><span class="pill ' + o[1] + '">' + o[2] + ' pts</span><span>' + o[0] + '</span><span class="sp" style="flex:1"></span><span class="muted mono" style="font-size:13px">' + esc(r.mission_id) + '</span></div>'; }).join('')
        : '<p class="muted" style="margin:0">' + (s ? 'No jobs yet.' : 'Your record follows your identity, not your account.') + '</p>') +
      (s && s.invalidations ? '<p style="margin:6px 0 0;font-size:14px" class="muted">Licence invalidated ' + s.invalidations + '× · deposit price raised to ×' + (s.coefficient / 100).toFixed(2) + '</p>' : '') + '</div></div>';
  },
  jobs() {
    const mine = myJobs().filter(m => m.state === 'taken'), open = openJobs();
    const row = (m, act) => { const j = JOB[m.id] || {}; const ck = ui.check[m.id];
      return '<div class="job" data-job="' + m.id + '"><div class="ic">' + BOX + '</div><div><h3>' + esc(j.title || 'Delivery #' + m.id) + '</h3><p>' + esc(j.route || '') + ' · posted by ' + esc(m.poster) + '</p></div>' +
        '<div class="act"><div class="rw">' + N(m.reward) + ' Ⓝ<small>reward in escrow</small></div>' + act + '</div>' +
        (ck === 'wait' ? '<div class="ck"><span class="spin"></span>Checking your licence on NEAR… <span class="mono muted">missions.testnet → demerit.testnet.is_allowed</span></div>'
          : ck && ck.ok ? '<div class="ck ok">✓ Licence valid — the job is yours.</div>'
          : ck && ck.no ? '<div class="ck no"><b>✕ ' + esc(why(ck.no)[0]) + '.</b>&nbsp;' + esc(why(ck.no)[1]) + ' <span class="code">' + esc(ck.no) + '</span></div>' : '') + '</div>'; };
    return '<div class="ph"><div><h1>Jobs</h1><p>Deliveries near you. Accepting asks the demerit registry if you are allowed.</p></div></div>' + bannerHTML() +
      '<div class="jobs">' +
      mine.map(m => row(m, ui.delivered[m.id] ? '<span class="pill">Waiting for rating</span>' : '<button class="btn pri" data-deliver="' + m.id + '">Mark as delivered</button>')).join('') +
      open.slice().reverse().slice(0, 4).map(m => row(m, '<button class="btn pri" data-accept="' + m.id + '">Accept</button>')).join('') +
      (!mine.length && !open.length ? '<div class="card muted">No jobs right now.</div>' : '') + '</div>';
  },
  orders() {
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
    if (ui.who === 'sam') {
      const c = w.credits['client.testnet'] || 0, paid = ui.samWithdrawn || 0;
      return '<div class="ph"><div><h1>Wallet</h1><p>When a courier causes a serious fault, the contract pays you from their deposit. No claim, no support ticket.</p></div></div>' + bannerHTML() +
        '<div class="stats"><div class="stat"><small>Compensation available</small><b id="comp">' + N(c) + ' <span>Ⓝ</span></b></div><div class="stat"><small>Withdrawn</small><b>' + N(paid) + ' <span>Ⓝ</span></b></div><div class="stat"><small>Paid by</small><b style="font-size:20px;margin-top:12px">courier deposit</b></div></div>' +
        '<div><button class="btn pri" id="withdraw">Withdraw ' + N(c) + ' Ⓝ</button></div>';
    }
    const s = licOf('lea.testnet');
    const earned = Object.values(w.missions).filter(m => m.worker === 'lea.testnet' && m.state === 'closed').reduce((a, m) => a + m.reward, 0);
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
      (r === 'wait' ? '<div class="card"><span class="spin" style="display:inline-block;vertical-align:middle"></span>&nbsp; Reading NEAR testnet…</div>' : r && r.err ? '<div class="ban no"><div><b>Could not read testnet</b>' + esc(r.err) + '</div></div>' : r ? checkCard(r) : '');
  }
};
function checkCard(s) {
  const ok = s.allowed;
  return '<div class="grid2"><div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:center;gap:12px"><b style="font:700 26px var(--display)">' + esc(s.holder) + '</b><span class="pill ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'Allowed to work' : 'Not allowed') + '</span></div>' +
    '<div style="display:flex;align-items:baseline;gap:8px"><b style="font:700 64px/1 var(--display)">' + s.points + '</b><span class="muted" style="font-size:20px">/ ' + s.cap + ' points</span></div>' +
    '<div class="segs" style="--x:0">' + Array.from({ length: 12 }, (_, i) => '<i style="background:' + (i < s.points ? 'var(--accent);box-shadow:0 0 10px rgba(164,107,255,.8)' : 'var(--surface3)') + ';height:10px;border-radius:5px"></i>').join('') + '</div></div>' +
    '<div class="card"><dl class="kv"><dt>Licence (NFT)</dt><dd class="mono">' + esc(s.token_id) + '</dd><dt>Status</dt><dd>' + esc(s.status) + '</dd><dt>Deposit locked</dt><dd>' + N(s.bond) + ' Ⓝ</dd><dt>Deposit required</dt><dd>' + N(s.required_bond) + ' Ⓝ</dd><dt>Price factor</dt><dd>×' + (s.coefficient / 100).toFixed(2) + '</dd><dt>Invalidations</dt><dd>' + s.invalidations + '</dd><dt>Source</dt><dd>NEAR testnet · view call</dd></dl></div></div>';
}
function render() {
  const p = me(); if (!p.pages.includes(ui.page)) ui.page = p.pages[0];
  renderChrome(); $('#main').innerHTML = P[ui.page]();
}

/* ---------- live testnet read (public check) ---------- */
async function liveStatus(acct) {
  const args = btoa(JSON.stringify({ account: acct, category: CAT }));
  const body = { jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: 'ledger.demerit.testnet', method_name: 'status', args_base64: args } };
  for (const url of ['https://rpc.testnet.fastnear.com', 'https://near-testnet.drpc.org']) {
    try { const r = await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
      if (r.result && r.result.result) { const s = JSON.parse(new TextDecoder().decode(new Uint8Array(r.result.result)));
        const y = v => Number(v) / 1e24; return { ...s, bond: y(s.bond), required_bond: y(s.required_bond) }; }
      if (r.error || (r.result && r.result.error)) return { err: 'No licence for ' + acct + ' on testnet.' };
    } catch (e) {}
  }
  return { err: 'Network unavailable.' };
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
  const r = call('issuer.testnet', REG, 'issue', '{account: "' + p.acct + '", identity: "' + p.id + '"}', () => w.issue(w.issuer, p.acct, CAT, p.id, 1), { dep: '1' });
  if (r.ok) { ui.banner = null; toast('Licence issued', '6 points on probation · 1 Ⓝ deposit locked.', 'ok'); }
  else { const y = why(r.code); ui.banner = { cls: 'no', title: y[0] + '.', body: ' ' + y[1], code: r.code }; toast(y[0], y[1], 'no'); }
  render();
}
function accept(id) {
  ui.check[id] = 'wait'; ui.banner = null; render();
  setTimeout(() => {
    const r = call('lea.testnet', PF, 'accept', '{mission_id: ' + id + '}', () => w.accept('lea.testnet', id, CAT), { xcc: true });
    ui.check[id] = r.ok ? { ok: true } : { no: r.code };
    if (!r.ok) toast(why(r.code)[0], why(r.code)[1], 'no');
    render();
  }, 1100);
}
function deliver(id) { ui.delivered[id] = true; delete ui.check[id]; toast('Marked as delivered', 'Sam will rate the delivery.', 'ok'); render(); }
function post() {
  const n = samJobs().length;
  const T = [['Parcel · 1.2 kg', '11 Rue Oberkampf → 4 Place de la Bastille'], ['Flowers · fragile', 'Marché aux Fleurs → Rue de Rivoli'], ['Laptop · high value', 'Rue de Rennes → Avenue de France'], ['Groceries · 3 bags', 'Rue Cler → Rue de Grenelle'], ['Keys · urgent', 'Gare de Lyon → Rue de Charonne']][n % 5];
  const r = call('client.testnet', PF, 'post', '{reward: 0.10}', () => w.post('client.testnet', 0.1, 0.1), { dep: '0.10' });
  if (r.ok) { JOB[r.v] = { title: T[0], route: T[1] }; toast('Delivery posted', '0.10 Ⓝ held in escrow by the platform contract.', 'ok'); }
  render();
}
function rate(id, outcome) {
  const s0 = licOf('lea.testnet');
  const r = call('client.testnet', PF, 'close', '{mission_id: ' + id + ', outcome: "' + outcome + '"}', () => w.close('client.testnet', id, outcome));
  if (r.ok) { logLine('x', '  ↳ cross-contract call: ' + PF + ' → ' + REG + '.record_mission · courier paid ' + N(w.missions[id].reward) + ' Ⓝ');
    const s1 = licOf('lea.testnet'), lost = (s0 ? s0.points : 0) - (s1 ? s1.points : 0);
    if (outcome === 'severe') { const c = w.credits['client.testnet'] || 0; ui.banner = { cls: 'ok', title: 'You were compensated ' + N(c) + ' Ⓝ.', body: ' Paid from the courier\'s deposit by the contract. Withdraw it from your wallet.' }; toast('Compensated ' + N(c) + ' Ⓝ', 'From the courier\'s deposit.', 'ok'); }
    else toast('Thanks for rating', lost ? 'The courier lost ' + lost + ' points.' : 'The courier keeps every point.', lost ? 'no' : 'ok');
  }
  render();
}
function topup() {
  const s = licOf('lea.testnet'); const need = s ? Math.max(0.01, Math.round((s.required_bond - s.bond) * 100) / 100) : 0;
  const r = call('lea.testnet', REG, 'top_up_bond', '{category: "courier"}', () => w.topUpBond('lea.testnet', CAT, need), { dep: N(need) });
  if (r.ok) { ui.banner = { cls: 'ok', title: 'Deposit topped up.', body: ' ' + N(s.bond + need) + ' Ⓝ locked — you can take jobs again.' }; toast('Deposit topped up', '+' + N(need) + ' Ⓝ', 'ok'); }
  render();
}
function sell() {
  const r = call('lea.testnet', REG, 'nft_transfer', '{receiver_id: "client.testnet", token_id: "demerit-1"}', () => w.nftTransfer(), { dep: '1 yocto' });
  const y = why(r.code); ui.banner = { cls: 'no', title: y[0] + '.', body: ' ' + y[1], code: r.code }; toast(y[0], y[1], 'no'); render();
}
function agent() {
  const r = call('lea.testnet', REG, 'delegate', '{delegate: "agent1.lea.testnet", expires: "+90 days"}', () => w.delegate('lea.testnet', CAT, 'agent1.lea.testnet', w.now + 90 * 86400));
  if (r.ok) { ui.banner = { cls: 'info', title: 'agent1.lea.testnet can now take jobs under your licence.', body: ' A NEAR sub-account with a limited key. Its faults cost your points.' }; toast('AI agent added', 'agent1.lea.testnet · 90 days', 'ok'); }
  render();
}
function withdraw() {
  const c = w.credits['client.testnet'] || 0;
  const r = call('client.testnet', REG, 'withdraw', '', () => w.withdraw('client.testnet'));
  if (r.ok) { ui.samWithdrawn = (ui.samWithdrawn || 0) + c; ui.banner = { cls: 'ok', title: N(c) + ' Ⓝ sent to your wallet.', body: ' Every NEAR is accounted for.' }; toast('Withdrawn', N(c) + ' Ⓝ', 'ok'); }
  render();
}
function fastForward() {
  const s0 = licOf('lea.testnet');
  w.advanceMonths(6);
  const s1 = licOf('lea.testnet');
  logLine('m', '# 6 months later — no transaction sent');
  if (s1) view('status', '{account: "lea.testnet"}', () => logLine('o', '  → ' + s1.points + ' points · ' + (s1.status === 'suspendu' ? 'suspended' : s1.status) + ' · recomputed from timestamps at read time'));
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
  if (t.dataset.accept) return accept(+t.dataset.accept);
  if (t.dataset.deliver) return deliver(+t.dataset.deliver);
  if (t.dataset.rate) return rate(+t.dataset.mid, t.dataset.rate);
  ({ getLic: getLicence, mx: closeModal, verify: verifyId, issue, post, topup, sell, agent, withdraw, ff: fastForward, doCheck }[t.id] || (() => {}))();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'q') doCheck(); });
const h = location.hash.replace('#/', ''); if (PEOPLE.lea.pages.includes(h)) ui.page = h;
logLine('m', '# demerit · two Rust contracts: demerit.testnet (licence registry) and missions.testnet (delivery platform)');
refresh(); render();
window.__demerit = { w, ui };
})();

/* demerit · V14 — live.js : mode LIVE testnet.
   Lit la chaîne réelle (vues gratuites, sans clé) et produit, pour chaque action, une
   intention signable : commande `near-cli-rs` prête à coller + lien MyNearWallet
   (via actions.js = copie de web/actions.js). La page ne détient aucune clé privée. */
(function (global) {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const RPC = 'https://rpc.testnet.fastnear.com';
const CAT = 'coursier', CONTRACT = 'ledger.demerit.testnet', MISSIONS = 'platform.demerit.testnet';
const HOLD = 'lea.demerit.testnet', CLI = 'client.demerit.testnet', ISS = 'issuer.demerit.testnet', PLAT = 'platform.demerit.testnet';
let role = 'pro', live = null, built = false;

const b64encode = s => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin); };
const fromYocto = v => v == null ? 0 : Math.round(Number(String(v)) / 1e22) / 100;
const fmt = x => x.toFixed(2).replace('.', ',');

async function view(contract, method, args) {
  try {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query',
        params: { request_type: 'call_function', finality: 'final', account_id: contract, method_name: method, args_base64: b64encode(JSON.stringify(args || {})) } }) });
    const j = await r.json();
    if (j.error) return null;
    const txt = new TextDecoder().decode(new Uint8Array(j.result.result)).replace(/\0+$/, '');
    try { return JSON.parse(txt); } catch (e) { return txt; }
  } catch (e) { return null; }
}

/* ---------- intentions d'écriture : un spec actions.js par appel du contrat ---------- */
const ACTS = [
  { id: 'issue', role: 'issuer', label: 'Délivrer le permis', call: 'issue', kind: 'tx', from: 'issuer', to: 'registry',
    spec: { contract: CONTRACT, method: 'issue', args: { account: HOLD, category: CAT, identity: 'fp-lea-demo' }, deposit: '1', signer: ISS } },
  { id: 'approve', role: 'issuer', label: 'Agréer la plateforme', call: 'approve_platform', kind: 'tx', from: 'issuer', to: 'registry',
    spec: { contract: CONTRACT, method: 'approve_platform', args: { category: CAT, account: MISSIONS }, signer: ISS } },
  { id: 'resolve', role: 'issuer', label: 'Trancher un recours', call: 'resolve_contest', kind: 'tx', from: 'issuer', to: 'registry',
    spec: { contract: CONTRACT, method: 'resolve_contest', args: { category: CAT, mission_id: 'm-1', upheld: true }, signer: ISS } },
  { id: 'strike', role: 'issuer', label: 'Avertir la plateforme', call: 'strike_platform', kind: 'tx', from: 'issuer', to: 'platform',
    spec: { contract: CONTRACT, method: 'strike_platform', args: { account: PLAT }, signer: ISS } },
  { id: 'revoke', role: 'issuer', label: 'Révoquer le permis', call: 'revoke_license', kind: 'tx', from: 'issuer', to: 'registry',
    spec: { contract: CONTRACT, method: 'revoke_license', args: { account: HOLD, category: CAT, reason: 'sanction' }, signer: ISS } },
  { id: 'post', role: 'client', label: 'Publier une mission', call: 'post', kind: 'tx', from: 'client', to: 'platform',
    spec: { contract: MISSIONS, method: 'post', args: { reward: '100000000000000000000000' }, deposit: '1', signer: CLI } },
  { id: 'close', role: 'client', label: 'Clôturer la mission', call: 'close', kind: 'tx', from: 'client', to: 'registry',
    spec: { contract: MISSIONS, method: 'close', args: { mission_id: 1, outcome: 'clean' }, signer: CLI } },
  { id: 'withdraw', role: 'client', label: "Retirer l'indemnité", call: 'withdraw', kind: 'pay', from: 'client', to: 'registry',
    spec: { contract: CONTRACT, method: 'withdraw', args: {}, signer: CLI } },
  { id: 'accept', role: 'platform', label: 'Accepter la mission', call: 'accept', kind: 'xcc', from: 'platform', to: 'registry',
    spec: { contract: MISSIONS, method: 'accept', args: { mission_id: 1 }, signer: HOLD } },
  { id: 'record', role: 'platform', label: 'Enregistrer le résultat', call: 'record_mission', kind: 'tx', from: 'platform', to: 'registry',
    spec: { contract: CONTRACT, method: 'record_mission', args: { category: CAT, mission_id: 'm-1', outcome: 'clean', worker: HOLD, client: CLI }, signer: PLAT } },
  { id: 'topup', role: 'pro', label: 'Compléter la caution', call: 'top_up_bond', kind: 'pay', from: 'pro', to: 'registry',
    spec: { contract: CONTRACT, method: 'top_up_bond', args: { category: CAT }, deposit: '1', signer: HOLD } },
  { id: 'excess', role: 'pro', label: "Retirer l'excédent", call: 'withdraw_bond_excess', kind: 'pay', from: 'registry', to: 'pro',
    spec: { contract: CONTRACT, method: 'withdraw_bond_excess', args: { category: CAT }, signer: HOLD } },
  { id: 'delegate', role: 'pro', label: 'Déléguer à un agent', call: 'delegate', kind: 'tx', from: 'pro', to: 'registry',
    spec: { contract: CONTRACT, method: 'delegate', args: { category: CAT, delegate: 'agent1.' + HOLD, expires_at: '1790000000000000000' }, signer: HOLD } },
  { id: 'contest', role: 'pro', label: 'Contester un signalement', call: 'contest', kind: 'tx', from: 'pro', to: 'registry',
    spec: { contract: CONTRACT, method: 'contest', args: { category: CAT, mission_id: 'm-1' }, deposit: '0.1', signer: HOLD } },
  { id: 'transfer', role: 'pro', label: 'Vendre le permis (refus)', call: 'nft_transfer', kind: 'no', from: 'pro', to: 'client',
    spec: { contract: CONTRACT, method: 'nft_transfer', args: { receiver_id: CLI, token_id: 'demerit-1' }, deposit: '0.000000000000000000000001', signer: HOLD } },
  { id: 'renounce', role: 'pro', label: 'Renoncer au permis', call: 'renounce', kind: 'tx', from: 'pro', to: 'registry',
    spec: { contract: CONTRACT, method: 'renounce', args: { category: CAT }, signer: HOLD } }
];
const ROLES = [{ id: 'issuer', n: 'ÉMETTEUR' }, { id: 'platform', n: 'PLATEFORME' }, { id: 'pro', n: 'PROFESSIONNELLE' }, { id: 'client', n: 'CLIENT' }, { id: 'registry', n: 'LECTURES' }];

/* ---------- lectures → état du shell + scène 3D ---------- */
async function refresh() {
  const st = await view(CONTRACT, 'status', { account: HOLD, category: CAT });
  const fund = await view(CONTRACT, 'fund', {});
  const credit = await view(CONTRACT, 'credit', { account: CLI });
  const tok = await view(CONTRACT, 'nft_token', { token_id: 'demerit-1' });
  const clk = await view(CONTRACT, 'clock', {});
  live = { st, fund, credit, tok, clk };
  const s = {
    pts: st ? st.points : 0, cap: st ? st.cap : 12, status: st ? (st.status === 'active' ? 'valide' : st.status) : '—',
    bond: st ? fromYocto(st.bond) : 0, req: st ? fromYocto(st.required_bond) : 0,
    coef: st ? st.coefficient / 100 : 1, fund: fromYocto(fund), credit: fromYocto(credit), wallet: 0,
    ok: st ? st.missions_ok : 0, inval: st ? st.invalidations : 0, month: clk ? Math.floor(Number(clk) / 1e6 / (30 * 24 * 3600)) : 0,
    token: st ? st.token_id : (tok ? tok.token_id : '')
  };
  global.CORE.paint(s, { id: 'live', title: 'CHAÎNE TESTNET EN DIRECT', kind: 'view', from: 'registry', to: 'pro', call: 'JSON-RPC · ' + CONTRACT });
  global.CORE.print([['ev', 'live · ' + CONTRACT + ' · bloc ' + (clk ? String(clk).slice(0, 13) : '—')]]);
  global.CORE.print([['out', 'status : ' + JSON.stringify(st).slice(0, 150)]]);
  global.CORE.print([['out', 'fund ' + fmt(fromYocto(fund)) + ' Ⓝ · crédit client ' + fmt(fromYocto(credit)) + ' Ⓝ · ' + (tok ? tok.metadata.title : 'pas de jeton')]]);
  if (global.SCENE && global.SCENE.manual) global.SCENE.manual(s, { kind: 'view' });
  return s;
}

/* ---------- interface ---------- */
function renderActs() {
  const box = $('#acts');
  box.innerHTML = ACTS.filter(a => role === 'registry' ? a.kind === 'view' : a.role === role).map(a =>
    '<button class="act k-' + a.kind + '" data-i="' + a.id + '"><i></i><b>' + a.label + '</b><code>' + a.call + '</code></button>').join('')
    + '<button class="act k-view" data-i="__refresh"><i></i><b>Rafraîchir la chaîne</b><code>view status · fund · credit</code></button>';
  box.onclick = e => { const b = e.target.closest('.act'); if (b) run(b.dataset.i); };
}
function buildUI() {
  const r = $('#roles');
  r.innerHTML = ROLES.map(x => '<button data-r="' + x.id + '"' + (x.id === role ? ' class="on"' : '') + '>' + x.n + '</button>').join('');
  r.onclick = e => { const b = e.target.closest('button'); if (b) { role = b.dataset.r; buildUI(); } };
  $('#objs').innerHTML = '<span class="ob ok">contrat déployé</span><span class="ob">aucune clé côté page</span><span class="ob">vue gratuite</span>';
  $('#atks').innerHTML = '<span class="atk">chaque action produit une commande near-cli-rs + un lien MyNearWallet : la signature a lieu dans votre portefeuille.</span>';
  const c1 = $('#obj-n'); if (c1) c1.textContent = 'LIVE';
  const c2 = $('#atk-n'); if (c2) c2.textContent = 'portefeuille';
  renderActs();
}
async function run(id) {
  if (id === '__refresh') { await refresh(); return; }
  const a = ACTS.find(x => x.id === id); if (!a) return;
  global.CORE.paint((live && live.st) ? { pts: live.st.points, bond: fromYocto(live.st.bond), req: fromYocto(live.st.required_bond) } : {},
    { id: 'live-' + id, title: a.label, kind: a.kind, from: a.from, to: a.to, call: a.call });
  const DA = global.DemeritActions;
  const cmd = DA ? DA.command(Object.assign({}, a.spec, { label: a.label })) : 'near contract call-function as-transaction ' + a.spec.contract + ' ' + a.spec.method + ' json-args {} ...';
  global.CORE.print([['cmd', cmd]]);
  if (DA && DA.walletUrl) {
    const url = await DA.walletUrl(Object.assign({}, a.spec, { label: a.label }));
    if (url) { global.CORE.print([['ev', 'lien MyNearWallet : ' + url.slice(0, 100) + '…']]); }
    else global.CORE.print([['com', '# lien de signature indisponible (RPC) — la commande near-cli-rs suffit']]);
  }
  global.CORE.print([['out', 'la signature a lieu dans votre portefeuille ; cette page ne détient aucune clé.']]);
}

global.LIVE = {
  async init() {
    if (!built) { built = true; buildUI(); }
    document.documentElement.dataset.mode = 'live';
    global.CORE.print([['com', '# LIVE — testnet NEAR · ' + CONTRACT + ' + ' + MISSIONS]]);
    global.CORE.print([['out', 'RPC public ' + RPC + ' · vues gratuites, sans clé ni compte']]);
    await refresh();
    if (new URLSearchParams(location.search).get('live') === '1') report();
  },
  teardown() { document.documentElement.dataset.mode = 'sandbox'; },
  refresh
};
function report() {
  const s = live && live.st;
  const ok = !!s && !!live.tok;
  const res = { ok, mode: 'live', contract: CONTRACT, missions: MISSIONS,
    state: s ? { pts: s.points, cap: s.cap, status: s.status, bond: fmt(fromYocto(s.bond)), req: fmt(fromYocto(s.required_bond)),
      coef: s.coefficient / 100, fund: fmt(fromYocto(live.fund)), credit: fmt(fromYocto(live.credit)), token: s.token_id } : null,
    dom: null, beats: ACTS.length, of: ACTS.length,
    termLines: $('#term') ? $('#term').children.length : 0, lastLine: '', errors: [] };
  res.dom = { pts: res.state ? String(res.state.pts) : '—', bond: res.state ? res.state.bond : '—',
    client: res.state ? fmt(fromYocto(live.credit)) : '—', fund: res.state ? res.state.fund : '—' };
  let pre = $('#result');
  if (!pre) { pre = document.createElement('script'); pre.type = 'application/json'; pre.id = 'result'; document.body.appendChild(pre); }
  pre.textContent = JSON.stringify(res); document.documentElement.dataset.done = ok ? 'ok' : 'ko'; window.__demerit = res;
}
})(typeof window !== 'undefined' ? window : globalThis);

// sonde live : lit le registre déployé sur testnet (vues gratuites, sans clé)
// forme RPC reprise de web/app.js : request_type + args_base64
const RPC = 'https://rpc.testnet.fastnear.com';
const post = async (body) => {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
};
const view = async (contract, method, args) => {
  const b64 = Buffer.from(JSON.stringify(args || {})).toString('base64');
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'query',
    params: { request_type: 'call_function', finality: 'final', account_id: contract, method_name: method, args_base64: b64 } });
  if (res.error) return { ok: false, out: res.error };
  const txt = Buffer.from(res.result.result || []).toString('utf8').replace(/\0+$/, '');
  let out = txt; try { out = JSON.parse(txt); } catch (e) { }
  return { ok: true, out };
};
const C = 'ledger.demerit.testnet', M = 'platform.demerit.testnet';
for (const [label, c, m, a] of [
  ['status', C, 'status', { account: 'lea.demerit.testnet', category: 'coursier' }],
  ['check', C, 'check', { account: 'lea.demerit.testnet', category: 'coursier' }],
  ['is_allowed', C, 'is_allowed', { account: 'lea.demerit.testnet', category: 'coursier' }],
  ['fund', C, 'fund', {}],
  ['credit', C, 'credit', { account: 'client.demerit.testnet' }],
  ['nft_token', C, 'nft_token', { token_id: 'demerit-1' }],
  ['clock', C, 'clock', {}],
  ['issuer', C, 'issuer', {}],
  ['platform', M, 'platform', { account: M }]
]) {
  const r = await view(c, m, a);
  console.log(label.padEnd(11), r.ok ? JSON.stringify(r.out).slice(0, 300) : 'ERREUR ' + JSON.stringify(r.out).slice(0, 160));
}

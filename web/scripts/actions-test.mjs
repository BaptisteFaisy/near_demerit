/* Tests for web/actions.js — plain node, zero dependency.
 * Run: cd web && node scripts/actions-test.mjs  → prints "ACTIONS OK (n/n)".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'actions.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok — ' + name); }
  else { fail++; console.log('  FAIL — ' + name + (extra ? ' : ' + extra : '')); }
}

/* Load actions.js in a minimal sandbox (no DOM, no fetch). */
function load(sandboxExtra) {
  const sandbox = Object.assign({ window: {} }, sandboxExtra);
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'actions.js' });
  return sandbox.window.DemeritActions;
}

const A = load();

/* 1. Public API surface. */
ok('API: attach/command/walletUrl/toYocto/fromYocto are functions',
  ['attach', 'command', 'walletUrl', 'toYocto', 'fromYocto']
    .every((f) => typeof A[f] === 'function'));

/* 2. toYocto exact values (hand-parsed decimals, no float). */
ok('toYocto("1")', A.toYocto('1') === '1' + '0'.repeat(24), A.toYocto('1'));
ok('toYocto("0.5")', A.toYocto('0.5') === '5' + '0'.repeat(23), A.toYocto('0.5'));
ok('toYocto("1.25")', A.toYocto('1.25') === '1250000000000000000000000', A.toYocto('1.25'));
ok('toYocto("0")', A.toYocto('0') === '0', A.toYocto('0'));
let threw = null;
try { A.toYocto('1.0000000000000000000000001'); } catch (e) { threw = e; }
// NB: instanceof Error fails across vm contexts; check the shape instead.
ok('toYocto throws beyond 24 decimals',
  threw && typeof threw.message === 'string' && /max is 24/.test(threw.message),
  threw && threw.message);

/* 3. fromYocto round-trip display. */
ok('fromYocto("1250…000") === "1.2500"',
  A.fromYocto('1250000000000000000000000') === '1.2500', A.fromYocto('1250000000000000000000000'));
ok('fromYocto(toYocto("1.5")) === "1.5000"', A.fromYocto(A.toYocto('1.5')) === '1.5000');

/* 4. command() for `issue` (ABI: account/category/identity, payable). */
const cmd = A.command({
  contract: 'demerit.testnet', method: 'issue',
  args: { account: 'lea.testnet', category: 'coursier', identity: 'fp-hex' },
  deposit: '1', gas: 100, signer: 'issuer.testnet',
});
ok('command contains as-transaction', cmd.includes('as-transaction'), cmd);
ok('command contains method issue', cmd.includes(' issue '), cmd);
ok('command contains JSON args',
  cmd.includes(`json-args '{"account":"lea.testnet","category":"coursier","identity":"fp-hex"}'`), cmd);
ok('command contains deposit + gas + sign-as + network',
  cmd.includes("'1000000000000000000000000 yoctoNEAR'") &&
  cmd.includes("'100.0 Tgas'") && cmd.includes('sign-as issuer.testnet') &&
  cmd.includes('network-config testnet sign-with-keychain send'), cmd);

/* 5. Borsh serialization — hand-computed reference vector.
 *
 * Fake transaction, fields in wire order (legacy near-api-js layout):
 *   signer_id   "a.testnet"  → u32 LE len 9  : 09000000 + 612e746573746e6574
 *   public_key  key_type 0 (ed25519)         : 00
 *               data 32 × 0x01               : 01×32
 *   nonce       7 as u64 LE                  : 0700000000000000
 *   receiver_id "b.testnet"  → u32 LE len 9  : 09000000 + 622e746573746e6574
 *   block_hash  32 × 0x02                    : 02×32
 *   actions     Vec len 1 u32 LE             : 01000000
 *   action      FunctionCall enum tag = 2    : 02
 *     method_name "issue" → u32 LE len 5     : 05000000 + 6973737565
 *     args Vec<u8> "{}"   → u32 LE len 2     : 02000000 + 7b7d
 *     gas    100 Tgas = 1e14 = 0x5AF3107A4000, u64 LE : 00407a10f35a0000
 *     deposit 1e24 = 0xD3C21BCECCEDA1000000, u128 LE  : 000000a1edccce1bc2d3000000000000
 * Total = 13 + 33 + 8 + 13 + 32 + 4 + 1 + 9 + 6 + 8 + 16 = 143 bytes.
 */
const expected = [
  '09000000', '612e746573746e6574',            // signer_id
  '00',                                          // key_type ed25519
  '01'.repeat(32),                               // public key data
  '0700000000000000',                            // nonce 7 u64 LE
  '09000000', '622e746573746e6574',             // receiver_id
  '02'.repeat(32),                               // block_hash
  '01000000', '02',                              // 1 action, FunctionCall tag
  '05000000', '6973737565',                      // method "issue"
  '02000000', '7b7d',                            // args "{}"
  '00407a10f35a0000',                            // gas 1e14 u64 LE
  '000000a1edccce1bc2d3000000000000',            // deposit 1e24 u128 LE
].join('');
const tx = A._encodeTransaction({
  signerId: 'a.testnet',
  pubKeyType: 0,
  pubKeyBytes: new Uint8Array(32).fill(1),
  nonce: 7n,
  receiverId: 'b.testnet',
  blockHashBytes: new Uint8Array(32).fill(2),
  methodName: 'issue',
  argsBytes: [0x7b, 0x7d],
  gas: 100000000000000n,
  deposit: 10n ** 24n,
});
const got = Buffer.from(tx).toString('hex');
ok('borsh vector matches hand-computed hex', got === expected, got);
ok('borsh vector is 143 bytes', tx.length === 143, String(tx.length));

/* 5b. base58 + base64 helpers. */
const bh = A._base58ToBytes('11111111111111111111111111111111');
ok('base58 all-ones decodes to 32 zero bytes', bh.length === 32 && bh.every((b) => b === 0));
ok('base64 of [1,2,3,254] = "AQID/g=="', A._bytesToBase64([1, 2, 3, 254]) === 'AQID/g==',
  A._bytesToBase64([1, 2, 3, 254]));

/* 6. walletUrl degrades to null without throwing. */
const noFetcher = load(); // sandbox without fetch
const u1 = await noFetcher.walletUrl({
  contract: 'demerit.testnet', method: 'issue', signer: 'issuer.testnet',
});
ok('walletUrl without fetch → null', u1 === null, String(u1));

const noSigner = await A.walletUrl({ contract: 'c.testnet', method: 'issue' });
ok('walletUrl without signer → null', noSigner === null, String(noSigner));

/* Bogus RPC: fetch always rejects → null, no throw. */
const bogus = load({
  fetch: () => Promise.reject(new Error('network down')),
});
const u2 = await bogus.walletUrl({
  contract: 'demerit.testnet', method: 'issue', signer: 'issuer.testnet',
  rpc: 'http://127.0.0.1:1/bogus',
});
ok('walletUrl with failing RPC → null', u2 === null, String(u2));

/* Result. */
const total = pass + fail;
if (fail) {
  console.log(`ACTIONS KO (${pass}/${total})`);
  process.exit(1);
}
console.log(`ACTIONS OK (${pass}/${total})`);

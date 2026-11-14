/* Tests of the shared event formatter (web/events.js).
   The amounts and timestamps below are the real ones the contracts wrote on
   testnet on 11 Nov 2026, read back from the chain: the ledger's storage (key
   0x01v0, borsh u128 little-endian) and the explorer receipts of the demo run
   (tx 4yReGbSY24ag close, 9XPucD7m9SxQ close, 7qD6LJPjxabo post, 5c46BFGtTp6Be
   top_up_bond). Ground truth: the registry emits a NEP-297 object, the missions
   contract wraps its data in an array, amounts are yocto strings
   (1 NEAR = 1e24 yocto) and timestamps are nanoseconds.
   Run: cd web && node scripts/events-test.mjs */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tap, browserWindow } from './tap.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const t = tap();
const ok = t.ok;

/* events.js is a plain browser script: run it in a sandbox and take its API. */
const E = browserWindow({ ROOT }).load('events.js').DemeritEvents;

console.log('events.js');
ok('the module exposes its API', !!E && typeof E.format === 'function' && typeof E.parseLogs === 'function');

/* Real payloads, as written by the contracts on testnet. */
const ISSUED = { standard: 'nep297', version: '1.0.0', event: 'license_issued',
  data: { holder: 'lea.demerit.testnet', category: 'coursier', identity: 'fp-lea-demo', points: 6 } };
const MISSION_POSTED = { standard: 'missions', version: '1.0.0', event: 'mission_posted',
  data: [{ id: 5, poster: 'client.demerit.testnet', reward: '50000000000000000000000' }] };
const SLASHED = { standard: 'nep297', version: '1.0.0', event: 'bond_slashed',
  data: { holder: 'lea.demerit.testnet', category: 'coursier', amount: '40000000000000000000000', fund: '20000000000000000000000' } };
const SUSPENDED = { standard: 'nep297', version: '1.0.0', event: 'license_suspended',
  data: { holder: 'lea.demerit.testnet', category: 'coursier', until: 1794392025252954415 } };
const POINTS = { standard: 'nep297', version: '1.0.0', event: 'points_changed',
  data: { holder: 'lea.demerit.testnet', category: 'coursier', before: 2, after: 0, reason: 'severe' } };

console.log('events.js');
ok('the module exposes its API', !!E && typeof E.format === 'function' && typeof E.parseLogs === 'function');

/* 1. The formatter never prints "undefined": that was the bug on the terminal. */
const samples = [ISSUED, MISSION_POSTED, SLASHED, SUSPENDED, POINTS,
  { event: 'license_reinstated', data: { holder: 'x.testnet', category: 'coursier' } },
  { event: 'delegation_changed', data: { holder: 'x.testnet', delegate: 'agent1.x.testnet', active: true } },
  { event: 'contest_resolved', data: { holder: 'x.testnet', mission_id: 'm-4', upheld: false } },
  { event: 'platform_struck', data: { account: 'platform.demerit.testnet', warnings: 1, suspended: false } }];
samples.forEach(p => {
  const line = E.format(p.event, p.data);
  ok(`no "undefined" in ${p.event}`, !/undefined/.test(line), line);
});

/* 2. The registry event keeps its fields. */
ok('license_issued reads holder and points',
  E.format(ISSUED.event, ISSUED.data) === 'license_issued · lea.demerit.testnet · 6 points',
  E.format(ISSUED.event, ISSUED.data));

/* 3. The missions contract wraps its data in an array: the formatter must unwrap it. */
const posted = E.format(MISSION_POSTED.event, MISSION_POSTED.data);
ok('mission_posted unwraps the array payload', /#5/.test(posted), posted);
ok('mission_posted converts yocto to NEAR', /0\.05/.test(posted), posted);

/* 4. Amounts are yocto strings on chain and NEAR floats in the sandbox. */
ok('bond_slashed converts yocto to NEAR', /0\.04/.test(E.format(SLASHED.event, SLASHED.data)),
  E.format(SLASHED.event, SLASHED.data));
ok('the sandbox float is read as NEAR too', /bond_slashed · 0\.4 Ⓝ/.test(E.format('bond_slashed', { amount: 0.4 })),
  E.format('bond_slashed', { amount: 0.4 }));

/* 5. Timestamps: nanoseconds on chain, seconds in the sandbox. */
ok('license_suspended reads a nanosecond timestamp',
  /11 Nov 2026/.test(E.format(SUSPENDED.event, SUSPENDED.data)),
  E.format(SUSPENDED.event, SUSPENDED.data));
ok('toSeconds turns nanoseconds into seconds', E.toSeconds(1794392025252954415) === 1794392025,
  String(E.toSeconds(1794392025252954415)));

/* 6. An unknown event still says something useful, never "undefined". */
const unknown = E.format('brand_new_event', { foo: 'bar' });
ok('an unknown event keeps its name', unknown.indexOf('brand_new_event') === 0, unknown);
ok('an unknown event prints its fields', /foo: bar/.test(unknown), unknown);

/* 7. The parser reads the "EVENT_JSON:" lines the contracts write. */
const parsed = E.parseLogs([
  'EVENT_JSON:' + JSON.stringify(ISSUED),
  'some other log line',
  'EVENT_JSON:' + JSON.stringify(POINTS),
  'EVENT_JSON:{not json}'
]);
ok('parseLogs reads the two real events', parsed.length === 2, JSON.stringify(parsed));
ok('parseLogs keeps the event name', parsed[0].event === 'license_issued', JSON.stringify(parsed[0]));
ok('parseLogs skips a broken line without throwing', parsed[1].event === 'points_changed');
ok('parseLogs unwraps the array payload', parsed[0].data.holder === 'lea.demerit.testnet',
  JSON.stringify(parsed[0].data));

/* 8. The amounts the terminal shows are the ones the contracts wrote. */
ok('toNear reads 0.125 NEAR from yocto', E.toNear('125000000000000000000000') === 0.125,
  String(E.toNear('125000000000000000000000')));
ok('toNear reads 0.17 NEAR from yocto', E.toNear('170000000000000000000000') === 0.17,
  String(E.toNear('170000000000000000000000')));
/* Le dépôt réel du top_up_bond du bloc 277196043 : 4.5e22 yocto = 0.045 NEAR. */
ok('toNear reads the on-chain top_up_bond deposit', E.toNear('45000000000000000000000') === 0.045,
  String(E.toNear('45000000000000000000000')));

/* 9. Le dépôt d'un top_up_bond réel (5c46BFGtTp6Be) : 4.5e22 yocto.
   Arrondi à 0.04, il contredirait le reçu — le texte garde le chiffre exact. */
ok('amountText keeps every digit', E.amountText('45000000000000000000000') === '0.045',
  E.amountText('45000000000000000000000'));
/* La caution de base déployée : 1e23 yocto = 0.1 NEAR (create_category). */
ok('amountText prints the base bond', E.amountText('100000000000000000000000') === '0.1',
  E.amountText('100000000000000000000000'));
ok('amountText prints a whole NEAR', E.amountText('1000000000000000000000000') === '1',
  E.amountText('1000000000000000000000000'));

/* 10. Le reçu complet d'une fermeture réelle (4yReGbSY24ag) : le contrat des
   missions émet un tableau, le registre un objet, dans la même transaction. */
const CLOSE = [
  { standard: 'missions', version: '1.0.0', event: 'mission_closed',
    data: [{ id: 4, worker: 'lea.demerit.testnet', outcome: 'severe', reward: '50000000000000000000000' }] },
  { standard: 'nep297', version: '1.0.0', event: 'bond_slashed',
    data: { holder: 'lea.demerit.testnet', category: 'coursier', amount: '40000000000000000000000', fund: '20000000000000000000000' } },
  { standard: 'nep297', version: '1.0.0', event: 'client_compensated',
    data: { holder: 'lea.demerit.testnet', client: 'client.demerit.testnet', amount: '20000000000000000000000', mission_id: 'm-4' } },
  { standard: 'nep297', version: '1.0.0', event: 'points_changed',
    data: { holder: 'lea.demerit.testnet', category: 'coursier', before: 2, after: 0, reason: 'severe' } },
  { standard: 'nep297', version: '1.0.0', event: 'license_suspended',
    data: { holder: 'lea.demerit.testnet', category: 'coursier', until: 1794392025252954400 } }
];
const closeLines = CLOSE.map(e => E.format(e.event, e.data));
ok('mission_closed reads the wrapped array', /mission_closed · #4 · severe/.test(closeLines[0]), closeLines[0]);
ok('the slashed bond is 0.04 NEAR', /^bond_slashed · 0\.04 Ⓝ$/.test(closeLines[1]), closeLines[1]);
ok('the client is paid 0.02 NEAR', /client_compensated · 0\.02 Ⓝ → client\.demerit\.testnet/.test(closeLines[2]), closeLines[2]);
ok('the points fall to zero', /points_changed · 2 → 0/.test(closeLines[3]), closeLines[3]);
/* Six demo months = 6 × 600 s (rules.month_seconds = 6e11) : la date seule
   ressemble à une faute le jour même, seule la minute lève le doute. */
ok('a suspension prints the minute', /until 11 Nov 2026 10:13 UTC/.test(closeLines[4]), closeLines[4]);
ok('a whole receipt prints no "undefined"', closeLines.every(l => !/undefined/.test(l)), closeLines.join(' | '));

t.done('EVENTS');

/* Tests of the live transaction feed (web/txs.js) and of the explorer client
   (web/explorer.js), against the REAL v3 payloads of api-testnet.nearblocks.io,
   read back on 14 Nov 2026 from the demo run of 11 Nov:
     5c46BFGt… top_up_bond   (deposit 4.5e22, no event)
     9XPucD7m… close         (1 event on the call, 5 in a nested receipt)
     CZ9aJ8qR… resolve_contest (contest_resolved + platform_struck)
     GfHgwBS1… close         (a failed transaction, status false)
   The shapes are the ground truth: an account row carries actions_agg.deposit
   and no args, a receipt node carries outcome.logs plus nested receipts.
   Run: cd web && node scripts/txs-test.mjs */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tap, browserWindow } from './tap.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const t = tap();
const LEDGER = 'ledger.demerit.testnet';
const PLATFORM = 'platform.demerit.testnet';
const TOP_UP = '5c46BFGtTp6BeNfhKz2uemHTBPvo9D8CPXuJU61jsU2N';
const CLOSE = '9XPucD7m9SxQdptJvcQWimRfWopSTpT3Erze3rVxqBxH';
const RESOLVE = 'CZ9aJ8qRGx5A68uqJcCLPv1x96uzz6rdmoV5E95Ep8jq';
const FAILED = 'GfHgwBS1pzHoyYMMKNNwgP1x1SQduf9CoEwnAbDJFioi';

function row(hash, method, account, signer, deposit, status) {
  return {
    transaction_hash: hash, signer_account_id: signer, receiver_account_id: account,
    actions: [{ action: 'FUNCTION_CALL', method: method }],
    actions_agg: { deposit: deposit }, outcomes: { status: status },
    block: { block_height: '277196042' }
  };
}

const TXNS = {
  [LEDGER]: [row(TOP_UP, 'top_up_bond', LEDGER, 'lea.demerit.testnet', '45000000000000000000000', true),
             row(RESOLVE, 'resolve_contest', LEDGER, 'issuer.demerit.testnet', '0', true)],
  [PLATFORM]: [row(CLOSE, 'close', PLATFORM, 'client.demerit.testnet', '0', true),
               row(FAILED, 'close', PLATFORM, 'client.demerit.testnet', '0', false)]
};

function eventJson(obj) { return 'EVENT_JSON:' + JSON.stringify(obj); }
const RECEIPTS = {
  [TOP_UP]: { outcome: { logs: [] }, receipts: [{ outcome: { logs: [] } }] },
  [RESOLVE]: {
    outcome: { logs: [
      eventJson({ standard: 'nep297', version: '1.0.0', event: 'contest_resolved',
        data: { holder: 'lea.demerit.testnet', category: 'coursier', mission_id: 'm-4', upheld: false } }),
      eventJson({ standard: 'nep297', version: '1.0.0', event: 'platform_struck',
        data: { account: 'platform.demerit.testnet', warnings: 1, suspended: false } })
    ] },
    receipts: []
  },
  [CLOSE]: {
    outcome: { logs: [eventJson({ standard: 'missions', version: '1.0.0', event: 'mission_closed',
      data: [{ id: 5, worker: 'lea2.demerit.testnet', outcome: 'severe', reward: '50000000000000000000000' }] })] },
    receipts: [{ outcome: { logs: [
      eventJson({ standard: 'nep297', version: '1.0.0', event: 'bond_slashed',
        data: { holder: 'lea2.demerit.testnet', category: 'coursier', amount: '40000000000000000000000', fund: '20000000000000000000000' } }),
      eventJson({ standard: 'nep297', version: '1.0.0', event: 'client_compensated',
        data: { holder: 'lea2.demerit.testnet', client: 'client.demerit.testnet', amount: '20000000000000000000000', mission_id: 'm-5' } }),
      eventJson({ standard: 'nep297', version: '1.0.0', event: 'points_changed',
        data: { holder: 'lea2.demerit.testnet', category: 'coursier', before: 6, after: 0, reason: 'severe' } }),
      eventJson({ standard: 'nep297', version: '1.0.0', event: 'license_suspended',
        data: { holder: 'lea2.demerit.testnet', category: 'coursier', until: 1794392491814980400 } })
    ] } }]
  },
  [FAILED]: { outcome: { logs: [] }, receipts: [] }
};

/* One probe at a time, like a browser that must not trip the rate limit. */
function explorerStub(broken) {
  const calls = [];
  let inflight = 0;
  let maxInflight = 0;
  const wait = () => new Promise(function (resolve) { setTimeout(resolve, 1); });
  function track(kind, key) {
    calls.push(kind + ':' + key);
    inflight++;
    if (inflight > maxInflight) maxInflight = inflight;
    return wait().then(function () { inflight--; });
  }
  return {
    calls: calls,
    peak: function () { return maxInflight; },
    txns: function (account) {
      return track('txns', account).then(function () {
        if (broken && broken.txns && broken.txns[account]) throw new Error('explorer HTTP 500');
        return TXNS[account] || [];
      });
    },
    receipts: function (hash) {
      return track('receipts', hash).then(function () {
        if (broken && broken.receipts && broken.receipts[hash]) throw new Error('explorer HTTP 500');
        return RECEIPTS[hash];
      });
    }
  };
}

function loadTxs(explorer) {
  const box = browserWindow({ ROOT });
  box.win.DemeritChain = { config: function () { return { contract: LEDGER, missions: PLATFORM }; } };
  box.load('events.js');
  box.win.DemeritExplorer = explorer;
  box.load('txs.js');
  return box.win.DemeritTxs;
}

console.log('txs.js');
const stub = explorerStub();
const Txs = loadTxs(stub);

await (async function () {
  const all = await Txs.recent(4);
  t.ok('both contracts are read', all.length === 4, JSON.stringify(all.map(x => x.method)));
  t.ok('the registry rows come first', all[0].receiver === LEDGER && all[1].receiver === LEDGER,
    all.map(x => x.receiver).join(','));
  t.ok('the deposit is read from actions_agg', all[0].deposit === '45000000000000000000000', all[0].deposit);
  t.ok('a call with no deposit reads zero', all[1].deposit === '0', all[1].deposit);
  t.ok('the status of a failed call is false', all[3].status === false, String(all[3].status));
  t.ok('events come from the nested receipts', all[2].events.length === 5,
    JSON.stringify(all[2].events.map(e => e.event)));
  t.ok('a transaction with no log has no event', all[0].events.length === 0);
  const lines = all.flatMap(tx => Txs.lines(tx));
  t.ok('the call line prints the exact deposit', /\$ lea\.demerit\.testnet → ledger\.demerit\.testnet\.top_up_bond · deposit 0\.045 Ⓝ/.test(lines[0].text), lines[0].text);
  t.ok('a zero deposit is not printed', !/deposit/.test(lines[4].text), lines[4].text);
  t.ok('the slashed bond reads 0.04 NEAR', lines.some(l => /EVENT bond_slashed · 0\.04 Ⓝ/.test(l.text)),
    lines.map(l => l.text).join(' | '));
  t.ok('a suspension prints the minute', lines.some(l => /license_suspended · until 11 Nov 2026 10:21 UTC/.test(l.text)));
  t.ok('a succeeded call is marked ✓', lines.some(l => l.cls === 'o' && /✓ 5c46BFGt/.test(l.text)));
  t.ok('a failed call is marked ✕', lines.some(l => l.cls === 'r' && /✕ GfHgwBS1/.test(l.text)));
  t.ok('the explorer link rides with the hash', lines.some(l => l.text.includes('explorer.testnet.near.org/tx/' + RESOLVE)));
  t.ok('nothing prints "undefined"', lines.every(l => !/undefined/.test(l.text)), lines.map(l => l.text).join(' | '));
  t.ok('requests are serialised', stub.peak() === 1, 'peak ' + stub.peak());
})();

await (async function () {
  const few = explorerStub();
  const T = loadTxs(few);
  await T.recent(2);
  const receipts = few.calls.filter(c => c.startsWith('receipts:'));
  t.ok('only the printed rows are fetched', receipts.length === 2, receipts.join(','));
})();

await (async function () {
  const T = loadTxs(explorerStub({ receipts: { [CLOSE]: true } }));
  const out = await T.recent(4);
  t.ok('a receipt that fails drops one row', out.length === 3 && out.every(x => x.hash !== CLOSE),
    JSON.stringify(out.map(x => x.hash.slice(0, 6))));
})();

await (async function () {
  const T = loadTxs(explorerStub({ txns: { [LEDGER]: true } }));
  const out = await T.recent(4);
  t.ok('one account down still reads the other', out.length === 2 && out.every(x => x.receiver === PLATFORM),
    JSON.stringify(out.map(x => x.receiver)));
})();

/* explorer.js: the v3 wrapper, the rate limit and the errors that must not be
   retried. The timer is stubbed so a retry costs no wall clock. */
console.log('explorer.js');
await (async function () {
  var hits = 0;
  const answers = [
    { ok: false, status: 429 },
    { ok: true, status: 200, json: function () { return Promise.resolve({ data: [row(TOP_UP, 'top_up_bond', LEDGER, 'lea.demerit.testnet', '45000000000000000000000', true)] }); } }
  ];
  const box = browserWindow({
    ROOT: ROOT,
    setTimeout: function (fn) { fn(); return 0; },
    fetch: function () { var a = answers[Math.min(hits, answers.length - 1)]; hits++; return Promise.resolve(a); }
  });
  box.load('explorer.js');
  const Ex = box.win.DemeritExplorer;
  const list = await Ex.txns(LEDGER, 1);
  t.ok('a 429 is retried, then answered', hits === 2 && list.length === 1, 'hits ' + hits);
  t.ok('the v3 data wrapper is unwrapped', list[0].transaction_hash === TOP_UP);
  t.ok('the endpoint is the v3 one', Ex.BASE.endsWith('/v3'), Ex.BASE);

  hits = 0;
  const box2 = browserWindow({
    ROOT: ROOT,
    setTimeout: function (fn) { fn(); return 0; },
    fetch: function () { hits++; return Promise.resolve({ ok: false, status: 500 }); }
  });
  box2.load('explorer.js');
  const failed = await box2.win.DemeritExplorer.txns(LEDGER, 1).then(function () { return null; },
                                                            function (e) { return e.message; });
  t.ok('a 500 is not retried', failed === 'explorer HTTP 500' && hits === 1, failed + ' / hits ' + hits);

  hits = 0;
  const box3 = browserWindow({
    ROOT: ROOT,
    setTimeout: function (fn) { fn(); return 0; },
    fetch: function () { hits++; return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ errors: [{ message: 'no such account' }] }); } }); }
  });
  box3.load('explorer.js');
  const errored = await box3.win.DemeritExplorer.txns('nope.testnet', 1).then(function () { return null; },
                                                                              function (e) { return e.message; });
  t.ok('an API error reaches the caller', errored === 'no such account', String(errored));
})();

t.done('TXS');

/* demerit — public explorer API (testnet).
   The JSON-RPC nodes keep only a short window of state, so a transaction from
   a few hours ago is no longer readable there. The explorer keeps the whole
   history and answers with CORS (access-control-allow-origin: *), so the live
   terminal can show what really happened: the hash, the method, the deposit and
   the NEP-297 events of each transaction.
   Shapes are the v3 ones: { data: … }, an account's txns carry actions_agg.deposit
   and no args, a receipt node carries outcome.logs and nested receipts.
   The endpoint rate-limits (HTTP 429) after a few dozen calls: one patient retry,
   then the caller falls back to the RPC reads. */
(function () {
  'use strict';

  var BASE = 'https://api-testnet.nearblocks.io/v3';
  var RETRIES = 2;
  var WAIT_MS = 3000;

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function once(path) {
    return fetch(BASE + path, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 429) {
          var limited = new Error('explorer rate limit');
          limited.retry = true;
          throw limited;
        }
        if (!r.ok) throw new Error('explorer HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (j && j.errors && j.errors.length) throw new Error(j.errors[0].message || 'explorer error');
        return j && j.data !== undefined ? j.data : j;
      });
  }

  function get(path, left) {
    var tries = left === undefined ? RETRIES : left;
    return once(path).catch(function (err) {
      if (!err.retry || tries <= 0) throw err;
      return delay(WAIT_MS).then(function () { return get(path, tries - 1); });
    });
  }

  /* The transactions of one account, newest first. */
  function txns(account, limit) {
    return get('/accounts/' + encodeURIComponent(account) + '/txns?limit=' + (limit || 8));
  }

  /* One transaction: methods, signer, deposit, status. */
  function tx(hash) {
    return get('/txns/' + encodeURIComponent(hash));
  }

  /* The receipts of one transaction: the logs the contracts wrote. */
  function receipts(hash) {
    return get('/txns/' + encodeURIComponent(hash) + '/receipts');
  }

  window.DemeritExplorer = { txns: txns, tx: tx, receipts: receipts, BASE: BASE };
})();

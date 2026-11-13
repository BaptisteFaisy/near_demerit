/* demerit — public explorer API (testnet).
   The JSON-RPC nodes keep only a short window of state, so a transaction from
   a few hours ago is no longer readable there. The explorer keeps the whole
   history and answers with CORS, so the live terminal can show what really
   happened: the hash, the method and the NEP-297 events of each transaction.
   Every call may fail (rate limit, network): the caller shows the error. */
(function () {
  'use strict';

  var BASE = 'https://api-testnet.nearblocks.io/v3';

  function get(path) {
    return fetch(BASE + path, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('explorer HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (j && j.errors && j.errors.length) throw new Error(j.errors[0].message || 'explorer error');
        return j && j.data !== undefined ? j.data : j;
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

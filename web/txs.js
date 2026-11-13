/* demerit — the real transactions of the live app.
   The public JSON-RPC prunes old blocks, so a transaction from a few days ago
   cannot be read back from it. The explorer's public API answers with CORS and
   keeps the history, so the live terminal shows what actually happened: the
   hash, the method, the signer and the NEP-297 events of each call.
   Everything degrades quietly: if the explorer is unreachable, the reads on the
   chain (which go through the RPC) keep working. */
(function () {
  'use strict';

  var Explorer = window.DemeritExplorer;
  var Events = window.DemeritEvents;
  var Chain = window.DemeritChain;

  function cfg() { return Chain.config(); }

  /* The NEP-297 events of one transaction, from its receipt logs. */
  function eventsOf(hash) {
    return Explorer.receipts(hash).then(function (receipt) {
      var logs = [];
      var outcome = (receipt && receipt.outcome) || {};
      (outcome.logs || []).forEach(function (l) { logs.push(l); });
      ((receipt && receipt.receipts) || []).forEach(function (rc) {
        var o = (rc && rc.outcome) || {};
        (o.logs || []).forEach(function (l) { logs.push(l); });
      });
      return Events.parseLogs(logs);
    });
  }

  /* One transaction: hash, method, signer, receiver, status, events. */
  function detail(tx) {
    var hash = tx.transaction_hash;
    var action = (tx.actions || [])[0] || {};
    return eventsOf(hash).then(function (events) {
      return {
        hash: hash,
        method: action.method || 'transfer',
        signer: tx.signer_account_id,
        receiver: tx.receiver_account_id,
        deposit: (action.args && action.args.deposit) || '0',
        status: !!(tx.outcomes && tx.outcomes.status),
        events: events
      };
    });
  }

  /* The latest transactions of both contracts, newest first. */
  function recent(limit) {
    var n = limit || 8;
    var c = cfg();
    var accounts = [c.contract, c.missions].filter(function (a, i, all) {
      return a && all.indexOf(a) === i;
    });
    return Promise.all(accounts.map(function (acct) {
      return Explorer.txns(acct, n).then(function (list) {
        return (list || []).slice(0, n);
      }).catch(function () { return []; });
    })).then(function (lists) {
      var seen = {}, out = [];
      lists.forEach(function (list) {
        list.forEach(function (tx) {
          if (!tx.transaction_hash || seen[tx.transaction_hash]) return;
          seen[tx.transaction_hash] = true;
          out.push(tx);
        });
      });
      return Promise.all(out.map(function (tx) {
        return detail(tx).catch(function () { return null; });
      })).then(function (details) {
        return details.filter(Boolean).slice(0, n);
      });
    });
  }

  /* The terminal lines of one transaction: the call, its events, the hash. */
  function lines(tx) {
    var out = [];
    out.push({
      cls: 'c',
      text: '$ ' + tx.signer + ' → ' + tx.receiver + '.' + tx.method +
        (tx.deposit && tx.deposit !== '0'
          ? ' · deposit ' + Events.toNear(tx.deposit).toFixed(2) + ' Ⓝ' : '')
    });
    tx.events.forEach(function (e) {
      out.push({ cls: 'e', text: '  EVENT ' + Events.format(e.event, e.data) });
    });
    out.push({
      cls: tx.status ? 'o' : 'r',
      text: '  ' + (tx.status ? '✓' : '✕') + ' ' + tx.hash +
        ' · explorer.testnet.near.org/tx/' + tx.hash
    });
    return out;
  }

  window.DemeritTxs = { recent: recent, lines: lines, detail: detail, eventsOf: eventsOf };
})();

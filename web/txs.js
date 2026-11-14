/* demerit — the real transactions of the live app.
   The public JSON-RPC prunes old blocks, so a transaction from a few days ago
   cannot be read back from it. The explorer's public API answers with CORS and
   keeps the history, so the live terminal shows what actually happened: the
   hash, the method, the signer, the deposit and the NEP-297 events of each call.
   Calls are serialised and capped: the explorer rate-limits a browser that
   fires a dozen requests at once. Everything degrades quietly — if the explorer
   is unreachable, the reads on the chain (which go through the RPC) keep working. */
(function () {
  'use strict';

  var Explorer = window.DemeritExplorer;
  var Events = window.DemeritEvents;
  var Chain = window.DemeritChain;

  var MAX_EVENTS_PER_TX = 6;

  function cfg() { return Chain.config(); }

  /* One request at a time: the explorer answers 429 to a burst. */
  function series(items, fn) {
    return items.reduce(function (chain, item) {
      return chain.then(function (acc) {
        return fn(item).then(function (out) { acc.push(out); return acc; },
                             function () { acc.push(null); return acc; });
      });
    }, Promise.resolve([]));
  }

  function unique(list) {
    var seen = {};
    return list.filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }

  /* The v3 account rows put the deposit in actions_agg, not in the action args. */
  function depositOf(tx) {
    var agg = tx.actions_agg || {};
    var action = (tx.actions || [])[0] || {};
    var args = action.args || {};
    return agg.deposit || args.deposit || '0';
  }

  /* The NEP-297 events of one transaction, from its receipt logs. */
  function eventsOf(hash) {
    return Explorer.receipts(hash).then(function (node) {
      var logs = [];
      function walk(part) {
        var outcome = (part && part.outcome) || {};
        (outcome.logs || []).forEach(function (l) { logs.push(l); });
        ((part && part.receipts) || []).forEach(walk);
      }
      walk(node);
      return Events.parseLogs(logs).slice(0, MAX_EVENTS_PER_TX);
    });
  }

  /* One transaction: hash, method, signer, receiver, deposit, status, events. */
  function detail(tx) {
    var hash = tx.transaction_hash;
    var actions = tx.actions || [];
    return eventsOf(hash).then(function (events) {
      return {
        hash: hash,
        method: (actions[0] && actions[0].method) || 'transfer',
        signer: tx.signer_account_id,
        receiver: tx.receiver_account_id,
        deposit: depositOf(tx),
        status: !!(tx.outcomes && tx.outcomes.status),
        events: events
      };
    });
  }

  /* The latest transactions of both contracts, newest first, at most `limit`.
     The list is cut BEFORE the receipt calls: one row per transaction shown,
     never a burst of calls for lines that will not be printed. */
  function recent(limit) {
    var n = limit || 8;
    var c = cfg();
    var accounts = unique([c.contract, c.missions].filter(Boolean));
    return series(accounts, function (acct) {
      return Explorer.txns(acct, n);
    }).then(function (lists) {
      var rows = [];
      lists.forEach(function (list) {
        (list || []).forEach(function (tx) { if (tx) rows.push(tx); });
      });
      var seen = {};
      return rows.filter(function (tx) {
        var h = tx.transaction_hash;
        if (!h || seen[h]) return false;
        seen[h] = true;
        return true;
      }).slice(0, n);
    }).then(function (picked) {
      return series(picked, function (tx) { return detail(tx); });
    }).then(function (details) {
      return details.filter(Boolean);
    });
  }

  /* The terminal lines of one transaction: the call, its events, the hash. */
  function lines(tx) {
    var out = [];
    var deposit = Events.amountText(tx.deposit);
    out.push({
      cls: 'c',
      text: '$ ' + Events.text(tx.signer) + ' → ' + Events.text(tx.receiver) + '.' + tx.method +
        (tx.deposit && tx.deposit !== '0' && deposit !== '0'
          ? ' · deposit ' + deposit + ' Ⓝ' : '')
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

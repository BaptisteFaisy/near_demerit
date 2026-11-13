/* demerit — shared JSON-RPC layer for the public pages.
   One place for the endpoints, the call shape and the yocto→NEAR conversion.
   Reads are free view calls: no key, no signature, no transaction. */
(function () {
  'use strict';

  var FALLBACKS = [
    'https://rpc.testnet.fastnear.com',
    'https://near-testnet.drpc.org',
    'https://rpc.testnet.near.org'
  ];
  var DEFAULTS = {
    rpc: FALLBACKS[0],
    contract: 'ledger.demerit.testnet',
    missions: 'platform.demerit.testnet',
    category: 'coursier'
  };

  /* Query string wins over the config file: ?contract=…&missions=…&rpc=… */
  function readQuery() {
    var out = {};
    try {
      var p = new URLSearchParams(location.search);
      ['rpc', 'contract', 'missions', 'category'].forEach(function (k) {
        var v = p.get(k);
        if (v) out[k] = v;
      });
    } catch (e) { /* no query string available */ }
    return out;
  }

  function config() {
    var cfg = {};
    var file = window.DEMERIT_CONFIG || {};
    Object.keys(DEFAULTS).forEach(function (k) { cfg[k] = file[k] || DEFAULTS[k]; });
    var q = readQuery();
    Object.keys(q).forEach(function (k) { cfg[k] = q[k]; });
    return cfg;
  }

  function endpoints() {
    var cfg = config();
    return [cfg.rpc].concat(FALLBACKS.filter(function (u) { return u !== cfg.rpc; }));
  }

  /* One view call. Tries every endpoint in turn; throws a readable error. */
  function view(contract, method, args) {
    var body = {
      jsonrpc: '2.0', id: 1, method: 'query',
      params: {
        request_type: 'call_function', finality: 'final',
        account_id: contract, method_name: method,
        args_base64: btoa(JSON.stringify(args || {}))
      }
    };
    return endpoints().reduce(function (chain, url) {
      return chain.catch(function (err) {
        return fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j.error) throw new Error(j.error.message || 'RPC error');
          var bytes = j.result && j.result.result;
          if (!bytes) throw new Error((j.result && j.result.error && j.result.error.message) || 'No result');
          return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
        });
      });
    }, Promise.reject(new Error('No endpoint tried')));
  }

  /* Yocto strings are exact: BigInt only, never parseFloat. */
  function toNear(yocto) {
    try {
      var unit = 1000000000000000000000000n;
      var v = BigInt(String(yocto).trim());
      var whole = v / unit, frac = (v % unit).toString().replace(/0+$/, '');
      return frac ? whole.toString() + '.' + frac : whole.toString();
    } catch (e) { return String(yocto); }
  }

  window.DemeritChain = {
    config: config, endpoints: endpoints, view: view, toNear: toNear,
    FALLBACKS: FALLBACKS, DEFAULTS: DEFAULTS
  };
})();

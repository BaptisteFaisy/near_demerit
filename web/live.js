/* demerit — live testnet layer for the public app.
   Reads are free view calls on the deployed contracts. Writes are never signed
   in the page: the app shows a ready-to-run near-cli-rs command instead. */
(function () {
  'use strict';

  var Chain = window.DemeritChain;
  var cfg = function () { return Chain.config(); };
  var cat = function () { return cfg().category; };

  function status(account) {
    return Chain.view(cfg().contract, 'status', { account: account, category: cat() })
      .then(function (s) {
        s.bond = Chain.toNear(s.bond);
        s.required_bond = Chain.toNear(s.required_bond);
        return s;
      });
  }

  /* Several licences at once: one failed account must not hide the others. */
  function statuses(accounts) {
    var out = {};
    return Promise.all(accounts.map(function (a) {
      return status(a).then(function (s) { out[a] = s; }, function () { out[a] = null; });
    })).then(function () { return out; });
  }

  function missions() {
    return Chain.view(cfg().missions, 'missions', {}).then(function (l) { return l || []; });
  }

  function credit(account) {
    return Chain.view(cfg().contract, 'credit', { account: account }).then(Chain.toNear);
  }

  function fund() {
    return Chain.view(cfg().contract, 'fund', {}).then(Chain.toNear);
  }

  function platform(account) {
    return Chain.view(cfg().contract, 'platform', { account: account });
  }

  function nft(tokenId) {
    return Chain.view(cfg().contract, 'nft_token', { token_id: tokenId });
  }

  window.DemeritLive = {
    status: status, statuses: statuses, missions: missions,
    credit: credit, fund: fund, platform: platform, nft: nft
  };
})();

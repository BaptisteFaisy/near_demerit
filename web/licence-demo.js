/* demerit — option B: the licences already issued on NEAR testnet.
   Read-only. No key, no signature, no transaction: two free view calls.
   The card appears on the licence page in live mode, so a visitor can read a
   real licence (points, deposit, refusals) without holding the issuer key. */
(function () {
  'use strict';

  var DEMO = [
    { acct: 'lea.demerit.testnet', who: 'Léa Martin · courier', what: 'full licence: active, can take jobs' },
    { acct: 'lea2.demerit.testnet', who: 'Léa Martin · same person, new account', what: 'a new account does not erase the record: under-deposit, every platform refuses it' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function near(v) {
    try { return (Number(v) / 1e24).toFixed(2).replace(/\.00$/, ''); } catch (e) { return String(v); }
  }
  function card() {
    return '<div class="card" id="demoLicences" style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">' +
      '<b style="font:600 17px var(--display)">Demo licences — already issued on NEAR testnet</b>' +
      '<span class="muted" style="font-size:14px">The issuer holds the key, so a visitor cannot get a licence signed on the spot. These two licences are real: read them on chain, free, no wallet.</span>' +
      DEMO.map(function (d) {
        return '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:15px" data-demo="' + esc(d.acct) + '">' +
          '<span class="mono" style="font-size:14px">' + esc(d.acct) + '</span>' +
          '<span class="muted" style="font-size:13px">' + esc(d.who) + ' · ' + esc(d.what) + '</span>' +
          '<span class="sp" style="flex:1"></span>' +
          '<span class="pill" data-slot="state">…</span>' +
          '<a class="btn sm" target="_blank" rel="noopener" href="https://testnet.nearblocks.io/address/' + esc(d.acct) + '">Explorer</a>' +
          '</div>';
      }).join('') +
      '</div>';
  }
  function fill() {
    DEMO.forEach(function (d) {
      var row = document.querySelector('[data-demo="' + d.acct + '"] [data-slot="state"]');
      if (!row) return;
      if (!window.DemeritLive) { row.textContent = 'read unavailable'; return; }
      window.DemeritLive.status(d.acct).then(function (s) {
        row.textContent = s.points + '/' + s.cap + ' pts · ' + (s.under_bonded ? 'under-deposit' : s.status);
      }, function (e) { row.textContent = 'read failed (RPC)'; });
    });
  }
  function mount() {
    var main = document.getElementById('main');
    if (!main || location.hash.indexOf('#/licence') !== 0) return;
    if (main.querySelector('#demoLicences')) return;
    var el = document.createElement('div');
    el.innerHTML = card();
    main.insertBefore(el.firstChild, main.firstChild);
    fill();
  }
  function start() {
    var obs = new MutationObserver(function () { mount(); });
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', mount);
    mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

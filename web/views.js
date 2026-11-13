/* demerit — shared view helpers for the public app.
   Rendering only: no state, no network. The demo (simulation) and the live
   (testnet) pages share the same components, so a licence looks the same
   whether its numbers come from the Rust rules or from the chain. */
(function () {
  'use strict';

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = x => (Math.round((x || 0) * 100) / 100).toFixed(2);
  const PAGE = { licence: 'My licence', jobs: 'Jobs', orders: 'My deliveries', wallet: 'Wallet', check: 'Public check' };
  const ICON = {
    licence: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="12" r="2.4"/><path d="M14 10h4M14 14h3"/></svg>',
    jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 9h18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>'
  };
  const BOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/></svg>';
  const OUT = { clean: ['On time', 'ok', '0'], light: ['Late', 'warn', '−1'], medium: ['Damaged parcel', 'warn', '−3'], severe: ['Lost parcel', 'no', '−6'] };

  /* Timestamps from the chain are unix seconds; the sandbox clock is not. */
  const realDate = ts => ts ? new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  function licenceCard(s, p, fmt) {
    const f = fmt || realDate;
    if (!s) return '<div class="lic empty"><div class="lic-h"><b>No licence yet</b></div><p style="margin:12px 0 18px;font-size:16px;color:var(--ink2)">A demerit licence lets any platform check, in one call, that you are allowed to work. It starts at 6 points on probation and needs a 1 Ⓝ deposit.</p><button class="btn pri" id="getLic">Get my courier licence</button></div>';
    const sus = s.status === 'Suspended', st = sus ? 'Suspended' : s.status === 'Probation' ? 'Probation' : 'Active';
    const segs = Array.from({ length: 12 }, (_, i) => '<i class="' + (i < s.points ? 'on' : i < s.cap ? 'cap' : '') + '"></i>').join('');
    return '<div class="lic ' + (sus ? 'sus' : '') + '"><div class="lic-h"><b>Courier licence</b><span class="sp"></span><span class="soul">Soulbound NFT · NEP-171</span></div>' +
      '<div class="lic-id">' + esc(p.name) + ' · ' + esc(s.holder) + ' · ' + esc(s.token_id) + '</div>' +
      '<div class="lic-pts"><b id="pts">' + s.points + '</b><span>/ 12 points</span><span class="pill ' + (sus ? 'no' : 'acc') + '">' + st + '</span></div>' +
      '<div class="segs">' + segs + '</div>' +
      '<div class="lic-f"><div>Deposit<b>' + N(s.bond) + ' / ' + N(s.required_bond) + ' Ⓝ</b></div><div>Price factor<b>×' + (s.coefficient / 100).toFixed(2) + '</b></div><div>Jobs done<b>' + s.missions_ok + '</b></div><div>' + (sus ? 'Suspended until<b>' + f(s.suspended_until) + '</b>' : 'Next point<b>' + (s.next_regen_at ? f(s.next_regen_at) : 'full') + '</b>') + '</div></div></div>';
  }

  function checkCard(s) {
    const ok = s.allowed;
    return '<div class="grid2"><div class="card" style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:center;gap:12px"><b style="font:700 26px var(--display)">' + esc(s.holder) + '</b><span class="pill ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'Allowed to work' : 'Not allowed') + '</span></div>' +
      '<div style="display:flex;align-items:baseline;gap:8px"><b style="font:700 64px/1 var(--display)">' + s.points + '</b><span class="muted" style="font-size:20px">/ ' + s.cap + ' points</span></div>' +
      '<div class="segs" style="--x:0">' + Array.from({ length: 12 }, (_, i) => '<i style="background:' + (i < s.points ? 'var(--accent);box-shadow:0 0 10px rgba(164,107,255,.8)' : 'var(--surface3)') + ';height:10px;border-radius:5px"></i>').join('') + '</div></div>' +
      '<div class="card"><dl class="kv"><dt>Licence (NFT)</dt><dd class="mono">' + esc(s.token_id) + '</dd><dt>Status</dt><dd>' + esc(s.status) + '</dd><dt>Deposit locked</dt><dd>' + N(s.bond) + ' Ⓝ</dd><dt>Deposit required</dt><dd>' + N(s.required_bond) + ' Ⓝ</dd><dt>Price factor</dt><dd>×' + (s.coefficient / 100).toFixed(2) + '</dd><dt>Invalidations</dt><dd>' + s.invalidations + '</dd><dt>Source</dt><dd>NEAR testnet · view call</dd></dl></div></div>';
  }

  /* Live pages: the same layout, fed by the chain. */
  function liveJobs(ctx) {
    const list = ctx.missions() || [];
    const shown = list.filter(m => m.worker === ctx.me().acct || m.state === 'open');
    const row = m => {
      const worker = m.worker || 'a courier';
      const act = m.state === 'open' ? '<button class="btn pri" data-intent-accept="' + m.id + '">Accept</button>'
        : m.state === 'taken' ? '<span class="pill acc">Taken by ' + esc(worker) + '</span>'
        : '<span class="pill ' + (m.outcome === 'severe' ? 'no' : 'ok') + '">' + esc(m.outcome || m.state) + '</span>';
      return '<div class="job"><div class="ic">' + BOX + '</div><div><h3>Delivery #' + m.id + '</h3><p>posted by ' + esc(m.poster) + '</p></div>' +
        '<div class="act"><div class="rw">' + N(ctx.toNear(m.reward)) + ' Ⓝ<small>reward in escrow</small></div>' + act + '</div></div>';
    };
    return '<div class="ph"><div><h1>Jobs</h1><p>Live missions on ' + ctx.platform + '. Accepting asks the registry whether you are allowed.</p></div></div>' + ctx.bannerHTML() + ctx.chainBanner() +
      '<div class="jobs">' + shown.map(row).join('') + (!list.length ? '<div class="card muted">No mission on the platform yet.</div>' : '') + '</div>';
  }

  function liveOrders(ctx) {
    const list = (ctx.missions() || []).filter(m => m.poster === ctx.me().acct);
    const row = m => '<div class="job"><div class="ic">' + BOX + '</div><div><h3>Delivery #' + m.id + '</h3><p>' + esc(m.worker || 'waiting for a courier') + '</p></div>' +
      '<div class="act"><span class="pill ' + (m.state === 'open' ? '' : m.state === 'taken' ? 'acc' : 'ok') + '">' + esc(m.state) + '</span></div></div>';
    return '<div class="ph"><div><h1>My deliveries</h1><p>Post a delivery, then rate the courier. A serious fault is refunded from the courier\'s deposit.</p></div><span class="sp"></span>' +
      '<button class="btn pri" data-intent-post="1">Post a delivery · 0.10 Ⓝ</button></div>' + ctx.bannerHTML() + ctx.chainBanner() +
      '<div class="jobs">' + list.map(row).join('') + (!list.length ? '<div class="card muted">No delivery yet.</div>' : '') + '</div>';
  }

  function liveWallet(ctx) {
    if (ctx.me().acct === 'client.demerit.testnet') {
      const c = ctx.credit();
      return '<div class="ph"><div><h1>Wallet</h1><p>When a courier causes a serious fault, the contract pays you from their deposit. No claim, no support ticket.</p></div></div>' + ctx.bannerHTML() + ctx.chainBanner() +
        '<div class="stats"><div class="stat"><small>Compensation available</small><b>' + N(c) + ' <span>Ⓝ</span></b></div>' +
        '<div class="stat"><small>Guarantee fund</small><b>' + N(ctx.fund()) + ' <span>Ⓝ</span></b></div>' +
        '<div class="stat"><small>Paid by</small><b style="font-size:20px;margin-top:12px">courier deposit</b></div></div>' +
        '<div><button class="btn pri" data-intent-withdraw="1">Withdraw ' + N(c) + ' Ⓝ</button></div>';
    }
    const s = ctx.licOf(ctx.me().acct);
    const need = s ? Math.max(0, s.required_bond - s.bond) : 0;
    return '<div class="ph"><div><h1>Wallet</h1><p>Your deposit backs your work. Good years lower it; serious faults raise it.</p></div></div>' + ctx.bannerHTML() + ctx.chainBanner() +
      '<div class="stats"><div class="stat"><small>Deposit locked</small><b>' + N(s && s.bond) + ' <span>Ⓝ</span></b></div>' +
      '<div class="stat"><small>Required deposit</small><b>' + N(s && s.required_bond) + ' <span>Ⓝ</span></b><small style="margin-top:8px">price factor ×' + (s ? (s.coefficient / 100).toFixed(2) : '1.00') + '</small></div>' +
      '<div class="stat"><small>Next point</small><b style="font-size:20px;margin-top:12px">' + (s && s.next_regen_at ? realDate(s.next_regen_at) : '—') + '</b></div></div>' +
      '<div><button class="btn pri" data-intent-topup="1">Top up deposit' + (need > 0 ? ' · +' + N(need) + ' Ⓝ' : '') + '</button></div>';
  }

  window.DemeritViews = {
    esc: esc, N: N, PAGE: PAGE, ICON: ICON, BOX: BOX, OUT: OUT, realDate: realDate,
    licenceCard: licenceCard, checkCard: checkCard,
    liveJobs: liveJobs, liveOrders: liveOrders, liveWallet: liveWallet
  };
})();

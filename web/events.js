/* demerit — one formatter for the on-chain events.
   The demo engine (moteur.js) and the deployed contracts emit the same event
   names but not the same payloads: the demo uses NEAR floats and seconds, the
   contracts use yocto strings and nanoseconds, and the missions contract wraps its
   data in an array. One formatter for both, so the terminal never prints
   "undefined" and the demo and the live mode read the same. */
(function () {
  'use strict';

  var UNIT = 1000000000000000000000000n;

  /* Timestamps: the contracts use nanoseconds, the sandbox uses seconds. */
  function toSeconds(ts) {
    var n = Number(ts || 0);
    if (!n) return 0;
    return n > 1e12 ? Math.floor(n / 1e9) : n;
  }

  /* One parse for both shapes the amounts arrive in: yocto strings on chain
     (1 NEAR = 1e24 yocto) and NEAR floats in the demo sandbox. `text` keeps
     every digit — printing a 0.045 deposit as "0.04" would contradict the
     receipt the explorer shows; `number` is for the lines that compare values. */
  function near(value) {
    var raw = String(value === null || value === undefined ? '' : value).trim();
    if (raw === '') return { text: '0', number: 0 };
    if (/^\d+$/.test(raw)) {
      var digits = raw.replace(/^0+(?=\d)/, '').padStart(25, '0');
      var whole = digits.slice(0, -24).replace(/^0+(?=\d)/, '') || '0';
      var frac = digits.slice(-24).replace(/0+$/, '');
      return { text: frac ? whole + '.' + frac : whole, number: Number(whole + (frac ? '.' + frac : '')) };
    }
    var n = Number(raw);
    return isNaN(n) ? { text: '0', number: 0 } : { text: String(n), number: n };
  }

  function toNear(value) { return near(value).number; }

  function amountText(value) { return near(value).text; }

  /* Never "undefined": a missing field reads as an em dash. */
  function text(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  /* The hour is printed too: the deployed category compresses a month into
     600 s (rules.month_seconds = 6e11, read from create_category on testnet),
     so a six-month suspension lands the same day and only the minute tells
     when the licence comes back. */
  function date(ts) {
    var s = toSeconds(ts);
    if (!s) return '—';
    var d = new Date(s * 1000);
    if (isNaN(d.getTime())) return '—';
    var day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    var hm = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    return day + ' ' + hm + ' UTC';
  }

  /* The missions contract wraps its payload in an array; the registry does not. */
  function payload(data) {
    if (Array.isArray(data)) return data[0] || {};
    return data || {};
  }

  var FORMATTERS = {
    license_issued: function (d) {
      return 'license_issued · ' + text(d.holder) + ' · ' + text(d.points) + ' points';
    },
    points_changed: function (d) {
      return 'points_changed · ' + text(d.before) + ' → ' + text(d.after);
    },
    mission_recorded: function (d) {
      return 'mission_recorded · ' + text(d.mission_id) + ' · ' + text(d.outcome);
    },
    license_suspended: function (d) {
      return 'license_suspended · until ' + date(d.until);
    },
    license_reinstated: function () {
      return 'license_reinstated';
    },
    license_revoked: function (d) {
      return 'license_revoked · ' + text(d.reason);
    },
    license_renounced: function () {
      return 'license_renounced';
    },
    bond_slashed: function (d) {
      return 'bond_slashed · ' + amountText(d.amount) + ' Ⓝ';
    },
    client_compensated: function (d) {
      return 'client_compensated · ' + amountText(d.amount) + ' Ⓝ → ' + text(d.client);
    },
    bond_topped_up: function (d) {
      return 'bond_topped_up · ' + amountText(d.amount) + ' Ⓝ';
    },
    bond_excess_withdrawn: function (d) {
      return 'bond_excess_withdrawn · ' + amountText(d.amount) + ' Ⓝ';
    },
    withdrawn: function (d) {
      return 'withdrawn · ' + amountText(d.amount) + ' Ⓝ → ' + text(d.account);
    },
    delegation_changed: function (d) {
      return 'delegation_changed · ' + text(d.delegate);
    },
    contest_opened: function (d) {
      return 'contest_opened · ' + text(d.mission_id) + ' · ' + amountText(d.deposit) + ' Ⓝ';
    },
    contest_resolved: function (d) {
      return 'contest_resolved · ' + text(d.mission_id) + ' · ' + (d.upheld ? 'upheld' : 'refused');
    },
    platform_approved: function (d) {
      return 'platform_approved · ' + text(d.account);
    },
    platform_struck: function (d) {
      return 'platform_struck · ' + text(d.account) + ' · ' + text(d.warnings) + ' warning(s)';
    },
    mission_posted: function (d) {
      return 'mission_posted · #' + text(d.id) + ' · ' + amountText(d.reward) + ' Ⓝ in escrow';
    },
    mission_taken: function (d) {
      return 'mission_taken · #' + text(d.id);
    },
    mission_closed: function (d) {
      return 'mission_closed · #' + text(d.id) + ' · ' + text(d.outcome);
    }
  };

  /* One line per event, from a NEP-297 payload or a sandbox log entry. */
  function format(name, data) {
    var d = payload(data);
    var fn = FORMATTERS[name];
    if (fn) return fn(d);
    var keys = Object.keys(d);
    if (!keys.length) return text(name);
    return text(name) + ' · ' + keys.slice(0, 4).map(function (k) {
      return k + ': ' + text(d[k]);
    }).join(' · ');
  }

  /* Parses the "EVENT_JSON:{…}" lines the contracts write in their logs. */
  function parseLogs(logs) {
    var out = [];
    (logs || []).forEach(function (line) {
      var raw = String(line);
      var at = raw.indexOf('EVENT_JSON:');
      if (at < 0) return;
      try {
        var parsed = JSON.parse(raw.slice(at + 'EVENT_JSON:'.length));
        out.push({ event: parsed.event, data: parsed.data });
      } catch (e) { /* a log line we cannot read is skipped, not guessed */ }
    });
    return out;
  }

  window.DemeritEvents = {
    format: format,
    parseLogs: parseLogs,
    toNear: toNear,
    amountText: amountText,
    toSeconds: toSeconds,
    text: text,
    date: date
  };
})();

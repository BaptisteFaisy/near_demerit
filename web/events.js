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

  /* Yocto strings (contracts) or NEAR floats (sandbox) → NEAR number. */
  function toNear(value) {
    if (value === null || value === undefined || value === '') return 0;
    var raw = String(value).trim();
    if (/^\d+$/.test(raw)) {
      var parts = raw.replace(/^0+(?=\d)/, '').padStart(25, '0');
      var whole = parts.slice(0, -24).replace(/^0+(?=\d)/, '');
      var frac = parts.slice(-24).replace(/0+$/, '');
      return Number((whole || '0') + (frac ? '.' + frac : ''));
    }
    var n = Number(raw);
    return isNaN(n) ? 0 : n;
  }

  /* Never "undefined": a missing field reads as an em dash. */
  function text(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  function date(ts) {
    var s = toSeconds(ts);
    if (!s) return '—';
    var d = new Date(s * 1000);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
      return 'bond_slashed · ' + toNear(d.amount).toFixed(2) + ' Ⓝ';
    },
    client_compensated: function (d) {
      return 'client_compensated · ' + toNear(d.amount).toFixed(2) + ' Ⓝ → ' + text(d.client);
    },
    bond_topped_up: function (d) {
      return 'bond_topped_up · ' + toNear(d.amount).toFixed(2) + ' Ⓝ';
    },
    bond_excess_withdrawn: function (d) {
      return 'bond_excess_withdrawn · ' + toNear(d.amount).toFixed(2) + ' Ⓝ';
    },
    withdrawn: function (d) {
      return 'withdrawn · ' + toNear(d.amount).toFixed(2) + ' Ⓝ → ' + text(d.account);
    },
    delegation_changed: function (d) {
      return 'delegation_changed · ' + text(d.delegate);
    },
    contest_opened: function (d) {
      return 'contest_opened · ' + text(d.mission_id) + ' · ' + toNear(d.deposit).toFixed(2) + ' Ⓝ';
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
      return 'mission_posted · #' + text(d.id) + ' · ' + toNear(d.reward).toFixed(2) + ' Ⓝ in escrow';
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
    toSeconds: toSeconds,
    text: text,
    date: date
  };
})();

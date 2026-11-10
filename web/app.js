/* Permis à points — public consultation page.
 * Static, no build step, no dependency. NEAR is read through plain JSON-RPC.
 * Every on-chain read goes through viewCall(); nothing else talks to the node.
 */
(function () {
  'use strict';

  var DEFAULTS = {
    rpc: 'https://rpc.testnet.near.org',
    contract: '',
    missions: '',
    category: 'coursier'
  };

  var cfg = resolveConfig();

  /* ------------------------------------------------------------------ config */

  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function resolveConfig() {
    var fromFile = window.PERMIS_CONFIG || {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = qs(k);
      if (v === null || v === '') v = fromFile[k];
      if (v === null || v === undefined || v === '') v = DEFAULTS[k];
      out[k] = String(v).trim();
    });
    return out;
  }

  /* -------------------------------------------------------------------- rpc */

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function bytesToUtf8(result) {
    var bytes;
    if (typeof result === 'string') {
      var bin = atob(result);
      bytes = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    } else if (Array.isArray(result)) {
      bytes = new Uint8Array(result.length);
      for (var k = 0; k < result.length; k++) bytes[k] = result[k];
    } else {
      return '';
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function rpcError(json) {
    var e = json && json.error;
    if (!e) return 'Réponse JSON-RPC invalide.';
    if (e.data) return String(e.data);
    return String(e.message || e.code || 'Erreur JSON-RPC inconnue.');
  }

  /** Single JSON-RPC round trip. Returns the parsed envelope. */
  function rpcCall(method, params) {
    var body = JSON.stringify({ jsonrpc: '2.0', id: '1', method: method, params: params });
    return fetch(cfg.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' depuis le nœud NEAR.');
      return res.json();
    }).then(function (json) {
      if (json.error) throw new Error(rpcError(json));
      return json;
    });
  }

  /**
   * Call a read-only view method on a contract and decode its JSON result.
   * This is the only place where the chain is queried for contract state.
   */
  function viewCall(contract, method, args) {
    if (!contract) return Promise.reject(new Error('Aucun contrat configuré.'));
    var params = {
      request_type: 'call_function',
      finality: 'final',
      account_id: contract,
      method_name: method,
      args_base64: b64encode(JSON.stringify(args || {}))
    };
    return rpcCall('query', params).then(function (json) {
      var raw = json.result && json.result.result;
      if (raw === undefined || raw === null) throw new Error('Réponse vide pour ' + method + '.');
      var text = bytesToUtf8(raw);
      if (!text) throw new Error('Résultat vide pour ' + method + '.');
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Résultat illisible pour ' + method + ' : ' + text.slice(0, 120));
      }
    });
  }

  /* ---------------------------------------------------------------- helpers */

  function $(id) { return document.getElementById(id); }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function fmtNear(yocto) {
    try {
      var v = BigInt(String(yocto || '0'));
      var whole = v / 1000000000000000000000000n;
      var frac = (v % 1000000000000000000000000n).toString().padStart(24, '0').slice(0, 4);
      return whole.toLocaleString('fr-FR') + (frac === '0000' ? '' : ',' + frac) + ' Ⓝ';
    } catch (e) {
      return String(yocto);
    }
  }

  function fmtDate(ns) {
    var n = Number(ns || 0);
    if (!n) return '—';
    var d = new Date(Math.floor(n / 1e6));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR');
  }

  function fmtCoeff(bp) {
    var n = Number(bp || 0);
    return (n / 100).toFixed(2).replace('.', ',') + ' ×';
  }

  function fmtDuration(ns) {
    var n = Number(ns || 0);
    if (!n) return '—';
    var days = Math.round(n / 86400e9);
    if (days >= 1) return 'dans ' + days + ' jour(s)';
    var hours = Math.round(n / 3600e9);
    if (hours >= 1) return 'dans ' + hours + ' h';
    return 'dans ' + Math.max(1, Math.round(n / 60e9)) + ' min';
  }

  function banner(message) {
    var el = $('banner');
    el.textContent = message;
    el.hidden = false;
  }

  function clearBanner() {
    var el = $('banner');
    el.textContent = '';
    el.hidden = true;
  }

  function fail(err) {
    var msg = err && err.message ? err.message : String(err);
    banner('Lecture impossible : ' + msg);
  }

  /* -------------------------------------------------------------- rendering */

  function renderStatus(st) {
    $('result').hidden = false;
    setText('holder', st.holder);
    setText('identity', st.identity);
    setText('cap', st.cap);
    setText('coef', fmtCoeff(st.coefficient));
    setText('bond', fmtNear(st.bond));
    setText('bondRequired', fmtNear(st.required_bond));
    setText('invalidations', st.invalidations);
    setText('nextRegen', st.next_regen_at ? fmtDate(st.next_regen_at) + ' (' + fmtDuration(st.next_regen_at) + ')' : '—');
    setText('nextCapGain', st.next_cap_gain_at ? fmtDate(st.next_cap_gain_at) : '—');
    setText('reasons', (st.reasons && st.reasons.length) ? st.reasons.join(', ') : 'aucun');
    var badge = $('statusBadge');
    badge.textContent = String(st.status || '—').replace(/_/g, ' ');
    badge.dataset.state = String(st.status || '');
    var cap = Number(st.cap || 0);
    var pts = Number(st.points || 0);
    var pct = cap > 0 ? Math.max(0, Math.min(100, (pts / cap) * 100)) : 0;
    $('pointsBar').style.width = pct + '%';
    $('pointsBar').dataset.level = pts === 0 ? 'zero' : (pts <= 3 ? 'low' : 'ok');
    setText('pointsText', pts + ' / ' + cap + ' points');
    $('pointsBar').parentNode.setAttribute('aria-label', pts + ' points sur ' + cap);
  }

  function renderReports(reports) {
    var body = $('reportsBody');
    clear(body);
    var list = reports || [];
    $('reportsEmpty').hidden = list.length > 0;
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      var cells = [r.mission_id, r.class, fmtDate(r.at), r.state];
      cells.forEach(function (value) {
        var td = document.createElement('td');
        td.textContent = value === null || value === undefined ? '—' : String(value);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function renderNft(nft) {
    if (!nft) return;
    var meta = nft.metadata || {};
    setText('nftTitle', meta.title || nft.title || '—');
    setText('nftTokenId', nft.token_id);
    setText('nftOwner', nft.owner_id);
    setText('nftEdition', meta.standard || meta.spec || '—');
  }

  function renderMissions(list) {
    var body = $('missionsBody');
    clear(body);
    var missions = list || [];
    $('missionsEmpty').hidden = missions.length > 0;
    missions.forEach(function (m) {
      var tr = document.createElement('tr');
      var cells = [m.id, fmtNear(m.reward), m.state, m.worker || '—', m.outcome || '—'];
      cells.forEach(function (value) {
        var td = document.createElement('td');
        td.textContent = value === null || value === undefined ? '—' : String(value);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    setText('missionsStatus', missions.length + ' mission(s) — ' + new Date().toLocaleTimeString('fr-FR'));
  }

  /* ----------------------------------------------------------------- loads */

  function loadStatus(account, category) {
    return viewCall(cfg.contract, 'status', { account: account, category: category })
      .then(function (st) {
        renderStatus(st);
        renderReports(st.recent_reports);
        return st;
      });
  }

  function loadLicense(tokenId) {
    if (!tokenId) return Promise.resolve();
    return viewCall(cfg.contract, 'license', { token_id: tokenId })
      .then(function (lic) {
        if (!lic) return;
        setText('licCategory', lic.category);
        setText('licPoints', lic.points);
        setText('licCap', lic.cap);
        setText('licBond', fmtNear(lic.bond));
        setText('licMissionsOk', lic.missions_ok);
        setText('licRulesVersion', lic.rules_version);
      })
      .catch(function (err) { banner('Fiche du permis indisponible : ' + err.message); });
  }

  function loadNft(tokenId) {
    if (!tokenId) return Promise.resolve();
    return viewCall(cfg.contract, 'nft_token', { token_id: tokenId })
      .then(renderNft)
      .catch(function (err) { banner('Titre du permis indisponible : ' + err.message); });
  }

  function loadCategories() {
    if (!cfg.contract) return Promise.resolve();
    return viewCall(cfg.contract, 'categories', {}).then(function (cats) {
      var list = $('categoryList');
      clear(list);
      (cats || []).forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.id;
        list.appendChild(opt);
      });
    }).catch(function () { /* la liste de catégories reste vide, sans erreur bloquante */ });
  }

  function loadMissions() {
    var status = $('missionsStatus');
    if (!cfg.missions) {
      setText('missionsStatus', 'contrat missions non configuré');
      status.textContent = 'contrat missions non configuré';
      return Promise.resolve();
    }
    status.textContent = 'chargement…';
    return viewCall(cfg.missions, 'missions', {}).then(renderMissions).catch(function (err) {
      status.textContent = '';
      banner('Missions indisponibles : ' + err.message);
    });
  }

  function loadFund() {
    if (!cfg.contract) {
      setText('fundValue', '—');
      return Promise.resolve();
    }
    return viewCall(cfg.contract, 'fund', {}).then(function (v) {
      setText('fundValue', fmtNear(v));
    }).catch(function (err) {
      banner('Fonds de garantie indisponible : ' + err.message);
    });
  }

  /* ---------------------------------------------------------------- events */

  function onSubmit(ev) {
    ev.preventDefault();
    clearBanner();
    var account = $('account').value.trim();
    var category = ($('category').value.trim() || cfg.category);
    if (!cfg.contract) {
      banner('Aucun contrat configuré : renseignez contract.js puis rechargez la page.');
      return;
    }
    if (!account) {
      banner('Indiquez un compte NEAR à consulter.');
      return;
    }
    $('submitBtn').disabled = true;
    $('submitBtn').textContent = 'Lecture…';
    loadStatus(account, category)
      .then(function (st) {
        return Promise.all([loadNft(st.token_id), loadLicense(st.token_id)]);
      })
      .catch(fail)
      .then(function () {
        $('submitBtn').disabled = false;
        $('submitBtn').textContent = 'Consulter';
      });
  }

  function boot() {
    if (!cfg.contract) {
      $('notice').hidden = false;
      $('notice').textContent = 'Aucun contrat configuré : configurez contract.js (valeurs dans config.js) ' +
        'ou ajoutez les paramètres ?contract=…&missions=…&rpc=… pour activer la lecture.';
      setText('missionsStatus', 'contrat non configuré');
    } else {
      $('notice').hidden = true;
    }
    $('lookupForm').addEventListener('submit', onSubmit);
    $('missionsRefresh').addEventListener('click', function () {
      clearBanner();
      loadMissions();
    });
    loadCategories();
    loadMissions();
    loadFund();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

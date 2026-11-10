/* Demerit — public consultation page & dashboard. Zero build, zero dependency. */
(function () {
  'use strict';
  var DEFAULTS = { rpc: 'https://rpc.testnet.near.org', contract: '', missions: '', category: 'coursier' };
  var cfg = resolveConfig(), lastStatus = null;

  function qs(k) { try { return new URLSearchParams(window.location.search).get(k); } catch (e) { return null; } }
  function resolveConfig() {
    var f = window.DEMERIT_CONFIG || {}, out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = qs(k); if (v === null || v === '') v = f[k];
      out[k] = String(v === null || v === undefined || v === '' ? DEFAULTS[k] : v).trim();
    });
    return out;
  }

  /* ---------------------------------------------------------- amount parsing */
  // YoctoNEAR amounts travel as decimal strings. A value that went through
  // JSON.parse as a number may already be in exponential form: expand it
  // instead of throwing on BigInt("1.25e+24").
  function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (value === null || value === undefined || value === '') return 0n;
    var raw = String(value).trim();
    if (/^-?\d+(\.\d+)?e[+-]?\d+$/i.test(raw)) {
      var parts = raw.toLowerCase().split('e');
      var mantissa = parts[0];
      var fracDigits = (mantissa.split('.')[1] || '').length;
      var digits = mantissa.replace('.', '');
      // 1.25e+24 is 125 followed by 22 zeros, not 24.
      var exp = parseInt(parts[1], 10) - fracDigits;
      var sign = digits.charAt(0) === '-' ? '-' : '';
      if (sign) digits = digits.slice(1);
      if (exp >= 0) digits += new Array(exp + 1).join('0');
      else digits = digits.slice(0, digits.length + exp);
      raw = sign + digits;
    }
    try { return BigInt(raw); } catch (e) { return 0n; }
  }

  /* ------------------------------------------------ JSON-RPC Helper (Unique) */
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function bytesToUtf8(res) {
    var bytes = typeof res === 'string' ? Uint8Array.from(atob(res), function (c) { return c.charCodeAt(0); })
      : Array.isArray(res) ? new Uint8Array(res) : null;
    return bytes ? new TextDecoder('utf-8').decode(bytes) : '';
  }
  function viewCall(contract, method, args) {
    if (!contract) return Promise.reject(new Error('Aucun contrat configuré.'));
    var body = JSON.stringify({
      jsonrpc: '2.0', id: '1', method: 'query',
      params: { request_type: 'call_function', finality: 'final', account_id: contract, method_name: method, args_base64: b64encode(JSON.stringify(args || {})) }
    });
    return fetch(cfg.rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (j.error) throw new Error(j.error.data || j.error.message || 'Erreur RPC');
        var raw = j.result && j.result.result;
        if (raw === undefined || raw === null) throw new Error('Réponse vide pour ' + method);
        return JSON.parse(bytesToUtf8(raw));
      });
  }

  /* ------------------------------------------------------- Formatting Helpers */
  function $(id) { return document.getElementById(id); }
  function clear(el) { if (el) while (el.firstChild) el.removeChild(el.firstChild); }
  function banner(msg) { var b = $('banner'); if (b) { b.textContent = msg; b.hidden = !msg; } }
  function setText(id, val) { var el = $(id); if (el) el.textContent = (val === null || val === undefined || val === '') ? '—' : String(val); }
  function fmtNear(yocto) {
    try {
      var v = toBigInt(yocto), whole = v / 1000000000000000000000000n;
      var frac = (v % 1000000000000000000000000n).toString().padStart(24, '0').slice(0, 4);
      return whole.toLocaleString('fr-FR') + (frac === '0000' ? '' : ',' + frac) + ' Ⓝ';
    } catch (e) { return String(yocto); }
  }
  function fmtDate(ns) {
    var n = Number(ns || 0); if (!n) return '—';
    var d = new Date(Math.floor(n / 1e6)); return isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR');
  }
  function fmtDuration(ns) {
    var n = Number(ns || 0); if (!n) return '';
    var d = Math.round(n / 86400e9); if (d >= 1) return ' (dans ' + d + ' j)';
    var h = Math.round(n / 3600e9); return ' (dans ' + (h >= 1 ? h + ' h' : Math.max(1, Math.round(n / 60e9)) + ' min') + ')';
  }
  function renderTableRows(tbodyId, rows) {
    var tbody = $(tbodyId); if (!tbody) return;
    clear(tbody);
    rows.forEach(function (cells) {
      var tr = document.createElement('tr');
      cells.forEach(function (c) {
        var td = document.createElement('td'); td.textContent = (c === null || c === undefined) ? '—' : String(c);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  /* ------------------------------------------------------ Section 1: Consult */
  function renderStatus(st) {
    lastStatus = st; $('result').hidden = false;
    setText('holder', st.holder); setText('tokenId', st.token_id); setText('identity', st.identity);
    setText('cap', st.cap); setText('statusLabel', st.status);
    setText('coef', ((Number(st.coefficient || 0) / 100).toFixed(2)) + ' ×');
    setText('bond', fmtNear(st.bond)); setText('bondRequired', fmtNear(st.required_bond));
    setText('invalidations', st.invalidations);
    setText('missionsRatio', (st.missions_ok || 0) + ' / ' + (st.missions_flagged || 0));
    setText('suspendedUntil', st.suspended_until ? fmtDate(st.suspended_until) : 'aucune');
    setText('nextRegen', st.next_regen_at ? fmtDate(st.next_regen_at) + fmtDuration(st.next_regen_at) : '—');
    setText('nextCapGain', st.next_cap_gain_at ? fmtDate(st.next_cap_gain_at) : '—');
    setText('reasons', (st.reasons && st.reasons.length) ? st.reasons.join(', ') : 'aucun');
    var badge = $('statusBadge'); badge.textContent = String(st.status || '—'); badge.dataset.state = String(st.status || '');
    $('underBondedBadge').hidden = !st.under_bonded;
    var cap = Number(st.cap || 0), pts = Number(st.points || 0);
    $('pointsBar').style.width = (cap > 0 ? Math.max(0, Math.min(100, (pts / cap) * 100)) : 0) + '%';
    $('pointsBar').dataset.level = pts === 0 ? 'zero' : (pts <= 3 ? 'low' : 'ok');
    setText('pointsText', pts + ' / ' + cap + ' points');
  }
  function renderReports(reports) {
    var list = reports || []; $('reportsEmpty').hidden = list.length > 0;
    renderTableRows('reportsBody', list.map(function (r) {
      return [r.mission_id, r.class, fmtDate(r.at), r.state, '-' + (r.points_lost || 0) + ' pt(s)', fmtNear(r.slashed)];
    }));
  }
  function renderLicense(lic) {
    if (!lic) return;
    setText('licIssuedAt', fmtDate(lic.issued_at));
    setText('licLastReport', lic.last_report_at ? fmtDate(lic.last_report_at) : 'aucun');
    setText('licLastInval', lic.last_invalidation_at ? fmtDate(lic.last_invalidation_at) : 'aucune');
    setText('licStreak', lic.streak_ok); setText('licLastStage', lic.last_stage_at ? fmtDate(lic.last_stage_at) : 'aucun');
    setText('licRulesVersion', lic.rules_version); setText('licPoints', lic.points);
    setText('licCap', lic.cap); setText('licBond', fmtNear(lic.bond));
    setText('licMissionsOk', lic.missions_ok); setText('licCategory', lic.category);
  }
  function loadConsult(account, category) {
    return viewCall(cfg.contract, 'status', { account: account, category: category }).then(function (st) {
      renderStatus(st); renderReports(st.recent_reports); updateHolderFinances(st);
      return Promise.all([
        viewCall(cfg.contract, 'license', { token_id: st.token_id }).then(renderLicense).catch(function () {}),
        loadNft(st.token_id, st.holder)
      ]);
    });
  }

  /* -------------------------------------------------------- Section 2: Check */
  function numOrNull(val) { var v = parseInt(val, 10); return isNaN(v) ? null : v; }
  function runCheck() {
    var req = {
      min_points: numOrNull($('chkMinPoints').value), min_missions: numOrNull($('chkMinMissions').value),
      max_invalidations: numOrNull($('chkMaxInval').value), min_age_months: numOrNull($('chkMinAge').value),
      max_coefficient: numOrNull($('chkMaxCoef').value)
    };
    var acc = $('chkAccount').value.trim(), cat = $('chkCategory').value.trim() || cfg.category;
    if (!cfg.contract || !acc) return;
    $('checkBtn').disabled = true;
    viewCall(cfg.contract, 'check', { account: acc, category: cat, requirements: req }).then(function (res) {
      var badge = $('checkBadge'); badge.textContent = res.allowed ? 'AUTORISÉ (OUI)' : 'REFUSÉ (NON)';
      badge.className = 'badge ' + (res.allowed ? 'badge-ok' : 'badge-err');
      setText('chkAllowed', res.allowed ? 'Oui' : 'Non'); setText('chkCode', res.code || 'aucun (succès)');
      setText('chkPoints', res.points); setText('chkStatus', res.status);
    }).catch(function (e) { banner('Check : ' + e.message); }).then(function () { $('checkBtn').disabled = false; });
  }

  /* ---------------------------------------------------------- Section 3: NFT */
  function loadNft(tokenId, ownerId) {
    if (!cfg.contract || !tokenId) return Promise.resolve();
    return Promise.all([
      viewCall(cfg.contract, 'nft_token', { token_id: tokenId }).then(function (t) {
        if (!t) return;
        var m = t.metadata || {};
        setText('nftTitle', m.title || t.computed_title || '—'); setText('nftTokenId', t.token_id);
        setText('nftOwner', t.owner_id); setText('nftEdition', m.spec || m.standard || 'nft-1.0.0');
        setText('nftComputedTitle', t.computed_title || '—');
        setText('nftExtra', m.extra ? JSON.stringify(JSON.parse(m.extra), null, 2) : '—');
      }),
      ownerId ? viewCall(cfg.contract, 'nft_tokens_for_owner', { account_id: ownerId, limit: 10 }).then(function (toks) {
        var list = toks || []; $('nftOwnerTokensEmpty').hidden = list.length > 0;
        renderTableRows('nftOwnerTokensBody', list.map(function (t) {
          return [t.token_id, t.computed_title || (t.metadata && t.metadata.title) || '—', t.owner_id];
        }));
      }) : Promise.resolve()
    ]).catch(function (e) { banner('NFT : ' + e.message); });
  }

  /* ------------------------------------------------------- Section 4: Holder */
  function updateHolderFinances(st) {
    setText('myBond', fmtNear(st.bond)); setText('myBondRequired', fmtNear(st.required_bond));
    var b = toBigInt(st.bond), req = toBigInt(st.required_bond);
    setText('myBondExcess', fmtNear(b > req ? (b - req).toString() : '0'));
    if (cfg.contract && st.holder) {
      viewCall(cfg.contract, 'credit', { account: st.holder }).then(function (c) { setText('myCredit', fmtNear(c)); }).catch(function () {});
    }
    setupHolderActions(st.holder, st.category);
  }
  function loadDelegation() {
    var del = $('delDelegate').value.trim(), cat = $('delCategory').value.trim() || cfg.category;
    if (!cfg.contract || !del) return;
    viewCall(cfg.contract, 'delegation', { delegate: del, category: cat }).then(function (d) {
      if (!d) {
        setText('delHolder', 'aucune délégation'); setText('delDelegateOut', '—');
        setText('delCatOut', '—'); setText('delExpires', '—'); return;
      }
      setText('delHolder', d.holder); setText('delDelegateOut', d.delegate);
      setText('delCatOut', d.category); setText('delExpires', fmtDate(d.expires_at) + fmtDuration(d.expires_at));
    }).catch(function (e) { banner('Délégation : ' + e.message); });
  }

  /* ----------------------------------------------------- Section 5: Missions */
  function loadMissions() {
    if (!cfg.missions) { setText('missionsStatus', 'Contrat missions non configuré'); return; }
    setText('missionsStatus', 'Chargement...');
    viewCall(cfg.missions, 'missions', {}).then(function (list) {
      var ms = list || []; $('missionsEmpty').hidden = ms.length > 0;
      renderTableRows('missionsBody', ms.map(function (m) {
        return [m.id, fmtNear(m.reward), m.state, m.worker || '—', m.outcome || '—'];
      }));
      setText('missionsStatus', ms.length + ' mission(s)');
    }).catch(function (e) { setText('missionsStatus', ''); banner('Missions : ' + e.message); });
  }
  function loadMissionDetail(id) {
    if (!cfg.missions || isNaN(id)) return;
    viewCall(cfg.missions, 'mission', { mission_id: id }).then(function (m) {
      setText('mViewId', m.id); setText('mViewPoster', m.poster); setText('mViewWorker', m.worker || 'aucun');
      setText('mViewReward', fmtNear(m.reward)); setText('mViewState', m.state); setText('mViewOutcome', m.outcome || 'en cours');
      setText('mViewCreated', fmtDate(m.created_at)); setText('mViewTaken', m.taken_at ? fmtDate(m.taken_at) : '—');
      setText('mViewClosed', m.closed_at ? fmtDate(m.closed_at) : '—');
    }).catch(function (e) { banner('Mission ' + id + ' : ' + e.message); });
  }

  /* ------------------------------------------------------- Section 6: Issuer */
  function loadIssuerData() {
    if (!cfg.contract) return;
    viewCall(cfg.contract, 'issuer', {}).then(function (iss) { setText('govIssuer', iss); }).catch(function () {});
    viewCall(cfg.contract, 'clock', {}).then(function (clk) { setText('govClock', fmtDate(clk) + ' (' + clk + ' ns)'); }).catch(function () {});
  }
  function loadPlatformStatus() {
    var acc = $('platAccount').value.trim() || cfg.missions;
    if (!cfg.contract || !acc) return;
    viewCall(cfg.contract, 'platform', { account: acc }).then(function (p) {
      setText('platTarget', p.account || acc); setText('platActive', p.active ? 'Oui (active)' : 'Non (révoquée)');
      setText('platWarnings', (p.warnings || 0) + ' / 3 strikes'); setText('platApproved', p.approved_at ? fmtDate(p.approved_at) : 'non agréée');
    }).catch(function (e) { banner('Plateforme : ' + e.message); });
  }

  /* ------------------------------------------------- Section 7 & 8: Rules & Fund */
  function renderCategoryRules(r) {
    if (!r) return;
    var rows = [
      ['Plafond max (max_points)', r.max_points + ' pts', 'Capital maximum du permis'],
      ['Points probatoires (probation_points)', r.probation_points + ' pts', 'Capital initial probatoire'],
      ['Gain probatoire (probation_gain)', '+' + r.probation_gain + ' pts/an', 'Augmentation annuelle du plafond'],
      ['Perte légère (light_loss)', '-' + r.light_loss + ' pt', 'Retrait pour manquement mineur'],
      ['Perte moyenne (medium_loss)', '-' + r.medium_loss + ' pts', 'Retrait pour manquement notable'],
      ['Perte grave (severe_loss)', '-' + r.severe_loss + ' pts', 'Retrait pour incident critique'],
      ['Régénération (regen_points)', '+' + r.regen_points + ' pt', 'Gain après période propre'],
      ['Délai régénération', r.regen_after_months + ' mois', 'Mois sans signalement requis'],
      ['Récupération totale', r.full_regen_after_months + ' mois', 'Délai pour recouvrer 12 points'],
      ['Stage de sensibilisation', '+' + r.stage_points + ' pts', 'Points récupérés via stage annuel'],
      ['Série de stage', r.stage_streak + ' missions', 'Missions sans faute pour y prétendre'],
      ['Suspension à zéro', r.suspension_months + ' mois', 'Période d\'invalidation à 0 point'],
      ['Indemnité client', fmtNear(r.severe_compensation), 'Indemnité versée sur incident grave'],
      ['Part du fonds', r.fund_share_pct + ' %', 'Part de la caution versée au fonds'],
      ['Fenêtre de recours', (r.contest_window_seconds / 86400) + ' jours', 'Délai pour contester un rapport'],
      ['Dépôt de recours', fmtNear(r.contest_deposit), 'Garantie versée pour recours'],
      ['Avertissements max plateforme', r.platform_strike_limit + ' strikes', 'Limite avant révocation d\'agrément']
    ];
    renderTableRows('rulesBody', rows);
  }
  function loadCategoriesAndRules() {
    if (!cfg.contract) return;
    viewCall(cfg.contract, 'categories', {}).then(function (cats) {
      var sel = $('catSelect'), dl = $('categoryList'); clear(sel); clear(dl);
      (cats || []).forEach(function (c) {
        var o = document.createElement('option'); o.value = c.id; o.textContent = c.id + ' (base ' + fmtNear(c.base_bond) + ')'; sel.appendChild(o);
        var o2 = document.createElement('option'); o2.value = c.id; dl.appendChild(o2);
      });
      if (cats && cats.length) onCategorySelect(cats[0].id);
    }).catch(function (e) { banner('Catégories : ' + e.message); });
  }
  function onCategorySelect(catId) {
    if (!cfg.contract || !catId) return;
    viewCall(cfg.contract, 'rules', { category: catId }).then(renderCategoryRules).catch(function () {});
  }
  function loadFund() {
    if (!cfg.contract) return;
    viewCall(cfg.contract, 'fund', {}).then(function (f) { setText('fundValue', fmtNear(f)); }).catch(function () {});
  }

  /* ------------------------------------------------ Actions Binding (Writer) */
  function bindAction(boxId, spec) {
    var el = $(boxId); if (!el) return;
    if (window.DemeritActions && typeof window.DemeritActions.attach === 'function') {
      window.DemeritActions.attach(el, spec);
    } else {
      clear(el);
      var st = document.createElement('strong'); st.textContent = spec.label || spec.method;
      var p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Module actions indisponible.';
      el.appendChild(st); el.appendChild(p);
    }
  }
  function setupHolderActions(holder, category) {
    var c = cfg.contract, h = holder || 'lea.testnet', cat = category || cfg.category;
    bindAction('act-topup', { contract: c, method: 'top_up_bond', args: { category: cat }, deposit: '1', signer: h, label: 'top_up_bond (compléter caution)', hint: 'Recharge la caution au niveau requis.' });
    bindAction('act-withdrawecess', { contract: c, method: 'withdraw_bond_excess', args: { category: cat }, signer: h, label: 'withdraw_bond_excess (retirer excédent)', hint: 'Retire la caution au-delà du montant requis.' });
    bindAction('act-delegate', { contract: c, method: 'delegate', args: { category: cat, delegate: 'agent1.' + h, expires_at: '1790000000000000000' }, signer: h, label: 'delegate (déléguer permis)', hint: 'Ouvre une délégation pour un sous-compte.' });
    bindAction('act-revokedelegate', { contract: c, method: 'revoke_delegate', args: { category: cat, delegate: 'agent1.' + h }, signer: h, label: 'revoke_delegate (révoquer délégation)', hint: 'Ferme la délégation active.' });
    bindAction('act-contest', { contract: c, method: 'contest', args: { category: cat, mission_id: 'm-1' }, deposit: '0.1', signer: h, label: 'contest (ouvrir un recours)', hint: 'Conteste un signalement avec dépôt de garantie.' });
    bindAction('act-claimstage', { contract: c, method: 'claim_stage', args: { category: cat }, signer: h, label: 'claim_stage (stage de récupération)', hint: 'Récupère +4 points après 5 missions sans signalement.' });
    bindAction('act-renounce', { contract: c, method: 'renounce', args: { category: cat }, signer: h, label: 'renounce (rendre le permis)', hint: 'Renonce au permis et débloque le solde de caution.' });
    bindAction('act-withdraw', { contract: c, method: 'withdraw', args: {}, signer: h, label: 'withdraw (retirer crédit)', hint: 'Transfère les crédits d\'indemnisation ou solde.' });
    bindAction('act-transfer', { contract: c, method: 'nft_transfer', args: { receiver_id: 'dest.testnet', token_id: 'demerit-1' }, deposit: '0.000000000000000000000001', signer: h, label: 'nft_transfer (test transfert)', hint: 'Prouve le refus formel ERR_SOULBOUND.' });
  }
  function setupGlobalActions() {
    var c = cfg.contract, m = cfg.missions, cat = cfg.category;
    bindAction('act-post', { contract: m, method: 'post', args: { reward: '1000000000000000000000000' }, deposit: '1', label: 'post (publier mission)', hint: 'Publie une tâche avec récompense sous séquestre.' });
    bindAction('act-accept', { contract: m, method: 'accept', args: { mission_id: 1 }, label: 'accept (accepter mission)', hint: 'Vérifie is_allowed et attribue le travail.' });
    bindAction('act-close', { contract: m, method: 'close', args: { mission_id: 1, outcome: 'clean' }, label: 'close (clôturer mission)', hint: 'Clôture, paie le worker et enregistre l\'issue.' });
    bindAction('act-issue', { contract: c, method: 'issue', args: { account: 'lea.testnet', category: cat, identity: 'fp-hex' }, deposit: '1', label: 'issue (délivrer permis)', hint: 'Émet un permis probatoire avec caution.' });
    bindAction('act-approveplatform', { contract: c, method: 'approve_platform', args: { category: cat, account: m || 'missions.testnet' }, label: 'approve_platform (agréer)', hint: 'Agrée une plateforme partenaire.' });
    bindAction('act-resolvecontest', { contract: c, method: 'resolve_contest', args: { category: cat, mission_id: 'm-1', upheld: true }, label: 'resolve_contest (arbitrer recours)', hint: 'Maintient ou infirme le signalement.' });
    bindAction('act-strikeplatform', { contract: c, method: 'strike_platform', args: { account: m || 'missions.testnet' }, label: 'strike_platform (sanctionner)', hint: 'Avertissement officiel à une plateforme.' });
    bindAction('act-revokelicense', { contract: c, method: 'revoke_license', args: { account: 'lea.testnet', category: cat, reason: 'fraude' }, label: 'revoke_license (révoquer)', hint: 'Révocation définitive pour motif grave.' });
  }

  /* ------------------------------------------------------------- Initial Boot */
  function initListeners() {
    $('lookupForm').addEventListener('submit', function (e) {
      e.preventDefault(); banner('');
      var a = $('account').value.trim(), c = $('category').value.trim() || cfg.category;
      if (!a) { banner('Indiquez un compte NEAR.'); return; }
      $('submitBtn').disabled = true;
      loadConsult(a, c).catch(function (err) { banner('Lecture consultation : ' + err.message); }).then(function () { $('submitBtn').disabled = false; });
    });
    $('consultRefresh').addEventListener('click', function () { if (lastStatus) loadConsult(lastStatus.holder, lastStatus.category); });
    $('checkForm').addEventListener('submit', function (e) { e.preventDefault(); runCheck(); });
    $('delegationForm').addEventListener('submit', function (e) { e.preventDefault(); loadDelegation(); });
    $('missionDetailForm').addEventListener('submit', function (e) { e.preventDefault(); loadMissionDetail(parseInt($('detailMissionId').value, 10)); });
    $('platformForm').addEventListener('submit', function (e) { e.preventDefault(); loadPlatformStatus(); });
    $('catSelect').addEventListener('change', function (e) { onCategorySelect(e.target.value); });
    $('nftRefresh').addEventListener('click', function () { if (lastStatus) loadNft(lastStatus.token_id, lastStatus.holder); });
    $('holderRefresh').addEventListener('click', function () { if (lastStatus) loadConsult(lastStatus.holder, lastStatus.category); });
    $('missionsRefresh').addEventListener('click', loadMissions);
    $('issuerRefresh').addEventListener('click', function () { loadIssuerData(); loadPlatformStatus(); });
    $('rulesRefresh').addEventListener('click', loadCategoriesAndRules);
    $('fundRefresh').addEventListener('click', loadFund);
  }

  function boot() {
    if (!cfg.contract) {
      $('notice').hidden = false;
      $('notice').textContent = 'Mode hors-ligne / non configuré : le contrat Demerit n\'est pas spécifié dans config.js. Utilisez ?contract=...&missions=...&rpc=... pour connecter un déploiement réel. Toutes les vues restent interactives et le scénario ci-dessous affiche les résultats attendus.';
    }
    initListeners();
    setupHolderActions('lea.testnet', cfg.category);
    setupGlobalActions();
    loadCategoriesAndRules();
    loadMissions();
    loadFund();
    loadIssuerData();
    if (cfg.missions) $('platAccount').value = cfg.missions;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

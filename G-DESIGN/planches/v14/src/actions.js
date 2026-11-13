/* Demerit — write-action module for the public page.
 * The page is static and holds NO key. For every write action this module
 * produces:
 *   1. a ready-to-paste `near-cli-rs` command (source of truth, always works);
 *   2. a MyNearWallet signing URL built from a Borsh-serialized unsigned
 *      transaction (nonce / block_hash / public_key fetched over JSON-RPC).
 *      If anything fails, walletUrl() resolves to null and only the command
 *      is shown — that is acceptable and documented.
 * No dependency, no build step, plain script (no modules). ES2017 + BigInt.
 *
 * spec = { contract, method, args (object), deposit (NEAR decimal string,
 *          default "0"), gas (Tgas number/string, default 100), label, hint,
 *          signer (account that signs, optional), signerHint }
 */
(function () {
  'use strict';

  var YOCTO_DECIMALS = 24;
  var DEFAULT_RPC = 'https://rpc.testnet.near.org';
  var WALLET_SIGN_URL = 'https://app.mynearwallet.com/sign?transactions=';
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  /* ------------------------------------------------------- decimal amounts */

  // "1.25" -> "1250000000000000000000000". Hand-parsed, never parseFloat.
  function toYocto(nearString) {
    if (typeof nearString !== 'string') {
      throw new Error('toYocto: expected a NEAR decimal string, got ' + typeof nearString);
    }
    var m = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(nearString.trim());
    if (!m) throw new Error('toYocto: invalid NEAR amount "' + nearString + '"');
    var frac = m[2] || '';
    if (frac.length > YOCTO_DECIMALS) {
      throw new Error('toYocto: "' + nearString + '" has ' + frac.length +
        ' decimals, max is ' + YOCTO_DECIMALS);
    }
    while (frac.length < YOCTO_DECIMALS) frac += '0';
    var out = (m[1] + frac).replace(/^0+/, '');
    return out === '' ? '0' : out;
  }

  // "1250000000000000000000000" -> "1.2500" (min 4 decimals kept).
  function fromYocto(yocto) {
    var s = String(yocto).trim();
    if (!/^[0-9]+$/.test(s)) throw new Error('fromYocto: invalid yocto amount "' + s + '"');
    while (s.length <= YOCTO_DECIMALS) s = '0' + s;
    var cut = s.length - YOCTO_DECIMALS;
    var frac = s.slice(cut).replace(/0+$/, '');
    while (frac.length < 4) frac += '0';
    return s.slice(0, cut) + '.' + frac;
  }

  /* ---------------------------------------------------------- borsh writer */

  function Borsh() { this.bytes = []; }
  Borsh.prototype.u8 = function (v) { this.bytes.push(v & 0xff); return this; };
  Borsh.prototype.uintLE = function (big, size) {
    for (var i = 0; i < size; i++) {
      this.bytes.push(Number((big >> BigInt(8 * i)) & 0xffn));
    }
    return this;
  };
  Borsh.prototype.raw = function (arr) {
    for (var i = 0; i < arr.length; i++) this.bytes.push(arr[i] & 0xff);
    return this;
  };
  Borsh.prototype.sized = function (arr) { return this.uintLE(BigInt(arr.length), 4).raw(arr); };
  Borsh.prototype.str = function (s) {
    return this.sized(utf8Bytes(String(s)));
  };
  Borsh.prototype.out = function () { return new Uint8Array(this.bytes); };

  function utf8Bytes(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (s.codePointAt(i) > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  // Unsigned NEAR transaction, legacy Borsh layout (same as near-api-js):
  //   signer_id: string, public_key: {key_type u8, data [u8;32]}, nonce: u64,
  //   receiver_id: string, block_hash: [u8;32], actions: Vec<Action>,
  //   Action::FunctionCall tag = 2: {method_name string, args Vec<u8>,
  //   gas u64, deposit u128}.
  function encodeTransaction(t) {
    if (!t.pubKeyBytes || t.pubKeyBytes.length !== 32) {
      throw new Error('encodeTransaction: public key must be 32 bytes');
    }
    if (!t.blockHashBytes || t.blockHashBytes.length !== 32) {
      throw new Error('encodeTransaction: block hash must decode to 32 bytes');
    }
    return new Borsh()
      .str(t.signerId)
      .u8(t.pubKeyType || 0).raw(t.pubKeyBytes)
      .uintLE(BigInt(t.nonce), 8)
      .str(t.receiverId)
      .raw(t.blockHashBytes)
      .uintLE(1n, 4).u8(2)
      .str(t.methodName)
      .sized(t.argsBytes)
      .uintLE(BigInt(t.gas), 8)
      .uintLE(BigInt(t.deposit), 16)
      .out();
  }

  /* ------------------------------------------------- base58 / base64 codecs */

  function base58ToBytes(s) {
    var num = 0n;
    for (var i = 0; i < s.length; i++) {
      var idx = B58.indexOf(s[i]);
      if (idx < 0) throw new Error('base58: invalid char "' + s[i] + '"');
      num = num * 58n + BigInt(idx);
    }
    var out = [];
    for (var j = 0; j < s.length && s[j] === '1'; j++) out.push(0); // leading zeros
    while (num > 0n) { out.push(Number(num & 0xffn)); num >>= 8n; }
    out.reverse();
    return out;
  }

  function bytesToBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
      s += B64[b0 >> 2];
      s += B64[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
      s += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
      s += b2 === undefined ? '=' : B64[b2 & 63];
    }
    return s;
  }

  /* -------------------------------------------------------- near-cli-rs cmd */

  // Single-quoted shell escape: every ' becomes '\''
  function shellQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

  // Build the copy-paste near-cli-rs 0.31 command (string only, never run).
  function command(spec) {
    if (!spec || !spec.contract || !spec.method) {
      throw new Error('command: spec.contract and spec.method are required');
    }
    var signer = spec.signer || '<VOTRE_COMPTE.testnet>';
    var gas = spec.gas === undefined || spec.gas === null ? 100 : spec.gas;
    var json = JSON.stringify(spec.args || {});
    var depositYocto = toYocto(spec.deposit === undefined ? '0' : String(spec.deposit));
    return 'near contract call-function as-transaction ' + spec.contract + ' ' + spec.method +
      ' json-args ' + shellQuote(json) +
      " prepaid-gas '" + gas + '.0 Tgas' +
      "' attached-deposit '" + depositYocto + ' yoctoNEAR' +
      "' sign-as " + signer +
      ' network-config testnet sign-with-keychain send';
  }

  /* ------------------------------------------------------------ wallet url */

  function rpcCall(rpc, method, params) {
    return fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'demerit', method: method, params: params })
    }).then(function (r) {
      if (!r.ok) throw new Error('RPC HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j.error) throw new Error('RPC error: ' + JSON.stringify(j.error));
      return j.result;
    });
  }

  // Build the MyNearWallet signing URL. Resolves to null (never throws) when
  // no signer is given, fetch/RPC is unavailable, or no full-access key fits.
  function walletUrl(spec) {
    try {
      if (!spec || !spec.signer || !spec.contract || !spec.method) return Promise.resolve(null);
      if (typeof fetch !== 'function') return Promise.resolve(null);
      var cfg = (typeof window !== 'undefined' && window.DEMERIT_CONFIG) || {};
      var rpc = cfg.rpc || spec.rpc || DEFAULT_RPC;
      return rpcCall(rpc, 'query', {
        request_type: 'view_access_key_list',
        finality: 'final',
        account_id: spec.signer
      }).then(function (res) {
        var key = (res.keys || []).filter(function (k) {
          return k.access_key && k.access_key.permission === 'FullAccess' &&
            k.public_key.indexOf('ed25519:') === 0;
        })[0];
        if (!key) throw new Error('no ed25519 full-access key for ' + spec.signer);
        var pub = base58ToBytes(key.public_key.slice('ed25519:'.length));
        var bh = base58ToBytes(res.block_hash);
        if (pub.length !== 32 || bh.length !== 32) throw new Error('bad key/hash length');
        var gas = spec.gas === undefined ? 100 : spec.gas;
        var tx = encodeTransaction({
          signerId: spec.signer,
          pubKeyType: 0,
          pubKeyBytes: pub,
          nonce: BigInt(key.access_key.nonce) + 1n,
          receiverId: spec.contract,
          blockHashBytes: bh,
          methodName: spec.method,
          argsBytes: utf8Bytes(JSON.stringify(spec.args || {})),
          gas: BigInt(gas) * 1000000000000n,
          deposit: BigInt(toYocto(spec.deposit === undefined ? '0' : String(spec.deposit)))
        });
        return WALLET_SIGN_URL + encodeURIComponent(bytesToBase64(tx));
      }).catch(function () {
        return null; // RPC or encoding failure: fall back to the CLI command.
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* ------------------------------------------------------------- rendering */

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) {
      // A child node is appended, a string becomes text: never "[object HTMLElement]".
      if (typeof text === 'object' && text.nodeType) node.appendChild(text);
      else node.textContent = text;
    }
    return node;
  }

  function copyToClipboard(text, status) {
    var done = function () { status.textContent = 'Commande copiée dans le presse-papier.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done, status); });
    } else legacyCopy(text, done, status);
  }

  function legacyCopy(text, done, status) {
    var ta = el('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { status.textContent = 'Copie impossible : sélectionnez la commande manuellement.'; }
    ta.remove();
  }

  function buildWalletLink(spec, status, slot) {
    slot.textContent = '';
    status.textContent = 'Construction du lien MyNearWallet…';
    walletUrl(spec).then(function (url) {
      if (url) {
        var a = el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' },
          'Signer la transaction avec MyNearWallet (ouvre un nouvel onglet)');
        slot.appendChild(a);
        status.textContent = 'Lien wallet prêt. Vérifiez le compte signataire dans le wallet.';
      } else {
        status.textContent = 'Lien wallet indisponible : utilisez la commande near-cli-rs ci-dessus.';
      }
    });
  }

  // Render one action block (button + generated command + wallet link) into
  // the given element. Accessible: real <button>, aria-live feedback region.
  function attach(element, spec) {
    if (!element || !spec) throw new Error('attach: element and spec are required');
    element.textContent = '';
    element.appendChild(el('strong', null, spec.label || spec.method));
    if (spec.hint) element.appendChild(el('p', { class: 'demerit-hint' }, spec.hint));
    var status = el('div', { class: 'demerit-action-status', role: 'status', 'aria-live': 'polite' });
    if (!spec.signer) {
      element.appendChild(el('p', { class: 'demerit-warning', role: 'note' },
        '⚠ Aucun compte signataire fourni : vérifie le compte signataire ' +
        'avant de copier la commande ou de signer dans le wallet.'));
    }
    var cmd = command(spec);
    var pre = el('pre', { class: 'demerit-command', tabindex: '0' }, el('code', null, cmd));
    element.appendChild(pre);
    var copyBtn = el('button', { type: 'button', class: 'demerit-copy' }, 'Copier la commande');
    copyBtn.addEventListener('click', function () { copyToClipboard(cmd, status); });
    element.appendChild(copyBtn);
    var walletSlot = el('div', { class: 'demerit-wallet' });
    var walletBtn = el('button', { type: 'button', class: 'demerit-wallet-btn' },
      'Générer le lien MyNearWallet');
    walletBtn.addEventListener('click', function () { buildWalletLink(spec, status, walletSlot); });
    element.appendChild(walletBtn);
    element.appendChild(walletSlot);
    element.appendChild(status);
    return element;
  }

  /* ------------------------------------------------------------------ API */

  window.DemeritActions = {
    attach: attach,
    command: command,
    walletUrl: walletUrl,
    toYocto: toYocto,
    fromYocto: fromYocto,
    // Private helpers, exposed for web/scripts/actions-test.mjs only.
    _encodeTransaction: encodeTransaction,
    _base58ToBytes: base58ToBytes,
    _bytesToBase64: bytesToBase64
  };
})();

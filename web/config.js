/* Demerit — public page configuration.
   Edit this file (no build, no bundler). A query string can override every
   value at runtime: ?contract=demerit.testnet&missions=missions.testnet&rpc=…
   Leave `contract` empty to keep the page in "not configured" mode. */
window.DEMERIT_CONFIG = {
  // archival-rpc answers with CORS headers even under load; the canonical
  // rpc.testnet.near.org returns a bare 429 that browsers report as a CORS
  // failure. app.js falls back across the list either way.
  rpc: 'https://archival-rpc.testnet.near.org',
  contract: 'ledger.demerit.testnet',
  missions: 'platform.demerit.testnet',
  category: 'coursier',
};

/* Demerit — public page configuration.
   Edit this file (no build, no bundler). A query string can override every
   value at runtime: ?contract=demerit.testnet&missions=missions.testnet&rpc=…
   Leave `contract` empty to keep the page in "not configured" mode. */
window.DEMERIT_CONFIG = {
  // FastNEAR is NEAR's recommended public RPC: the historical
  // rpc.testnet.near.org is deprecated and answers a bare 429 that browsers
  // report as a CORS failure. app.js walks a fallback list either way.
  rpc: 'https://rpc.testnet.fastnear.com',
  contract: 'ledger.demerit.testnet',
  missions: 'platform.demerit.testnet',
  category: 'coursier',
};

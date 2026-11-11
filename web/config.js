/* Demerit — public page configuration.
   Edit this file (no build, no bundler). A query string can override every
   value at runtime: ?contract=demerit.testnet&missions=missions.testnet&rpc=…
   Leave `contract` empty to keep the page in "not configured" mode. */
window.DEMERIT_CONFIG = {
  rpc: 'https://rpc.testnet.near.org',
  contract: 'ledger.demerit.testnet',
  missions: 'platform.demerit.testnet',
  category: 'coursier',
};

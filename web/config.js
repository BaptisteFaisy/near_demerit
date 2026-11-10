/* Permis à points — public page configuration.
   Edit this file (no build, no bundler). A query string can override every
   value at runtime: ?contract=permis.testnet&missions=missions.testnet&rpc=…
   Leave `contract` empty to keep the page in "not configured" mode. */
window.PERMIS_CONFIG = {
  rpc: 'https://rpc.testnet.near.org',
  contract: '',
  missions: '',
  category: 'coursier',
};

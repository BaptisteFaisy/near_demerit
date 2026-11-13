// Shared content for the V26 planches: brand mark, the five parties, the journey, and a live-typing terminal.
export const MARK = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".3"/><g stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 6.5V2M26.75 8.31L29 4.41M31.69 13.25L35.59 11M33.5 20H38M31.69 26.75L35.59 29M26.75 31.69L29 35.59M20 33.5V38M13.25 31.69L11 35.59M8.31 26.75L4.41 29M6.5 20H2M8.31 13.25L4.41 11M13.25 8.31L11 4.41"/></g><path d="M20 11l6.8 9-6.8 9-6.8-9z" fill="var(--accent)"/></svg>`;

export const PARTIES = [
  { k: 'courier', name: 'Léa', role: 'Courier', id: 'lea.demerit.testnet', what: 'Holds the licence. 6 points, 1 Ⓝ deposit.' },
  { k: 'client', name: 'Sam', role: 'Customer', id: 'client.demerit.testnet', what: 'Posts jobs. Refunded if something goes wrong.' },
  { k: 'platform', name: 'Platform', role: 'Any gig app', id: 'platform.demerit.testnet', what: 'Asks the registry before every job.' },
  { k: 'registry', name: 'Registry', role: 'demerit contract', id: 'ledger.demerit.testnet', what: 'Keeps points. Says yes or no.' },
  { k: 'fund', name: 'Fund', role: 'Shared guarantee', id: 'ledger.demerit.testnet · fund', what: 'Tops up refunds when a deposit runs short.' },
];

export const STEPS = [
  ['01', 'Get licensed', 'Verify once. 6 points on probation, 1 Ⓝ locked.'],
  ['02', 'Work anywhere', 'Every platform checks the same licence.'],
  ['03', 'Lose points', 'A fault costs points on every app at once.'],
  ['04', 'Client repaid', 'A serious fault refunds the client from the deposit.'],
];

// [kind, text]  kinds: c = command, o = ok, e = event, x = cross-contract, r = refused, m = muted
export const LOG = [
  ['m', '# demerit · ledger.demerit.testnet (registry) · platform.demerit.testnet (jobs)', 'idle'],
  ['c', '$ issuer.demerit.testnet → ledger.issue({account:"lea.demerit.testnet", deposit:"1 Ⓝ"})', 'issue'],
  ['e', 'EVENT license_issued · lea.demerit.testnet · 6 pts · probation', 'issued'],
  ['c', '$ lea.demerit.testnet → platform.accept({mission_id: 3})', 'accept'],
  ['x', '└ cross-contract: ledger.is_allowed("lea.demerit.testnet") · 10 Tgas', 'ask'],
  ['o', '✓ allowed · mission assigned', 'allowed'],
  ['c', '$ client.demerit.testnet → platform.close({id: 4, outcome:"severe"})', 'severe'],
  ['e', 'EVENT points_changed 3 → 0 · license_suspended 6 months', 'drop'],
  ['e', 'EVENT client_compensated 0.20 Ⓝ → client.demerit.testnet', 'refund'],
  ['c', '$ lea2.demerit.testnet → ledger.issue({identity:"fp-lea"})', 'lea2'],
  ['r', '✗ ERR_IDENTITY_SUSPENDED · a new account erases nothing', 'refused'],
  ['c', '$ near view ledger.demerit.testnet status({account:"lea.demerit.testnet"})', 'read'],
  ['o', '→ 6/12 pts · probation · deposit 1.25/1.25 Ⓝ · free read, no gas', 'restored'],
];

// Types LOG into <ol> el, line by line, then loops.
export function terminal(el, { speed = 14, pause = 520, max = 9, onLine = () => {} } = {}) {
  let i = 0;
  const step = () => {
    const [k, t, ev] = LOG[i % LOG.length];
    onLine(ev, i % LOG.length);
    const li = document.createElement('li');
    li.className = k; el.appendChild(li);
    while (el.children.length > max) el.removeChild(el.firstChild);
    let n = 0;
    const tick = () => {
      li.textContent = t.slice(0, n += k === 'c' ? 2 : 4);
      if (n < t.length) setTimeout(tick, speed); else { i++; setTimeout(step, k === 'c' ? pause * .6 : pause); }
    };
    tick();
  };
  // prefill so a still capture already reads well
  for (let j = 0; j < 3; j++) { const [k, t] = LOG[j]; const li = document.createElement('li'); li.className = k; li.textContent = t; el.appendChild(li); }
  onLine('issued', 2); i = 3; setTimeout(step, 900);
}

export const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

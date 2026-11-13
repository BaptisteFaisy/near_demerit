// Drives the PUBLIC page against testnet: proves every section shows chain data.
import puppeteer from 'puppeteer-core';

// Public page against the live testnet registry. Override with env vars:
//   LIVE_URL=... LIVE_ACCOUNT=... LIVE_SUSPENDED=... node scripts/live-check.mjs
const URL = process.env.LIVE_URL || 'https://near-demerit.vercel.app/dashboard.html';
const ACCOUNT = process.env.LIVE_ACCOUNT || 'lea.demerit.testnet';
const SUSPENDED = process.env.LIVE_SUSPENDED || 'lea2.demerit.testnet';
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.error(`  FAIL ${label}${detail ? ' — ' + detail : ''}`); }
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
const text = async (sel) => (await page.$eval(sel, (e) => e.textContent.trim()).catch(() => ''));

// section 1: query a real licence
await page.type('#account', ACCOUNT);
await page.click('#submitBtn');
await page.waitForFunction(() => {
  const t = document.querySelector('#pointsText');
  return t && t.textContent.trim() !== '—' && t.textContent.trim() !== '';
}, { timeout: 30000 });
const points = await text('#pointsText');
const status = await text('#statusLabel');
const coef = await text('#coef');
check('S1 points lus sur testnet', /\d+\s*\/\s*\d+/.test(points), points);
check('S1 statut traduit en français', ['probatoire', 'valide', 'suspendu', 'révoqué', 'rendu'].includes(status), status);
check('S1 coefficient réel', /^\d/.test(coef), coef);
const bond = await text('#bond'), req = await text('#bondRequired');
check('S1 caution versée (NEAR, pas un float cassé)', /\d/.test(bond) && !bond.includes('e+'), bond);
check('S1 caution exigée', /\d/.test(req) && !req.includes('e+'), req);
const rows = await page.$$eval('#reportsBody tr', (r) => r.length).catch(() => 0);
check('S1 signalements listés', rows >= 3, `${rows} lignes`);

// section 3: NFT title computed on chain
await page.waitForFunction(() => {
  const t = document.querySelector('#nftTitle');
  return t && t.textContent.trim() !== '—' && t.textContent.trim() !== '';
}, { timeout: 30000 }).catch(() => {});
const nft = await text('#nftTitle');
check('S3 titre NFT calculé par le contrat', /·/.test(nft), nft);
const nftExtra = await text('#nftExtra');
check('S3 extra du NFT (points/statut/coefficient)', nftExtra.includes('points'), nftExtra.slice(0, 40));

// section 5: mission board
const missions = await page.$$eval('#missionsBody tr', (r) => r.length).catch(() => 0);
check('S5 missions de la plateforme', missions >= 5, `${missions} lignes`);

// section 7: the scale
const scale = await page.$$eval('#rulesBody tr', (r) => r.length).catch(() => 0);
check('S7 barème affiché', scale >= 8, `${scale} lignes`);

// section 8: the guarantee fund must be funded
await page.waitForFunction(() => {
  const t = document.querySelector('#fundValue');
  return t && t.textContent.trim() !== '—' && t.textContent.trim() !== '';
}, { timeout: 20000 }).catch(() => {});
const fund = await text('#fundValue');
check('S8 fonds de garantie > 0', !/^0[.,]0000/.test(fund) && /\d/.test(fund), fund);

// section 2: access control on a suspended licence
await page.evaluate((a) => { document.querySelector('#chkAccount').value = a; }, SUSPENDED);
await page.click('#checkBtn');
await page.waitForFunction(() => {
  const t = document.querySelector('#chkAllowed');
  return t && t.textContent.trim() !== '—' && t.textContent.trim() !== '';
}, { timeout: 30000 }).catch(() => {});
const verdict = await text('#chkAllowed');
const code = await text('#chkCode');
check('S2 permis suspendu refusé', /^non$/i.test(verdict), `${verdict} / ${code}`);
check('S2 code de refus exact', code === 'ERR_LICENSE_SUSPENDED', code);

// section 4: an action renders a copyable near-cli-rs command
const cmd = await page.$$eval('.demerit-command', (els) => els.length).catch(() => 0);
check('S4 commandes near-cli-rs générées', cmd >= 3, `${cmd} blocs`);
const cmdText = await page.$eval('.demerit-command', (e) => e.textContent).catch(() => '');
check('S4 commande lisible (pas [object HTMLElement])',
  cmdText.includes('near contract call-function') && !cmdText.includes('[object'), cmdText.slice(0, 60));

await page.screenshot({ path: '/tmp/demerit-live.png', fullPage: true });
console.log('JS errors:', errors.length ? errors.slice(0, 3) : 'none');
await browser.close();
console.log(fail === 0 ? `LIVE OK (${pass}/${pass})` : `LIVE KO (${pass} ok, ${fail} ko)`);
process.exit(fail === 0 ? 0 : 1);

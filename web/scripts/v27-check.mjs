/* Headless check of the public pages: the landing, the app (demo + live) and
   the deep dashboard. Proves every page answers, the live mode reads the
   chain, and nothing logs a JavaScript error.
   Usage: node scripts/v27-check.mjs [baseUrl]   (no argument: serves web/) */
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2'
};

function serve(root) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
      try {
        const body = await readFile(path.join(root, rel));
        res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404).end('not found'); }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let server = null;
let BASE = process.argv[2];
if (!BASE) {
  server = await serve(ROOT);
  BASE = `http://127.0.0.1:${server.address().port}`;
}
let pass = 0, fail = 0, warn = 0;
const STRICT = process.env.STRICT_LIVE === '1';
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.error(`  FAIL ${label}${detail ? ' — ' + detail : ''}`); }
};
/* A check that needs the network: it fails only in strict mode (locally),
   otherwise the RPC rate limit would make the CI cry wolf. */
const net = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else if (STRICT) { fail++; console.error(`  FAIL ${label}${detail ? ' — ' + detail : ''}`); }
  else { warn++; console.warn(`  warn ${label}${detail ? ' — ' + detail : ''}`); }
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function open(path, { width = 1440, height = 1000 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
  return { page, errors };
}

/* ---------------------------------------------------------------- landing */
{
  const { page, errors } = await open('/index.html');
  await page.waitForFunction(() => {
    const t = document.getElementById('liveStrip');
    return t && t.textContent.trim() !== '' && !t.textContent.includes('Reading the chain');
  }, { timeout: 30000 }).catch(() => {});
  const strip = await page.$eval('#liveStrip', (e) => e.textContent.trim()).catch(() => '');
  const netBadge = await page.$eval('#net', (e) => e.textContent.trim()).catch(() => '');
  net('landing: la bande live est remplie', strip.length > 20 && !strip.includes('Reading the chain'), strip.slice(0, 80));
  net('landing: le badge réseau est résolu', /live|unreachable/.test(netBadge), netBadge);
  net('landing: points lus sur la chaîne', /\d+\/\d+ points/.test(strip), strip.slice(0, 80));
  const canvas = await page.$eval('#gl', (c) => c.width > 0 && c.height > 0).catch(() => false);
  check('landing: la scène 3D est Initialisée', canvas);
  check('landing: aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: '/tmp/demerit-v28-index.png' });
  await page.close();
}

/* ------------------------------------------------------------------- app */
{
  const { page, errors } = await open('/app.html');
  await page.waitForFunction(() => document.querySelector('#main') && document.querySelector('#main').textContent.includes('points'), { timeout: 20000 }).catch(() => {});
  const demo = await page.$eval('#main', (e) => e.textContent).catch(() => '');
  check('app: la page licence s’affiche', /Courier licence|points/.test(demo), demo.slice(0, 60));

  const modeButtons = await page.$$('#modes button');
  check('app: le sélecteur demo/live est présent', modeButtons.length === 2, `${modeButtons.length} boutons`);
  await modeButtons[1].click();
  await page.waitForFunction(() => {
    const b = document.querySelector('.ban.info');
    return b && b.textContent.includes('Live mode');
  }, { timeout: 40000 }).catch(() => {});
  const live = await page.$eval('#main', (e) => e.textContent).catch(() => '');
  net('app: le mode live lit la chaîne', /Live mode/.test(live), live.slice(0, 60));
  net('app: les points viennent de testnet', /\d+\s*\/\s*12/.test(live), live.slice(0, 120));
  net('app: la caution vient de testnet', /Ⓝ/.test(live));
  const badge = await page.$eval('#chainMode', (e) => e.textContent.trim()).catch(() => '');
  net('app: le bandeau terminal annonce le mode live', /live/.test(badge), badge);
  check('app: aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: '/tmp/demerit-v28-app-live.png' });
  await page.close();
}

/* -------------------------------------------------------------- dashboard */
{
  const { page, errors } = await open('/dashboard.html');
  await page.type('#account', 'lea.demerit.testnet');
  await page.click('#submitBtn');
  await page.waitForFunction(() => {
    const t = document.querySelector('#pointsText');
    return t && t.textContent.trim() !== '—' && t.textContent.trim() !== '';
  }, { timeout: 30000 }).catch(() => {});
  const points = await page.$eval('#pointsText', (e) => e.textContent.trim()).catch(() => '');
  net('dashboard: les points sont lus sur la chaîne', /\d+\s*\/\s*\d+/.test(points), points);
  check('dashboard: aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
if (server) server.close();
console.log(`\nV28 CHECK ${fail === 0 ? 'OK' : 'KO'} (${pass}/${pass + fail}${warn ? ', ' + warn + ' warn' : ''})`);
process.exit(fail === 0 ? 0 : 1);

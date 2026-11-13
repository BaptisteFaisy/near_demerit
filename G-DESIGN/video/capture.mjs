// demerit — capture du parcours A→Z dans la version jouable (vrais clics, vrai moteur du contrat),
// puis la preuve en direct sur le site public (lectures JSON-RPC du testnet), puis la carte de fin.
// Chaque plan dure exactement sa réplique (voice-<v>/durations.json) ; les temps de préparation sont coupés.
// Usage : node capture.mjs <baptiste|gaia>   (serveur de la version jouable sur http://127.0.0.1:8099)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const V = process.argv[2] || 'gaia';
const LINES = JSON.parse(fs.readFileSync(path.join(HERE, `lines-${V}.json`), 'utf8')).lines;
const DUR = JSON.parse(fs.readFileSync(path.join(HERE, `voice-${V}`, 'durations.json'), 'utf8'));
const RAW = path.join(HERE, `raw-${V}`);
const APP = process.env.APP || 'http://127.0.0.1:8120/', SITE = 'https://near-demerit.vercel.app/';
const GAP = 0.12, W = 1440, H = 810, BAND = 110;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const plain = t => t.replace(/\[[^\]]+\]\s*/g, '').trim();

/* curseur visible, onde de clic, anneau de surlignage, carte de note — par-dessus n'importe quelle page */
const OVERLAY = `(() => {
  const css = '#__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;opacity:0;transform:translate(720px,520px);transition:transform .6s cubic-bezier(.3,.7,.2,1),opacity .3s}'
   + '#__cur svg{width:30px;height:30px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}'
   + '.__rip{position:fixed;z-index:2147483646;pointer-events:none;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;border:3px solid #c9a8ff;animation:__r .55s ease-out forwards}'
   + '@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}'
   + '#__ring{position:fixed;z-index:2147483645;pointer-events:none;border:3px solid #c9a8ff;border-radius:16px;box-shadow:0 0 0 6px rgba(157,92,255,.28),0 0 30px rgba(157,92,255,.5);transition:all .45s ease;opacity:0}'
   + '#__note{position:fixed;left:24px;top:70px;z-index:2147483644;max-width:520px;padding:16px 20px;border-radius:16px;background:rgba(14,8,30,.94);color:#efe6ff;font:500 19px/1.45 "Segoe UI",sans-serif;box-shadow:0 18px 40px -18px rgba(0,0,0,.8);border-left:5px solid #9d5cff;opacity:0;transform:translateY(10px);transition:all .35s}'
   + '#__note.on{opacity:1;transform:none}#__note b{color:#c9a8ff}#__note code{font:500 16px Consolas,monospace;color:#c9a8ff}';
  function boot() {
    if (document.getElementById('__cur') || !document.body) return;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#14092c" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const r = document.createElement('div'); r.id = '__ring'; document.body.appendChild(r);
    const n = document.createElement('div'); n.id = '__note'; document.body.appendChild(n);
  }
  window.__v = {
    move(x, y, ms) { boot(); const c = document.getElementById('__cur'); c.style.transitionDuration = (ms || 600) + 'ms, 300ms';
      c.style.opacity = 1; c.style.transform = 'translate(' + (x - 5) + 'px,' + (y - 3) + 'px)'; },
    hide() { const c = document.getElementById('__cur'); if (c) c.style.opacity = 0; },
    ripple(x, y) { const d = document.createElement('div'); d.className = '__rip'; d.style.left = x + 'px'; d.style.top = y + 'px';
      document.body.appendChild(d); setTimeout(() => d.remove(), 650); },
    ring(b) { boot(); const r = document.getElementById('__ring'); if (!b) { r.style.opacity = 0; return; } const p = 8;
      Object.assign(r.style, { left: (b.x - p) + 'px', top: (b.y - p) + 'px', width: (b.width + 2 * p) + 'px', height: (b.height + 2 * p) + 'px', opacity: 1 }); },
    note(html) { boot(); const n = document.getElementById('__note'); if (!html) { n.classList.remove('on'); return; } n.innerHTML = html; n.classList.add('on'); },
  };
  /* le terminal de la version jouable écrit parfois « undefined » (bug signalé) : ces lignes sont masquées au tournage */
  const clean = () => document.querySelectorAll('#term > *').forEach(e => { if (/undefined/.test(e.textContent)) e.remove(); });
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('DOMContentLoaded', () => { const t = document.getElementById('term'); if (t) new MutationObserver(clean).observe(t, { childList: true, subtree: true }); });
})();`;

/* sélecteurs par alias, dans la mise en page vidéo de la version jouable */
const SEL = {
  hud: 'section#top .hero-r .hud', acts: 'section.grid2 #acts', roles: 'section.grid2 #roles', term: 'section#term',
  scene: 'section#scene', time: 'section#top .clockbox', mode: '#mode', invariant: '#i2',
  consult: '#sec-consult', check: '#sec-check', nft: '#sec-nft', fund: '#sec-fund'
};
const sel = s => SEL[s] || s;

async function captions(browser) {
  const p = await browser.newPage(); await p.setViewport({ width: W, height: BAND });
  for (const l of LINES) {
    const chip = l.chapter
      ? `<div style="flex:none;width:300px;display:flex;justify-content:flex-end"><span style="background:#9d5cff;color:#fff;font:700 18px 'Segoe UI',sans-serif;padding:8px 16px;border-radius:999px;white-space:nowrap">${l.chapter}</span></div>`
      : `<div style="flex:none;width:300px"></div>`;
    await p.setContent(`<html><body style="margin:0;background:#0d0719;height:${BAND}px;display:flex;align-items:center;gap:26px;padding:0 44px 0 0;box-sizing:border-box">
      ${chip}<div style="flex:1;color:#f3edff;font:600 24px/1.3 'Segoe UI',system-ui,sans-serif">${plain(l.text)}</div></body></html>`);
    await p.screenshot({ path: path.join(RAW, `cap_${l.id}.png`) });
  }
  await p.close();
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  for (const f of fs.readdirSync(RAW)) { const p = path.join(RAW, f); if (fs.statSync(p).isFile()) fs.unlinkSync(p); }
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 120000,
    args: ['--hide-scrollbars', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`] });
  await captions(browser);
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(OVERLAY);
  page.on('pageerror', e => console.error('page error:', e.message));
  const cdp = await page.createCDPSession();
  let n = 0; const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const name = String(n++).padStart(6, '0') + '.jpg';
    fs.writeFileSync(path.join(RAW, name), Buffer.from(f.data, 'base64'));
    frames.push([name, f.metadata.timestamp]);
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {}
  });

  const marks = {}, cuts = [];
  const J = js => page.evaluate(js);
  async function box(s) { return page.evaluate(q => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, s); }
  async function glide(s, ms = 550) { const b = await box(s); if (!b) throw new Error('absent : ' + s); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await J(`__v.move(${x}, ${y}, ${ms})`); await page.mouse.move(x, y, { steps: 6 }); await sleep(ms); return [x, y]; }
  async function click(s, ms) { const [x, y] = await glide(s, ms); await J(`__v.ripple(${x}, ${y})`); await page.mouse.click(x, y); }
  async function ring(s) { const b = s ? await box(sel(s)) : null; await J(`__v.ring(${JSON.stringify(b)})`); }
  /* une commande de lines-<v>.json */
  async function run(cmd) {
    const [op, ...rest] = cmd.split(' '); const arg = rest.join(' ');
    if (op === 'role') return click(`.role[data-role="${arg}"]`, 450);
    if (op === 'act') return click(`#acts .act[data-id="${arg}"]`, 550);
    if (op === 'time') return click(`#time button[data-m="${arg}"]`, 500);
    if (op === 'ring') return ring(arg === 'off' ? null : arg);
    if (op === 'glide') return glide(sel(arg), 600);
    if (op === 'hide') return J('__v.hide()');
    if (op === 'note') return J(`__v.note(${JSON.stringify(arg === 'off' ? null : arg)})`);
    if (op === 'who') { await click('#acctBtn', 380); await sleep(250); return click('[data-who="' + arg + '"]', 380); }
    if (op === 'nav') return click('[data-page="' + arg + '"]', 420);
    const latest = async q => page.evaluate(s => { const es = [...document.querySelectorAll(s)]; es.sort((a, b) => (+b.dataset.accept || +b.dataset.deliver || +b.dataset.mid) - (+a.dataset.accept || +a.dataset.deliver || +a.dataset.mid)); return es[0] ? s + '[data-' + (es[0].dataset.accept ? 'accept' : es[0].dataset.deliver ? 'deliver' : 'mid') + '="' + (es[0].dataset.accept || es[0].dataset.deliver || es[0].dataset.mid) + '"]' : null; }, q);
    if (op === 'accept') { const s = await latest('[data-accept]'); if (!s) throw new Error('no job'); return click(s, 500); }
    if (op === 'deliver') { const s = await latest('[data-deliver]'); if (!s) throw new Error('no delivery'); return click(s, 500); }
    if (op === 'rate') { const s = await latest('[data-rate="' + arg + '"]'); if (!s) throw new Error('no rating'); return click(s, 500); }
    if (op === 'click') return click(sel(arg), 550);
    if (op === 'type') { const [s, ...t] = rest; await click(sel(s), 450); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); return page.keyboard.type(t.join(' '), { delay: 45 }); }
    if (op === 'waitdata') { await page.waitForFunction(() => { const r = document.querySelector('#result'); return r && !r.hidden && /[0-9]/.test((r.querySelector('dd, td, .v, b') || r).innerText); }, { timeout: 20000 }).catch(() => console.error('données live non chargées')); return; }
    if (op === 'scroll') return J(`document.querySelector(${JSON.stringify(sel(arg))}).scrollIntoView({behavior:'smooth',block:'start'})`);
    throw new Error('commande inconnue : ' + cmd);
  }
  async function prep(fn) { const a = now(); await fn(); await sleep(250); cuts.push([a, now()]); }
  async function play(line) {
    const id = line.id; marks[id] = now(); const end = marks[id] + DUR[id] + GAP;
    for (const [at, cmd] of line.do || []) {
      const t = typeof at === 'string' && at.endsWith('%') ? DUR[id] * parseFloat(at) / 100 : +at;
      const wait = marks[id] + t - now(); if (wait > 0) await sleep(wait * 1000);
      try { await run(cmd); } catch (e) { console.error(id, '→', cmd, ':', e.message); }
    }
    const rest = end - now(); if (rest > 0) await sleep(rest * 1000);
  }

  /* la version jouable, mise en page vidéo (coupé) */
  await prep(async () => {
    await page.goto(APP, { waitUntil: 'load' });
    if (process.env.LAYOUT) await page.addStyleTag({ path: path.join(HERE, 'layout.css') });
    await sleep(2500);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  for (const line of LINES) {
    if (line.scene === 'site' && !marks.__site) {
      marks.__site = 1;
      await prep(async () => {
        await page.goto(SITE + '#sec-consult', { waitUntil: 'load' });
        await sleep(2500);
        await page.evaluate(() => document.querySelector('#sec-consult').scrollIntoView({ block: 'start' }));
        await sleep(1200);
      });
    }
    if (line.scene === 'end' && !marks.__end) {
      marks.__end = 1;
      await prep(async () => { await page.goto(pathToFileURL(path.join(HERE, 'endcard.html')).href); await sleep(700); });
    }
    if (line.pre && line.pre.length) await prep(async () => { for (const cmd of line.pre) { try { await run(cmd); } catch (e) { console.error(line.id, 'pre', cmd, ':', e.message); } await sleep(cmd === 'accept' ? 1900 : cmd.startsWith('click') ? 900 : 600); } });
    await play(line);
  }
  await sleep(300);
  const stop = now();
  await cdp.send('Page.stopScreencast').catch(() => {});
  delete marks.__site; delete marks.__end;
  fs.writeFileSync(path.join(RAW, 'frames.json'), JSON.stringify(frames));
  fs.writeFileSync(path.join(RAW, 'marks.json'), JSON.stringify({ marks, cuts, stop }));
  await browser.close();
  console.log('frames', frames.length, 'cuts', cuts.map(c => (c[1] - c[0]).toFixed(2)).join(' '));
})().catch(e => { console.error('CAPTURE ERROR', e.message); process.exit(1); });

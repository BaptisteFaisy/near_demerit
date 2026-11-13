// V14 : vérification headless Chrome des planches construites.
// node verify.mjs [filtre] [--shots=1,5b,9] [--w=1600 --h=900] [--idle-only]
// 1) joue ?auto=1 et lit le rapport du socle (état final exact, erreurs JS, lignes de terminal) ;
// 2) contrôle le contenu obligatoire (marque, slogan, 6 parties, 11 cartes, légende) ;
// 3) capture idle + arrêts sur image dans ../captures/.
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const filter = args.find(a => !a.startsWith('--')) || '';
const shots = (opt('shots') || '').split(',').filter(Boolean);
const W = opt('w') || 1600, H = opt('h') || 900;
const idleOnly = args.includes('--idle-only');
const manuel = args.includes('--manuel');
const live = args.includes('--live');
const base = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--run-all-compositor-stages-before-draw', `--window-size=${W},${H}`];
mkdirSync(join(out, 'captures'), { recursive: true });

let bad = 0;
const files = readdirSync(out).filter(f => /^\d\d-.*\.html$/.test(f) && f.includes(filter));
if (!files.length) { console.log('aucune planche trouvée dans', out); process.exit(1); }

/* Chrome peut quitter avec un code non nul après --dump-dom : le DOM reste exploitable */
function dumpDom(url, budget) {
  try {
    return execFileSync(CHROME, [...base, '--virtual-time-budget=' + budget, '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return e.stdout || '';
  }
}

for (const f of files) {
  const url = pathToFileURL(join(out, f)).href;
  const dom = dumpDom(url + '?auto=1&speed=10', 45000);
  const m = dom.match(/<script type="application\/json" id="result">(.*?)<\/script>/s);
  /* le DOM contient le source des scripts inline : on le retire avant de compter le chrome */
  const body = dom.replace(/<script[\s\S]*?<\/script>/g, '');
  const cnt = re => (body.match(re) || []).length;
  const chrome = {
    marque: /id="brand"/.test(body) && /<b>demerit<\/b>/.test(body),
    slogan: cnt(/class="sw"/g),
    parties: cnt(/class="pt[ "]/g),
    cartes: cnt(/class="cd[ "]/g),
    legende: cnt(/class="kd[ "]/g),
    etapes: cnt(/class="stp[ "]/g),
    term: cnt(/class="tl /g)
  };
  const chromeOk = chrome.marque && chrome.slogan >= 2 && chrome.parties === 6 && chrome.cartes === 11 && chrome.legende === 6 && chrome.etapes === 11;
  if (!m) { console.log('KO', f, '— pas de rapport (scénario non terminé)'); bad++; }
  else {
    const r = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
    const good = r.ok && chromeOk;
    if (!good) bad++;
    console.log(good ? 'OK' : 'KO', f,
      `| ${r.beats}/${r.of} temps | pts ${r.dom.pts} · caution ${r.dom.bond} · client ${r.dom.client} · fonds ${r.dom.fund}` +
      ` | ${r.termLines} lignes | « ${r.lastLine} » | erreurs JS: ${r.errors.length}`,
      `| chrome ${chrome.slogan}L/${chrome.parties}P/${chrome.cartes}C/${chrome.legende}K/${chrome.etapes}E`,
      r.errors.length ? r.errors : '');
  }
  if (manuel) {
    const dm = dumpDom(url + '?manuel=1&speed=10', 90000);
    const mm = dm.match(/<script type="application\/json" id="result">(.*?)<\/script>/s);
    if (!mm) { console.log('KO', f, '— pas de rapport manuel'); bad++; }
    else {
      const r = JSON.parse(mm[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
      const good = r.ok; if (!good) bad++;
      console.log(good ? 'OK' : 'KO', f, 'MANUEL',
        `| ${r.beats}/${r.of} appels | objectifs ${r.objectives}/${r.objectiveTotal}` + (r.missing && r.missing.length ? ' manquants: ' + r.missing.join(',') : '') +
        ` | attaques refusées ${r.attacks}/${r.attackTotal}` +
        ` | I2 ${r.invariant ? 'ok' : 'écart'} | pts ${r.dom.pts} · caution ${r.dom.bond} · client ${r.dom.client} · fonds ${r.dom.fund}` +
        (r.fatal ? ' | FATAL ' + r.fatal : '') + (r.errors && r.errors.length ? ' | erreurs: ' + r.errors.join(' ; ') : ''));
      if (!idleOnly) {
        const png = join(out, 'captures', f.replace('.html', '') + '-manuel.png');
        try { execFileSync(CHROME, [...base, '--virtual-time-budget=110000', '--screenshot=' + png, url + '?manuel=1&speed=10'], { stdio: 'ignore' }); } catch (e) { }
      }
    }
  }
  if (live) {
    const dl = dumpDom(url + '?live=1', 60000);
    const lm = dl.match(/<script type="application\/json" id="result">(.*?)<\/script>/s);
    if (!lm) { console.log('KO', f, '— pas de rapport live'); bad++; }
    else {
      const r = JSON.parse(lm[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
      const good = r.ok; if (!good) bad++;
      console.log(good ? 'OK' : 'KO', f, 'LIVE',
        `| ${r.contract} | état ${r.state ? r.state.pts + ' pts · ' + r.state.status + ' · caution ' + r.state.bond + ' / ' + r.state.req + ' · coef ' + r.state.coef : 'absent'}` +
        ` | fonds ${r.dom.fund} · client ${r.dom.client} | jeton ${r.state ? r.state.token : '—'}` +
        (r.errors && r.errors.length ? ' | erreurs: ' + r.errors.join(' ; ') : ''));
      if (!idleOnly) {
        const png = join(out, 'captures', f.replace('.html', '') + '-live.png');
        try { execFileSync(CHROME, [...base, '--virtual-time-budget=70000', '--screenshot=' + png, url + '?live=1'], { stdio: 'ignore' }); } catch (e) { }
      }
    }
  }
  if (idleOnly) continue;
  for (const s of ['idle', ...shots]) {
    const png = join(out, 'captures', f.replace('.html', '') + '-' + s.replace(':', '_') + '.png');
    const q = s === 'idle' ? '' : s.includes(':') ? '?auto=1&speed=6&at=' + s : '?auto=1&speed=6&stop=' + s;
    execFileSync(CHROME, [...base, '--virtual-time-budget=' + (s === 'idle' ? 3000 : 75000), '--screenshot=' + png, url + q], { stdio: 'ignore' });
  }
}
console.log(bad ? `KO ${bad}/${files.length}` : `TOUT OK ${files.length}/${files.length}`);
process.exit(bad ? 1 : 0);

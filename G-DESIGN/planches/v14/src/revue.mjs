// V14 : galerie de revue. Lit ../captures/*.png, récupère les titres des temps dans core.js,
// produit ../revue.html (grille cliquable, une section par planche) pour validation visuelle.
// usage : node revue.mjs [filtre]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const capDir = join(root, 'captures');
const filter = process.argv[2] || '';

/* titres réels des temps, extraits du socle (pas de copie en dur) */
const core = readFileSync(join(here, 'core.js'), 'utf8');
const titles = {};
for (const m of core.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?title:\s*'([^']+)'/g)) titles[m[1]] = m[2];
const shotLabel = s => {
  if (s === 'idle') return 'affiche · avant lancement';
  const id = s.split('_')[0];
  return (titles[id] || id) + (s.includes('_') ? ' · en cours' : ' · fin de temps');
};

if (!existsSync(capDir)) { console.log('pas de dossier captures/'); process.exit(0); }
const files = readdirSync(capDir).filter(f => /\.png$/i.test(f) && f.includes(filter)).sort();
const groups = new Map();
for (const f of files) {
  const m = f.match(/^(\d\d-[^-.]+(?:-[^-.]+)?)-(.+)\.png$/i);
  if (!m) continue;
  const [, planche, shot] = m;
  if (!groups.has(planche)) groups.set(planche, []);
  groups.get(planche).push({ f, shot });
}

const cards = [...groups.entries()].map(([planche, shots]) => {
  const live = join(root, planche + '.html');
  const link = existsSync(live) ? '<a class="live" href="' + planche + '.html" target="_blank">ouvrir la planche ↗</a>' : '';
  const figs = shots.map(s => '<figure><a href="captures/' + s.f + '" target="_blank"><img src="captures/' + s.f + '" loading="lazy" alt="' + s.f + '"></a><figcaption><b>' + s.shot + '</b>' + shotLabel(s.shot) + '</figcaption></figure>').join('');
  return '<section><h2>' + planche + link + '</h2><div class="grid">' + figs + '</div></section>';
}).join('\n');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>demerit · revue des captures</title>
<style>
:root{--bg:#06030b;--v:#9d5cff;--hi:#efe6ff;--ink:#c9b8ee;--dim:#6f5c9c;--line:rgba(157,92,255,.16)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 13px/1.5 system-ui,"Segoe UI",sans-serif}
header{padding:26px 26px 18px;border-bottom:1px solid var(--line)}
h1{margin:0;font:200 clamp(26px,3.4vw,44px)/1.1 "Segoe UI",system-ui,sans-serif;letter-spacing:-.03em;color:var(--hi)}
h1 b{font-weight:500;color:#fff}
p{margin:10px 0 0;font-size:12px;color:var(--dim);max-width:900px}
section{padding:26px;border-bottom:1px solid rgba(157,92,255,.08)}
h2{margin:0 0 18px;font:600 11px ui-monospace,Consolas,monospace;letter-spacing:.34em;color:var(--v)}
h2 .live{margin-left:16px;letter-spacing:.14em;color:var(--hi);text-decoration:none;border-bottom:1px solid var(--line)}
h2 .live:hover{color:#fff;border-color:var(--v)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:20px}
figure{margin:0;border:1px solid var(--line);background:#0b0616;overflow:hidden}
figure img{display:block;width:100%;height:auto}
figcaption{padding:10px 12px;font:400 10px ui-monospace,Consolas,monospace;letter-spacing:.12em;color:var(--dim);display:flex;gap:10px;align-items:baseline}
figcaption b{color:var(--hi);font-weight:600;letter-spacing:.16em}
figure:hover{border-color:var(--v)}
</style></head><body>
<header><h1>demerit — <b>revue des captures</b></h1>
<p>Chaque image est un arrêt sur image réel de la page (Chrome headless, 1600×900). Cliquez pour ouvrir en grand.
« affiche » = l'état avant lancement : logo, slogan, les 6 parties, le programme des 11 temps, le bouton.
Les autres = les temps du scénario certifié, dans l'ordre.</p></header>
${cards}
</body></html>`;
writeFileSync(join(root, 'revue.html'), html);
console.log('ok revue.html ·', files.length, 'captures ·', groups.size, 'planche(s)');

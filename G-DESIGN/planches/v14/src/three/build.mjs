// V14 : three/NN-nom.js (+ NN-nom.css facultatif) -> ../../NN-nom.html, un seul fichier autonome.
// esbuild empaquète three.js + kit3d.js + assets.js + la scène en IIFE ; tpl.html porte l'interface ; core.js le scénario.
// En-tête attendu dans la scène :
//   // TITRE: L'écluse
//   // SLOGAN: ligne 1 | ligne 2            (chaque segment = une ligne révélée)
//   // SUB: <b>...</b> sous-titre explicite
// usage : node build.mjs [filtre]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const out = join(src, '..');
const ESB = join(here, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe');
if (!existsSync(ESB)) { console.error('esbuild introuvable :', ESB); process.exit(1); }

const tpl = readFileSync(join(src, 'tpl.html'), 'utf8');
const core = readFileSync(join(src, 'core.js'), 'utf8');
const moteur = readFileSync(join(src, 'moteur.js'), 'utf8');
const manuel = readFileSync(join(src, 'manuel.js'), 'utf8');
const actions = readFileSync(join(src, 'actions.js'), 'utf8');
const live = readFileSync(join(src, 'live.js'), 'utf8');
const cssShell = readFileSync(join(src, 'style.css'), 'utf8');
const filter = process.argv[2] || '';
const head = (s, k) => ((s.match(new RegExp('^//\\s*' + k + ':\\s*(.+)$', 'm')) || [, ''])[1] || '').trim();
const esc = s => s.replace(/<\/script/gi, '<\\/script');
const slogan = s => s.split('|').map(x => x.trim()).filter(Boolean)
  .map(x => '<span class="sw"><span>' + x + '</span></span>').join('');

let n = 0;
for (const f of readdirSync(here).filter(f => /^\d\d-.*\.js$/.test(f) && f.includes(filter))) {
  const name = f.replace(/\.js$/, '');
  const js = execFileSync(ESB, [join(here, f), '--bundle', '--format=iife', '--minify', '--target=es2020',
    '--loader:.json=json', '--legal-comments=none', '--log-level=warning'],
    { cwd: here, encoding: 'utf8', maxBuffer: 1 << 28 });
  const s = readFileSync(join(here, f), 'utf8');
  const css = existsSync(join(here, name + '.css')) ? readFileSync(join(here, name + '.css'), 'utf8') : '';
  const title = 'demerit — ' + name.slice(0, 2) + ' · ' + (head(s, 'TITRE') || name.slice(3));
  const html = tpl
    .replace('/*TITLE*/', () => esc(title))
    .replace('/*SLOGAN*/', () => slogan(head(s, 'SLOGAN')))
    .replace('/*SUB*/', () => esc(head(s, 'SUB')))
    .replace('/*CSS-SHELL*/', () => esc(cssShell))
    .replace('/*ANNEXE*/', () => '')
    .replace('/*CSS*/', () => esc(css))
    .replace('/*SCENE*/', () => esc(js))
    .replace('/*MOTEUR*/', () => esc(moteur))
    .replace('/*ACTIONS*/', () => esc(actions))
    .replace('/*CORE*/', () => esc(core))
    .replace('/*MANUEL*/', () => esc(manuel))
    .replace('/*LIVE*/', () => esc(live));
  writeFileSync(join(out, name + '.html'), html);
  console.log('ok', name + '.html', (html.length / 1024).toFixed(0) + ' Ko');
  n++;
}
console.log(n + ' planche(s) construite(s)');

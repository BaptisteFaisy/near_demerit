// Smoke test of the static web page. Node only, no dependency.
// Serves web/ over a local HTTP server on a free port, checks the assets,
// runs `node --check` on app.js, then checks the page answers with a query
// string. Exit code 0 on success, 1 on failure.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
};

function serve(root) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function get(port, pathname) {
  return fetch(`http://127.0.0.1:${port}${pathname}`);
}

async function checkSyntax(code) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'demerit-web-'));
  const tmp = path.join(dir, 'app.js');
  await writeFile(tmp, code);
  return new Promise((resolve) => {
    execFile(process.execPath, ['--check', tmp], (err) => resolve(!err));
  });
}

const server = await serve(ROOT);
const { port } = server.address();

try {
  console.log(`Serving ${ROOT} on 127.0.0.1:${port}`);

  for (const [file, type] of [
    ['/index.html', 'text/html'],
    ['/app.html', 'text/html'],
    ['/app.js', 'text/javascript'],
    ['/chain.js', 'text/javascript'],
    ['/live.js', 'text/javascript'],
    ['/events.js', 'text/javascript'],
    ['/explorer.js', 'text/javascript'],
    ['/txs.js', 'text/javascript'],
    ['/views.js', 'text/javascript'],
    ['/moteur.js', 'text/javascript'],
    ['/common.js', 'text/javascript'],
    ['/style.css', 'text/css'],
    ['/fonts.css', 'text/css'],
    ['/dashboard.html', 'text/html'],
    ['/dashboard.js', 'text/javascript'],
    ['/dashboard.css', 'text/css'],
    ['/vendor/three.module.js', 'text/javascript'],
    ['/config.js', 'text/javascript'],
  ]) {
    const res = await get(port, file);
    const ctype = res.headers.get('content-type') || '';
    check(`GET ${file} -> 200`, res.status === 200, `status ${res.status}`);
    check(`GET ${file} content-type ${type}`, ctype.includes(type), ctype);
  }

  /* The public page must not depend on a CDN. */
  const landing = await (await get(port, '/index.html')).text();
  const app = await (await get(port, '/app.html')).text();
  check('landing has no CDN reference', !/https?:\/\/(cdn|fonts\.googleapis|unpkg|cdnjs)/.test(landing));
  check('app has no CDN reference', !/https?:\/\/(cdn|fonts\.googleapis|unpkg|cdnjs)/.test(app));
  check('three.js is vendored', landing.includes('"./vendor/three.module.js"'));

  for (const file of ['app.js', 'chain.js', 'live.js', 'events.js', 'explorer.js', 'txs.js', 'views.js', 'moteur.js', 'common.js', 'dashboard.js']) {
    const source = await readFile(path.join(ROOT, file), 'utf8');
    check(`${file} passes node --check`, await checkSyntax(source));
  }

  const page = await get(port, '/?contract=demo.testnet');
  check('GET /?contract=demo.testnet -> 200', page.status === 200, `status ${page.status}`);
  const html = await page.text();
  check('landing links the app', html.includes('app.html'));
  check('landing loads the vendored three.js', html.includes('vendor/three.module.js'));
} finally {
  server.close();
}

const total = passed + failed;
if (failed > 0) {
  console.error(`WEB KO (${passed}/${total} checks passed, ${failed} failed)`);
  process.exit(1);
}
console.log(`WEB OK (${passed}/${total} checks)`);

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
    ['/app.js', 'text/javascript'],
    ['/styles.css', 'text/css'],
    ['/config.js', 'text/javascript'],
  ]) {
    const res = await get(port, file);
    const ctype = res.headers.get('content-type') || '';
    check(`GET ${file} -> 200`, res.status === 200, `status ${res.status}`);
    check(`GET ${file} content-type ${type}`, ctype.includes(type), ctype);
  }

  const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
  check('app.js passes node --check', await checkSyntax(appSource));

  const page = await get(port, '/?contract=demo.testnet');
  check('GET /?contract=demo.testnet -> 200', page.status === 200, `status ${page.status}`);
  const html = await page.text();
  check('page contains the app entrypoint', html.includes('app.js'));
} finally {
  server.close();
}

const total = passed + failed;
if (failed > 0) {
  console.error(`WEB KO (${passed}/${total} checks passed, ${failed} failed)`);
  process.exit(1);
}
console.log(`WEB OK (${passed}/${total} checks)`);

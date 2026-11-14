/* Turns the raw proof logs in docs/proof/ into web/proof.json.

   Nothing here is typed by hand: every number on the Proof page is read back
   from the output of a real run (`cargo test -p demerit`, `make demo`,
   `make attack`, `make sim`).

   Usage: node scripts/proof-summary.mjs   */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const ROOT = path.resolve(WEB, '..');
const LOG_DIR = path.join(ROOT, 'docs', 'proof');

const RUNS = [
  { key: 'unit', file: 'cargo-test-demerit-20261114.txt' },
  { key: 'demo', file: 'make-demo-20261114.txt' },
  { key: 'attack', file: 'make-attack-20261114.txt' },
  { key: 'sim', file: 'make-sim-20261114.txt' },
];

async function readLog(name) {
  const abs = path.join(LOG_DIR, name);
  try {
    return { text: await readFile(abs, 'utf8'), rel: `docs/proof/${name}`, missing: false };
  } catch {
    return { text: '', rel: `docs/proof/${name}`, missing: true };
  }
}

/* ---- shared envelope: command, timestamps, exit code ---- */
function envelope(text) {
  const grab = (label) => {
    const m = text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };
  const exit = text.match(/^EXIT\s+(\d+)\s*$/m);
  return {
    command: grab('command'),
    host: grab('host'),
    started: grab('started'),
    ended: grab('ended'),
    exit: exit ? Number(exit[1]) : null,
  };
}

/* ---- pipe tables (demo, attack): `a | b | c | verdict` ---- */
function pipeRows(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const parts = line.split(' | ');
    if (parts.length !== 4) continue;
    const verdict = parts[3].trim();
    if (verdict !== 'OK' && verdict !== 'KO') continue;
    if (parts[0].trim() === 'step') continue;
    rows.push({
      label: parts[0].trim(),
      expected: parts[1].trim(),
      got: parts[2].trim(),
      ok: verdict === 'OK',
    });
  }
  return rows;
}

/* ---- fixed width table (sim): columns located from the header ---- */
function widthRows(text) {
  const lines = text.split('\n');
  const header = lines.find((l) => l.trimStart().startsWith('robot '));
  if (!header) return [];
  const names = ['robot', 'points', 'plaf.', 'suspensions', 'coef', 'caution', 'attendu', 'verdict'];
  const at = [];
  let from = 0;
  for (const n of names) {
    const i = header.indexOf(n, from);
    if (i < 0) return [];
    at.push(i);
    from = i + n.length;
  }
  const rows = [];
  for (const raw of lines.slice(lines.indexOf(header) + 1)) {
    const line = raw.trimEnd();
    /* The table ends where the money line begins: that line also finishes with
       " OK", and it is not a robot. */
    if (line.trim() === '' || /^(fonds?|funds?):/i.test(line.trim())) break;
    /* The last column is padded to 42 chars, but some expectations are longer,
       so the verdict has to be anchored at the end of the line rather than at a
       fixed offset. */
    const v = /\s(OK|KO)$/.exec(line);
    if (!v) continue;
    const verdictAt = line.length - v[1].length - 1;
    if (verdictAt < at[6]) continue;
    const cell = (i) => line.slice(at[i], i + 1 < at.length ? at[i + 1] : line.length).trim();
    rows.push({
      robot: cell(0),
      points: cell(1),
      cap: cell(2),
      suspensions: cell(3),
      coefficient: cell(4),
      bond: cell(5),
      expected: line.slice(at[6], verdictAt).trim(),
      ok: v[1] === 'OK',
    });
  }
  return rows;
}

function verdictLine(text, name) {
  const m = text.match(new RegExp(`^${name} (OK|KO) \\((\\d+)/(\\d+)\\)`, 'm'));
  if (!m) return null;
  return { line: `${name} ${m[1]} (${m[2]}/${m[3]})`, ok: m[1] === 'OK', score: `${m[2]}/${m[3]}` };
}

function firstLine(text, prefix) {
  const m = text.match(new RegExp(`^(${prefix}.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

/* ---- unit tests: every `test result:` line of every suite ---- */
function unitTests(text) {
  const suites = [];
  const re = /^test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out/gm;
  for (const m of text.matchAll(re)) {
    suites.push({
      status: m[1],
      passed: Number(m[2]),
      failed: Number(m[3]),
      ignored: Number(m[4]),
    });
  }
  const names = [...text.matchAll(/^test (\S+) \.\.\. ok$/gm)].map((m) => m[1]);
  const passed = suites.reduce((n, s) => n + s.passed, 0);
  const failed = suites.reduce((n, s) => n + s.failed, 0);
  return {
    passed,
    failed,
    ignored: suites.reduce((n, s) => n + s.ignored, 0),
    suites: suites.length,
    tests: names,
    ok: failed === 0 && passed > 0 && suites.every((s) => s.status === 'ok'),
  };
}

const runs = {};
const texts = {};
for (const { key, file } of RUNS) {
  const { text, rel, missing } = await readLog(file);
  texts[key] = text;
  const env = envelope(text);
  runs[key] = { ...env, log: rel, missing };
}

/* unit */
Object.assign(runs.unit, unitTests(texts.unit));

/* demo: nine steps plus the I2 row, then the funds line */
{
  const t = texts.demo;
  const v = verdictLine(t, 'DEMO');
  Object.assign(runs.demo, v ?? { ok: false, score: null, line: null });
  runs.demo.rows = pipeRows(t);
  runs.demo.funds = firstLine(t, 'funds:');
  runs.demo.invariant = runs.demo.rows.find((r) => r.label.startsWith('I2')) ?? null;
}

/* attack: the seven refusals, each with its expected code and the real one */
{
  const t = texts.attack;
  const v = verdictLine(t, 'ATTACK');
  Object.assign(runs.attack, v ?? { ok: false, score: null, line: null });
  runs.attack.refusals = pipeRows(t);
}

/* sim: five robots plus the money conservation check */
{
  const t = texts.sim;
  const v = verdictLine(t, 'SIM');
  Object.assign(runs.sim, v ?? { ok: false, score: null, line: null });
  runs.sim.rows = widthRows(t);
  runs.sim.funds = firstLine(t, 'fonds:');
}

const proof = {
  generatedBy: 'web/scripts/proof-summary.mjs',
  generatedAt: new Date().toISOString(),
  invariantI2: 'Σ bonds + fund + Σ credits + missions in progress = Σ deposits − Σ withdrawals',
  runs,
};

const out = path.join(WEB, 'proof.json');
await writeFile(out, JSON.stringify(proof, null, 2) + '\n', 'utf8');

const flag = (b) => (b ? 'ok' : 'KO');
console.log(`proof.json written from ${RUNS.length} logs`);
console.log(`  unit    ${flag(runs.unit.ok)}   ${runs.unit.passed} passed, ${runs.unit.failed} failed (exit ${runs.unit.exit})`);
console.log(`  demo    ${flag(runs.demo.ok)}   ${runs.demo.score ?? '—'} (exit ${runs.demo.exit})`);
console.log(`  attack  ${flag(runs.attack.ok)}   ${runs.attack.score ?? '—'} (exit ${runs.attack.exit})`);
console.log(`  sim     ${flag(runs.sim.ok)}   ${runs.sim.score ?? '—'} (exit ${runs.sim.exit})`);

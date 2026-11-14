/* Small test harness shared by the web tests: counters, a reporter and a loader
   for the plain browser scripts (window.*) the app ships. Keeping it in one file
   means one behaviour for every test, not one copy per test.
   Used by: events-test.mjs, txs-test.mjs. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function tap() {
  let pass = 0;
  let fail = 0;
  return {
    ok(label, cond, detail) {
      if (cond) { pass++; console.log(`  ok   ${label}`); }
      else { fail++; console.error(`  FAIL ${label}${detail ? ' — ' + detail : ''}`); }
    },
    done(name) {
      const total = pass + fail;
      if (fail > 0) {
        console.error(`\n${name} KO (${pass}/${total} checks passed, ${fail} failed)`);
        process.exit(1);
      }
      console.log(`\n${name} OK (${total} checks)`);
    }
  };
}

/* A browser global object, then .load(file) runs a script into the same sandbox. */
export function browserWindow(globals = {}) {
  const win = {};
  const box = { window: win, console, setTimeout, clearTimeout, ...globals };
  vm.createContext(box);
  const root = path.resolve(globals.ROOT || '.');
  return {
    win,
    load(file) {
      vm.runInContext(readFileSync(path.join(root, file), 'utf8'), box);
      return win;
    }
  };
}

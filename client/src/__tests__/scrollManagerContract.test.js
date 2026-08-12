import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * ScrollManager navigation contract — static source verification (no jsdom).
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');

function read(relPath) {
  return readFileSync(path.join(clientSrc, relPath), 'utf8');
}

const scrollManager = read('components/navigation/ScrollManager.jsx');
const main = read('main.jsx');

{
  check(/useLocation/.test(scrollManager), 'ScrollManager uses useLocation');
  check(/useNavigationType/.test(scrollManager), 'ScrollManager uses useNavigationType');
  check(/navigationType === 'POP'/.test(scrollManager), 'POP navigations skip forced scroll reset');
  check(/window\.scrollTo\(0,\s*0\)/.test(scrollManager), 'PUSH/REPLACE pathname changes scroll to top');
  check(/document\.documentElement\.scrollTop = 0/.test(scrollManager), 'scroll reset targets documentElement');
  check(/document\.body\.scrollTop = 0/.test(scrollManager), 'scroll reset targets body');
  check(/scrollIntoView/.test(scrollManager), 'hash navigations attempt scrollIntoView');
  check(/prevPathnameRef/.test(scrollManager), 'tracks previous pathname for search-only changes');
  check(/pathname !== prevPathname/.test(scrollManager), 'only pathname changes trigger top reset');
}

{
  check(/ScrollManager/.test(main), 'main.jsx mounts ScrollManager');
  check(/<BrowserRouter>[\s\S]*ScrollManager/.test(main), 'ScrollManager is inside BrowserRouter');
  check(/ScrollManager[\s\S]*<Suspense/.test(main), 'ScrollManager sits outside Suspense fallback tree');
  check(/min-h-screen bg-bg-main dark:bg-secondary/.test(main), 'PageLoading keeps consistent shell background');
}

console.log(`scrollManagerContract.test.js: ${count} assertions passed`);

import assert from 'node:assert/strict';
import fs from 'node:fs';

const routes = fs.readFileSync(new URL('../routes/tests.js', import.meta.url), 'utf8');
assert.match(routes, /testsRouter\.get\('\/tests\/compare', tests\.compareTests\)/);
assert.ok(routes.indexOf("'/tests/compare'") < routes.indexOf("'/tests/:slug'"), 'static comparison route precedes dynamic slug route');
assert.doesNotMatch(routes, /testsRouter\.get\('\/tests\/:slug\/compare/);

console.log('p7eTestRouting: server comparison route collision guards passed');

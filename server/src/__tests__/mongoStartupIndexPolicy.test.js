import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../config/db.js', import.meta.url), 'utf8');
assert.match(source, /autoIndex:\s*process\.env\.MONGO_AUTO_INDEX\s*===\s*'1'/);
assert.doesNotMatch(source, /autoIndex:\s*true/);
console.log('mongoStartupIndexPolicy.test.js: 2/2 checks passed');

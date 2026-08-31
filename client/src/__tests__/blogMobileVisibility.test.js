import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Blog listing contracts for mobile visibility, filtering, and failure states. */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'pages', 'Blog', 'Blog.jsx'), 'utf8');
const gridStart = src.indexOf('<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">');
const gridBlock = src.slice(gridStart);

check(gridStart !== -1, 'blog card grid remains present');
const revealBeforeGrid = src.slice(0, gridStart).lastIndexOf('<ScrollReveal');
check(revealBeforeGrid === -1 || src.slice(revealBeforeGrid, gridStart).includes('</ScrollReveal>'), 'complete blog grid is not inside ScrollReveal');
check(/filtered\.map\(\(post\)/.test(gridBlock), 'all filtered published posts render as cards');
check(/if \(!category\) return list;/.test(src), 'All category keeps the complete list');
check(/blogCategoryFilterValues\(category\)/.test(src) && /values\.includes\(canonicalBlogCategoryLabel\(p\.category/.test(src), 'category filters remain canonical and functional');
check(/setLoadError\(true\)/.test(src), 'API failures are tracked separately from empty results');
check(/loadError \?/.test(src) && /role="alert"/.test(src), 'API failure has a distinct user-visible error state');
check(/filtered\.length === 0/.test(src), 'legitimate zero-result state remains available');
check(/if \(loadError\) return \[\];/.test(src), 'API failure does not fall through to sample content');

console.log(`blogMobileVisibility.test.js: ${count} assertions passed`);

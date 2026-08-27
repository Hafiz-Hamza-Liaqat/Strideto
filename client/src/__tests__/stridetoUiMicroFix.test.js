import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * STRIDETO UI micro-fix contracts — Intl Scholarship grid + Blog article icon fallback.
 * Run: node src/__tests__/stridetoUiMicroFix.test.js
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');

const intl = read('pages/IntlScholarships/IntlScholarships.jsx');
const blog = read('pages/Blog/Blog.jsx');
const home = read('components/home/HomePersonalizedBody.jsx');
const icon = read('components/brand/Icon.jsx');

// ── UI-SCHOLAR-01: responsive grid ───────────────────────────────────────────
check(
  /ul className="grid gap-4 sm:grid-cols-2"/.test(intl) || /className="grid gap-4 sm:grid-cols-2"/.test(intl),
  'UI-SCHOLAR-01: Intl Scholarships listing uses responsive grid (sm:grid-cols-2)',
);

// ── UI-SCHOLAR-02: single card does not force full-width stretch via space-y list ─
check(!/<ul className="space-y-4">/.test(intl), 'UI-SCHOLAR-02a: full-width space-y-4 list removed');
check(
  /grid gap-4 sm:grid-cols-2/.test(intl) && !/lg:grid-cols-3|xl:grid-cols-4|md:grid-cols-3/.test(intl),
  'UI-SCHOLAR-02b: desktop stays at most 2 columns (no giant 3/4-col stretch)',
);
check(/min-w-0/.test(intl) && /h-full/.test(intl), 'UI-SCHOLAR-02c: card stays in grid cell (min-w-0 + h-full)');

// ── UI-SCHOLAR-03: mobile single column (default grid without base multi-col) ─
check(
  /grid gap-4 sm:grid-cols-2/.test(intl) && !/grid-cols-2(?!.*sm:)/.test(intl.split('sm:grid-cols-2')[0].slice(-80)),
  'UI-SCHOLAR-03: base grid is single-column; 2-col starts at sm breakpoint',
);

// ── UI-SCHOLAR-04: Save + View Details retained ───────────────────────────────
check(/SaveButton/.test(intl), 'UI-SCHOLAR-04a: SaveButton retained');
check(/viewDetails/.test(intl), 'UI-SCHOLAR-04b: View Details link retained');
check(/item\.title/.test(intl) && /item\.country/.test(intl), 'UI-SCHOLAR-04c: title and country still rendered');
check(/item\.deadline/.test(intl), 'UI-SCHOLAR-04d: deadline still rendered when present');
check(/fundingType/.test(intl), 'UI-SCHOLAR-04e: funding type exposed when available');
check(/coerceCountryCode/.test(intl), 'UI-SCHOLAR-04f: CountrySelect coerce path unchanged');

// ── UI-BLOG-ICON-01: sparkle absent on blog surfaces ─────────────────────────
check(!blog.includes('✦'), 'UI-BLOG-ICON-01a: Blog listing has no sparkle glyph');
check(!home.includes('✦'), 'UI-BLOG-ICON-01b: homepage blog cards have no sparkle glyph');

// ── UI-BLOG-ICON-02: semantic document/article icon present ──────────────────
check(/Icon/.test(blog) && /name="document"/.test(blog), 'UI-BLOG-ICON-02a: Blog uses Icon name="document"');
check(/Icon/.test(home) && /name="document"/.test(home), 'UI-BLOG-ICON-02b: homepage blog uses Icon name="document"');
check(/case 'document':/.test(icon), 'UI-BLOG-ICON-02c: brand Icon library provides document glyph');

// ── UI-BLOG-ICON-03: real images take precedence ─────────────────────────────
check(
  /post\.imageUrl \?[\s\S]*?<img[\s\S]*?:[\s\S]*?Icon name="document"/.test(blog),
  'UI-BLOG-ICON-03a: Blog renders img when imageUrl exists, else document icon',
);
check(
  /post\.imageUrl \?[\s\S]*?<img[\s\S]*?:[\s\S]*?Icon name="document"/.test(home),
  'UI-BLOG-ICON-03b: homepage renders img when imageUrl exists, else document icon',
);

// ── UI-BLOG-ICON-04: fallback remains responsive (full-width media plane) ────
check(/w-full h-32/.test(blog) || /w-full h-28/.test(blog), 'UI-BLOG-ICON-04a: Blog fallback keeps full-width responsive media plane');
check(/w-full h-28/.test(home) || /w-full h-32/.test(home), 'UI-BLOG-ICON-04b: homepage fallback keeps full-width responsive media plane');
check(/from-primary/.test(blog) && /dark:from-mint/.test(blog), 'UI-BLOG-ICON-04c: Blog fallback uses brand gradient surfaces');

console.log(`stridetoUiMicroFix.test.js: ${count} assertions passed`);

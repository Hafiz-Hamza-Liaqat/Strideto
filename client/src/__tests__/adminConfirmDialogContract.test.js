import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Follow-up: AdminConfirmDialog must default closed and every caller
 * must pass an explicit open prop (boolean expression or open shorthand).
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');

function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}

function walkJsx(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsx(full, out);
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const dialogSrc = read('components/admin/AdminConfirmDialog.jsx');

check(
  /export function AdminConfirmDialog\(\{ open = false/.test(dialogSrc),
  'AdminConfirmDialog defaults open = false'
);
check(
  /if \(!open\) return null;/.test(dialogSrc),
  'AdminConfirmDialog returns null when closed'
);
check(
  /onClick=\{onCancel\}/.test(dialogSrc) && /onClick=\{onConfirm\}/.test(dialogSrc),
  'Cancel and Confirm buttons remain wired'
);
check(
  /e\.target === e\.currentTarget && !isLoading\) onCancel\?\. \(\)/.test(dialogSrc)
    || /e\.target === e\.currentTarget && !isLoading\) onCancel/.test(dialogSrc),
  'Backdrop click still cancels when not loading'
);
check(
  /useOverlayA11y\(\{ open, onClose: onCancel/.test(dialogSrc),
  'Escape / overlay a11y still uses onCancel'
);

// Without open / open={false} semantics are encoded in source default + early return.
check(!/open = true/.test(dialogSrc), 'no unsafe open = true default remains');

const pagesDir = path.join(clientSrc, 'pages/Admin');
const files = walkJsx(pagesDir).filter((f) => {
  const src = readFileSync(f, 'utf8');
  return src.includes('AdminConfirmDialog') && !f.endsWith('AdminConfirmDialog.jsx');
});

const usages = [];
const missingOpen = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = path.relative(clientSrc, file).replace(/\\/g, '/');
  const re = /<AdminConfirmDialog\b([\s\S]*?)(?:\/>|>)/g;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1];
    const hasOpen = /\bopen(?:\s*=|\s|>|$)/.test(attrs) || /\bopen\b/.test(attrs);
    usages.push({ rel, attrs: attrs.trim().slice(0, 120), hasOpen });
    if (!hasOpen) missingOpen.push(rel);
  }
}

check(usages.length >= 20, `expected many AdminConfirmDialog call sites, found ${usages.length}`);
check(
  missingOpen.length === 0,
  `every caller must pass open explicitly; missing in: ${missingOpen.join(', ') || 'none'}`
);

// Commerce + Trust specifically
{
  const commerce = read('pages/Admin/AdminCommerceCenter.jsx');
  check(
    /\{actionRow && \(\s*<AdminConfirmDialog\s+open/.test(commerce)
      || /actionRow && \([\s\S]*?<AdminConfirmDialog[\s\S]*?\bopen\b/.test(commerce),
    'Commerce manual review mounts only when actionRow set and passes open'
  );
  check(
    /onCancel=\{\(\) => \{ setActionRow\(null\); setReason\(''\); \}\}/.test(commerce)
      || /onCancel=\{\(\) => \{ setActionRow\(null\);/.test(commerce),
    'Commerce cancel clears actionRow without mutation path'
  );
  check(
    /onConfirm=\{handleManualReview\}/.test(commerce),
    'Commerce confirm still uses existing handleManualReview authority path'
  );
}

{
  const trust = read('pages/Admin/AdminTrustCenter.jsx');
  check(
    /actionRow && \([\s\S]*?<AdminConfirmDialog[\s\S]*?\bopen\b[\s\S]*?Update Report/.test(trust),
    'Trust update report dialog opens only after intended trigger + explicit open'
  );
  check(
    /resolveRow && \([\s\S]*?<AdminConfirmDialog[\s\S]*?\bopen\b[\s\S]*?Resolve Dispute/.test(trust),
    'Trust resolve dispute dialog opens only after intended trigger + explicit open'
  );
  check(/onConfirm=\{handleAction\}/.test(trust), 'Trust update report confirm uses handleAction');
  check(/onConfirm=\{handleResolve\}/.test(trust), 'Trust resolve dispute confirm uses handleResolve');
}

console.log(
  `adminConfirmDialogContract.test.js: ${count} assertions passed; ${usages.length} call sites audited; missingOpen=${missingOpen.length}`
);

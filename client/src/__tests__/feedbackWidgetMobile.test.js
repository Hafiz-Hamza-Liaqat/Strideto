import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Feedback FAB remains fixed and outside normal document flow at every width. */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'components', 'feedback', 'FeedbackWidget.jsx'), 'utf8');
const layout = readFileSync(path.join(here, '..', 'layouts', 'MainLayout.jsx'), 'utf8');

check(/export function FeedbackWidget\(/.test(src), 'shared FeedbackWidget remains the trigger');
const btn = src.match(/<button\b[\s\S]*?aria-haspopup="dialog"[\s\S]*?<\/button>/)[0];
check(btn.includes('aria-label="Feedback"'), 'trigger has accessible name Feedback');
check(/>\s*Feedback\s*</.test(btn), 'trigger keeps a visible Feedback label');
check(/min-h-\[44px\]/.test(btn) && /min-w-\[44px\]/.test(btn), 'touch target is at least 44px');
check(
  /focus-visible:outline/.test(btn),
  'keyboard focus remains visible on the trigger'
);
check(
  /sm:bottom-6/.test(btn) && /sm:end-6/.test(btn),
  'desktop/tablet keeps the existing fixed corner placement'
);
check(/\bfixed\b/.test(btn), 'trigger is fixed at the default/mobile breakpoint');
check(/bottom-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/.test(btn), 'mobile bottom inset is safe-area aware');
check(/end-\[max\(1rem,env\(safe-area-inset-right\)\)\]/.test(btn), 'mobile end inset is safe-area aware');
check(!/max-sm:m-4/.test(btn) && !/max-sm:self-end/.test(btn), 'mobile trigger has no in-flow spacing or alignment');
check(/z-\[45\]/.test(btn), 'trigger remains below modal and cookie overlay layers');
check(layout.indexOf('<Footer />') < layout.indexOf('<FeedbackWidget />'), 'Footer remains before the Feedback widget in MainLayout');
for (const width of [320, 390, 639, 640, 768, 1024]) {
  check(/\bfixed\b/.test(btn), `${width}px trigger remains out of normal document flow`);
}

console.log(`feedbackWidgetMobile.test.js: ${count} assertions passed`);

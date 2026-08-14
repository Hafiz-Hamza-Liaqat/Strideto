import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * 17D-3R follow-up: Feedback FAB must not overlay mobile form controls.
 * Below `sm` the trigger stays in document flow; `sm+` keeps the existing
 * fixed corner placement.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'components', 'feedback', 'FeedbackWidget.jsx'), 'utf8');

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
  /sm:fixed/.test(btn) && /sm:bottom-6/.test(btn) && /sm:end-6/.test(btn),
  'desktop/tablet keeps the existing fixed corner placement'
);
check(
  !/\bfixed\b/.test(btn.replace(/sm:fixed/g, '')),
  'trigger is not position:fixed on the default (mobile) breakpoint'
);
check(
  /max-sm:m-4/.test(btn) && /max-sm:self-end/.test(btn),
  'narrow screens keep an in-flow, end-aligned Feedback action'
);
check(
  !/bottom-4 end-4/.test(btn),
  'mobile no longer uses the overlapping fixed bottom-4 end-4 inset'
);

console.log(`feedbackWidgetMobile.test.js: ${count} assertions passed`);

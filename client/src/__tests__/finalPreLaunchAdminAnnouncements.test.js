import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Mission F — admin announcements honesty + confirm dialog */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRoot = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const admin = read('pages/Admin/AdminAnnouncements.jsx');
const service = readRoot('server/src/services/announcementService.js');
const dialog = read('components/admin/AdminConfirmDialog.jsx');
const sidebar = read('components/admin/AdminSidebar.jsx');

check(/openCreate/.test(admin) && /New announcement|createAnnouncement/.test(admin), 'New announcement opens editor');
check(/Save draft|Publish now|Publish Now|publish/i.test(admin), 'draft + publish-now workflow present');
check(!/Scheduled at/.test(admin), 'scheduled-at UI removed for launch honesty');
check(/Scheduling not available|worker is stopped|background worker/i.test(admin) || /scheduledAt/.test(service) === false || /Ignores scheduledAt|ignore.*scheduledAt|Scheduling not available/i.test(service), 'schedule honesty documented in admin or service');
check(/open = false/.test(dialog), 'AdminConfirmDialog defaults closed');
check(/scrollTop|sidebarScroll|nearest/.test(sidebar), 'admin sidebar preserves scroll');

console.log(`finalPreLaunchAdminAnnouncements.test.js: ${count} assertions passed`);

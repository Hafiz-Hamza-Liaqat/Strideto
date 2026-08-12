import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Announcements startup / module wiring contract.
 * Proves ERR_MODULE_NOT_FOUND cannot recur for the Announcements graph,
 * and that Admin + role feed routers are registered.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');

function read(rel) {
  return readFileSync(path.join(serverSrc, rel), 'utf8');
}

const controller = read('controllers/announcementsController.js');
check(
  /from '\.\.\/utils\/asyncHandler\.js'/.test(controller),
  'announcementsController imports asyncHandler via ../utils (src-relative)'
);
check(
  !/from '\.\.\/\.\.\/utils\/asyncHandler\.js'/.test(controller),
  'announcementsController must not escape src with ../../utils'
);
check(
  /from '\.\.\/models\/Announcement\.js'/.test(controller),
  'announcementsController imports Announcement via ../models'
);
check(
  /from '\.\.\/services\/announcementService\.js'/.test(controller),
  'announcementsController imports announcementService via ../services'
);

const adminCtrl = read('controllers/admin/adminAnnouncementsController.js');
check(
  /from '\.\.\/\.\.\/utils\/asyncHandler\.js'/.test(adminCtrl),
  'adminAnnouncementsController keeps ../../utils (admin subfolder convention)'
);

const feedRoutes = read('routes/announcements.js');
check(/requireAuth/.test(feedRoutes), 'role feed routes require auth');
check(/announcementsRouter\.get\('\/feed'/.test(feedRoutes), 'feed route registered');
check(/announcementsRouter\.post\('\/:id\/read'/.test(feedRoutes), 'read route registered');
check(/announcementsRouter\.post\('\/:id\/ack'/.test(feedRoutes), 'ack route registered');
check(/announcementsRouter\.post\('\/:id\/vote'/.test(feedRoutes), 'vote route registered');

const adminRoutes = read('routes/admin.js');
check(/adminRouter\.get\('\/announcements'/.test(adminRoutes), 'Admin list route registered');
check(/adminRouter\.post\('\/announcements'/.test(adminRoutes), 'Admin create route registered');
check(/adminRouter\.post\('\/announcements\/:id\/publish'/.test(adminRoutes), 'Admin publish route registered');

const indexSrc = read('index.js');
check(/app\.use\('\/api\/announcements',\s*announcementsRouter\)/.test(indexSrc), 'feed mounted at /api/announcements');

const service = read('services/announcementService.js');
check(/audienceMatches/.test(service), 'audience isolation helper exists');
check(/ANNOUNCEMENT_AUDIENCES/.test(service) || /audiences\.includes\('all'\)/.test(service), 'all/audience matching preserved');

// Live import proof (requires secrets for auth middleware chain on routes)
process.env.JWT_SECRET ||= 'test-secret-for-announcements-module-check-32';
process.env.REFRESH_SECRET ||= 'test-refresh-for-announcements-module-check-32';

const controllerUrl = pathToFileURL(path.join(serverSrc, 'controllers/announcementsController.js')).href;
const routesUrl = pathToFileURL(path.join(serverSrc, 'routes/announcements.js')).href;
const adminCtrlUrl = pathToFileURL(path.join(serverSrc, 'controllers/admin/adminAnnouncementsController.js')).href;

const ctrlMod = await import(controllerUrl);
check(typeof ctrlMod.getFeed === 'function', 'controller getFeed exports');
check(typeof ctrlMod.read === 'function', 'controller read exports');

const routesMod = await import(routesUrl);
check(!!routesMod.announcementsRouter, 'announcementsRouter exports');

const adminMod = await import(adminCtrlUrl);
check(typeof adminMod.list === 'function' && typeof adminMod.create === 'function', 'admin list/create exports');

console.log(`announcementsStartupWiring.test.js: ${count} assertions passed`);

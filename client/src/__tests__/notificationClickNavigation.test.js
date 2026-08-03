import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isSafeInternalLink } from '../utils/notificationLink.js';

/**
 * PF-N — notification click navigation. `isSafeInternalLink` is pure logic
 * with no React/DOM dependency, so it is executed directly. The two
 * consumer components have no jsdom/DOM runner in this repo (same
 * constraint as every other client test here), so their wiring is proven
 * against the shipped source text instead.
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

// --- 1/9/10/11/12. isSafeInternalLink: real execution, not regex-matched ---
{
  check(isSafeInternalLink('/applications/64f1a2b3c4d5e6f7a8b9c0d1') === true, 'accepts a valid application detail route');
  check(isSafeInternalLink('/employer/jobs') === true, 'accepts a valid internal Employer route');
  check(isSafeInternalLink('/admin/moderation') === true, 'accepts a valid internal Admin route');
  check(isSafeInternalLink('javascript:alert(1)') === false, 'rejects a javascript: URL');
  check(isSafeInternalLink('data:text/html,<script>alert(1)</script>') === false, 'rejects a data: URL');
  check(isSafeInternalLink('//evil.example.com') === false, 'rejects a protocol-relative external URL');
  check(isSafeInternalLink('https://evil.example.com') === false, 'rejects an absolute external URL');
  check(isSafeInternalLink('/\\evil.example.com') === false, 'rejects a backslash-based open-redirect-style value');
  check(isSafeInternalLink('') === false, 'rejects an empty string');
  check(isSafeInternalLink(null) === false, 'rejects a null link (notification without an action link)');
  check(isSafeInternalLink(undefined) === false, 'rejects an undefined link (notification without an action link)');
}

const bell = read('components/notifications/NotificationBell.jsx');
const page = read('pages/Notifications/NotificationsPage.jsx');

// --- 2/4/5. Bell: click navigates, marks read, navigation not gated on mark-read success ---
{
  check(/import \{ Link, useNavigate \} from 'react-router-dom'/.test(bell), 'NotificationBell.jsx: uses useNavigate');
  check(/import \{ isSafeInternalLink \} from '\.\.\/\.\.\/utils\/notificationLink'/.test(bell), 'NotificationBell.jsx: imports the safe-link validator');
  check(
    /const handleActivate = \(n\) => \{\s*const safe = isSafeInternalLink\(n\.link\);\s*if \(!n\.read\) markRead\(n\._id\);\s*setOpen\(false\);\s*if \(safe\) navigate\(n\.link\);\s*\};/.test(bell),
    'NotificationBell.jsx: handleActivate marks read, closes the dropdown, and navigates only when the link is safe'
  );
  check(/onClick=\{\(\) => handleActivate\(n\)\}/.test(bell), 'NotificationBell.jsx: each item is wired to handleActivate');
  check(
    /const markRead = async \(id\) => \{\s*await api\.markRead\(id\)\.catch\(\(\) => \{\}\);/.test(bell),
    'NotificationBell.jsx: mark-read failure is swallowed, never thrown to the UI (PF-J3-B parameterized inboxApi -> api, User realm still passes inboxApi in)'
  );
}

// --- 3/4/5/6/7. Page: click navigates, mark-read/delete are siblings (no nested controls), no navigate() in either ---
{
  check(/import \{ Link, useNavigate \} from 'react-router-dom'/.test(page), 'NotificationsPage.jsx: uses useNavigate');
  check(/import \{ isSafeInternalLink \} from '\.\.\/\.\.\/utils\/notificationLink'/.test(page), 'NotificationsPage.jsx: imports the safe-link validator');
  check(
    /const handleActivate = \(n\) => \{\s*const safe = isSafeInternalLink\(n\.link\);\s*if \(!n\.read\) \{\s*api\.markRead\(n\._id\)\.then\(load\)\.catch\(\(\) => \{\}\);\s*\}\s*if \(safe\) navigate\(n\.link\);\s*\};/.test(page),
    'NotificationsPage.jsx: handleActivate marks read (fire-and-forget) and navigates only when the link is safe, regardless of mark-read outcome (PF-J3-B parameterized inboxApi -> api, User realm still passes inboxApi in)'
  );
  check(/onClick=\{\(\) => handleActivate\(n\)\}/.test(page), 'NotificationsPage.jsx: the notification content button is wired to handleActivate');
  check(
    /onClick=\{\(\) => markOne\(n\._id\)\}/.test(page) && !/markOne[\s\S]{0,80}navigate/.test(page),
    'NotificationsPage.jsx: the explicit Mark read button only marks read, never navigates'
  );
  check(
    /onClick=\{\(\) => remove\(n\._id\)\}/.test(page) && !/remove[\s\S]{0,80}navigate/.test(page),
    'NotificationsPage.jsx: the Delete button only deletes, never navigates'
  );
  check(
    /onClick=\{\(\) => handleActivate\(n\)\}[\s\S]{0,900}<\/button>\s*<div className="flex flex-col gap-1 shrink-0">/.test(page),
    'NotificationsPage.jsx: the navigable content button and the mark-read/delete controls are siblings, not nested'
  );
}

// --- 8/13. Accessible label present on both surfaces; native <button> gives keyboard activation for free ---
{
  for (const [name, src] of [['NotificationBell.jsx', bell], ['NotificationsPage.jsx', page]]) {
    check(
      /aria-label=\{safe\s*\?\s*t\('dashboard:openNotification', \{ title: n\.title,/.test(src),
      `${name}: actionable items get an accessible label naming the notification title`
    );
    check(
      /type="button"[\s\S]{0,120}onClick=\{\(\) => handleActivate\(n\)\}/.test(src),
      `${name}: the notification activation control is a real <button> (native keyboard activation, no custom key handling needed)`
    );
  }
}

// --- PF-J3-B: Employer notification bell/page reuse the same, already-tested shared core ---
{
  const employerBell = read('components/notifications/EmployerNotificationBell.jsx');
  const employerPage = read('pages/Employer/EmployerNotifications.jsx');
  const employerLayout = read('pages/Employer/EmployerLayout.jsx');
  const routes = read('routes/index.jsx');
  const employerService = read('services/employerService.js');

  check(
    /import \{ NotificationBellCore \} from '\.\/NotificationBell'/.test(employerBell),
    'EmployerNotificationBell.jsx: reuses the same NotificationBellCore as the User bell (no duplicated navigation/click logic)'
  );
  check(
    /api=\{employerInboxApi\}/.test(employerBell) && /viewAllRoute=\{ROUTES\.EMPLOYER_NOTIFICATIONS\}/.test(employerBell),
    'EmployerNotificationBell.jsx: wired to the Employer-scoped API and the /employer/notifications view-all route'
  );
  check(
    /const enabled = isEmployerPortalPath\(pathname\) && isAuthenticated;/.test(employerBell),
    'EmployerNotificationBell.jsx: only enabled on Employer portal routes while Employer-authenticated (own gating, independent of the User bell)'
  );
  check(
    /employerInboxApi = \{\s*list: \(params\) => employerAxios\.get\('\/inbox\/notifications', \{ params \}\),\s*unreadCount: \(\) => employerAxios\.get\('\/inbox\/notifications\/unread-count'\),\s*markRead: \(id\) => employerAxios\.patch\(`\/inbox\/notifications\/\$\{id\}\/read`\),\s*markAllRead: \(\) => employerAxios\.post\('\/inbox\/notifications\/mark-all-read'\),\s*remove: \(id\) => employerAxios\.delete\(`\/inbox\/notifications\/\$\{id\}`\),\s*\};/.test(employerService),
    'employerService.js: employerInboxApi covers list/unreadCount/markRead/markAllRead/remove via the Employer-authenticated axios instance (no manual token/header handling, no employer ID sent from the client)'
  );

  check(
    /import \{ NotificationsPageContent \} from '\.\.\/Notifications\/NotificationsPage'/.test(employerPage),
    'EmployerNotifications.jsx: reuses the same NotificationsPageContent as the User page (mark-one/mark-all/delete/loading/empty/error states all inherited, not duplicated)'
  );
  check(
    /api=\{employerInboxApi\}/.test(employerPage) && /backRoute=\{ROUTES\.EMPLOYER_DASHBOARD\}/.test(employerPage),
    'EmployerNotifications.jsx: wired to the Employer-scoped API, back-link targets the Employer dashboard'
  );

  check(
    /import \{ EmployerNotificationBell \} from '\.\.\/\.\.\/components\/notifications\/EmployerNotificationBell'/.test(employerLayout),
    'EmployerLayout.jsx: imports the Employer bell'
  );
  const bellMounts = employerLayout.match(/<EmployerNotificationBell \/>/g) || [];
  check(bellMounts.length === 2, 'EmployerLayout.jsx: bell is mounted in both the mobile header and the desktop top bar');

  check(
    /\{ path: 'notifications', element: <EmployerNotifications \/> \}/.test(routes),
    "routes/index.jsx: 'notifications' is registered as a child of the Employer dashboard route"
  );
  const employerDashboardBlockStart = routes.indexOf('path: ROUTES.EMPLOYER_DASHBOARD');
  const notificationsRouteIdx = routes.indexOf("{ path: 'notifications', element: <EmployerNotifications /> }");
  const protectedWrapperIdx = routes.indexOf('<ProtectedEmployerRoute>', employerDashboardBlockStart);
  check(
    employerDashboardBlockStart > -1
      && protectedWrapperIdx > employerDashboardBlockStart
      && notificationsRouteIdx > protectedWrapperIdx,
    'routes/index.jsx: the notifications child route sits inside the ProtectedEmployerRoute-wrapped Employer dashboard route tree (protected, not a standalone public route)'
  );
}

console.log(`notificationClickNavigation.test.js: ${count} assertions passed`);

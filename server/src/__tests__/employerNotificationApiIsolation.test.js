/**
 * PF-J3-B — server-side Employer notification isolation contract.
 * No server code changed in this phase: userNotificationsController.js
 * already branches on req.employer (populated only by the Employer-realm
 * cookie/token, never client input) and userInbox.js already mounts these
 * routes behind realm-agnostic requireAuth. This test proves that
 * pre-existing contract in source rather than asserting new behavior.
 * Run: node server/src/__tests__/employerNotificationApiIsolation.test.js
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
function read(relPath) {
  return readFileSync(path.join(serverSrc, relPath), 'utf8');
}

const controller = read('controllers/userNotificationsController.js');
const routes = read('routes/userInbox.js');
const model = read('models/UserNotification.js');

// --- 1/2/3/4/5. recipientContext branches correctly; identity never taken from client input ---
{
  check(
    /function recipientContext\(req\) \{\s*if \(req\.employer\) \{\s*return \{ recipientType: 'employer', employerId: req\.employer\.employerId \|\| req\.employer\._id \};/.test(controller),
    'recipientContext: Employer identity is derived only from req.employer (populated server-side by secure auth middleware), never from req.body/req.query'
  );
  check(
    !/req\.(body|query|headers)\.employerId/.test(controller),
    'Controller never reads an employerId from body/query/headers'
  );
  check(
    /const isStaff = req\.user\?\.role && STAFF_ROLES\.includes\(req\.user\.role\);/.test(controller),
    'Staff/Admin recipientType is derived from req.user.role, a separate identity space from req.employer — an Admin can never fall into the employer branch'
  );
}

// --- 6/7/8/13. Filters scope strictly by the resolved context; ownership required for mutations ---
{
  check(
    /function buildFilter\(ctx, query\) \{\s*const filter = \{ recipientType: ctx\.recipientType \};\s*applyRecipientOwner\(filter, ctx\);/.test(controller),
    'buildFilter: recipient owner is applied via applyRecipientOwner — never unscoped'
  );
  check(
    /if \(ctx\.recipientType === 'employer'\) filter\.employerId = ctx\.employerId;\s*else if \(ctx\.recipientType === 'agent'\) filter\.agentAccountId = ctx\.agentAccountId;\s*else filter\.userId = ctx\.userId;/.test(controller),
    'applyRecipientOwner: employer→employerId, agent→agentAccountId, else userId — never both, never unscoped'
  );
  const markReadFilterMatches = controller.match(/const filter = \{ _id: id, recipientType: ctx\.recipientType \};\s*\n\s*applyRecipientOwner\(filter, ctx\);/g) || [];
  check(
    markReadFilterMatches.length === 2,
    'markRead and removeNotification both require _id + recipientType + owner id together (2 call sites) — a matching _id alone is never sufficient to mutate a record'
  );
  check(
    /if \(!doc\) return res\.status\(404\)\.json\(\{ error: 'Notification not found' \}\);/.test(controller),
    "Foreign or absent records return a generic 404 ('Notification not found'), never revealing whether the record exists for a different owner"
  );
}

// --- 9/11. Newest-first ordering preserved for both list paths ---
{
  check(
    /UserNotification\.find\(filter\)\.sort\(\{ createdAt: -1 \}\)\.skip\(skip\)\.limit\(limit\)\.lean\(\)/.test(controller),
    'listUserNotifications: newest-first ordering, applies identically regardless of recipient context'
  );
}

// --- 10/12/14. Routes are realm-agnostic (requireAuth only) so an authenticated Employer can reach them ---
{
  check(
    /userInboxRouter\.get\('\/inbox\/notifications', requireAuth, listUserNotifications\);/.test(routes),
    'GET /inbox/notifications uses realm-agnostic requireAuth (no requireUserAuth gate blocking Employer identity)'
  );
  check(
    /userInboxRouter\.get\('\/inbox\/notifications\/unread-count', requireAuth, getUnreadCount\);/.test(routes),
    'GET /inbox/notifications/unread-count uses realm-agnostic requireAuth'
  );
  check(
    /userInboxRouter\.patch\('\/inbox\/notifications\/:id\/read', requireAuth, markRead\);/.test(routes),
    'PATCH mark-read uses realm-agnostic requireAuth'
  );
  check(
    /userInboxRouter\.post\('\/inbox\/notifications\/mark-all-read', requireAuth, markAllRead\);/.test(routes),
    'POST mark-all-read uses realm-agnostic requireAuth'
  );
  check(
    /userInboxRouter\.delete\('\/inbox\/notifications\/:id', requireAuth, removeNotification\);/.test(routes),
    'DELETE uses realm-agnostic requireAuth'
  );
  check(
    /userInboxRouter\.get\('\/users\/me\/notifications', requireAuth, requireUserAuth, getNotificationsForUser\);/.test(routes),
    'The separate legacy v1 endpoint remains User-only (requireUserAuth) and is untouched — no Employer equivalent needed for it'
  );
  check(
    !/requireEmployerAuth/.test(routes),
    'No requireEmployerAuth was added to userInbox.js in this phase — the existing realm-agnostic contract already suffices, per the audit\'s own preference for reuse over new routes'
  );
}

// --- Model already supports Employer recipient scoping (no migration needed) ---
{
  check(
    /recipientType: \{ type: String, enum: \['user', 'employer', 'staff', 'agent'\], required: true \},/.test(model),
    'UserNotification.recipientType includes employer and agent'
  );
  check(
    /employerId: \{ type: mongoose\.Schema\.Types\.ObjectId, ref: 'Employer' \},/.test(model),
    'UserNotification.employerId field already exists'
  );
  check(
    /agentAccountId: \{ type: mongoose\.Schema\.Types\.ObjectId, ref: 'AgentAccount' \},/.test(model),
    'UserNotification.agentAccountId field exists for Agent inbox'
  );
  check(
    /userNotificationSchema\.index\(\{ employerId: 1, read: 1, createdAt: -1 \}\);/.test(model),
    'A dedicated employerId index already exists — Employer queries were anticipated, not newly bolted on'
  );
}

console.log(`employerNotificationApiIsolation.test.js: ${count} assertions passed`);

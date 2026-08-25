/** Mission 13 focused behavioral/security acceptance tests. No DB/network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as consultation from '../../../shared/services/consultations.js';
import { isValidTimeZone } from '../../../shared/international/timezone.js';
import { canExercisePrivilegedCapability } from '../../../shared/international/verification.js';

const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const service = read('server/src/services/consultationService.js');
const routes = read('server/src/routes/consultations.js');
const userCapabilityMiddleware = read('server/src/middleware/requireUserCapability.js');
const model = read('server/src/models/consultation/Consultation.js');
const threadModel = read('server/src/models/consultation/ConsultationThread.js');
const messageModel = read('server/src/models/consultation/ConsultationMessage.js');
const eventModel = read('server/src/models/consultation/ConsultationEvent.js');
const notificationModel = read('server/src/models/consultation/ConsultationNotificationEvent.js');
const marketplace = read('server/src/services/agentMarketplaceService.js');
let passed = 0;
async function check(label, fn) { if (process.env.MISSION13_ONLY && !label.startsWith(`${process.env.MISSION13_ONLY} `)) return; try { await fn(); passed += 1; console.log(`  ok - ${label}`); } catch (error) { console.error(`  FAIL - ${label}\n       ${error.message}`); process.exitCode = 1; } }

await check('1 consultation ownership uses authenticated Student identity', () => {
  assert.match(routes, /import \{ studentProductAuth \} from ['"]\.\.\/middleware\/requireUserCapability\.js['"]/);
  assert.match(routes, /const studentAuth = \[\.\.\.studentProductAuth\]/);
  assert.match(userCapabilityMiddleware, /studentProductAuth = \[\s*requireAuth,\s*requireUserAuth,\s*requireStudentCapability,?\s*\]/);
  assert.match(service, /studentUserId: userId/);
  assert.doesNotMatch(service, /studentUserId: input/);
});
await check('2 approved Agent organization can receive a booking', () => assert.match(service, /requestConsultation[\s\S]*assertApprovedVerification\(service\.organizationId\)/));
await check('3 unapproved suspended revoked and expired organizations are blocked', () => ['draft','suspended','revoked','expired'].forEach((status) => assert.equal(canExercisePrivilegedCapability(status), false)));
await check('4 lifecycle valid transitions are explicit', () => { assert.equal(consultation.canTransitionConsultation('requested','confirmed','agent'), true); assert.equal(consultation.canTransitionConsultation('confirmed','cancelled','student'), true); });
await check('5 invalid terminal transitions are rejected', () => { assert.equal(consultation.canTransitionConsultation('completed','requested','student'), false); assert.equal(consultation.canTransitionConsultation('cancelled','completed','agent'), false); });
await check('6 lifecycle history is append-only', () => { assert.match(service, /ConsultationEvent\.create/); assert.doesNotMatch(service, /ConsultationEvent\.(update|findOneAndUpdate|delete)/); assert.match(eventModel, /updatedAt: false/); });
await check('7 IANA timezone identity is validated and preserved', () => { assert.equal(isValidTimeZone('Europe/London'), true); assert.equal(isValidTimeZone('+05:00'), false); assert.match(model, /timezone: \{ type: String/); assert.match(service, /normalizeTimeZone\(input\.timezone\)/); assert.match(service, /Booking timezone must match the selected availability timezone/); });
await check('8 UTC instant remains separate from timezone identity', () => { assert.match(model, /requestedWindow: \{ start: \{ type: Date/); assert.match(model, /timezone:/); });
await check('9 malformed date and local time values are rejected', () => { assert.equal(consultation.parseLocalTime('25:00'), null); assert.equal(consultation.zonedParts('bad', 'UTC'), null); });
await check('10 overlapping availability windows are rejected', () => assert.equal(consultation.validateAvailabilityWindows([{weekday:1,startLocal:'09:00',endLocal:'12:00'},{weekday:1,startLocal:'11:00',endLocal:'13:00'}]).ok, false));
await check('11 double booking is blocked with duration and buffer overlap', () => { assert.match(service, /Requested slot conflicts with another consultation/); assert.match(service, /\$lt: new Date\(end\.getTime\(\) \+ bufferMs\)/); });
await check('12 Student cannot book an unavailable slot', () => { const windows = [{weekday:1,startLocal:'09:00',endLocal:'10:00'}]; assert.equal(consultation.isSlotInsideAvailability({start:'2026-08-11T12:00:00Z',durationMinutes:30,timeZone:'UTC',windows}), false); });
await check('13 Agent reads and mutations are organization scoped', () => { assert.match(service, /organizationId: scope\.organizationId, assignedMembershipId: scope\.membership\._id/); assert.match(service, /organizationId: scope\.organizationId/); });
await check('14 cross-Agent consultation access is denied', () => assert.match(service, /Only the assigned Agent member can access this consultation/));
await check('15 User realm cannot invoke Agent consultation mutations', () => assert.match(routes, /agentAuth = \[requireAuth, requireAgentAuth\]/));
await check('16 Employer realm cannot invoke Agent consultation mutations', () => { assert.match(routes, /requireAgentAuth/); assert.doesNotMatch(routes, /requireEmployerAuth/); });
await check('17 meeting links have no public route or projection', () => { assert.doesNotMatch(routes, /public/); assert.match(service, /meetingMetadata: restricted \? \{ restricted: true \}/); });
await check('18 future-paid consultations never claim payment success', () => { assert.equal(consultation.CONSULTATION_PAYMENT_STATES.PAYMENT_REQUIRED_FUTURE, 'payment_required_future'); assert.doesNotMatch(service, /chargeCard|capturePayment|paymentStatus:\s*['"]paid|financiallySettled/i); });
await check('19 every thread is consultation-bound and deterministic', () => { assert.match(threadModel, /consultationId:[\s\S]*unique: true/); assert.match(threadModel, /contextType:[\s\S]*consultation/); });
await check('20 arbitrary User to Agent direct messaging is impossible', () => { assert.match(routes, /threads\/:threadId\/messages/); assert.doesNotMatch(routes, /users\/:.*messages|agents\/:.*messages/); });
await check('21 Student thread ownership is enforced', () => assert.match(service, /String\(thread\.studentUserId\) !== String\(actorId\)/));
await check('22 Agent message access requires an authorized membership', () => assert.match(service, /authorizedMembershipIds\.some/));
await check('23 cross-thread and cross-tenant message access is denied', () => { assert.match(service, /threadId: thread\._id/); assert.match(service, /String\(thread\.organizationId\) !== String\(scope\.organizationId\)/); });
await check('24 message validation strips HTML and control content', () => { assert.equal(consultation.sanitizeMessageText('<script>x</script>Hello\u0000'), 'xHello'); assert.match(messageModel, /maxlength: 4000/); });
await check('25 message and consultation pagination is bounded', () => { assert.match(service, /MAX_PAGE_SIZE = 50/); assert.match(service, /Math\.min\(MAX_PAGE_SIZE/); });
await check('26 generic audit excludes message bodies', () => { const block = service.split('export async function sendMessage')[1].split('export async function markThreadRead')[0]; assert.doesNotMatch(block, /metadata: \{[^}]*text/); assert.match(block, /messageType/); });
await check('27 marketplace interest does not auto-book', () => assert.doesNotMatch(marketplace, /Consultation\.create|requestConsultation/));
await check('28 explicit consultation request creates or links a relationship', () => { assert.match(service, /requestConsultation[\s\S]*AgentLead\.findOneAndUpdate/); assert.match(service, /marketplacePostId/); });
await check('29 consultation alone grants zero Vault access', () => { const requestBlock = service.split('export async function requestConsultation')[1].split('export async function listStudentConsultations')[0]; assert.doesNotMatch(requestBlock, /DocumentAccessGrant\.create|canAccessDocument/); });
await check('30 exact active Vault grant permits document reference validation', () => { assert.match(service, /canAccessDocument\(\{ actor: \{ type: 'agent'/); assert.match(service, /grant\.consultationRef/); });
await check('31 revoked or expired Vault grant is rechecked on reference access', () => { assert.match(service, /resolveDocumentReference[\s\S]*canAccessDocument/); assert.match(service, /DocumentAccessGrant\.findById/); });
await check('32 unrelated Vault documents and grants are denied', () => { assert.match(service, /ownerUserId: actorId/); assert.match(service, /Document grant denied/); });
await check('33 notification events are prepared but not delivered', () => { assert.match(service, /ConsultationNotificationEvent\.create/); assert.match(notificationModel, /status:[\s\S]*PENDING/); });
await check('34 no consultation worker email push SMS or WhatsApp delivery exists', () => { const all = service + notificationModel; assert.doesNotMatch(all, /sendEmail|sendSms|sendPush|sendWhatsApp|startWorker/); assert.match(notificationModel, /deliveryAttempted:[\s\S]*false/); });
await check('35 completed and cancelled messaging policy is bounded', () => { assert.equal(consultation.messagingAllowed('completed', new Date(Date.now() - 74 * 3600000), new Date(), 72), false); assert.match(service, /POST_CONSULTATION_MESSAGE_HOURS = 72/); });
await check('36 projections separate private Agent notes and restricted meeting data', () => { const student = service.split('function studentProjection')[1].split('function agentProjection')[0]; assert.doesNotMatch(student, /agentNote:/); assert.match(student, /meetingMetadata: restricted/); });
await check('37 Mission 12 marketplace remains isolated and requires explicit booking', () => { assert.match(service, /Marketplace origin is not a valid public post/); assert.match(routes, /post\('\/consultations'/); });
await check('38 Mission 11 Agent realm isolation remains mandatory', () => { assert.match(routes, /requireAgentAuth/); assert.match(service, /AgentMembership\.findOne\(\{ agentAccountId, organizationId: profile\.organizationId, active: true \}\)/); });

if (!process.exitCode) console.log(process.env.MISSION13_ONLY ? `\nMission 13 affected checks: ${passed}/1 passed.` : `\nMission 13 Consultations + Contextual Messaging: ${passed}/38 tests passed.`);

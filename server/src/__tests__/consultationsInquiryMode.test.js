/** Phase 2 regression tests — free-service inquiry mode (no availability required). No DB/network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as consultation from '../../../shared/services/consultations.js';
import { canExercisePrivilegedCapability } from '../../../shared/international/verification.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const service = read('server/src/services/consultationService.js');
const routes = read('server/src/routes/consultations.js');
const model = read('server/src/models/consultation/Consultation.js');
const notificationModel = read('server/src/models/consultation/ConsultationNotificationEvent.js');
const frontend = read('client/src/pages/Consultations/ConsultationRequest.jsx');
const agentDetail = read('client/src/pages/Agent/AgentConsultationDetail.jsx');

let passed = 0;
async function check(label, fn) {
  try { await fn(); passed += 1; console.log(`  ok - ${label}`); }
  catch (error) { console.error(`  FAIL - ${label}\n       ${error.message}`); process.exitCode = 1; }
}

// ── INQUIRY-01 ──────────────────────────────────────────────────────────────
await check('INQUIRY-01 form remains actionable when hasAvailability is false', () => {
  // Submit button must NOT be gated on hasAvailability
  assert.doesNotMatch(frontend, /disabled=\{busy \|\| !hasAvailability\}/);
  // Purpose field must NOT be disabled when no availability
  assert.doesNotMatch(frontend, /disabled=\{!hasAvailability\}/);
  // Button is only gated on busy
  assert.match(frontend, /disabled=\{busy\}/);
});

// ── INQUIRY-02 ──────────────────────────────────────────────────────────────
await check('INQUIRY-02 inquiry submit path does not require membershipId', () => {
  // Frontend: membershipId is only included in the booking branch
  assert.match(frontend, /if \(mode === .booking.\) \{/);
  assert.match(frontend, /membershipId: form\.membershipId/);
  // Service: inquiry detection is based on absence of membershipId
  assert.match(service, /const isInquiry = !input\.membershipId/);
});

// ── INQUIRY-03 ──────────────────────────────────────────────────────────────
await check('INQUIRY-03 inquiry mode skips slot assertion', () => {
  // assertSlotAvailable is called only inside the booking (else) branch
  const inquiryBlock = service.split('const isInquiry = !input.membershipId')[1].split('} else {')[0];
  assert.doesNotMatch(inquiryBlock, /assertSlotAvailable/);
  // Booking branch still calls assertSlotAvailable
  const bookingBlock = service.split('} else {')[1].split('let marketplacePostId')[0];
  assert.match(bookingBlock, /assertSlotAvailable/);
});

// ── INQUIRY-04 ──────────────────────────────────────────────────────────────
await check('INQUIRY-04 inquiry is scoped to the correct provider organization', () => {
  // Inquiry path resolves membership within service.organizationId
  assert.match(service, /chosenMembership.*organizationId: service\.organizationId/s);
  // Consultation.create uses organizationId from service
  assert.match(service, /organizationId: service\.organizationId/);
  // assertApprovedVerification is called before inquiry/booking branching
  assert.match(service, /await assertApprovedVerification\(service\.organizationId\)/);
});

// ── BOOKING-01 ──────────────────────────────────────────────────────────────
await check('BOOKING-01 booking path still validates slot when membershipId provided', () => {
  assert.match(service, /requestedWindow = await assertSlotAvailable\(\{ availability, start: input\.requestedStart, durationMinutes \}\)/);
});

// ── BOOKING-02 ──────────────────────────────────────────────────────────────
await check('BOOKING-02 invalid slot is still blocked by shared validator', () => {
  const windows = [{ weekday: 1, startLocal: '09:00', endLocal: '10:00' }];
  assert.equal(consultation.isSlotInsideAvailability({ start: '2026-08-11T12:00:00Z', durationMinutes: 30, timeZone: 'UTC', windows }), false);
  assert.match(service, /Requested slot is unavailable/);
  assert.match(service, /Requested slot conflicts with another consultation/);
});

// ── SECURITY-01 ─────────────────────────────────────────────────────────────
await check('SECURITY-01 suspended or revoked provider is hard-denied', () => {
  ['draft', 'suspended', 'revoked', 'expired'].forEach((status) => {
    assert.equal(canExercisePrivilegedCapability(status), false);
  });
  // assertApprovedVerification is called in requestConsultation before any branching
  assert.match(service, /await assertApprovedVerification\(service\.organizationId\)/);
});

// ── SECURITY-02 ─────────────────────────────────────────────────────────────
await check('SECURITY-02 wrong realm or unauthenticated user cannot create inquiry', () => {
  assert.match(routes, /studentProductAuth/);
  assert.match(service, /if \(!userId\) fail\('Authentication required'/);
});

// ── SECURITY-03 ─────────────────────────────────────────────────────────────
await check('SECURITY-03 inactive or non-public service cannot receive inquiry', () => {
  assert.match(service, /AgentService\.findOne\(\{ _id: input\.agentServiceId, status: AGENT_SERVICE_STATUSES\.ACTIVE \}\)/);
  assert.match(service, /Active Agent service not found/);
});

// ── PAYMENT-01 ──────────────────────────────────────────────────────────────
await check('PAYMENT-01 FREE request remains free — paymentStateFor unchanged', () => {
  assert.equal(consultation.CONSULTATION_PAYMENT_STATES.FREE, 'free');
  assert.match(service, /paymentStateFor\(service\)/);
  assert.match(service, /pricingMode === AGENT_SERVICE_PRICING_MODES\.FREE.*CONSULTATION_PAYMENT_STATES\.FREE/s);
});

// ── PAYMENT-02 ──────────────────────────────────────────────────────────────
await check('PAYMENT-02 future-paid service does not become live checkout', () => {
  assert.equal(consultation.CONSULTATION_PAYMENT_STATES.PAYMENT_REQUIRED_FUTURE, 'payment_required_future');
  assert.doesNotMatch(service, /chargeCard|capturePayment|paymentStatus:\s*['"]paid|financiallySettled/i);
  // Frontend warns that payments are not collected
  assert.match(frontend, /does not collect or settle consultation payments in this release/);
});

// ── PROVIDER-01 ─────────────────────────────────────────────────────────────
await check('PROVIDER-01 provider listing projection tolerates null requestedWindow', () => {
  // requestedWindow in model is now optional (no required: true)
  assert.doesNotMatch(model, /requestedWindow:.*required: true/);
  assert.match(model, /requestedWindow: \{ start: \{ type: Date, default: null \}/);
  // agentProjection still returns requestedWindow (from studentProjection)
  assert.match(service, /requestedWindow: data\.requestedWindow/);
});

// ── NOTIFICATION-01 ─────────────────────────────────────────────────────────
await check('NOTIFICATION-01 notification prep is preserved for inquiry creation', () => {
  // prepareNotification is called for both agent and student after Consultation.create
  const requestBlock = service.split('export async function requestConsultation')[1].split('export async function listStudentConsultations')[0];
  assert.match(requestBlock, /prepareNotification\(record, 'agent', assignedMembershipId, 'consultation_requested'\)/);
  assert.match(requestBlock, /prepareNotification\(record, 'student', userId, 'consultation_requested'\)/);
  // Notification event model still has pending status and deferred delivery
  assert.match(notificationModel, /status:[\s\S]*PENDING/);
  assert.match(notificationModel, /deliveryAttempted:[\s\S]*false/);
});

// ── INQUIRY-05 ──────────────────────────────────────────────────────────────
await check('INQUIRY-05 availability present — student can still choose Send Inquiry', () => {
  // Mode selector lets student switch to inquiry even when availability exists
  assert.match(frontend, /setMode.*inquiry/);
  // Submit branches on mode, not on hasAvailability
  assert.match(frontend, /if \(mode === .booking.\) \{/);
});

// ── INQUIRY-06 ──────────────────────────────────────────────────────────────
await check('INQUIRY-06 booking remains separately available when availability exists', () => {
  // Mode selector lets student switch to booking
  assert.match(frontend, /setMode.*booking/);
  // Booking fields gated on mode === 'booking' AND hasAvailability
  assert.match(frontend, /mode === .booking. && hasAvailability/);
});

// ── ROUTING-01 ──────────────────────────────────────────────────────────────
await check('ROUTING-01 agency inquiry assignment is deterministic — uses service owner profile', () => {
  // Primary route: service.agentProfileId identifies the canonical owner
  assert.match(service, /service\.agentProfileId/);
  // Canonical lookup uses the profile's agentAccountId, not an arbitrary member
  assert.match(service, /serviceProfile\.agentAccountId/);
  // Fallback chain is role-ordered (owner then admin)
  assert.match(service, /AGENT_MEMBER_ROLES\.OWNER/);
  assert.match(service, /AGENT_MEMBER_ROLES\.ADMIN/);
  // Role-scoped fallbacks are deterministic (sorted, not arbitrary)
  assert.match(service, /sort\(\{ createdAt: 1 \}\)/);
});

// ── ROUTING-02 ──────────────────────────────────────────────────────────────
await check('ROUTING-02 ordinary active member never receives inquiry when no owner or admin exists', () => {
  // The inquiry routing block must NOT contain a bare findOne without a role filter
  // (i.e., no fallback to earliest active member regardless of role)
  const inquiryBlock = service
    .split('const isInquiry = !input.membershipId')[1]
    .split('if (!chosenMembership) fail')[0];
  // Every AgentMembership.findOne inside the fallback path must specify a role constraint
  const fallbackBlock = inquiryBlock.split('if (!chosenMembership) {')[1] || '';
  const membershipLookups = fallbackBlock.match(/AgentMembership\.findOne\([^)]+\)/g) || [];
  for (const lookup of membershipLookups) {
    assert.match(lookup, /role:/, `Found a membership lookup without a role constraint: ${lookup}`);
  }
  // Fail-safe error must be present with a 503 / PROVIDER_UNAVAILABLE signal (not 404 "no members")
  assert.match(service, /PROVIDER_UNAVAILABLE/);
  assert.match(service, /No authorized consultation recipient found for this service/);
  // The old generic "no active agent members" catch-all must be gone
  assert.doesNotMatch(service, /No active agent members are available for this service/);
});

// ── PROVIDER-02 ─────────────────────────────────────────────────────────────
await check('PROVIDER-02 unscheduled inquiry exposes valid provider-side actions — not only confirm', () => {
  // Provider UI detects unscheduled inquiry
  assert.match(agentDetail, /isUnscheduledInquiry/);
  // The true-branch of the ternary (unscheduled path) must not include 'confirmed'
  const trueBranch = agentDetail.split('isUnscheduledInquiry ?')[1].split(':')[0];
  assert.doesNotMatch(trueBranch, /'confirmed'/);
  // Propose-time and decline actions appear in the true-branch
  assert.match(trueBranch, /reschedule_requested/);
  assert.match(trueBranch, /declined/);
});

// ── PAYMENT-03 ─────────────────────────────────────────────────────────────
await check('PAYMENT-03 only FREE paymentState produces free-consultation label', () => {
  // "free consultation" CTA is guarded behind a paymentState === 'free' check
  assert.match(frontend, /paymentState === .free.[\s\S]{0,100}Request free consultation/);
});

// ── PAYMENT-04 ─────────────────────────────────────────────────────────────
await check('PAYMENT-04 future-paid and not-configured inquiry is labelled neutrally', () => {
  // The old static ternary that unconditionally called all no-availability paths "free" is gone
  assert.doesNotMatch(frontend, /hasAvailability \? ['"]Request consultation['"] : ['"]Request free consultation['"]/);
  // Neutral label "Send inquiry" is present for non-free paths
  assert.match(frontend, /Send inquiry/);
  // Payment warning that payments are not collected is preserved
  assert.match(frontend, /does not collect or settle consultation payments/);
});

console.log(passed === 20 ? `\nPhase 2 inquiry mode: ${passed}/20 tests passed.` : `\nPhase 2 inquiry mode: ${passed}/20 tests passed — check failures above.`);

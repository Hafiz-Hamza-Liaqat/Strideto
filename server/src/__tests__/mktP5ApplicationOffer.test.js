/**
 * STRIDETO MKT-P5 — application offer workflow contracts.
 * Run: node src/__tests__/mktP5ApplicationOffer.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OFFER_NOTE_MAX_LENGTH,
  OFFER_RESPONDABLE_STATUSES,
  OFFER_STATUSES,
} from '../../../shared/employer/applicationOffer.js';
import { deriveEffectiveOfferStatus } from '../utils/applicationOfferView.js';
import { rejectUnexpectedBodyKeys } from '../services/applicationCommunicationService.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const clientSrc = path.resolve(here, '../../../client/src');
const read = (rel) => readFileSync(path.join(serverSrc, rel), 'utf8');
const readClient = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');

const service = read('services/applicationOfferService.js');
const controller = read('controllers/applicationOfferController.js');
const employerRoutes = read('routes/employer.js');
const candidateRoutes = read('routes/opportunityApplications.js');
const employerDetail = readClient('pages/Employer/EmployerApplicationDetail.jsx');
const candidateDetail = readClient('pages/Applications/ApplicationDetail.jsx');
const panel = readClient('components/applications/ApplicationOfferPanel.jsx');
const analytics = readClient('components/employer/applicant/applicationOfferAnalytics.js');
const commService = read('services/applicationCommunicationService.js');
const automation = read('services/automationService.js');

check(OFFER_STATUSES.join(',') === 'sent,accepted,declined,withdrawn,expired', 'MKT-P5: offer status enum includes persisted expired');
check(OFFER_RESPONDABLE_STATUSES.join(',') === 'sent', 'MKT-P5: only sent offers are respondable');
check(OFFER_NOTE_MAX_LENGTH === 2000, 'MKT-P5: offer note max length');

check(
  /getOwnedApplicationForEmployer\(employerId, applicationId\)/.test(commService) &&
    service.includes('getOwnedApplicationForEmployer'),
  'MKT-P5-SEC01/03: employer authorization via job ownership'
);
check(service.includes('getOwnedApplicationForCandidate'), 'MKT-P5-SEC05/06: candidate authorization');
check(service.includes('clientCommandId') && service.includes('isDuplicateKeyError'), 'MKT-P5-E05: idempotency');
check(service.includes('withdrawActiveSentOffers'), 'MKT-P5-E09: offer history retained on replacement');

check(
  controller.includes("rejectUnexpectedBodyKeys(req.body, [") &&
    controller.includes("'clientCommandId'"),
  'MKT-P5-MASS: employer offer whitelist'
);
check(
  /rejectUnexpectedBodyKeys\(req\.body, \['response', 'status'\]\)/.test(controller),
  'MKT-P5-MASS: candidate response whitelist'
);

check(employerRoutes.includes("'/employer/applications/:id/offers'"), 'MKT-P5-E01: employer offer routes');
check(employerRoutes.includes('applicationCommunicationLimiter'), 'MKT-P5-41: reuse communication limiter');
check(candidateRoutes.includes("'/applications/:id/offers/:offerId/respond'"), 'MKT-P5-C01: candidate respond route');

check(employerDetail.includes('EmployerApplicationOfferSection'), 'MKT-P5-E01: employer offer section');
check(
  employerDetail.includes('listApplicationOffers') && employerDetail.includes('sendApplicationOffer'),
  'MKT-P5-E03: employer uses offer API'
);
check(candidateDetail.includes('CandidateApplicationOfferSection'), 'MKT-P5-C01: candidate offer section');
check(
  candidateDetail.includes('legacyApplicationId') && candidateDetail.includes('respondApplicationOffer'),
  'MKT-P5-C01: candidate offer gated on internal application'
);

check(!panel.includes('dangerouslySetInnerHTML'), 'MKT-P5-42: no dangerouslySetInnerHTML');
check(panel.includes('whitespace-pre-wrap') && panel.includes('{offer.compensationText}'), 'MKT-P5-42: escaped text');
check(panel.includes('offerSentInApp') && panel.includes('offerEmailQueued'), 'MKT-P5-35: truthful success copy');
check(!panel.includes('Employee hired'), 'MKT-P5-E10: no hire overclaim in UI');
check(
  panel.includes('offerLegalHint') || panel.includes('offerAcceptConfirmBody'),
  'MKT-P5-C06: accept does not imply contract'
);

check(
  analytics.includes('employer_offer_intent') && analytics.includes('employer_offer_sent'),
  'MKT-P5-37: analytics action names'
);
check(!analytics.includes('compensationText'), 'MKT-P5-39: no compensation in analytics module');

check(
  service.includes("action: 'offer.sent'") && service.includes("action: 'offer.withdrawn'"),
  'MKT-P5-36: audit actions'
);
check(
  service.includes('hasCompensation: Boolean') && service.includes("action: 'offer.sent'"),
  'MKT-P5-74: audit uses flags not full compensation'
);

check(
  read('templates/emailTemplates.js').includes('applicationOffer') &&
    !read('templates/emailTemplates.js').match(/applicationOffer:[\s\S]*compensationText/),
  'MKT-P5-33: generic offer email without compensation'
);

check(
  automation.includes("if (status === 'hired')") && automation.includes('offerLetter'),
  'MKT-P5-32: legacy offerLetter still tied to hired status only'
);

const expired = deriveEffectiveOfferStatus({
  status: 'sent',
  expiresAt: new Date(Date.now() - 60_000),
});
check(expired === 'expired', 'MKT-P5-25: expired derived without worker');

check(!service.includes("application.status = 'hired'"), 'MKT-P5-C07: accept does not auto-hire');
check(!service.includes("application.status = 'rejected'"), 'MKT-P5-C07: decline does not auto-reject');
check(
  service.includes('conflictError') || service.includes('status = 409'),
  'MKT-P5-CONC: concurrent active-sent conflict returns 409'
);
check(
  read('utils/applicationOfferLifecycle.js').includes("status: 'expired'"),
  'MKT-P5-EXPIRY: persisted expiry transition'
);

try {
  rejectUnexpectedBodyKeys({ status: 'accepted', applicationId: 'evil' }, ['response']);
  check(false, 'MKT-P5-MASS: unexpected applicationId rejected');
} catch (err) {
  check(err.status === 400, 'MKT-P5-MASS: mass assignment returns 400');
}

console.log(`MKT-P5 application offer contract tests: ${count} passed`);

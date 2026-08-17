import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GBS_MESSAGE_LIMITS,
  parseGbsMessageLimit,
  parseGbsMessagePage,
} from '../../../shared/gbs/contextMessaging.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const buyerRoutes = read('server/src/routes/gbsBuyer.js');
const agentRoutes = read('server/src/routes/agent.js');
const requestService = read('server/src/services/gbs/gbsServiceRequestService.js');
const messageService = read('server/src/services/gbs/gbsContextMessagingService.js');
const messageController = read('server/src/controllers/gbsContextMessagingController.js');
const threadModel = read('server/src/models/gbs/GbsContextThread.js');
const messageModel = read('server/src/models/gbs/GbsContextMessage.js');

assert.match(buyerRoutes, /business\/private-beta\/services\/:listingSlug/);
assert.match(buyerRoutes, /business\/private-beta\/requests/);
assert.match(buyerRoutes, /business\/requests['"]\s*,[\s\S]*buyer\.createRequest/);
assert.match(requestService, /requireMarketplaceEnabled:\s*false/);
assert.match(requestService, /listingModerationIsPubliclyEligible/);
assert.match(requestService, /isBusinessServicesDomainEnrollmentActive/);
assert.match(requestService, /intakeChannel\s*===\s*'private_beta'/);
assert.match(requestService, /evaluatePublicMarketplaceEligibility/);
assert.match(requestService, /invalid_entity_type/);
assert.match(requestService, /executeHighValueIdempotentCommand/);

for (const context of ['requests', 'quotes', 'cases']) {
  assert.match(buyerRoutes, new RegExp(`business\\/${context}\\/:contextRef\\/messages`));
  assert.match(agentRoutes, new RegExp(`business-services\\/${context}\\/:contextRef\\/messages`));
}
assert.match(messageController, /assertAuthorizedProviderSubject/);
assert.match(messageController, /assertProviderDomainAccess/);
assert.match(messageController, /BUSINESS_REQUESTS_MANAGE/);
assert.match(messageController, /BUSINESS_QUOTES_MANAGE/);
assert.match(messageController, /BUSINESS_CASES_MANAGE/);
assert.match(messageService, /requesterUserId\s*=\s*actor\.id/);
assert.match(messageService, /providerSubjectType\s*=\s*actor\.subjectType/);
assert.match(messageService, /providerSubjectId\s*=\s*String\(actor\.subjectId\)/);
assert.match(messageService, /\.limit\(limit\)/);
assert.match(messageService, /stripAllHtml/);
assert.doesNotMatch(messageService, /dangerouslySetInnerHTML/);
assert.match(threadModel, /autoIndex:\s*false/);
assert.match(messageModel, /autoIndex:\s*false/);
assert.equal(parseGbsMessagePage('-1'), 1);
assert.equal(parseGbsMessageLimit('9999'), GBS_MESSAGE_LIMITS.PAGE_MAX);

console.log('prelaunchBusinessIntakeMessagingDocumentClosure.test.js: 32 assertions passed');

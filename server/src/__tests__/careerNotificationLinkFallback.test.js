/**
 * PF-TRACK-C2B — careerNotificationBridge.js must never link a User-facing
 * notification to an Employer-facing Application id. Confirmed live defect
 * (docs/STRIDETO_EMPLOYER_TO_USER_STAGE_SYNC_LIVE_VERIFICATION.md): the
 * stage-change notification link fell back through
 * `legacyApplicationId`/`event.aggregateId` — both Employer-facing Application
 * identifiers — whenever `opportunityApplicationId` was unavailable, landing
 * the User on an unresolvable `/applications/:id` route.
 *
 * Source-contract style, matching this repo's established convention for
 * this file's own event-bus wiring (no DB harness exists for it); regression
 * assertions reuse the same convention as the sibling
 * jobApplicationNotificationLink.test.js, which already proves the
 * apply-time path this fix now mirrors.
 *
 * Run: node src/__tests__/careerNotificationLinkFallback.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const bridge = read('services/career/careerNotificationBridge.js');
const handlerStart = bridge.indexOf('export function registerCareerNotificationHandlers');
const handlerBody = bridge.slice(handlerStart);

// --- 1/2. Linked tracker route and missing-link fallback ---
{
  check(
    /const opportunityApplicationId = event\.payload\?\.opportunityApplicationId \|\| null;/.test(handlerBody),
    '1/2. applicationId resolution reads only event.payload.opportunityApplicationId, defaulting to null'
  );
  check(
    /link: opportunityApplicationId \? `\/applications\/\$\{opportunityApplicationId\}` : '\/applications',/.test(handlerBody),
    "1/2. link is '/applications/<opportunityApplicationId>' when present, '/applications' (safe generic User route) when absent"
  );
}

// --- 3/4. legacyApplicationId and aggregateId are never inserted into the User route ---
{
  const resolutionLine = handlerBody.slice(
    handlerBody.indexOf('const opportunityApplicationId ='),
    handlerBody.indexOf(';', handlerBody.indexOf('const opportunityApplicationId =')) + 1
  );
  check(
    !/legacyApplicationId/.test(resolutionLine),
    '3. The applicationId resolution expression itself no longer references legacyApplicationId — cannot be used as a link fallback (the code comment above it may still name it for context, which is expected)'
  );
  check(
    !/event\.aggregateId/.test(resolutionLine),
    '4. The applicationId resolution expression itself no longer references event.aggregateId — cannot be used as a link fallback'
  );
}

// --- 5. Notification is still created when tracker linkage is absent (unconditional notifyUser call) ---
{
  check(
    /if \(!userId\) return;\s*\n[\s\S]*?const opportunityApplicationId[\s\S]*?try \{\s*await notifyUser\(userId, \{/.test(handlerBody),
    '5. notifyUser is still called unconditionally (not gated on opportunityApplicationId truthiness) — a missing tracker link no longer suppresses the notification'
  );
}

// --- 6. Recipient resolution unchanged ---
{
  check(
    /const userId = resolveNotifyUserId\(event\);/.test(handlerBody) && /await notifyUser\(userId, \{/.test(handlerBody),
    '6. Recipient is still resolved via resolveNotifyUserId and passed unchanged to notifyUser'
  );
}

// --- 7. Notification type/category unchanged ---
{
  check(
    /category: event\.eventType === 'InterviewScheduled' \|\| event\.eventType === 'InterviewCompleted'\s*\?\s*'interview'\s*:\s*'application',/.test(
      handlerBody
    ),
    '7. category logic is byte-identical to before this fix'
  );
  check(/type: `career\.\$\{event\.eventType\}`,/.test(handlerBody), '7. type is byte-identical to before this fix');
}

// --- Metadata stays consistent with the link (no stale legacy id left behind in metadata either) ---
{
  check(
    /applicationId: opportunityApplicationId \? String\(opportunityApplicationId\) : null,/.test(handlerBody),
    'metadata.applicationId now reflects the same opportunityApplicationId used for the link, never a legacy id'
  );
}

// --- 8. Employer stage event payload (the emitting side) is untouched by this fix ---
{
  const employerService = read('services/career/EmployerIntelligenceService.js');
  check(
    /opportunityApplicationId: oa\?\._id \? String\(oa\._id\) : null,/.test(employerService),
    "8. EmployerIntelligenceService.js's emitted event payload shape is unchanged — this fix only changed how the bridge reads it, not what is emitted"
  );
}

// --- 10/11. Dual-write enable/disable behavior untouched by this fix ---
{
  const migrationService = read('services/career/migration/ApplicationMigrationService.js');
  check(
    /if \(!isApplicationDualWrite\(\)\) return null;/.test(migrationService),
    '11. The dual-write disabled early-return is unchanged — still a clean no-op, not touched by this notification-only fix'
  );
  check(
    /legacyApplicationId: legacy\._id,/.test(migrationService) &&
      /findByTalentAndOpportunity\(/.test(migrationService),
    '10. The dual-write enabled path (atomic legacyApplicationId linkage, existing-tracker reuse) is unchanged'
  );
}

// --- 12. User->Employer reverse synchronization remains absent ---
{
  const oaService = read('services/career/OpportunityApplicationService.js');
  const transitionStart = oaService.indexOf('async transitionStage(');
  const transitionEnd = oaService.indexOf('\n  async ', transitionStart + 1);
  const transitionBody = oaService.slice(transitionStart, transitionEnd === -1 ? undefined : transitionEnd);
  check(
    !/Application\.(updateOne|updateMany|findByIdAndUpdate|findOneAndUpdate|create)/.test(transitionBody),
    "12. OpportunityApplicationService.transitionStage still never writes to the legacy Application model — User->Employer sync remains absent, unaffected by this fix"
  );
}

console.log(`careerNotificationLinkFallback.test.js: ${count} assertions passed`);

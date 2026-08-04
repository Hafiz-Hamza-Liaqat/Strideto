/**
 * PF-HIRE-B4-R1 — close the two remaining runtime application-destination
 * validation bypasses found during the PF-HIRE-B1 alternate-writer
 * preflight: importHandlers.js's importJobs (arbitrary staff-uploaded
 * CSV/XLSX/JSON) and scraperService.js's scraper ingestion loop (arbitrary
 * third-party scraped content). Neither called validateApplicationLink
 * before this phase.
 *
 * Source-contract style, matching this repo's established convention for
 * these DB-backed services (no test-Mongo harness exists for them).
 *
 * Run: node src/__tests__/jobDestinationImportScraperValidation.test.js
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

const importHandlers = read('services/importHandlers.js');
const scraperService = read('services/scraperService.js');

// ---- IMPORT WRITER ----

// 1/2/11. Same rawLink precedence preserved (applicationLink, then link, then empty), now validated
{
  check(
    /const rawLink = row\.applicationLink \|\| row\.link \|\| '';/.test(importHandlers),
    '1/2/11. importJobs still resolves rawLink from applicationLink first, then link, preserving existing precedence, before validating it'
  );
}

// Import wires the canonical validator
{
  check(
    /import \{ validateApplicationLink \} from '\.\.\/utils\/jobApplicationDestination\.js';/.test(importHandlers),
    'importHandlers.js imports the canonical PF-HIRE-B4 validator'
  );
}

// 3-6. Validation runs before Job.create — any unsafe scheme (javascript:/data:/vbscript:/file:) or
// protocol-relative/malformed value is rejected by validateApplicationLink itself (proven executable
// in jobApplicationDestinationValidation.test.js); here we prove importJobs actually gates on it.
{
  const fnBody = importHandlers.slice(
    importHandlers.indexOf('async function importJobs'),
    importHandlers.indexOf('async function importScholarships')
  );
  const validateIdx = fnBody.indexOf('validateApplicationLink(rawLink)');
  const createIdx = fnBody.indexOf('await Job.create(');
  check(validateIdx !== -1 && createIdx !== -1 && validateIdx < createIdx, '3-6. importJobs validates before Job.create — no unsafe row can reach persistence');
}

// 7. Row-level continuation preserved: rejection path uses `continue`, not throw/return that would abort the whole import
{
  const fnBody = importHandlers.slice(
    importHandlers.indexOf('async function importJobs'),
    importHandlers.indexOf('async function importScholarships')
  );
  check(
    /if \(!linkResult\.ok\) \{\s*recordError\(report, i, `\$\{linkResult\.field\}: \$\{linkResult\.message\}`, redactDestinationFields\(row\)\);\s*continue;\s*\}/.test(fnBody),
    '7. An invalid row is recorded and the loop continues to the next row — the established per-row try/catch/continue contract is preserved, not replaced with a fail-fast abort'
  );
}

// 8/9. Invalid row is represented safely: field-prefixed message, redacted row data, no raw parser stack
{
  check(
    importHandlers.includes('function redactDestinationFields(row)'),
    '9. A dedicated redaction helper exists and strips applicationLink/link before the row is echoed into the import report'
  );
  check(
    /redacted\.applicationLink = '\[redacted\]';/.test(importHandlers) && /redacted\.link = '\[redacted\]';/.test(importHandlers),
    '9. Both possible destination-field names are redacted, not just one'
  );
  check(
    !/console\.(log|error|warn)\(.*rawLink/.test(importHandlers),
    '9. The raw destination value is never passed to a console logger'
  );
}

// 10. Auto-approval cannot occur for a rejected row: Job.create (which sets approvalStatus:'approved') is unreachable when linkResult.ok is false
{
  const fnBody = importHandlers.slice(
    importHandlers.indexOf('async function importJobs'),
    importHandlers.indexOf('async function importScholarships')
  );
  const continueIdx = fnBody.indexOf('continue;', fnBody.indexOf('!linkResult.ok'));
  const approvalIdx = fnBody.indexOf("approvalStatus: 'approved'");
  check(continueIdx !== -1 && approvalIdx !== -1 && continueIdx < approvalIdx, "10. The rejection path's `continue` occurs before the line that sets approvalStatus:'approved' — an invalid row can never reach that assignment");
}

// 12. applyEmail is not silently introduced — importJobs still does not read/persist applyEmail (not part of this import contract)
{
  check(!/applyEmail/.test(importHandlers), '12. importJobs does not accept or persist applyEmail — no new functionality added beyond destination validation');
}

// ---- SCRAPER WRITER ----

check(
  /import \{ validateApplicationLink \} from '\.\.\/utils\/jobApplicationDestination\.js';/.test(scraperService),
  'scraperService.js imports the canonical PF-HIRE-B4 validator'
);

// 13/16. Validation runs before Job.create
{
  const validateIdx = scraperService.indexOf("validateApplicationLink(j.applicationLink || '')");
  const createIdx = scraperService.indexOf('await Job.create(');
  check(validateIdx !== -1 && createIdx !== -1 && validateIdx < createIdx, '13/16. Scraper validates before Job.create — Job.create is never reached for an unsafe/empty destination');
}

// 14/15/20. Unsafe or empty destination is skipped via `continue` (loop-scoped), not thrown (which would abort the whole source's remaining items)
{
  const loopBody = scraperService.slice(scraperService.indexOf('for (const j of jobs)'), scraperService.indexOf('await ScraperConfig.findOneAndUpdate'));
  check(
    /if \(!linkResult\.ok \|\| !linkResult\.value\) \{\s*jobsSkipped\+\+;\s*errors\.push\(`\$\{sourceKey\}: invalid_application_destination`\);\s*continue;\s*\}/.test(loopBody),
    '14/15/20. Both unsafe AND empty destinations are rejected via `continue` inside the per-job loop — remaining jobs from the same source, and all other sources, keep processing (the outer try/catch is never triggered by this path)'
  );
}

// 17. Safe failure category recorded, not the raw URL
{
  check(
    scraperService.includes('invalid_application_destination') && !/errors\.push\(`\$\{sourceKey\}: \$\{j\.applicationLink/.test(scraperService),
    '17. Only the safe category string is pushed to errors — the raw scraped applicationLink is never interpolated into it'
  );
}

// 18. Full unsafe URL/payload is not logged anywhere in the corrected block
{
  const loopBody = scraperService.slice(scraperService.indexOf('for (const j of jobs)'), scraperService.indexOf('await ScraperConfig.findOneAndUpdate'));
  check(!/console\.(log|error|warn)/.test(loopBody), '18. No console logging of any kind was added to the per-job loop');
}

// 19. Duplicate handling unchanged: both externalId and title/org/deadline duplicate checks still precede the new destination check in source order
{
  const loopBody = scraperService.slice(scraperService.indexOf('for (const j of jobs)'), scraperService.indexOf('await ScraperConfig.findOneAndUpdate'));
  const dupIdx1 = loopBody.indexOf('existingExternalIds.has(j.externalId)');
  const dupIdx2 = loopBody.indexOf('isDuplicateByTitleOrgDeadline');
  const destIdx = loopBody.indexOf('invalid_application_destination');
  check(dupIdx1 !== -1 && dupIdx2 !== -1 && destIdx !== -1 && dupIdx1 < destIdx && dupIdx2 < destIdx, '19. Both pre-existing duplicate checks still run before the new destination-validation check, unchanged in order or logic');
}

// applyType/applyEmail: scraper still hardcodes applyType:'external' unchanged, and does not persist applyEmail
{
  check(/applyType: 'external',/.test(scraperService), "applyType:'external' remains hardcoded and unmodified for scraped Jobs");
  check(
    !/applyEmail/.test(scraperService),
    'scraperService.js does not accept or persist applyEmail — no new functionality added beyond destination validation'
  );
}

// applicationLink now uses the validated/normalized value, not the raw scraped field, at the Job.create call site
{
  check(
    /applicationLink: linkResult\.value,/.test(scraperService),
    "Job.create's applicationLink now uses the validated, normalized linkResult.value rather than the raw j.applicationLink"
  );
}

console.log(`jobDestinationImportScraperValidation.test.js: ${count} assertions passed`);

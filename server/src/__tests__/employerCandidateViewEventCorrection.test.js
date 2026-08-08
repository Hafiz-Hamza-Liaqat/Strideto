/**
 * PF-EMP-UX-B2 — candidate-detail entry records one CandidateViewed event,
 * while same-mount duplicate effects and in-page refreshes explicitly do not.
 * Source-contract style matches the repository's existing client-page tests;
 * the exported query-intent helper is also exercised directly.
 *
 * Run: node src/__tests__/employerCandidateViewEventCorrection.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldRecordCandidateView } from '../controllers/career/employerIntelligenceController.js';

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(here, '..');
const repoRoot = path.resolve(serverSrc, '..', '..');
const clientSrc = path.resolve(repoRoot, 'client', 'src');

const page = readFileSync(path.join(clientSrc, 'pages/Employer/EmployerCandidateDetail.jsx'), 'utf8');
const api = readFileSync(path.join(clientSrc, 'services/employerService.js'), 'utf8');
const controller = readFileSync(
  path.join(serverSrc, 'controllers/career/employerIntelligenceController.js'),
  'utf8'
);
const routes = readFileSync(path.join(serverSrc, 'routes/employerIntelligence.js'), 'utf8');
const service = readFileSync(path.join(serverSrc, 'services/career/EmployerIntelligenceService.js'), 'utf8');
const bridge = readFileSync(path.join(serverSrc, 'services/career/careerEmployerBridge.js'), 'utf8');

const detailFn = service.slice(
  service.indexOf('async getCandidateDetail('),
  service.indexOf('async getPipeline(')
);
const transitionFn = service.slice(
  service.indexOf('async transitionPipeline('),
  service.indexOf('async addNote(')
);
const addNoteFn = service.slice(service.indexOf('async addNote('), service.indexOf('async scheduleInterview('));
const scheduleFn = service.slice(
  service.indexOf('async scheduleInterview('),
  service.indexOf('async completeInterview(')
);
const completeFn = service.slice(
  service.indexOf('async completeInterview('),
  service.indexOf('async listSavedFilters(')
);

// Server intent parsing preserves the historical GET default while honoring
// the explicit no-record signal used by in-page refreshes.
check(shouldRecordCandidateView({}) === true, '1. An omitted recordView query retains the recording default');
check(
  shouldRecordCandidateView({ recordView: 'true' }) === true,
  '2. An explicit page-entry recordView=true records the visit'
);
check(
  shouldRecordCandidateView({ recordView: 'false' }) === false,
  '3. An explicit in-page recordView=false suppresses the view event'
);
check(
  shouldRecordCandidateView({ recordView: false }) === true,
  '4. Only the HTTP query string value "false" changes the backward-compatible server default'
);
check(
  /getCandidateDetail\(employerIdFrom\(req\), req\.params\.id, \{[\s\S]*recordView: shouldRecordCandidateView\(req\.query\)/.test(
    controller
  ),
  '5. The authenticated controller passes explicit record intent into the service'
);
check(
  /get\('\/employer\/intelligence\/candidates\/:id', \.\.\.auth, getCandidateDetail\)/.test(routes),
  '6. Candidate detail remains GET /employer/intelligence/candidates/:id behind the unchanged auth chain'
);

// Client entry and StrictMode behavior.
check(
  /import \{[^}]*\buseRef\b[^}]*\} from 'react';/.test(page),
  '7. Candidate detail imports useRef (order-independent) so the entry guard can be per-mounted-instance'
);
check(
  /const recordedEntryForId = useRef\(null\);/.test(page),
  '8. The entry guard starts empty on each component mount'
);
check(
  /const recordView = recordedEntryForId\.current !== id;[\s\S]*recordedEntryForId\.current = id;[\s\S]*refresh\(\{ recordView \}\)/.test(
    page
  ),
  '9. Record intent is derived by comparing the guard ref to the current ID, and the ref is assigned before the request is issued — so a repeated effect for the same ID within one mount resolves to no-record (source-level check; no DOM runner exists in this repository to exercise StrictMode directly)'
);
check(
  /intelligenceCandidate: \(id, \{ recordView = false \} = \{\}\)/.test(api),
  '10. The API wrapper fails safe to no-record for ambiguous/background callers'
);
check(
  /params: \{ recordView \}/.test(api),
  '11. Record intent is transported explicitly as a query parameter without changing the response contract'
);
check(
  /const refresh = \(\{ recordView = false \} = \{\}\)/.test(page),
  '12. Candidate data refresh defaults to no-record within the mounted page'
);
{
  // PF-EMP-INT-B3 added a third mutation refresh (interview completion). The invariant
  // is not the count but that *every* awaited refresh suppresses the view event, so
  // assert the two are equal rather than pinning a number a new handler would break.
  const suppressed = (page.match(/await refresh\(\{ recordView: false \}\);/g) || []).length;
  const awaited = (page.match(/await refresh\(/g) || []).length;
  check(
    suppressed === awaited && suppressed === 3,
    '13. Note-add, interview-save and interview-completion refreshes all explicitly suppress CandidateViewed'
  );
}
check(
  /intelligenceTransitionStage\(id, \{ toStage: stage \}\)[\s\S]*setCandidate\(data\.data\)/.test(page),
  '14. Stage updates still reconcile candidate data from the mutation response without a recording GET'
);
check(
  !/addEventListener\(['"](?:focus|visibilitychange)/.test(page),
  '15. No focus/visibility refresh exists on this page; none can accidentally record a view'
);
check(
  /const \{ id \} = useParams\(\);/.test(page),
  '16. Route navigation still derives the candidate ID from the existing route parameter'
);
check(
  /to=\{ROUTES\.EMPLOYER_INTELLIGENCE_CANDIDATES\}/.test(page),
  '17. Candidate-detail back navigation remains unchanged and functional'
);

// Service event and ownership semantics.
check(
  /\{ recordView = true \} = \{\}/.test(detailFn),
  '18. Direct/backward-compatible service callers retain the historical recording default'
);
check(
  /if \(recordView\) \{[\s\S]*'CandidateViewed'/.test(detailFn),
  '19. CandidateViewed publication is conditional on explicit record intent'
);
check(
  detailFn.indexOf('await getOwnedLegacyApplication') < detailFn.indexOf("'CandidateViewed'"),
  '20. Employer ownership is resolved before CandidateViewed can be published'
);
check(
  detailFn.indexOf("if (!card)") < detailFn.indexOf("'CandidateViewed'"),
  '21. A missing candidate profile fails before CandidateViewed publication'
);
check(
  /return \{ \.\.\.card, ranking \};/.test(detailFn),
  '22. Candidate-detail service response shape remains the same card-plus-ranking object'
);
check(
  /res\.json\(\{ data \}\);/.test(controller),
  '23. Candidate-detail HTTP response remains wrapped as { data }'
);
{
  // Pre-existing staleness, failing at HEAD (7bc31d4) and unrelated to PF-EMP-INT-B3:
  // transitionPipeline stopped `return`ing the reconciliation read and now takes
  // before/after snapshots. The invariant being protected is that *every* detail read
  // on this path is explicitly no-record, so assert that rather than the return form.
  const reads = transitionFn.match(/this\.getCandidateDetail\([^)]*\)/g) || [];
  check(reads.length > 0, '24. Stage transition still reconciles candidate detail');
  check(
    reads.every((r) => /\{ recordView: false \}/.test(r)),
    '24. Stage-transition detail reconciliation remains explicitly no-record'
  );
}
check(
  !/getCandidateDetail/.test(addNoteFn),
  '25. Note mutation itself does not perform a hidden recording detail read'
);
check(
  !/getCandidateDetail/.test(scheduleFn),
  '26. Interview scheduling itself does not perform a hidden recording detail read'
);
check(
  /getCandidateDetail\(employerId, legacyApplicationId, \{ recordView: false \}\)/.test(completeFn),
  '27. Interview completion returns refreshed detail with recording disabled'
);

// Preservation: no global/timing dedup, history rewrite, Job views, notification,
// or pipeline/application synchronization change is introduced.
check(
  !/setTimeout|within.*seconds|dedup/i.test(detailFn),
  '28. The correction uses caller intent, not timing-based global deduplication'
);
check(
  !/TimelineEvent\.(delete|update)|deleteMany|updateMany/.test(detailFn),
  '29. Existing stored duplicate timeline events are never modified or deleted'
);
check(
  /CandidateViewed: 'employer_candidate_viewed'/.test(bridge),
  '30. Legitimate distinct CandidateViewed events continue through the existing timeline/analytics event bridge'
);
check(
  !/Job\.|\$inc|views/.test(detailFn),
  '31. CandidateViewed detail handling does not read or mutate Job view counts'
);
check(
  !/Notification|notify|sendEmail/.test(detailFn),
  '32. CandidateViewed detail handling creates no notification or email'
);
check(
  !/onApplicationStatusChange\(application\)/.test(transitionFn)
    && /applicationId: application\._id/.test(transitionFn)
    && /await onApplicationStatusChange\(/.test(transitionFn),
  '33. Application synchronization after stage transition remains present, now correlated to the real Application id (PF-EMP-UX-B5B — never the raw Mongoose document)'
);
check(
  /visibility: body\.visibility === 'private' \? 'private' : 'employer_scoped'/.test(addNoteFn),
  '34. Employer-note privacy remains unchanged'
);
check(
  /recordedEntryForId\.current !== id/.test(page),
  '35. A different ID or a fresh route remount can record a later legitimate page entry'
);

console.log(`employerCandidateViewEventCorrection.test.js: ${count} assertions passed`);

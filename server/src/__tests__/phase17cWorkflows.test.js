import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { coerceCountryCode } from '../../../shared/international/country.js';
import { INSTITUTION_ADMISSION_TRANSITIONS, ADMISSION_STATES } from '../../../shared/institution/institutionPortal.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

{
  check(coerceCountryCode('Turkey') === 'TR' || coerceCountryCode('TR') === 'TR', 'Home/Intl country contract uses ISO codes');
  const home = read('client/src/pages/Home/Home.jsx');
  check(/\?country=TR/.test(home) && /\?country=DE/.test(home), 'Home international scholarship links use ISO country codes');
  const intl = read('client/src/pages/IntlScholarships/IntlScholarships.jsx');
  check(/CountrySelect/.test(intl) && /setSearchParams/.test(intl), 'Intl Scholarships initializes and writes country from the URL');
  check(!/COUNTRIES = \['UK'/.test(intl), 'hardcoded Intl Scholarship country list removed');
}

{
  const allowed = INSTITUTION_ADMISSION_TRANSITIONS[ADMISSION_STATES.RECEIVED];
  check(allowed.has(ADMISSION_STATES.UNDER_REVIEW), 'received can move to under_review');
  check(!allowed.has(ADMISSION_STATES.ADMITTED), 'received cannot jump to admitted');
  const apps = read('client/src/pages/Institution/InstitutionApplications.jsx');
  check(/INSTITUTION_ADMISSION_TRANSITIONS/.test(apps), 'Institution UI filters destination states from current status');
}

{
  const dash = read('server/src/services/institutionPortalService.js');
  check(/intakeCount/.test(dash), 'Institution dashboard metrics include server-derived intake count');
}

{
  const services = read('client/src/pages/Agent/AgentServices.jsx');
  check(/MultiSelect/.test(services) && /coerceCountryCode/.test(services), 'Agent services use ISO multi-select');
  check(!/comma separated/.test(services), 'Agent services no longer author countries as CSV');
}

{
  const leadsSvc = read('server/src/services/agentProfileService.js');
  const leadsUi = read('client/src/pages/Agent/AgentLeads.jsx');
  check(/displayName/.test(leadsSvc) && /User\.find/.test(leadsSvc), 'leads project a person name without populate/Vault');
  check(/lead\.displayName/.test(leadsUi) && !/Relationship \{lead\._id\}/.test(leadsUi), 'Agent Leads do not show raw Mongo id as the title');
}

{
  const nav = read('client/src/config/studentNavConfig.js');
  const saved = read('client/src/pages/SavedJobs/SavedJobs.jsx');
  const docs = read('client/src/dashboard/widgets/DocumentsWidget.jsx');
  check(/STUDENT_INSTITUTION_ADMISSIONS/.test(nav) && /PERSONALIZATION_HUB/.test(nav), 'Student More group surfaces Institution applications and Eligibility');
  check(/JOURNEY_SAVED/.test(saved) && /Navigate/.test(saved), 'legacy /saved-jobs redirects to canonical journey/saved');
  check(/ROUTES\.VAULT/.test(docs), 'Documents widget points at canonical Vault');
}

console.log(`phase17cWorkflows.test.js: ${count} assertions passed`);

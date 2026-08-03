import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * PF-B — application tracker completion (internship tracking, edit UI,
 * calendar view). Same convention as the other client tests: no jsdom/DOM
 * runner exists in this repo, so these checks prove the contract directly
 * against the shipped source text.
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

const internshipDetail = read('pages/Internships/InternshipDetail.jsx');
const editPanel = read('components/applications/ApplicationEditPanel.jsx');
const applicationDetail = read('pages/Applications/ApplicationDetail.jsx');
const calendarView = read('components/applications/ApplicationCalendarView.jsx');
const myApplications = read('pages/Applications/MyApplications.jsx');

// --- Internship manual creation already supported (unchanged, verified) ---
{
  const applicationUi = read('utils/applicationUi.js');
  check(
    /OPPORTUNITY_TYPE_FILTERS = \['all', 'job', 'scholarship', 'admission', 'internship'\]/.test(applicationUi),
    'applicationUi.js: internship is already a first-class filter/create type'
  );
}

// --- Internship listing tracking: same pattern as JobDetail.handleTrackApplication ---
{
  check(
    /import \{ applicationsApi as oaApi \} from '\.\.\/\.\.\/services\/applicationsApi'/.test(internshipDetail),
    'InternshipDetail.jsx: imports the opportunity-application tracker API'
  );
  check(
    /const handleTrackApplication = async \(\) => \{/.test(internshipDetail),
    'InternshipDetail.jsx: defines a track-application handler'
  );
  check(
    /opportunityType: 'internship'/.test(internshipDetail),
    "InternshipDetail.jsx: tracks using opportunityType: 'internship'"
  );
  check(
    /opportunityId: internship\._id/.test(internshipDetail),
    'InternshipDetail.jsx: tracks against the real internship listing id'
  );
  check(
    /const existingId = err\.response\?\.data\?\.applicationId \|\| err\.response\?\.data\?\.id;/.test(internshipDetail),
    'InternshipDetail.jsx: reuses the existing duplicate-tracking protection (409 applicationId)'
  );
  check(
    /isOpportunityApplicationEnabled\(\)/.test(internshipDetail),
    'InternshipDetail.jsx: track action respects the existing feature flag'
  );
  check(
    /onClick=\{handleTrackApplication\}/.test(internshipDetail),
    'InternshipDetail.jsx: a real button is wired to the track handler'
  );
}

// --- Edit UI: prefilled, saves via existing update endpoint, cancel is a no-op ---
{
  check(
    /const \[title, setTitle\] = useState\(application\.title \|\| ''\)/.test(editPanel)
      && /const \[companyName, setCompanyName\] = useState\(application\.companyName \|\| ''\)/.test(editPanel)
      && /const \[externalUrl, setExternalUrl\] = useState\(application\.externalUrl \|\| ''\)/.test(editPanel),
    'ApplicationEditPanel.jsx: fields are prefilled from the existing application record'
  );
  check(
    /await onSave\(\{\s*title: title\.trim\(\),\s*companyName: companyName\.trim\(\),\s*externalUrl: externalUrl\.trim\(\),\s*\}\);/.test(editPanel),
    'ApplicationEditPanel.jsx: only sends the fields the PATCH contract actually persists (title, companyName, externalUrl)'
  );
  check(
    !/opportunityType:|pipelineStage:|appliedAt:|notes:/.test(editPanel),
    'ApplicationEditPanel.jsx: does not invent fields unsupported by the update endpoint'
  );
  check(
    /function cancelEdit\(\)/.test(editPanel) && !/cancelEdit[\s\S]{0,120}onSave/.test(editPanel),
    'ApplicationEditPanel.jsx: cancel resets local state without calling onSave (no mutation)'
  );
  check(
    /role="alert"/.test(editPanel),
    'ApplicationEditPanel.jsx: validation/save errors are surfaced accessibly'
  );
  check(
    /import \{ ApplicationEditPanel \} from '\.\.\/\.\.\/components\/applications\/ApplicationEditPanel'/.test(applicationDetail)
      && /applicationsApi\.update\(id, body\)/.test(applicationDetail)
      && /afterMutation\(applicationsApi\.update\(id, body\)\)/.test(applicationDetail),
    'ApplicationDetail.jsx: wires the edit panel to the existing update endpoint and reloads afterwards (metrics/view refresh)'
  );
}

// --- Calendar: real month view replacing the placeholder ---
{
  check(
    !/calendarPlaceholder/.test(myApplications),
    'MyApplications.jsx: placeholder Calendar box has been removed'
  );
  check(
    /import \{ ApplicationCalendarView \} from '\.\.\/\.\.\/components\/applications\/ApplicationCalendarView'/.test(myApplications)
      && /<ApplicationCalendarView applications=\{visible\} \/>/.test(myApplications),
    'MyApplications.jsx: Calendar view renders the same filtered/sorted list as List/Kanban/Table'
  );
  check(
    /setCursor\(\(c\) => new Date\(c\.getFullYear\(\), c\.getMonth\(\) - 1, 1\)\)/.test(calendarView)
      && /setCursor\(\(c\) => new Date\(c\.getFullYear\(\), c\.getMonth\(\) \+ 1, 1\)\)/.test(calendarView),
    'ApplicationCalendarView.jsx: month navigation moves the displayed month by exactly one'
  );
  check(
    /aria-label=\{t\('applications:calendar\.prevMonth'/.test(calendarView)
      && /aria-label=\{t\('applications:calendar\.nextMonth'/.test(calendarView),
    'ApplicationCalendarView.jsx: month navigation buttons have accessible labels'
  );
  check(
    /function dayKey\(d\)/.test(calendarView) && /eventsByDay\.get\(key\)/.test(calendarView),
    'ApplicationCalendarView.jsx: entries are grouped onto their correct calendar day'
  );
  check(
    /if \(app\.appliedAt\)/.test(calendarView)
      && /if \(app\.interview\?\.scheduledAt\)/.test(calendarView)
      && /if \(r\.remindAt\)/.test(calendarView),
    'ApplicationCalendarView.jsx: only uses dates the model actually supports (appliedAt, interview.scheduledAt, reminder remindAt)'
  );
  check(
    /\.filter\(\(e\) => !Number\.isNaN\(e\.date\.getTime\(\)\)\)/.test(calendarView),
    'ApplicationCalendarView.jsx: records without a valid date are dropped, never fabricated'
  );
  check(
    /eventsByDay\.size === 0/.test(calendarView) && /calendar\.empty/.test(calendarView),
    'ApplicationCalendarView.jsx: shows an explicit empty-month state'
  );
  check(
    /to=\{`\$\{ROUTES\.APPLICATIONS\}\/\$\{e\.app\._id\}`\}/.test(calendarView),
    'ApplicationCalendarView.jsx: selecting an entry opens the existing application detail/edit page'
  );
  check(
    /stageBadgeClass\(e\.app\.pipelineStage\)/.test(calendarView) && /typeLabel/.test(calendarView),
    'ApplicationCalendarView.jsx: entries are visually identifiable by stage (color) and type (label)'
  );
  check(
    /overflow-x-auto/.test(calendarView),
    'ApplicationCalendarView.jsx: grid scrolls horizontally on narrow viewports (responsive, matches ApplicationTable convention)'
  );
}

// --- Regression: List/Kanban/Table and Job/Scholarship/Admission wiring untouched ---
{
  check(
    /view === 'list'/.test(myApplications) && /view === 'kanban'/.test(myApplications) && /view === 'table'/.test(myApplications),
    'MyApplications.jsx: List/Kanban/Table view switching is unchanged'
  );
  check(
    /ApplicationKanbanBoard applications=\{visible\}/.test(myApplications) && /ApplicationTable applications=\{visible\}/.test(myApplications),
    'MyApplications.jsx: Kanban/Table still receive the same filtered/sorted applications array'
  );
}

console.log(`applicationTrackerCompletion.test.js: ${count} assertions passed`);

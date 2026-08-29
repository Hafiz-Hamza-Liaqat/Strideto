/**
 * STRIDETO MKT-P4 — application communication & interview workflow contracts.
 * Run: node src/__tests__/mktP4ApplicationCommunication.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APPLICATION_MESSAGE_MAX_LENGTH,
  APPLICATION_MESSAGE_TYPES,
  INTERVIEW_INVITATION_METHODS,
  INTERVIEW_INVITATION_STATUSES,
} from '../../../shared/employer/applicationCommunication.js';
import { validateInterviewMeetingUrl } from '../utils/interviewMeetingUrl.js';
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

const service = read('services/applicationCommunicationService.js');
const controller = read('controllers/applicationCommunicationController.js');
const employerRoutes = read('routes/employer.js');
const candidateRoutes = read('routes/opportunityApplications.js');
const employerDetail = readClient('pages/Employer/EmployerApplicationDetail.jsx');
const candidateDetail = readClient('pages/Applications/ApplicationDetail.jsx');
const panel = readClient('components/applications/ApplicationCommunicationPanel.jsx');
const analytics = readClient('components/employer/applicant/applicationCommunicationAnalytics.js');
const automation = read('services/automationService.js');

check(APPLICATION_MESSAGE_MAX_LENGTH === 4000, 'MKT-P4: message max length 4000 matches employer note convention');
check(APPLICATION_MESSAGE_TYPES.includes('message'), 'MKT-P4: message type enum');
check(INTERVIEW_INVITATION_STATUSES.includes('pending'), 'MKT-P4: invitation status pending');
check(INTERVIEW_INVITATION_METHODS.join(',') === 'video,phone,in_person', 'MKT-P4: interview methods');

check(
  /getOwnedApplicationForEmployer\(employerId, applicationId\)/.test(service) &&
    /application\.jobId\?\.employerId/.test(service),
  'MKT-P4-SEC01/03: employer authorization via job ownership'
);
check(
  /getOwnedApplicationForCandidate\(userId/.test(service) &&
    /String\(candidateId\) !== String\(userId\)/.test(service),
  'MKT-P4-SEC05/06: candidate authorization via application.userId'
);
check(/resolveJobApplyType\(application\.jobId\) === 'external'/.test(service), 'MKT-P4-E02/I02: external hard block');
check(/clientMessageId/.test(service) && /isDuplicateKeyError/.test(service), 'MKT-P4-E08: idempotency via clientMessageId');
check(/normalizeMessageBody/.test(service), 'MKT-P4-E09/E10: server-side message validation');
check(/parseTimeZone\(body\.timeZone\)/.test(service), 'MKT-P4-I04: invalid timezone rejected');
check(/validateInterviewMeetingUrl/.test(service), 'MKT-P4-I06: meeting URL validation in service');

check(
  controller.includes("rejectUnexpectedBodyKeys(req.body, ['body', 'message', 'clientMessageId'])"),
  'MKT-P4-MASS: employer message whitelist'
);
check(
  /rejectUnexpectedBodyKeys\(req\.body, \[\s*'scheduledAt'/.test(controller),
  'MKT-P4-MASS: interview invitation whitelist'
);
check(
  /rejectUnexpectedBodyKeys\(req\.body, \['response', 'status'\]\)/.test(controller),
  'MKT-P4-MASS: candidate RSVP whitelist'
);

check(employerRoutes.includes("'/employer/applications/:id/communication'"), 'MKT-P4-E01: employer communication route');
check(employerRoutes.includes('applicationCommunicationLimiter'), 'MKT-P4-82: employer rate limit');
check(candidateRoutes.includes("'/applications/:id/communication'"), 'MKT-P4-C01: candidate communication route');

check(employerDetail.includes('EmployerApplicationCommunication'), 'MKT-P4-E01: employer detail communication section');
check(
  employerDetail.includes('listApplicationCommunication') && employerDetail.includes('sendApplicationMessage'),
  'MKT-P4-E06: employer uses API for messages'
);
check(
  candidateDetail.includes('legacyApplicationId') && candidateDetail.includes('CandidateApplicationCommunication'),
  'MKT-P4-C01: candidate communication gated on internal application'
);

check(!panel.includes('dangerouslySetInnerHTML'), 'MKT-P4-E05/81: no dangerouslySetInnerHTML in communication panel');
check(
  panel.includes('whitespace-pre-wrap') && panel.includes('{message.body}'),
  'MKT-P4-E05: message body rendered as escaped text'
);
check(
  panel.includes('communicationMessageSentInApp') || panel.includes('communicationMessageSent'),
  'MKT-P4-E06: truthful in-app success copy'
);
check(!panel.includes('Email sent'), 'MKT-P4-N03: UI does not claim email delivered');

check(
  analytics.includes('employer_candidate_message_intent') &&
    analytics.includes('employer_candidate_message_sent'),
  'MKT-P4-A01/A02: analytics action names present'
);
check(!analytics.includes('messageText'), 'MKT-P4-A08: no message text in analytics module');

check(
  validateInterviewMeetingUrl('javascript:alert(1)').ok === false,
  'MKT-P4-I06/81: javascript meeting URL rejected'
);
check(
  validateInterviewMeetingUrl('https://meet.example.com/room').ok === true,
  'MKT-P4-I06: https meeting URL accepted'
);

try {
  rejectUnexpectedBodyKeys({ senderId: 'evil', body: 'hi' }, ['body']);
  check(false, 'MKT-P4-MASS: unexpected senderId rejected');
} catch (err) {
  check(err.status === 400, 'MKT-P4-MASS: mass assignment returns 400');
}

check(
  automation.includes('queueNotification') && automation.includes('In-app persistence is authoritative'),
  'MKT-P4-N01: in-app notifications synchronous; email queued separately'
);
check(
  service.includes('queueInterviewInvitationEmail') &&
    service.includes('Boolean(emailResult?.enqueued)'),
  'MKT-P4-N02: interview emailQueued reflects actual queueEmail enqueue result'
);
check(
  !service.includes('notify: false'),
  'MKT-P4-N02: interview path no longer treats notify:false no-op as queued email'
);
check(
  read('templates/emailTemplates.js').includes('applicationCommunication'),
  'MKT-P4-N05: generic application communication email template'
);

const employerEn = readClient('i18n/locales/en/employer.json');
check(
  employerEn.includes('Interview invitation saved in STRIDETO') &&
    !employerEn.includes('The candidate has been notified'),
  'NOTIF-TRUTH: intelligence interview copy no longer claims notified'
);
check(
  read('services/career/OpportunityApplicationService.js').includes("note?.visibility !== 'employer_scoped'"),
  'PRIV-02: candidate note filter in projectStudentApplication'
);

console.log(`mktP4ApplicationCommunication.test.js (server): ${count} checks passed`);

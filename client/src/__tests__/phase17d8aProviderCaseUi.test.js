import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(src, rel), 'utf8');
}

const nav = read('config/agentNavConfig.js');
const layout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');
const list = read('pages/Agent/business-services/GbsCases.jsx');
const detail = read('pages/Agent/business-services/GbsCaseDetail.jsx');
const routes = read('routes/index.jsx');
const constants = read('constants/index.js');

check(nav.includes("label: 'Cases'"), 'Business nav Cases');
check(nav.includes("label: 'Quotes'"), 'Quotes preserved');
const bizItems = nav.split('const BUSINESS =')[1]?.split('const EDUCATION_GROUPS')[0] || '';
const bizWork = nav.split("id: 'business-work'")[1]?.split("id: 'business-setup'")[0] || '';
check(bizWork.includes("label: 'Work'"), 'sidebar WORK group exists');
check(
  bizWork.includes('AGENT_BUSINESS_SERVICES_REQUESTS')
  && bizWork.includes('AGENT_BUSINESS_SERVICES_QUOTES')
  && bizWork.includes('AGENT_BUSINESS_SERVICES_CASES'),
  'sidebar WORK routes include Requests Quotes Cases'
);
check(
  bizItems.includes("AGENT_BUSINESS_SERVICES_REQUESTS, label: 'Requests'")
  && bizItems.includes("AGENT_BUSINESS_SERVICES_QUOTES, label: 'Quotes'")
  && bizItems.includes("AGENT_BUSINESS_SERVICES_CASES, label: 'Cases'"),
  'sidebar Business items expose Requests Quotes Cases labels'
);
check(
  bizItems.indexOf("AGENT_BUSINESS_SERVICES_REQUESTS, label: 'Requests'")
    < bizItems.indexOf("AGENT_BUSINESS_SERVICES_QUOTES, label: 'Quotes'")
  && bizItems.indexOf("AGENT_BUSINESS_SERVICES_QUOTES, label: 'Quotes'")
    < bizItems.indexOf("AGENT_BUSINESS_SERVICES_CASES, label: 'Cases'"),
  'sidebar WORK order is Requests then Quotes then Cases'
);
check(!/\bSUBNAV\b/.test(layout) && !/label: 'Cases'/.test(layout), 'GbsWorkspaceLayout has no redundant workspace-global SUBNAV');
check(!/Payout|Mailroom|Formation Case|PDF/.test(nav + layout), 'no payment/payout/formation-case/PDF nav');
check(constants.includes("AGENT_CASES: '/agent/cases'"), 'education cases path unchanged');
check(constants.includes("AGENT_BUSINESS_SERVICES_CASES: '/agent/business-services/cases'"), 'GBS cases are not education cases');
check(nav.includes('AGENT_BUSINESS_SERVICES_CASES'), 'Business Cases stay on business-services cases route in nav');
check(!nav.includes("AGENT_CASES, label: 'Cases'") || bizItems.includes("AGENT_BUSINESS_SERVICES_CASES, label: 'Cases'"), 'Business Cases label remains on business-services cases route');

check(list.includes('No cases for this subject'), 'empty state');
check(list.includes('htmlFor="gbs-case-status"'), 'status filter labelled');
check(list.includes('View Case') && list.includes('Pagination'), 'list + pagination');
check(list.includes('do not have access') || list.includes('cases.manage'), 'view-only permission error');

check(detail.includes('Start preparation'), 'start preparation');
check(detail.includes('Request customer action') && detail.includes('htmlFor="gbs-task-key"'), 'task request form labelled');
check(detail.includes('Mark ready for submission') && detail.includes('open={readyOpen}'), 'ready confirmation');
check(detail.includes('Unable to proceed') && detail.includes('open={unableOpen}'), 'unable dialog');
check(detail.includes('htmlFor="gbs-unable-reason"'), 'unable reason labelled');
check(detail.includes('cases.manage duty'), 'writes require cases.manage');
check(detail.includes('View accepted quote') && detail.includes('View service request'), 'quote and request links');
check(detail.includes('does not submit anything to a government authority'), 'ready copy is not filing');
check(!/innerHTML|dangerouslySetInnerHTML/.test(detail), 'no raw HTML');
check(!/submitted-to-authority|authority result|Pay now|Upload documents|Chat/i.test(detail), 'no later-product controls');
check(detail.includes('role="alert"') || detail.includes('errorBox'), 'errors announced');
check(detail.includes('generic_professional_service') && detail.includes('Mark professional service complete'), 'generic completion is template-gated');

check(routes.includes('GbsCases') && routes.includes("path: 'cases'"), 'nested provider case routes');
check(routes.includes('GbsCaseDetail'), 'provider case detail route');

console.log(`phase17d8aProviderCaseUi.test.js: ${count} assertions passed`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('notification filters and Admin marketplace retain accessible route semantics', () => {
  const notifications = read('client/src/pages/Notifications/NotificationsPage.jsx');
  const marketplace = read('client/src/pages/Admin/AdminAgentMarketplace.jsx');
  assert.match(notifications, /<label[^>]*>[\s\S]*Read status[\s\S]*<select/);
  assert.match(notifications, /<label[^>]*>[\s\S]*Category[\s\S]*<select/);
  assert.match(notifications, /focus-visible:ring-2/);
  assert.match(marketplace, /<h1[^>]*>Agent marketplace moderation<\/h1>/);
  assert.match(marketplace, /dark:bg-gray-800/);
  assert.match(marketplace, /dark:bg-red-950/);
  assert.doesNotMatch(marketplace, /<h2[^>]*>Agent marketplace moderation<\/h2>/);
});

test('attention summaries are bounded, canonical, and do not add workflow models', () => {
  const education = read('server/src/controllers/agentController.js');
  const cases = read('server/src/services/caseManagementService.js');
  const provider = read('server/src/services/gbs/providerWorkspaceSummaryService.js');
  const buyer = read('server/src/controllers/gbsBuyerController.js');
  for (const source of [education, cases, provider, buyer]) assert.match(source, /limit:\s*5|\.limit\(5\)/);
  assert.match(education, /getProviderAttention/);
  assert.match(education, /CaseTask\.aggregate/);
  assert.doesNotMatch(education, /attentionCases[\s\S]*?\.limit\(50\)[\s\S]*?attentionCaseIds/);
  assert.match(cases, /studentUserId:\s*actorId/);
  assert.match(cases, /responsibleActor:\s*'student'/);
  assert.match(provider, /GbsServiceRequest\.find/);
  assert.match(provider, /GbsQuote\.find/);
  assert.match(provider, /GbsCase\.find/);
  assert.match(provider, /GbsContextThread\.find/);
  assert.match(buyer, /status:\s*'sent'/);
  assert.match(buyer, /status:\s*'awaiting_client'/);
  for (const source of [education, cases, provider, buyer]) {
    assert.doesNotMatch(source, /DashboardTask|AttentionQueue|BusinessProviderTask/);
  }
});

test('dashboard views expose truthful actions, canonical deep links, and route titles', () => {
  const education = read('client/src/pages/Agent/AgentDashboard.jsx');
  const student = read('client/src/pages/Cases/Cases.jsx');
  const provider = read('client/src/pages/Agent/business-services/GbsOverview.jsx');
  const buyer = read('client/src/pages/BusinessClient/BusinessClientOverview.jsx');
  const providerLayout = read('client/src/pages/Agent/business-services/GbsWorkspaceLayout.jsx');
  const buyerLayout = read('client/src/pages/BusinessClient/BusinessClientLayout.jsx');
  assert.match(education, /Needs your attention/);
  assert.match(student, /Your next actions/);
  assert.match(provider, /Operational attention/);
  assert.match(buyer, /Quote awaiting your decision/);
  assert.match(buyer, /Review Quote/);
  assert.match(buyer, /document exchange and filing authorization remain unavailable/);
  assert.match(providerLayout, /<SeoHead title=\{routeTitle\}/);
  assert.match(buyerLayout, /<SeoHead title=\{routeTitle\}/);
});

test('manifest favicon references are valid local static assets', () => {
  const manifest = JSON.parse(read('client/public/site.webmanifest'));
  for (const icon of manifest.icons) {
    const file = path.join(root, 'client/public', icon.src.replace(/^\//, ''));
    assert.equal(fs.existsSync(file), true, `${icon.src} exists`);
    assert.ok(fs.statSync(file).size > 0, `${icon.src} is non-empty`);
  }
});

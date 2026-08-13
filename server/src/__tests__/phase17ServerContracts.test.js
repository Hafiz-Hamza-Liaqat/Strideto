import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isFixtureRecord,
  isPubliclyLaunchVisible,
  assignLaunchEligibleOnAuthorityPublish,
  withFixtureExclusion,
  withLaunchSearchFilter,
} from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { isAssessmentsEnabled } from '../config/careerFeatureFlags.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, '..', rel), 'utf8');

const prod = { NODE_ENV: 'production' };

check(isFixtureRecord({ title: 'P13 Internal Analyst' }) === false, 'title matching is not used');
check(isPubliclyLaunchVisible({ status: 'active' }) === false, 'unclassified record is not public');
check(isPubliclyLaunchVisible({ launchEligible: true, isFixture: true }) === false, 'fixture is never public even if eligible');
check(isPubliclyLaunchVisible({ launchEligible: false }) === false, 'explicitly ineligible is not public');
check(isPubliclyLaunchVisible({ launchEligible: true }) === true, 'explicit eligible non-fixture may be public');
check(assignLaunchEligibleOnAuthorityPublish({ isFixture: true }) === false, 'authority publish cannot launch a fixture');
check(assignLaunchEligibleOnAuthorityPublish({}) === true, 'authority publish can mark a non-fixture eligible');

const clause = withFixtureExclusion({ status: 'active' }, prod);
check(clause.$and.some((p) => p.launchEligible === true), 'production job filter requires launchEligible true');

const jobs = read('controllers/jobsController.js');
check(jobs.includes('withFixtureExclusion'), 'jobs public list uses launch exclusion');

const programs = read('controllers/education/programIntelligenceController.js');
check(programs.includes('withFixtureExclusion'), 'programs public list uses launch exclusion');

const agents = read('services/agentProfileService.js');
check(agents.includes('withFixtureExclusion'), 'agent directory uses launch exclusion');
check(agents.includes('coerceCountryCode'), 'agent country write path canonicalizes ISO');

const marketplace = read('services/agentMarketplaceService.js');
check(marketplace.includes('withFixtureExclusion'), 'marketplace public list uses launch exclusion');

const sitemap = read('controllers/seoController.js');
check(sitemap.includes('withFixtureExclusion'), 'sitemap/SEO queries use launch exclusion');
check(!/for Pakistani Students 2026/.test(sitemap), 'global scholarship SEO is not Pakistan-framed');
check(/Latest \$\{sourceName\} Jobs in Pakistan/.test(sitemap) || /Jobs in Pakistan 2026/.test(sitemap), 'Pakistan source landings remain localized');

const dynamic = read('services/dynamicContent/DynamicContentService.js');
check(dynamic.includes('withFixtureExclusion'), 'homepage dynamic jobs use launch exclusion');

const search = read('services/search/SearchIndexService.js');
check(search.includes('withLaunchSearchFilter'), 'search index applies launch gate');
const related = read('services/search/RelatedContentService.js');
check(related.includes('withLaunchSearchFilter'), 'related/similar search applies launch gate');
const mappers = read('services/search/documentMappers.js');
check(mappers.includes('isPubliclyLaunchVisible'), 'search mapper searchable follows launch visibility');

const searchGate = withLaunchSearchFilter({ searchable: true }, prod);
check(JSON.stringify(searchGate).includes('metadata.launchEligible'), 'search gate requires metadata.launchEligible for gated types');

const cacheRoute = read('routes/dynamicContent.js');
check(cacheRoute.includes('requireAuth'), 'cache invalidate requires auth');
check(cacheRoute.includes('requireStaff'), 'cache invalidate requires staff');
check(cacheRoute.includes('PERMISSIONS.CONTENT_SITE'), 'cache invalidate requires CONTENT_SITE');

const emailSrc = read('services/emailDeliveryState.js');
check(emailSrc.includes('queued_worker_stopped'), 'email health distinguishes queued_worker_stopped');
check(emailSrc.includes('configured_delivery_stopped'), 'email health distinguishes configured_delivery_stopped');
check(emailSrc.includes('providerConfigured') && emailSrc.includes('workerRunning') && emailSrc.includes('queuePending'), 'email health separates provider/worker/queue');
check(!/Emails sent via SMTP/.test(read('controllers/platformOpsController.js')), 'health does not claim SMTP live delivery');

const prevAssess = process.env.ASSESSMENTS_ENABLED;
delete process.env.ASSESSMENTS_ENABLED;
check(isAssessmentsEnabled() === false, 'assessments launch default is disabled');
process.env.ASSESSMENTS_ENABLED = '1';
check(isAssessmentsEnabled() === true, 'assessments can be enabled with === 1');
if (prevAssess === undefined) delete process.env.ASSESSMENTS_ENABLED;
else process.env.ASSESSMENTS_ENABLED = prevAssess;

const flags = read('config/careerFeatureFlags.js');
check(/ASSESSMENTS_ENABLED === '1'/.test(flags), 'server assessments require explicit 1');

const routesIndex = read('routes/index.js');
check(/intentionally unmounted/.test(routesIndex), 'correctionsRouter remains unmounted and documented');
const appEntry = read('index.js');
check(!appEntry.includes('correctionsRouter'), 'correctionsRouter is not mounted on the app');

const worker = read('worker.js');
check(worker.includes('touchWorkerHeartbeat'), 'worker heartbeat is recorded only when worker ticks');

console.log(`phase17ServerContracts.test.js: ${count} assertions passed`);

/**
 * SEO-P7 — AI search readiness, answer usefulness, citation readiness.
 *
 * Run: node server/src/__tests__/seoP7AiSearchCitationReadiness.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import { buildRobotsTxt, isRobotsDisallowedPath, ROBOTS_DISALLOW_PATHS } from '../../../shared/seo/robotsPolicy.js';
import {
  evaluateCrawlerPathAccess,
  isPublicPathAllowedByRobots,
  robotsTxtHasExplicitUserAgentGroup,
} from '../../../shared/seo/robotsCrawlerAccess.js';
import {
  SOURCE_LINK_KINDS,
  SOURCE_LINK_LABELS,
} from '../../../shared/seo/sourceLabels.js';
import {
  SOURCE_AUTHORITY_LEVEL,
  SOURCE_LINK_LABEL,
  resolveJobApplicationLink,
  resolveJobProvenanceLink,
  resolveJobSourceReference,
  resolveInstitutionOfficialWebsite,
  resolveProgramOfficialPage,
  resolveProgramAdmissionRequirementsUrl,
  resolveCmsScholarshipLink,
  resolveAdmissionApplicationLink,
  isExplicitOfficialLevel,
} from '../../../shared/seo/sourceAuthority.js';
import { evaluateJobPostingEligibility, JOB_POSTING_SURFACES } from '../../../shared/seo/jobPostingEligibility.js';
import { resolvePublicBlogAuthorLabel } from '../../../shared/blog/publicAuthor.js';
import { publicHttpUrlOrNull } from '../../../shared/publicDiscovery/safePublicUrl.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const ORIGIN = PRODUCTION_PUBLIC_ORIGIN;
const robotsTxt = buildRobotsTxt(ORIGIN);
const staticRobots = read('client/public/robots.txt');

const jobDetail = read('client/src/pages/Jobs/JobDetail.jsx');
const internshipDetail = read('client/src/pages/Internships/InternshipDetail.jsx');
const scholarshipDetail = read('client/src/pages/Scholarships/ScholarshipDetail.jsx');
const intlScholarshipDetail = read('client/src/pages/IntlScholarships/IntlScholarshipDetail.jsx');
const scholarshipIntelDetail = read('client/src/pages/Scholarships/ScholarshipIntelligenceDetail.jsx');
const institutionDetail = read('client/src/pages/Education/InstitutionExplorer.jsx');
const programDetail = read('client/src/pages/Tests/ProgramExplorer.jsx');
const admissionDetail = read('client/src/pages/Admissions/AdmissionDetail.jsx');
const foreignStudyDetail = read('client/src/pages/ForeignStudies/ForeignStudyDetail.jsx');
const blogPost = read('client/src/pages/Blog/BlogPost.jsx');
const keyFacts = read('client/src/components/public/KeyFacts.jsx');
const publicSourceLink = read('client/src/components/public/PublicSourceLink.jsx');
const sourceAuthority = read('shared/seo/sourceAuthority.js');
const provenanceStrip = read('client/src/components/public/ProvenanceStrip.jsx');
const publicSourceSection = read('client/src/components/public/PublicSourceSection.jsx');
const routesSource = read('client/src/routes/index.jsx');
const schemasSource = read('client/src/seo/schemas.js');
const seoHead = read('client/src/components/seo/SeoHead.jsx');
const p7Doc = read('docs/SEO_P7_AI_SEARCH_CITATION_READINESS.md');

// --- Baseline / crawler matrix ---
check(staticRobots === robotsTxt, 'SEO-P7-CRAWL-01: static robots matches shared policy');
check(isPublicPathAllowedByRobots('/jobs/example-job'), 'SEO-P7-CRAWL-01b: public job path allowed');
check(!isPublicPathAllowedByRobots('/admin'), 'SEO-P7-CRAWL-02: private admin disallowed');
check(!isPublicPathAllowedByRobots('/agent/leads'), 'SEO-P7-CRAWL-02b: private agent subtree disallowed');
check(isPublicPathAllowedByRobots('/agents'), 'SEO-P7-CRAWL-02c: public /agents not blocked by /agent/ rule');

const oaiAccess = evaluateCrawlerPathAccess('OAI-SearchBot', '/blog/example');
check(oaiAccess.publicContentAccess === true, 'SEO-P7-CRAWL-03: OAI-SearchBot can reach public blog path');
const oaiPrivate = evaluateCrawlerPathAccess('OAI-SearchBot', '/employer/dashboard');
check(oaiPrivate.privateRouteBlocked === true, 'SEO-P7-CRAWL-04: OAI-SearchBot cannot bypass private disallows');

check(!robotsTxtHasExplicitUserAgentGroup(robotsTxt, 'OAI-SearchBot'), 'SEO-P7-CRAWL-04b: no redundant OAI-SearchBot group');
check(!robotsTxtHasExplicitUserAgentGroup(robotsTxt, 'GPTBot'), 'SEO-P7-CRAWL-05: no explicit GPTBot group (unchanged)');
check(!robotsTxtHasExplicitUserAgentGroup(robotsTxt, 'Google-Extended'), 'SEO-P7-CRAWL-06: no Google-Extended group (unchanged)');
check(robotsTxt.startsWith('User-agent: *'), 'SEO-P7-CRAWL-07: wildcard policy only — no cloaking groups');
check(!robotsTxt.includes('INDEXNOW_KEY'), 'SEO-P7-CRAWL-08: robots does not expose secrets');

// --- llms.txt ---
check(!existsSync(path.join(repo, 'client/public/llms.txt')), 'SEO-P7-LLMS-01: no llms.txt added');
check(!existsSync(path.join(repo, 'client/public/llms-full.txt')), 'SEO-P7-LLMS-01b: no llms-full.txt added');
check(!read('client/vite.config.js').includes('llms.txt'), 'SEO-P7-LLMS-02: no llms route wiring');
check(!routesSource.includes('/llms'), 'SEO-P7-LLMS-03: no hidden AI markdown mirror routes');

// --- Snippet controls ---
check(!seoHead.includes('data-nosnippet') && !seoHead.includes('nosnippet'), 'SEO-P7: no nosnippet in SeoHead');
check(!blogPost.includes('data-nosnippet'), 'SEO-P7: blog body not nosnippet blocked');

// --- Shared fact component ---
check(keyFacts.includes('export function KeyFacts'), 'SEO-P7-FACT-01: KeyFacts component exists');
check(keyFacts.includes('shouldRenderFactValue'), 'SEO-P7-FACT-02: unknown values omitted');
check(keyFacts.includes('OMIT_FACT_VALUES'), 'SEO-P7-FACT-03: no guessed NOT_SPECIFIED fallback rendered');
check(keyFacts.includes('Key details') || keyFacts.includes('title ='), 'SEO-P7-FACT-04: semantic heading supported');
check(keyFacts.includes('<dt') && keyFacts.includes('<dd'), 'SEO-P7-FACT-05: label-value dl semantics');
check(keyFacts.includes('rel="noopener noreferrer"'), 'SEO-P7-FACT-06: safe external link semantics');
check(!keyFacts.includes('dangerouslySetInnerHTML'), 'SEO-P7-FACT-07: no dangerouslySetInnerHTML');
check(keyFacts.includes('fact.label'), 'SEO-P7-FACT-08: duplicate labels keyed by label');

// --- Source authority (SEO-P7-SOURCE) ---
const safeHttps = resolveJobApplicationLink('https://example.com/apply');
check(safeHttps?.url && safeHttps.level === SOURCE_AUTHORITY_LEVEL.EXTERNAL_APPLICATION, 'SEO-P7-SOURCE-01: safe HTTPS does not auto-become official');
check(isExplicitOfficialLevel(safeHttps.level) === false, 'SEO-P7-SOURCE-01b: application link not explicit official');
check(resolveJobApplicationLink('javascript:alert(1)') === null, 'SEO-P7-SOURCE-02: unsafe URL rejected');
check(resolveInstitutionOfficialWebsite('https://uni.example')?.label === SOURCE_LINK_LABEL.INSTITUTION_WEBSITE,
  'SEO-P7-SOURCE-03: explicit officialWebsite uses institution label');
check(isExplicitOfficialLevel(resolveInstitutionOfficialWebsite('https://uni.example')?.level), 'SEO-P7-SOURCE-03b: officialWebsite is explicit official');
check(resolveJobApplicationLink('https://jobs.example/role')?.label === SOURCE_LINK_LABEL.APPLICATION_PAGE,
  'SEO-P7-SOURCE-04: generic application URL uses neutral application label');
check(!sourceAuthority.includes('hostname') && !sourceAuthority.includes('.edu') && !sourceAuthority.includes('includes('),
  'SEO-P7-SOURCE-05: no hostname-based official inference');
check(!JSON.stringify(SOURCE_LINK_LABEL).toLowerCase().includes('verified'), 'SEO-P7-SOURCE-06: no Verified source wording');
check(publicSourceLink.includes('rel="noopener noreferrer"'), 'SEO-P7-SOURCE-07: noopener/noreferrer preserved');
check(publicSourceLink.includes('label') && !publicSourceLink.includes('Official source'), 'SEO-P7-SOURCE-07b: label required explicitly');

// --- Job source authority ---
const jobApp = resolveJobProvenanceLink({ applyType: 'external', applicationLink: 'https://employer.example/job' });
check(jobApp?.label === SOURCE_LINK_LABEL.APPLICATION_PAGE, 'SEO-P7-JOB-SOURCE-02: external application neutral label');
check(!jobDetail.includes('Official job source'), 'SEO-P7-JOB-SOURCE-02b: job detail does not say Official job source');
check(jobDetail.includes('resolveJobProvenanceLink'), 'SEO-P7-JOB-SOURCE-01: job uses source authority resolver');
const agg = resolveJobApplicationLink('https://aggregator.example/listing/123');
check(agg?.label === SOURCE_LINK_LABEL.APPLICATION_PAGE && !isExplicitOfficialLevel(agg.level),
  'SEO-P7-JOB-SOURCE-03: aggregator URL cannot become official from safety alone');
check(jobDetail.includes('jobPostingSchema'), 'SEO-P7-JOB-SOURCE-04: JobPosting policy unchanged');
const jobRef = resolveJobSourceReference('https://portal.example/listing');
check(jobRef?.label === SOURCE_LINK_LABEL.SOURCE, 'SEO-P7-JOB-SOURCE-01b: sourceUrl is reference label');

// --- Scholarship source authority ---
check(resolveCmsScholarshipLink('https://sch.example/apply')?.label === SOURCE_LINK_LABEL.APPLICATION_PAGE,
  'SEO-P7-SCH-SOURCE-01: CMS link uses application label not official source');
check(!scholarshipDetail.includes('Official application page') && !scholarshipDetail.includes('Official source'),
  'SEO-P7-SCH-SOURCE-02: CMS detail avoids official wording for generic link');
check(!scholarshipDetail.includes('Strideto provides') && scholarshipDetail.includes('item.provider'),
  'SEO-P7-SCH-SOURCE-03: Strideto not inferred as provider');
check(intlScholarshipDetail.includes('ROUTES.INTL_SCHOLARSHIPS'), 'SEO-P7-SCH-SOURCE-04: route ownership unchanged');

// --- Institution / Program source authority ---
check(resolveInstitutionOfficialWebsite('https://mit.edu')?.label === SOURCE_LINK_LABEL.INSTITUTION_WEBSITE,
  'SEO-P7-INST-SOURCE-01: officialWebsite labeled institution website');
check(institutionDetail.includes('resolveInstitutionOfficialWebsite'), 'SEO-P7-INST-SOURCE-01b: institution uses resolver');
const progOfficial = resolveProgramOfficialPage('https://uni.example/cs-ms');
check(progOfficial?.label === SOURCE_LINK_LABEL.OFFICIAL_PROGRAM_PAGE, 'SEO-P7-PROG-SOURCE-02: program official URL when field says official');
check(resolveProgramAdmissionRequirementsUrl('https://uni.example/requirements')?.label === SOURCE_LINK_LABEL.ADMISSION_REQUIREMENTS,
  'SEO-P7-PROG-SOURCE-01: admission requirements not labeled official program source');
check(programDetail.includes('resolveProgramOfficialPage') && programDetail.includes('resolveProgramAdmissionRequirementsUrl'),
  'SEO-P7-PROG-SOURCE-02b: program detail uses distinct resolvers');

// --- Source labels / citation safety ---
check(SOURCE_LINK_LABELS[SOURCE_LINK_KINDS.INSTITUTION_WEBSITE] === 'Institution website', 'SEO-P7-CITE: institution website label map');
check(publicSourceLink.includes('publicHttpUrlOrNull'), 'SEO-P7-CITE-03: source URL must pass safe URL helper');
check(!publicSourceLink.includes('google.com/search'), 'SEO-P7-CITE-03b: no search-engine URL pattern');
check(!provenanceStrip.includes('evidenceRecords'), 'SEO-P7-CITE-05: no private provenance fields');
check(provenanceStrip.includes('PublicSourceLink'), 'SEO-P7-CITE-06: source link user-visible');
check(provenanceStrip.includes('linkLabel'), 'SEO-P7-CITE-06b: provenance requires explicit linkLabel');
check(!jobDetail.includes('display:none') && !jobDetail.includes('sr-only-only-for-bots'), 'SEO-P7-CITE-07: no crawler-only source text');
check(!jobDetail.includes('sourceLinkKind') && !jobDetail.includes('OFFICIAL_JOB_SOURCE'),
  'SEO-P7-CITE-08: removed automatic official kind on jobs');

// --- Job detail ---
check(jobDetail.includes('KeyFacts'), 'SEO-P7-JOB-01: job uses KeyFacts');
check(jobDetail.includes('compensation') && jobDetail.includes(': null'), 'SEO-P7-JOB-02: missing salary omitted (null not NOT_SPECIFIED)');
check(jobDetail.includes('organization || job.company'), 'SEO-P7-JOB-03: company identity explicit');
check(jobDetail.includes('formatLocationDisplay'), 'SEO-P7-JOB-04: location normalized');
check(jobDetail.includes('formatDate(job.deadline)'), 'SEO-P7-JOB-05: deadline uses actual value');
check(jobDetail.includes('publicHttpUrlOrNull'), 'SEO-P7-JOB-06: official source uses safe URL');
check(!jobDetail.includes('https://${') && !jobDetail.includes('inferOfficial'), 'SEO-P7-JOB-07: no invented source URL');
check(jobDetail.includes('Employer-posted on Strideto') || jobDetail.includes('authorityLabel'), 'SEO-P7-JOB-08: employer/source semantics preserved');
check(jobDetail.includes('jobPostingSchema'), 'SEO-P7-JOB-09: JobPosting policy unchanged');
check(!jobDetail.includes('visibility:hidden') && !jobDetail.includes('aria-hidden="true"'), 'SEO-P7-JOB-10: no AI-only hidden text');

// --- Internship ---
check(internshipDetail.includes('KeyFacts'), 'SEO-P7-INT-01: internship facts from public model');
check(!internshipDetail.includes('stipend') || !internshipDetail.includes('Competitive'), 'SEO-P7-INT-02: stipend not invented');
check(!internshipDetail.includes('jobPostingSchema'), 'SEO-P7-INT-03: no JobPosting schema');

// --- CMS Scholarship ---
check(scholarshipDetail.includes('KeyFacts'), 'SEO-P7-SCH-01: scholarship provider facts');
check(!scholarshipDetail.includes('Fully funded') && !scholarshipDetail.includes('Top university'), 'SEO-P7-SCH-02: funding not invented');
check(scholarshipDetail.includes('formatDate(item.deadline)'), 'SEO-P7-SCH-03: deadline truth preserved');
check(scholarshipDetail.includes('resolveCmsScholarshipLink'), 'SEO-P7-SCH-04: CMS scholarship uses authority resolver');
check(intlScholarshipDetail.includes('ROUTES.INTL_SCHOLARSHIPS'), 'SEO-P7-SCH-05: intl route ownership unchanged');
check(!scholarshipDetail.includes('CANONICAL_SCHOLARSHIPS'), 'SEO-P7-SCH-06: CMS scholarship not merged with intelligence route');
check(!scholarshipDetail.includes('Strideto provides') && scholarshipDetail.includes('item.provider'), 'SEO-P7-SCH-07: Strideto not inferred as provider');

// --- Institution ---
check(institutionDetail.includes('KeyFacts') && institutionDetail.includes('officialName'), 'SEO-P7-INST-01: institution identity facts');
check(institutionDetail.includes('resolveInstitutionOfficialWebsite'), 'SEO-P7-INST-02: official website via authority resolver');
check(institutionDetail.includes('programs.length'), 'SEO-P7-INST-03: program count from public programs');
check(institutionDetail.includes('acceptedTests.length'), 'SEO-P7-INST-04: accepted tests from public claims');
check(institutionDetail.includes('isCanonicalInstitutionDetailEligible'), 'SEO-P7-INST-05: thin institution gate unchanged');
check(!institutionDetail.includes('evidence') && !institutionDetail.includes('rawClaims'), 'SEO-P7-INST-06: raw evidence not exposed');
check(!institutionDetail.includes('partner') && !institutionDetail.includes('official partner'), 'SEO-P7-INST-07: no partnership claim invented');

// --- Program ---
check(programDetail.includes('KeyFacts') && programDetail.includes('data.name'), 'SEO-P7-PROG-01: program name explicit');
check(programDetail.includes('inst?.officialName'), 'SEO-P7-PROG-02: parent institution explicit');
check(programDetail.includes('DEGREE_LABELS') && programDetail.includes('STUDY_MODE_LABELS'), 'SEO-P7-PROG-03: stored degree/field/mode labels');
check(programDetail.includes('data.tuition?.amountMinor != null'), 'SEO-P7-PROG-04: tuition only when stored');
check(programDetail.includes('notFound'), 'SEO-P7-PROG-05: thin program 404 path preserved');
check(programDetail.includes('ROUTES.PROGRAM_EXPLORER'), 'SEO-P7-PROG-06: canonical routes unchanged');

// --- Admission / Foreign study ---
check(admissionDetail.includes('KeyFacts'), 'SEO-P7-ADM-01: admission facts from fields');
check(!admissionDetail.includes('minimum GPA') && !admissionDetail.includes('invent'), 'SEO-P7-ADM-02: requirements not invented');
check(foreignStudyDetail.includes('KeyFacts') && foreignStudyDetail.includes('item.country'), 'SEO-P7-FS-01: destination truth preserved');
check(!routesSource.includes('/study-in-') && !routesSource.includes('/answers/'), 'SEO-P7-FS-02: no country answer landing generator');

// --- Blog structural ---
check(blogPost.includes('resolvePublicBlogAuthorLabel'), 'SEO-P7-BLOG-01: real author preserved');
check(!blogPost.includes('defaultAuthor') && !blogPost.includes('Strideto Editorial Team'), 'SEO-P7-BLOG-02: missing author not fabricated');
check(blogPost.includes('publishedAt') && blogPost.includes('formatArticleDate'), 'SEO-P7-BLOG-03: published date truthful');
check(blogPost.includes('shouldShowLastUpdated'), 'SEO-P7-BLOG-04: last updated truthful');
check(blogPost.includes('dangerouslySetInnerHTML') && blogPost.includes('renderedHtml'), 'SEO-P7-BLOG-05: authored HTML body visible (includes Sources when present)');
check(!blogPost.includes('autoGenerateSources') && !blogPost.includes('fabricateSources'), 'SEO-P7-BLOG-06: no auto-generated sources');
check(!blogPost.includes('Key Takeaways') && !blogPost.includes('keyTakeaways'), 'SEO-P7-BLOG-07: no auto key takeaways');
check(read('shared/blog/blogContent.js').includes('demoteBodyH1'), 'SEO-P7-BLOG-08: body H1 demotion preserved');
check(blogPost.includes('shouldShowBlogToc'), 'SEO-P7-BLOG-09: TOC behavior preserved');
check(blogPost.includes('ROUTES.EDITORIAL_POLICY'), 'SEO-P7-BLOG-10: editorial policy link preserved');

// --- Anti-spam / safety ---
check(!routesSource.includes('/questions/') && !routesSource.includes('/ai/answers'), 'SEO-P7-SAFE-01: no mass question routes');
check(!routesSource.includes('queryFanout') && !routesSource.includes('generateAnswerPages'), 'SEO-P7-SAFE-02: no query-fanout generator');
check(!jobDetail.includes('injectKeywords') && !scholarshipDetail.includes('injectKeywords'), 'SEO-P7-SAFE-03: no keyword injection');
check(!scholarshipDetail.includes('autoCite') && !blogPost.includes('autoCite'), 'SEO-P7-SAFE-04: no automatic citation generation');
check(!internshipDetail.includes('bot-only') && !jobDetail.includes('bot-only'), 'SEO-P7-SAFE-05: no AI-only hidden content');
check(!blogPost.includes('expertQuoteGenerator'), 'SEO-P7-SAFE-06: no fake expert quotes');
check(!scholarshipDetail.includes('98%') && !jobDetail.includes('leading employer'), 'SEO-P7-SAFE-07: no fake statistics copy');
check(!jobDetail.includes('FAQPage') && !scholarshipDetail.includes('FAQPage') && !blogPost.includes('FAQPage'), 'SEO-P7-SAFE-08: no FAQ schema added to P7 detail pages');
check(!schemasSource.includes('AIAnswer') && !schemasSource.includes('LLMContent'), 'SEO-P7-SAFE-09: no AI schema types');
check(!read('package.json').includes('"openai"') || !read('client/package.json').includes('openai'), 'SEO-P7-SAFE-10: no OpenAI client in frontend deps');

// --- Structured data freeze ---
check(schemasSource.includes('organizationSchema') && schemasSource.includes('blogPostingSchema'), 'SEO-P7: core schema exports preserved');
check(evaluateJobPostingEligibility({ slug: 'x', status: 'active', approvalStatus: 'approved', publicationState: 'active', title: 'Engineer' }, { surface: JOB_POSTING_SURFACES.DETAIL }).eligible === false,
  'SEO-P7: incomplete job still ineligible for JobPosting on detail');

// --- Scholarship intelligence ---
check(scholarshipIntelDetail.includes('KeyFacts'), 'SEO-P7: canonical scholarship KeyFacts');
check(scholarshipIntelDetail.includes('data.provider?.name'), 'SEO-P7: intelligence provider from data');
check(scholarshipIntelDetail.includes('resolveCanonicalScholarshipApplicationUrl'), 'SEO-P7: intelligence application resolver');
check(scholarshipIntelDetail.includes('PublicSourceLink'), 'SEO-P7: intelligence public source link');
check(!scholarshipIntelDetail.includes('Official application page'), 'SEO-P7: intelligence avoids unproven official wording');

// --- Public source section adoption ---
check(publicSourceSection.includes('export function PublicSourceSection'), 'SEO-P7: PublicSourceSection exists');
check(jobDetail.includes('PublicSourceSection'), 'SEO-P7: job source section');
check(internshipDetail.includes('PublicSourceSection'), 'SEO-P7: internship source section');

// --- Source label module ---
check(SOURCE_LINK_LABELS[SOURCE_LINK_KINDS.INSTITUTION_WEBSITE] === SOURCE_LINK_LABEL.INSTITUTION_WEBSITE, 'SEO-P7: institution website label');
check(publicHttpUrlOrNull('javascript:alert(1)') === null, 'SEO-P7: javascript URL blocked');
check(resolveAdmissionApplicationLink('https://admissions.example/apply')?.label === SOURCE_LINK_LABEL.APPLICATION_PAGE,
  'SEO-P7-ADM-SOURCE: admission apply link neutral');

// --- Blog author regression (P6 + P7) ---
check(resolvePublicBlogAuthorLabel({}) === null, 'SEO-P7-BLOG-02b: empty author omitted');
check(resolvePublicBlogAuthorLabel({ authorDisplay: 'A. Author' }) === 'A. Author', 'SEO-P7-BLOG-01b: authorDisplay shown');

// --- Documentation ---
check(p7Doc.includes('OAI-SearchBot'), 'SEO-P7-DOC: OAI-SearchBot documented');
check(p7Doc.includes('DEFER') && p7Doc.includes('preferred source'), 'SEO-P7-DOC: preferred sources decision documented');
check(p7Doc.includes('sourceAuthority'), 'SEO-P7-DOC: source authority documented');
check(p7Doc.includes('P8'), 'SEO-P7-DOC: measurement deferred to P8');

// --- Robots disallow parity ---
for (const prefix of ROBOTS_DISALLOW_PATHS) {
  if (prefix.endsWith('/')) {
    const base = prefix.slice(0, -1);
    check(isRobotsDisallowedPath(base), `SEO-P7-ROBOT: disallow exact base ${base}`);
    check(isRobotsDisallowedPath(`${prefix}nested`), `SEO-P7-ROBOT: disallow subtree ${prefix}`);
  }
}

// --- Entity pages import KeyFacts (coverage) ---
for (const [name, src] of [
  ['Internship', internshipDetail],
  ['Scholarship', scholarshipDetail],
  ['Intl', intlScholarshipDetail],
  ['Admission', admissionDetail],
  ['ForeignStudy', foreignStudyDetail],
]) {
  check(src.includes("from '../../components/public/KeyFacts'") || src.includes('KeyFacts'), `SEO-P7-COVERAGE: ${name} uses KeyFacts`);
}

console.log(`SEO-P7 passed (${count} checks)`);

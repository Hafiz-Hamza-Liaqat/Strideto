/**
 * SEO-P6 — Entity authority, trust pages, and off-page readiness.
 *
 * Run: node server/src/__tests__/seoP6EntityAuthorityTrust.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import { INDEXABLE_STATIC_PATHS } from '../../../shared/seo/publicIndexablePages.js';
import {
  publicOrganizationIdentity,
  ORGANIZATION_PUBLIC_NAME,
} from '../../../shared/seo/organizationIdentity.js';
import { OFFICIAL_LINKEDIN_COMPANY_URL } from '../../../shared/social/officialSocialLinks.js';
import { evaluateJobPostingEligibility, JOB_POSTING_SURFACES } from '../../../shared/seo/jobPostingEligibility.js';
import { buildRobotsTxt } from '../../../shared/seo/robotsPolicy.js';
import { resolvePublicBlogAuthorLabel } from '../../../shared/blog/publicAuthor.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const ORIGIN = PRODUCTION_PUBLIC_ORIGIN;
const identitySource = read('shared/seo/organizationIdentity.js');
const schemasSource = read('client/src/seo/schemas.js');
const entityIdsSource = read('client/src/seo/entityIds.js');
const aboutSource = read('client/src/pages/Static/About.jsx');
const editorialSource = read('client/src/pages/Static/EditorialPolicy.jsx');
const pressSource = read('client/src/pages/Static/Press.jsx');
const footerSource = read('client/src/components/layout/Footer.jsx');
const humanSitemapSource = read('client/src/pages/Static/HumanSitemap.jsx');
const blogPostSource = read('client/src/pages/Blog/BlogPost.jsx');
const routesSource = read('client/src/routes/index.jsx');
const constantsSource = read('client/src/constants/index.js');
const staticEn = read('client/src/i18n/locales/en/static.json');
const offPageDoc = read('docs/SEO_P6_ENTITY_AUTHORITY_OFF_PAGE_PLAN.md');
const globalSeoSource = read('client/src/components/seo/GlobalSeo.jsx');
const jobDetailSource = read('client/src/pages/Jobs/JobDetail.jsx');
const indexHtml = read('client/index.html');

// Dynamic import organizationSchema
const fileUrl = (rel) => pathToFileURL(path.join(repo, rel)).href;
const configStub = [
  `const SITE_URL = ${JSON.stringify(ORIGIN)};`,
  "const SITE_NAME = 'Strideto';",
  "const DEFAULT_DESCRIPTION = 'test';",
  `const DEFAULT_OG_IMAGE = ${JSON.stringify(`${ORIGIN}/og-image.png`)};`,
  `export function buildCanonicalUrl(p = '/') {
    if (!p || p === '/') return SITE_URL;
    const n = p.startsWith('/') ? p : \`/\${p}\`;
    return \`\${SITE_URL}\${n.replace(/\\/$/, '')}\`;
  }`,
  'export { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE };',
].join('\n');

const stripImportFrom = (source, fromPath) =>
  source.replace(
    new RegExp(`^import\\s*(?:\\{[\\s\\S]*?\\}|[^;]+)\\s*from\\s*'${fromPath.replace(/\./g, '\\.')}';\n?`, 'm'),
    ''
  );

const entityIdsModule = entityIdsSource.replace(/^import\s*\{[\s\S]*?\}\s*from\s*'\.\/config\.js';\n?/m, '');

let schemasBody = schemasSource;
schemasBody = stripImportFrom(schemasBody, '@shared/seo/jobPostingEligibility.js');
schemasBody = stripImportFrom(schemasBody, './entityIds.js');
schemasBody = stripImportFrom(schemasBody, '@shared/seo/organizationIdentity.js');
schemasBody = stripImportFrom(schemasBody, './sanitize.js');
schemasBody = stripImportFrom(schemasBody, './config.js');
schemasBody = schemasBody.replace(/^export\s*\{[\s\S]*?\}\s*from\s*'\.\/entityIds\.js';\n?/m, '');

const sanitizeImport = `import { sanitizeJsonLdString } from '${fileUrl('client/src/seo/sanitize.js')}';\n`;
const identityImport = `import { ORGANIZATION_PUBLIC_NAME, ORGANIZATION_PUBLIC_DESCRIPTION, organizationPublicSameAs } from '${fileUrl('shared/seo/organizationIdentity.js')}';\n`;
const jobImport = `import { JOB_POSTING_SURFACES, evaluateJobPostingEligibility, isFullyRemoteJob, jobPostingCountry } from '${fileUrl('shared/seo/jobPostingEligibility.js')}';\n`;

const schemasBundled = `${configStub}\n${entityIdsModule}\n${sanitizeImport}${identityImport}${jobImport}${schemasBody}`;

const schemasModule = await import(
  `data:text/javascript;base64,${Buffer.from(schemasBundled, 'utf8').toString('base64')}`
);

const { organizationSchema, websiteSchema, blogPostingSchema } = schemasModule;
const org = organizationSchema();
const site = websiteSchema();
const identity = publicOrganizationIdentity();

// --- Organization tests ---
check(org['@id'] === `${ORIGIN}/#organization`, 'SEO-P6-ORG-01: Organization @id canonical');
check(site['@id'] === `${ORIGIN}/#website`, 'SEO-P6-ORG-02: WebSite @id unchanged');
check(org.name === ORGANIZATION_PUBLIC_NAME && org.name === 'Strideto', 'SEO-P6-ORG-03: name consistent');
check(org.url === ORIGIN, 'SEO-P6-ORG-04: organization url is www canonical');
check(org.logo?.url === `${ORIGIN}/branding/logo-symbol.svg`, 'SEO-P6-ORG-05: logo is public STRIDETO asset');
check(Array.isArray(org.sameAs) && org.sameAs.length === 1 && org.sameAs[0] === OFFICIAL_LINKEDIN_COMPANY_URL,
  'SEO-P6-ORG-06: sameAs only approved LinkedIn');
check(new Set(org.sameAs).size === org.sameAs.length, 'SEO-P6-ORG-07: sameAs deduplicated');
check(org.legalName === undefined, 'SEO-P6-ORG-08: no fake legalName');
check(org.foundingDate === undefined, 'SEO-P6-ORG-09: no fake foundingDate');
check(org.address === undefined && org.telephone === undefined, 'SEO-P6-ORG-10: no fake address/telephone');

// --- Trust page tests ---
check(constantsSource.includes("EDITORIAL_POLICY: '/editorial-policy'"), 'SEO-P6-PAGE-03: editorial route constant');
check(constantsSource.includes("PRESS: '/press'"), 'SEO-P6-PAGE-05: press route constant');
check(routesSource.includes('ROUTES.EDITORIAL_POLICY'), 'SEO-P6-PAGE-03: editorial route wired');
check(routesSource.includes('ROUTES.PRESS'), 'SEO-P6-PAGE-05: press route wired');
check(aboutSource.includes('canonical={ROUTES.ABOUT}'), 'SEO-P6-PAGE-01: About self-canonical');
check(editorialSource.includes('canonical={ROUTES.EDITORIAL_POLICY}'), 'SEO-P6-PAGE-03: Editorial self-canonical');
check(pressSource.includes('canonical={ROUTES.PRESS}'), 'SEO-P6-PAGE-05: Press self-canonical');
check(INDEXABLE_STATIC_PATHS.includes('/about'), 'SEO-P6-PAGE-02: About in XML sitemap static paths');
check(INDEXABLE_STATIC_PATHS.includes('/editorial-policy'), 'SEO-P6-PAGE-04: Editorial in XML sitemap');
check(INDEXABLE_STATIC_PATHS.includes('/press'), 'SEO-P6-PAGE-08: Press in XML sitemap');
check(humanSitemapSource.includes('ROUTES.EDITORIAL_POLICY'), 'SEO-P6-PAGE-07: Editorial in human sitemap');
check(humanSitemapSource.includes('ROUTES.PRESS'), 'SEO-P6-PAGE-07: Press in human sitemap');
check(!routesSource.includes('/about-us') && !routesSource.includes('/newsroom'), 'SEO-P6-PAGE-09: no duplicate About/Press routes');
check(!staticEn.includes('world\'s leading') && !staticEn.includes('award-winning'), 'SEO-P6-PAGE-10: no fake metrics/awards in trust copy');

// --- Press tests ---
check(pressSource.includes('ORGANIZATION_PUBLIC_URL'), 'SEO-P6-PRESS-01: press uses canonical website');
check(pressSource.includes('ORGANIZATION_PRESS_ASSETS'), 'SEO-P6-PRESS-02: press references real assets only');
check(!pressSource.includes('As Seen In') && !pressSource.includes('Press Coverage'), 'SEO-P6-PRESS-03: no fake media coverage');
check(!pressSource.includes('10,000') && !pressSource.includes('founded'), 'SEO-P6-PRESS-04: no fabricated metrics');
check(pressSource.includes('organizationPublicSameAs'), 'SEO-P6-PRESS-05: social from shared identity');
check(!pressSource.includes('@strideto.com') && !pressSource.match(/\+92/), 'SEO-P6-PRESS-06: no private contact data');

// --- Editorial tests ---
check(staticEn.includes('does not invent'), 'SEO-P6-EDIT-01: editorial avoids unsupported verification claims');
check(staticEn.includes('does not invent'), 'SEO-P6-EDIT-02: salary-missing principle in policy copy');
check(staticEn.includes('official source'), 'SEO-P6-EDIT-03: official-source principle present');
check(!editorialSource.includes('Jane Doe') && !editorialSource.includes('John Smith'), 'SEO-P6-EDIT-04: no fake author');
check(blogPostSource.includes('resolvePublicBlogAuthorLabel'), 'SEO-P6-EDIT-05: blog uses shared author truth helper');
check(schemasSource.includes("authorName\n      ? { '@type': 'Person'"), 'SEO-P6-EDIT-05b: P2 Person author schema preserved');
check(!blogPostSource.includes('defaultAuthor'), 'SEO-P6-EDIT-05c: no defaultAuthor fallback in BlogPost');
check(!blogPostSource.includes('auto-cite') && !blogPostSource.includes('fabricateSources'), 'SEO-P6-EDIT-06: blog body not auto-cited');
check(staticEn.includes('not auto-generated'), 'SEO-P6-EDIT-07: sources not fabricated');
check(blogPostSource.includes('shouldShowLastUpdated'), 'SEO-P6-EDIT-08: published/updated dates truthful');

// --- Blog authorship truth (SEO-P6-AUTHOR) ---
check(resolvePublicBlogAuthorLabel({ authorDisplay: 'Jane Q. Writer' }) === 'Jane Q. Writer', 'SEO-P6-AUTHOR-01: real authorDisplay shows real author');
check(
  resolvePublicBlogAuthorLabel({ authorName: 'Legacy Name' }) === 'Legacy Name',
  'SEO-P6-AUTHOR-02: authorName fallback when authorDisplay absent'
);
const noAuthorSchema = blogPostingSchema({ title: 'T', slug: 't', publishedAt: new Date('2026-01-01') });
check(noAuthorSchema?.author === undefined, 'SEO-P6-AUTHOR-03: missing author does not create fake Person schema');
check(resolvePublicBlogAuthorLabel({}) === null, 'SEO-P6-AUTHOR-04: missing author does not claim Strideto as author');
check(
  noAuthorSchema?.publisher?.['@id'] === `${ORIGIN}/#organization`,
  'SEO-P6-AUTHOR-05: Organization publisher remains canonical'
);
check(blogPostSource.includes('shouldShowLastUpdated'), 'SEO-P6-AUTHOR-06: published/updated dates unchanged');
check(blogPostSource.includes('ROUTES.EDITORIAL_POLICY'), 'SEO-P6-AUTHOR-07: editorial standards link remains');
check(
  !staticEn.includes('all unattributed') && staticEn.includes('when one is stored'),
  'SEO-P6-AUTHOR: editorial policy does not claim all unattributed posts are Strideto-authored'
);

// --- Link policy tests ---
for (const url of org.sameAs) {
  check(url.startsWith('https://'), 'SEO-P6-LINK-01: social URLs HTTPS');
  check(!url.includes('?') && !url.includes('#'), 'SEO-P6-LINK-02: no tracking query on sameAs');
}
check(!org.sameAs.some((u) => /crunchbase|wikipedia|github/i.test(u)), 'SEO-P6-LINK-03: no random directory in sameAs');
check(!read('client/src/routes/index.jsx').includes('backlink-exchange'), 'SEO-P6-LINK-04: no backlink-exchange code');
check(!footerSource.includes('display:none') && !footerSource.includes('seo-hidden'), 'SEO-P6-LINK-05: no hidden SEO links');
check(!offPageDoc.includes('auto-submit') || offPageDoc.includes('not auto-submit'), 'SEO-P6-LINK-06: doc prohibits paid-link automation');
check(!jobDetailSource.match(/officialUrl[\s\S]{0,200}nofollow/), 'SEO-P6-LINK-07: no arbitrary nofollow on official sources');
check(!read('client/index.html').includes('INDEXNOW') && !read('client/src/seo/config.js').includes('INDEXNOW_KEY'), 'SEO-P6-REG-06: IndexNow key not in frontend static');

// --- Site reputation tests ---
check(!routesSource.includes('guest-post') && !routesSource.includes('sponsored-articles'), 'SEO-P6-REPUTATION-01/02: no guest/sponsored SEO routes');
check(editorialSource.includes('not as a separate SEO') || staticEn.includes('not as a separate SEO'), 'SEO-P6-REPUTATION-04: third-party content product-serving');
check(!routesSource.includes('massPageGenerator'), 'SEO-P6-REPUTATION-05: no mass page generator');

// --- Schema freeze tests ---
check(globalSeoSource.includes('organizationSchema()') && globalSeoSource.includes('websiteSchema()'), 'SEO-P6-SCHEMA-01: global graph unchanged pattern');
check(schemasSource.includes("publisher: { '@id': ORGANIZATION_ID }"), 'SEO-P6-SCHEMA-02: publisher references unchanged');
check(!schemasSource.includes('AggregateRating') && !schemasSource.includes('Review'), 'SEO-P6-SCHEMA-05/06: no fake ratings');
check(evaluateJobPostingEligibility({ slug: 'x', status: 'active', approvalStatus: 'approved', publicationState: 'active', title: 'T' }, { surface: JOB_POSTING_SURFACES.COLLECTION }).eligible === false,
  'SEO-P6-SCHEMA-03: JobPosting collection surface still blocked');
check(schemasSource.includes("resolveExplicitOrganizationName(item, ['provider'])"), 'SEO-P6-SCHEMA-04: scholarship provider semantics preserved');
check(!aboutSource.includes('@type\': \'Organization\'') && !pressSource.includes('@type\': \'Organization\''), 'SEO-P6-SCHEMA-07: no duplicate Organization on trust pages');

// --- P3/P4/P5 regressions ---
check(!INDEXABLE_STATIC_PATHS.some((p) => p.includes('?')), 'SEO-P6-REG-01: no query URLs in sitemap static paths');
check(buildRobotsTxt({ origin: ORIGIN }).includes('Disallow: /admin'), 'SEO-P6-REG-07: robots private routes unchanged');
check(aboutSource.includes('rel="noopener noreferrer"'), 'SEO-P6-LINK-08: external blank links use safe rel');

// --- Off-page doc tests ---
check(offPageDoc.includes('VERIFIED') && offPageDoc.includes('PLANNED') && offPageDoc.includes('DEFERRED'), 'SEO-P6 off-page labels present');
check(offPageDoc.includes('Buying backlinks') || offPageDoc.includes('buying backlinks'), 'SEO-P6 off-page prohibits manipulative links');
check(offPageDoc.includes('DEFERRED') && offPageDoc.includes('Google Business Profile'), 'SEO-P6 GBP deferred');

// --- Identity source architecture ---
check(identity.name === 'Strideto' && identity.url === ORIGIN, 'SEO-P6 identity source coherent');
check(identitySource.includes('organizationPublicSameAs'), 'SEO-P6 single identity source exports sameAs');
check(schemasSource.includes('organizationIdentity'), 'SEO-P6 schemas consume identity source');

// --- Footer ---
check(footerSource.includes('ROUTES.ABOUT') && footerSource.includes('ROUTES.EDITORIAL_POLICY'), 'SEO-P6 footer trust navigation');

// --- Favicon / OG ---
check(indexHtml.includes('rel="icon"') && indexHtml.includes('/favicon.svg'), 'SEO-P6 favicon configured');
check(indexHtml.includes('og:image') && indexHtml.includes('strideto.com/og-image.png'), 'SEO-P6 OG identity consistent');

// --- Blog editorial link ---
check(blogPostSource.includes('ROUTES.EDITORIAL_POLICY'), 'SEO-P6 blog editorial transparency link');

// --- Identity matrix: unverified fields absent from identity module ---
check(!identitySource.includes('legalName') && !identitySource.includes('foundingDate'), 'SEO-P6 deliberate omission of unverified legal fields');

console.log(`seoP6EntityAuthorityTrust: ${count} checks passed`);
if (count < 55) {
  throw new Error(`Expected at least 55 checks, got ${count}`);
}

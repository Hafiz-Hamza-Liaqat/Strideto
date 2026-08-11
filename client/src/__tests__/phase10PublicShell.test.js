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
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');

function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}
function readRoot(rel) {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

const navConfig = read('components/layout/navConfig.js');
const navbar = read('components/layout/Navbar.jsx');
const drawer = read('components/layout/DrawerMenu.jsx');
const footer = read('components/layout/Footer.jsx');
const sitemapPage = read('pages/Static/HumanSitemap.jsx');
const routes = read('routes/index.jsx');
const help = read('pages/Static/HelpCenter.jsx');
const support = read('pages/Static/Support.jsx');
const services = read('pages/Static/Services.jsx');
const contact = read('pages/Contact/Contact.jsx');
const notFound = read('pages/Static/NotFound.jsx');
const cookieConsent = read('components/consent/CookieConsent.jsx');
const footerEn = read('i18n/locales/en/footer.json');
const navbarEn = read('i18n/locales/en/navbar.json');
const staticEn = read('i18n/locales/en/static.json');
const licenseFile = read('pages/Static/License.jsx');
const repoLicense = readRoot('LICENSE');

check(navbarEn.includes('"scholarshipsAndFunding": "Scholarships & Funding"'), 'EN label: Scholarships & Funding');
check(navbarEn.includes('"admissionsAndIntakes": "Admissions & Intakes"'), 'EN label: Admissions & Intakes');
check(navbarEn.includes('"studyAndInstitutions": "Study & Institutions"'), 'EN label: Study & Institutions');
check(navbarEn.includes('"testsAndPrep": "Tests & Prep"'), 'EN label: Tests & Prep');
check(navbarEn.includes('"services": "Services"'), 'EN label: Services');

check(/path: '\/scholarships'/.test(navConfig), 'Scholarships URL remains /scholarships');
check(/path: '\/admissions'/.test(navConfig), 'Admissions URL remains /admissions');
check(/path: '\/program-explorer'/.test(navConfig), 'Study maps to /program-explorer');
check(/path: '\/tests'/.test(navConfig), 'Tests maps to /tests');
check(/path: '\/services'/.test(navConfig), 'Services maps to /services');
check(/path: '\/agents'/.test(navConfig), 'Services mega includes /agents');
check(!/navbar:more|SECONDARY_NAV_ITEMS = \[/.test(navbar), 'Navbar does not render More');
check(/SECONDARY_NAV_ITEMS = \[\]/.test(navConfig), 'More/secondary nav is empty');
check(/min-\[1440px\]:flex/.test(navbar), 'Desktop nav starts at 1440');
check(/min-\[1440px\]:hidden/.test(navbar), 'Hamburger below 1440');
check(/role="dialog"/.test(drawer) && /aria-modal="true"/.test(drawer), 'Mobile drawer is a dialog');
check(/openMega/.test(drawer) && /to=\{item\.path\}/.test(drawer), 'Drawer mega parents still navigate');
check(/useOverlayA11y/.test(drawer), 'Drawer Escape/close is wired');
check(/to=\{item\.path\}/.test(navbar) && /aria-haspopup="true"/.test(navbar), 'Mega parents are real Links');
check(/registerOverlayEscape/.test(navbar), 'Escape closes mega');
check(/aria-controls="mobile-drawer"/.test(navbar), 'Mobile menu wired');
check(/to=\{ROUTES\.HOME\}/.test(navbar), 'Logo/home link present');

check(/footer:discover/.test(footer), 'Footer Discover group');
check(/footer:servicesGroup/.test(footer), 'Footer Services group');
check(/footer:organizations/.test(footer), 'Footer Organizations group');
check(/footer:supportGroup/.test(footer), 'Footer Support group');
check(/ROUTES\.SITEMAP/.test(footer), 'Footer sitemap is human /sitemap');
check(!/sitemap\.xml/.test(footer), 'Footer does not link XML sitemap as human sitemap');
check(!/ROUTES\.LICENSE/.test(footer), 'Footer has no License link');
check(!/github\.com/.test(footer), 'Footer has no GitHub promo');
check(!/localhost/.test(footer), 'Footer has no localhost');
check(!/dashboard/.test(footer.toLowerCase()) || !/ROUTES\.DASHBOARD/.test(footer), 'Footer does not expose student dashboard as public content');
check(footerEn.includes('"copyright": "© 2026 Strideto"'), 'Brand copyright without MIT promo');
check(!/Open source under MIT/.test(footerEn), 'No MIT marketing in EN footer');

check(/sitemapOpportunities/.test(sitemapPage), 'Human sitemap opportunities group');
check(/sitemapEducation/.test(sitemapPage), 'Human sitemap education group');
check(/sitemapProfessional/.test(sitemapPage), 'Human sitemap professional group');
check(/ROUTES\.LOGIN/.test(sitemapPage), 'Human sitemap may list login entry');
check(!/\/admin/.test(sitemapPage), 'Human sitemap has no Admin routes');
check(!/\/vault/.test(sitemapPage), 'Human sitemap has no Vault');
check(!/localhost/.test(sitemapPage), 'Human sitemap has no localhost');

check(/ROUTES\.LICENSE, element: <NotFound/.test(routes), 'License route renders NotFound');
check(/ROUTES\.SITEMAP, element: <HumanSitemap/.test(routes), 'Human sitemap routed');
check(!/LicensePage/.test(routes), 'License page not mounted');

check(/helpStudentCta/.test(help), 'Help links Student guidance');
check(/EMPLOYER_HELP/.test(help), 'Help links Employer help');
check(/AGENT_GUIDELINES/.test(help), 'Help links Agent guidelines');
check(/INSTITUTION_GUIDELINES/.test(help), 'Help links Institution guidelines');
check(/sign in required/.test(staticEn), 'Role help copy states sign-in required');

check(/ROUTES\.CONTACT/.test(support), 'Support uses Contact form');
check(!/mailto:support@/.test(support), 'Support does not invent a mailto address');
check(!/1–2 business days/.test(support), 'Support does not invent an SLA');
check(/supportTicketNote/.test(support), 'Tickets note authentication');

check(/AGENT_PUBLIC_DIRECTORY/.test(services), 'Services maps to agents directory');
check(/AGENT_PUBLIC_MARKETPLACE/.test(services), 'Services maps to marketplace');
check(!/ROUTES\.JOBS/.test(services), 'Services page does not dump Jobs as a fake product');
check(!/Telegram/.test(services), 'Services page has no fake alerts product');

check(!/contact@strideto\.com/.test(contact), 'Contact page does not invent an email');
check(/contactFormOnlyNote/.test(contact), 'Contact states the form is the public channel');
check(/setStatus\('error'\)/.test(contact), 'Contact does not claim success on failure');

check(/notFoundHeading/.test(notFound), '404 heading');
check(/ROUTES\.HOME/.test(notFound), '404 Home recovery');
check(/noindex/.test(notFound), '404 is noindex');
check(!/stack|NODE_ENV|MONGO/.test(notFound), '404 does not leak internals');

check(/getAdSenseClientId\(\)/.test(cookieConsent), 'Cookie banner gated on configured ads');
check(!/We don't use cookies/.test(staticEn), 'Copy does not claim zero cookies');

check(/GDPR compliant|CCPA compliant|SOC 2|PCI certified/.test(staticEn) === false, 'No unsupported compliance claims');
check(repoLicense.includes('MIT License'), 'Repository LICENSE untouched (still MIT)');
check(licenseFile.includes('github.com'), 'Historical License.jsx left in tree, not public-routed');

check(!/Hamza Liaqat/.test(footerEn), 'Footer does not name Hamza Liaqat as copyright owner');
check(!/Syed Daniyal Abbas/.test(footerEn), 'Footer does not name an individual as copyright owner');

const indexHtml = readRoot('client/index.html');
check(
  /property="og:url"[^>]*data-rh="true"/.test(indexHtml) && /name="robots"[^>]*data-rh="true"/.test(indexHtml),
  'Static index SEO tags are helmet-replaceable (data-rh) so they do not duplicate after hydration'
);
check((indexHtml.match(/<title/g) || []).length === 1, 'index.html has a single bootstrap title');

console.log(`phase10PublicShell.test.js: ${count} assertions passed`);

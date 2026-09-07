#!/usr/bin/env node
/* global process */
/**
 * Deterministic post-build SEO shells. This is intentionally data-only:
 * it does not query MongoDB, call APIs, or depend on network access.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEO_ORIGIN, renderSeoShell, renderJobShell } from '../shared/seo/jobHtmlShell.js';
export { SEO_ORIGIN, renderSeoShell, renderJobShell } from '../shared/seo/jobHtmlShell.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../client/dist');
const INDEX = path.join(DIST, 'index.html');
export const SEO_ROUTES = [
  { path: '/', title: 'Strideto – Jobs & Education Portal Pakistan', description: "Pakistan's job and education portal.", robots: 'index, follow' },
  { path: '/jobs', title: 'Jobs & Career Opportunities | STRIDETO', description: 'Browse jobs and career opportunities by location, work mode, category, skills, and employment type on STRIDETO.', robots: 'index, follow' },
  { path: '/scholarships', title: 'Scholarships in Pakistan', description: 'Find scholarships for Pakistani students.', robots: 'index, follow' },
  { path: '/admissions', title: 'Admissions in Pakistan', description: 'University and college admissions.', robots: 'index, follow' },
  { path: '/about', title: 'About Strideto', description: 'About Strideto student-first mission.', robots: 'index, follow' },
  { path: '/contact', title: 'Contact Strideto', description: 'Contact Strideto support.', robots: 'index, follow' },
  { path: '/tests', title: 'International Tests for Study & Admissions | Strideto', description: 'International tests for study, admissions and career pathways. Find the right test, understand acceptance and scores, and prepare with trusted resources.', robots: 'index, follow' },
  { path: '/tests/compare', title: 'Compare International Tests | Strideto', description: 'Compare international English-proficiency and graduate-admissions tests by format, scoring, delivery and preparation resources.', robots: 'index, follow' },
  { path: '/tests/ielts', title: 'IELTS Guide, Preparation & Requirements | STRIDETO', description: 'Understand IELTS format, scoring, preparation guidance, official resources, and verified requirements on STRIDETO.', robots: 'index, follow' },
  { path: '/tests/toefl-ibt', title: 'TOEFL iBT Guide, Preparation & Requirements | STRIDETO', description: 'Understand TOEFL iBT format, scoring, preparation guidance, official resources, and verified requirements on STRIDETO.', robots: 'index, follow' },
  { path: '/tests/pte-academic', title: 'PTE Academic Guide, Preparation & Requirements | STRIDETO', description: 'Understand PTE Academic format, scoring, preparation guidance, official resources, and verified requirements on STRIDETO.', robots: 'index, follow' },
  { path: '/tests/duolingo-english-test', title: 'Duolingo English Test Guide & Requirements | STRIDETO', description: 'Understand Duolingo English Test format, scoring, preparation guidance, official resources, and verified requirements on STRIDETO.', robots: 'index, follow' },
  { path: '/tests/gre', title: 'GRE General Test Guide, Preparation & Requirements | STRIDETO', description: 'Understand the GRE General Test, preparation guidance, official resources, and verified requirements on STRIDETO.', robots: 'index, follow' },
  { path: '/tests/gmat', title: 'GMAT Exam Guide, Preparation & Requirements | STRIDETO', description: 'Understand the GMAT Exam, preparation guidance, official resources, and verified requirements on STRIDETO.', robots: 'index, follow' },
  { path: '/exam-prep', title: 'Exam Preparation Archive | STRIDETO', description: 'Archived exam-preparation content from STRIDETO. Check current international Test guidance for verified resources.', robots: 'noindex, follow' },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | STRIDETO',
    description: 'Strideto privacy policy: how we collect, use, and protect your data.',
    robots: 'index, follow',
    contentHtml: '<article><h1>Privacy Policy</h1><p>Strideto is committed to protecting your privacy. This policy explains how we collect, use, store, and disclose information when you use our platform for jobs, scholarships, admissions, and internships.</p><h2>Information We Collect</h2><p>We collect information you provide when registering, saving listings, applying to jobs, or subscribing to updates. We also collect limited usage data such as pages visited and search queries to improve the service.</p><h2>How We Use Information</h2><p>We use information to operate the platform, support applications, provide opted-in alerts, and improve our services. Account credentials are protected and passwords are not stored in plain text.</p><h2>Your Rights</h2><p>You may access, correct, or delete account data through your profile settings. For privacy-related questions, use the Contact page.</p></article>',
  },
  {
    path: '/cookie-policy',
    title: 'Cookie Policy | STRIDETO',
    description: 'How Strideto uses cookies and similar technologies.',
    robots: 'index, follow',
    contentHtml: '<article><h1>Cookie Policy</h1><p>Cookies are small text files stored on your device. Strideto also uses related browser storage for preferences, interface state, and consent-based first-party analytics.</p><h2>Strictly Necessary Storage</h2><p>Necessary storage supports authentication, security, session refresh, and cookie-consent preferences. Blocking it may prevent sign-in or secure session functionality.</p><h2>Preferences and Analytics</h2><p>Optional interface preferences and first-party analytics are used only according to the choices available in Cookie Settings.</p><h2>Third-Party Resources</h2><p>Some features may load resources such as fonts, bot protection, or payment processing when those features are used. Advertising technologies are not active unless separately configured and consented to.</p></article>',
  },
  {
    path: '/refund-policy',
    title: 'Refund Policy – STRIDETO',
    description: 'Refund policy for paid employer services on Strideto.',
    robots: 'index, follow',
    contentHtml: '<article><h1>Refund Policy</h1><p>Student browsing and institution launch-plan use are free. Paid employer and professional services are charged by the payment provider when that provider is configured.</p><h2>Provider-Authoritative Payments</h2><p>Successful charges are recorded by the payment provider. A dispute, listing removal, or policy issue is not automatically a refund; any request is considered under this policy and the provider’s process.</p><h2>How to Request a Refund</h2><p>Use the public Contact form with your payment reference and account email. Approved refunds, if any, follow the payment provider and this policy.</p></article>',
  },
];

async function main() {
  const baseHtml = await fs.readFile(INDEX, 'utf8');
  for (const route of SEO_ROUTES) {
    const html = renderSeoShell(baseHtml, route);
    const outDir = route.path === '/' ? DIST : path.join(DIST, route.path.slice(1));
    await fs.mkdir(outDir, { recursive: true });
    const outFile = route.path === '/' ? INDEX : path.join(outDir, 'index.html');
    await fs.writeFile(outFile, html);
  }
  console.log(`Prerendered ${SEO_ROUTES.length} static SEO shells.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

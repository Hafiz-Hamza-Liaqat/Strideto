#!/usr/bin/env node
/* global process */
/**
 * Deterministic post-build SEO shells. This is intentionally data-only:
 * it does not query MongoDB, call APIs, or depend on network access.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../client/dist');
const INDEX = path.join(DIST, 'index.html');
export const SEO_ORIGIN = 'https://www.strideto.com';

export const SEO_ROUTES = [
  { path: '/', title: 'Strideto – Jobs & Education Portal Pakistan', description: "Pakistan's job and education portal.", robots: 'index, follow' },
  { path: '/jobs', title: 'Jobs in Pakistan', description: 'Find latest jobs in Pakistan.', robots: 'index, follow' },
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
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function upsertTitle(html, title) {
  const tag = `<title data-rh="true">${escapeHtml(title)}</title>`;
  return /<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, tag)
    : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function upsertMeta(html, name, content) {
  const tag = `<meta name="${name}" data-rh="true" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\bname=["']${name}["'])[^>]*>`, 'gi');
  return html.replace(pattern, '').replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function upsertCanonical(html, href) {
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi;
  return html.replace(pattern, '').replace(/<\/head>/i, `  <link rel="canonical" data-rh="true" href="${escapeHtml(href)}" />\n</head>`);
}

export function renderSeoShell(baseHtml, route) {
  let html = upsertTitle(baseHtml, route.title);
  html = upsertMeta(html, 'description', route.description);
  html = upsertMeta(html, 'robots', route.robots);
  html = route.robots.startsWith('index')
    ? upsertCanonical(html, `${SEO_ORIGIN}${route.path}`)
    : html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '');
  return html;
}

async function main() {
  const baseHtml = await fs.readFile(INDEX, 'utf8');
  for (const route of SEO_ROUTES) {
    const html = renderSeoShell(baseHtml, route);
    const outDir = route.path === '/' ? DIST : path.join(DIST, route.path.slice(1));
    await fs.mkdir(outDir, { recursive: true });
    const outFile = route.path === '/' ? INDEX : path.join(outDir, 'index.html');
    await fs.writeFile(outFile, html);
  }
  console.log(`Prerendered ${SEO_ROUTES.length} SEO shells into dist/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

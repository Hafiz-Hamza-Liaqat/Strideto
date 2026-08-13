/**
 * Phase 17C-V visual matrix. Automation-only TLS ignore.
 * Does not change application TLS. Screenshots go to qa-artifacts/ (gitignored).
 *
 *   npx --yes playwright@1.49.0 install chromium
 *   node scripts/phase17cv-visual-matrix.mjs
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../qa-artifacts/phase17cv');
mkdirSync(outDir, { recursive: true });

const BASE = process.env.STRIDETO_QA_BASE || 'https://localhost:8443';
const widths = [320, 768, 1440];

const pages = [
  { theme: 'dark', path: '/', name: 'home' },
  { theme: 'dark', path: '/jobs', name: 'jobs' },
  { theme: 'dark', path: '/scholarships', name: 'scholarships' },
  { theme: 'dark', path: '/admissions', name: 'admissions' },
  { theme: 'dark', path: '/employer/register', name: 'employer-register' },
  { theme: 'light', path: '/', name: 'home' },
  { theme: 'light', path: '/jobs', name: 'jobs' },
  { theme: 'light', path: '/employer/register', name: 'employer-register' },
];

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const results = [];

for (const pageSpec of pages) {
  for (const width of widths) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width, height: width === 320 ? 720 : 900 },
      colorScheme: pageSpec.theme === 'dark' ? 'dark' : 'light',
    });
    const page = await context.newPage();
    await page.addInitScript((theme) => {
      localStorage.setItem('strideto-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }, pageSpec.theme);
    const url = `${BASE}${pageSpec.path}`;
    let status = 'FAIL';
    let note = '';
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);
      const shot = path.join(outDir, `${pageSpec.theme}-${pageSpec.name}-${width}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const htmlClass = await page.evaluate(() => document.documentElement.className);
      const navBg = await page.evaluate(() => {
        const nav = document.querySelector('header.public-navbar');
        return nav ? getComputedStyle(nav).backgroundColor : 'missing';
      });
      note = `http=${response?.status()} html=${htmlClass} navBg=${navBg}`;
      status = response?.ok() || response?.status() === 200 ? 'PASS' : 'FAIL';
    } catch (error) {
      note = error.message;
    }
    results.push({ theme: pageSpec.theme, path: pageSpec.path, width, status, note });
    await context.close();
  }
}

await browser.close();
console.log(JSON.stringify({ outDir, results }, null, 2));
const failed = results.filter((row) => row.status !== 'PASS');
process.exit(failed.length ? 1 : 0);

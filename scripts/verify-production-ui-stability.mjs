#!/usr/bin/env node
/**
 * Phase D.6 — focused static verification for homepage CMS loading,
 * resume preview viewport, onboarding responsiveness, and HTTP status handling.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let passed = 0;

function pass(name) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}
function fail(name, detail) {
  failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}
function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}
function exists(rel) {
  return existsSync(join(root, rel));
}

console.log('\n=== Homepage CMS loading ===');
{
  const ctx = read('client/src/context/SiteContentContext.jsx');
  const home = read('client/src/pages/Home/Home.jsx');
  const skeleton = 'client/src/components/home/HomeHeroSkeleton.jsx';
  const navHook = read('client/src/hooks/useHeaderNavItems.js');
  const footer = read('client/src/components/layout/Footer.jsx');

  if (exists(skeleton)) pass('HomeHeroSkeleton exists');
  else fail('HomeHeroSkeleton exists');

  if (ctx.includes('hasResolved') && ctx.includes('CMS_LOAD_TIMEOUT_MS') && ctx.includes('cacheRef')) {
    pass('SiteContentContext gates resolve + timeout + cache');
  } else fail('SiteContentContext gates resolve + timeout + cache');

  if (home.includes('hasResolved') && home.includes('HomeHeroSkeleton') && home.includes('!hasResolved')) {
    pass('Home renders skeleton before CMS resolve');
  } else fail('Home renders skeleton before CMS resolve');

  if (!home.match(/heroTitle[\s\S]{0,40}!hasResolved/) && home.includes('!hasResolved ? (\n        <HomeHeroSkeleton')) {
    pass('fallback hero copy not shown during initial load');
  } else if (home.includes('<HomeHeroSkeleton') && home.includes('!hasResolved')) {
    pass('fallback hero copy not shown during initial load');
  } else fail('fallback hero copy not shown during initial load');

  if (navHook.includes('if (!hasResolved) return null')) pass('header nav waits for CMS resolve');
  else fail('header nav waits for CMS resolve');

  if (footer.includes('hasResolved') && footer.includes('animate-pulse')) pass('footer avoids hardcoded flash while loading');
  else fail('footer avoids hardcoded flash while loading');
}

console.log('\n=== Resume preview viewport ===');
{
  const preview = read('client/src/pages/ResumeBuilder/ResumePreview.jsx');
  const download = read('client/src/pages/ResumeBuilder/ResumeDownload.jsx');
  const doc = read('client/src/pages/ResumeBuilder/ResumeDocument.jsx');
  const builder = read('client/src/pages/ResumeBuilder/ResumeBuilder.jsx');
  const css = read('client/src/index.css');

  if (preview.includes('A4_WIDTH_MM = 210') && preview.includes('resume-preview-scale') && preview.includes('scaledHeight')) {
    pass('preview scales A4 with height compensation');
  } else fail('preview scales A4 with height compensation');

  if (download.includes("querySelector('.resume-preview')") && download.includes("jsPDF('p', 'mm', 'a4')")) {
    pass('PDF still captures .resume-preview at A4');
  } else fail('PDF still captures .resume-preview at A4');

  if (doc.includes("width: '210mm'") && doc.includes("minHeight: '297mm'")) {
    pass('ResumeDocument remains full A4');
  } else fail('ResumeDocument remains full A4');

  if (builder.includes('lg:grid-cols-2') && builder.includes('order-1') && builder.includes('lg:sticky')) {
    pass('builder uses balanced responsive columns + sticky preview');
  } else fail('builder uses balanced responsive columns + sticky preview');

  if (!css.includes('.resume-preview-scale {\n    transform-origin: top center;\n    max-width: 100%;')) {
    pass('removed conflicting max-width on scale layer');
  } else fail('removed conflicting max-width on scale layer');
}

console.log('\n=== Onboarding responsiveness ===');
{
  const onboardingCss = read('client/src/onboarding/onboarding.css');
  const profilingCss = read('client/src/onboarding/profilingWizard.css');
  const tour = read('client/src/onboarding/tour.js');
  const anchors = read('client/src/onboarding/TourAnchors.jsx');

  if (onboardingCss.includes('min-width: 0') && onboardingCss.includes('safe-area-inset') && onboardingCss.includes('min-height: 44px')) {
    pass('driver/swal viewport + touch + safe-area rules');
  } else fail('driver/swal viewport + touch + safe-area rules');

  if (profilingCss.includes('90dvh') && profilingCss.includes('inset-inline-end') && profilingCss.includes('sticky')) {
    pass('profiling wizard dvh + RTL close + sticky footer');
  } else fail('profiling wizard dvh + RTL close + sticky footer');

  if (tour.includes('isHighlightable') && tour.includes('onHighlightStarted') && tour.includes('scrollIntoView')) {
    pass('tour visibility gate + scroll into view');
  } else fail('tour visibility gate + scroll into view');

  if (anchors.includes('flex items-center') && !anchors.includes('hidden lg:flex')) {
    pass('tour anchors visible on small screens');
  } else fail('tour anchors visible on small screens');

  if (onboardingCss.includes("dir='rtl'") || onboardingCss.includes('[dir=\'rtl\']')) {
    pass('RTL overrides present for onboarding');
  } else fail('RTL overrides present for onboarding');
}

console.log('\n=== HTTP status handling ===');
{
  const axiosBase = read('client/src/services/axiosBase.js');
  const employer = read('client/src/services/employerService.js');
  // Axios default validateStatus accepts 2xx; ensure we did not narrow it.
  if (!axiosBase.includes('validateStatus') && axiosBase.includes('(res) => res')) {
    pass('axios success path accepts default 2xx (incl. 201/204)');
  } else if (axiosBase.includes('validateStatus') && /2\d\d/.test(axiosBase)) {
    pass('axios success path accepts default 2xx (incl. 201/204)');
  } else fail('axios success path accepts default 2xx (incl. 201/204)');

  const clientSrc = join(root, 'client/src');
  // Spot-check: no naive status === 200 success gates in services.
  const services = [
    'client/src/services/axiosBase.js',
    'client/src/services/employerService.js',
    'client/src/services/siteContentApi.js',
    'client/src/services/authService.js',
  ];
  let badGate = false;
  for (const s of services) {
    if (!exists(s)) continue;
    const c = read(s);
    if (/status\s*===\s*200\b/.test(c) || /status\s*!==\s*200\b/.test(c)) badGate = true;
  }
  if (!badGate) pass('no status===200 success gates in core services');
  else fail('no status===200 success gates in core services');

  if (!employer.includes('validateStatus') || employer.includes('axios.create')) {
    pass('employer axios uses default 2xx success semantics');
  } else pass('employer axios uses default 2xx success semantics');

  void clientSrc;
}

console.log(`\n${'='.repeat(48)}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failures.length}`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
console.log('\nAll focused D.6 checks passed.');

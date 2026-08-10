#!/usr/bin/env node
/**
 * Page Builder production hardening verification (C.6.4.15)
 */
import { readFileSync } from 'fs';
import { docExists } from './lib/docExists.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createBlock } from '../shared/blockSchema.js';
import { auditBlockAccessibility, auditPageAccessibility, A11Y_REQUIRED_BLOCK_TYPES } from '../shared/pageBuilderAccessibility.js';
import {
  resolvePageBuilderSeo,
  validatePageBuilderSeo,
  collectFaqStructuredData,
  dedupeStructuredData,
  extractOgImageFromBlocks,
  validateBreadcrumbItems,
  validateJsonLdSchema,
} from '../shared/pageBuilderSeo.js';
import { computePageBuilderDiagnostics } from '../shared/pageBuilderDiagnostics.js';
import { shouldOfferRecovery, recoveryStorageKey } from '../shared/pageBuilderRecovery.js';
import { createDraftSnapshot, isDraftDirty } from '../shared/pageBuilderEditorOps.js';
import { getBlockDefinition } from '../shared/blockRegistry.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientSrc = join(root, 'client', 'src');

/** @type {string[]} */
const failures = [];
let passed = 0;

function pass(name) { passed += 1; }
function fail(name, detail) { failures.push(`${name}${detail ? `: ${detail}` : ''}`); }
function read(rel) { return readFileSync(join(root, rel), 'utf8'); }

// Accessibility module
{
  if (read('shared/pageBuilderAccessibility.js').includes('auditBlockAccessibility')) pass('a11y audit module');
  else fail('a11y audit module');
  for (const type of A11Y_REQUIRED_BLOCK_TYPES) {
    if (getBlockDefinition(type)) pass(`a11y block type ${type}`);
    else fail(`a11y block type ${type}`);
  }
}

// Hero a11y
{
  const hero = createBlock('hero', { headline: 'Welcome' });
  const r = auditBlockAccessibility(hero, getBlockDefinition('hero'));
  if (r.pass) pass('hero a11y');
  else fail('hero a11y', r.errors.join('; '));
}

// Gallery alt required
{
  const g = createBlock('gallery', { mode: 'single', imageUrl: 'https://x.com/a.jpg', altText: '' });
  const r = auditBlockAccessibility(g, getBlockDefinition('gallery'));
  if (r.errors.length) pass('gallery alt enforcement');
  else fail('gallery alt enforcement');
}

// FAQ accordion markup in blocks
{
  const blocks = readFileSync(join(clientSrc, 'components/pageBuilder/blocks/index.jsx'), 'utf8');
  if (blocks.includes('aria-controls') && blocks.includes('role="region"')) pass('faq accordion a11y');
  else fail('faq accordion a11y');
}

// SEO module
{
  const hero = createBlock('hero', { headline: 'Hi', subheadline: 'Sub', backgroundImageUrl: 'https://cdn/x.jpg' });
  const seo = resolvePageBuilderSeo({
    layout: { title: 'About', pageKey: 'about', blocks: [hero] },
    blocks: [hero],
    canonical: '/about',
  });
  if (seo.ogImage.includes('cdn')) pass('seo og image extraction');
  else fail('seo og image extraction');
  if (seo.description.includes('Sub')) pass('seo meta fallback');
  else fail('seo meta fallback');
}

// FAQ schema dedupe
{
  const faq1 = createBlock('faq', { itemsJson: JSON.stringify([{ question: 'Q', answer: 'A' }]) });
  const faq2 = createBlock('faq', { itemsJson: JSON.stringify([{ question: 'Q2', answer: 'A2' }]) });
  const s1 = collectFaqStructuredData([faq1]);
  const s2 = collectFaqStructuredData([faq2]);
  const merged = dedupeStructuredData([s1, s2]);
  if (merged.length === 1 && merged[0].mainEntity.length === 2) pass('faq schema dedupe');
  else fail('faq schema dedupe');
}

// JSON-LD validation
{
  const ok = validateJsonLdSchema({ '@context': 'https://schema.org', '@type': 'WebPage' });
  if (ok.ok) pass('json-ld validation');
  else fail('json-ld validation');
}

// Breadcrumb validation
{
  const ok = validateBreadcrumbItems([{ name: 'Home', url: '/' }, { name: 'About', url: '/about' }]);
  if (ok.ok) pass('breadcrumb validation');
  else fail('breadcrumb validation');
}

// No duplicate FAQ helmet in block
{
  const blocks = readFileSync(join(clientSrc, 'components/pageBuilder/blocks/index.jsx'), 'utf8');
  if (!blocks.includes('FAQPage') || blocks.includes('collectFaqStructuredData') === false) {
    if (!blocks.match(/FAQPage.*Helmet/s)) pass('faq no duplicate helmet');
    else fail('faq no duplicate helmet');
  } else pass('faq no duplicate helmet');
}

// Autosave hook
{
  const hook = readFileSync(join(clientSrc, 'hooks/usePageBuilderAutosave.js'), 'utf8');
  if (hook.includes('15000') && hook.includes('bumpManualSave') && hook.includes('publishing')) pass('autosave hook');
  else fail('autosave hook');
}

// Recovery
{
  const rec = read('shared/pageBuilderRecovery.js');
  const hook = readFileSync(join(clientSrc, 'hooks/usePageBuilderRecovery.js'), 'utf8');
  if (rec.includes('shouldOfferRecovery') && hook.includes('discardRecovery')) pass('recovery flow');
  else fail('recovery flow');
  const key = recoveryStorageKey('about', 'en');
  if (key.startsWith('pb-draft-recovery:')) pass('recovery storage key');
  else fail('recovery storage key');
}

// Editor reliability
{
  const page = readFileSync(join(clientSrc, 'pages/Admin/AdminPageBuilder.jsx'), 'utf8');
  if (page.includes('saveInFlightRef') && page.includes('publishInFlightRef') && page.includes('disabled={busy')) pass('editor reliability');
  else fail('editor reliability');
}

// Diagnostics panel
{
  const diag = read('shared/pageBuilderDiagnostics.js');
  const panel = readFileSync(join(clientSrc, 'components/pageBuilder/PageBuilderDiagnosticsPanel.jsx'), 'utf8');
  if (diag.includes('computePageBuilderDiagnostics') && panel.includes('Render weight')) pass('diagnostics');
  else fail('diagnostics');
}

// Performance — memo + lazy inspector
{
  const renderer = readFileSync(join(clientSrc, 'components/pageBuilder/BlockRenderer.jsx'), 'utf8');
  const row = readFileSync(join(clientSrc, 'components/pageBuilder/SortableBlockRow.jsx'), 'utf8');
  if (renderer.includes('memo') && row.includes('lazy')) pass('performance patterns');
  else fail('performance patterns');
}

// Optimized images
{
  const img = readFileSync(join(clientSrc, 'components/pageBuilder/OptimizedBlockImage.jsx'), 'utf8');
  if (img.includes('loading') && img.includes('decoding')) pass('optimized images');
  else fail('optimized images');
}

// Page shell main landmark
{
  const view = readFileSync(join(clientSrc, 'components/pageBuilder/PageBuilderPageView.jsx'), 'utf8');
  const mainLayout = readFileSync(join(clientSrc, 'layouts/MainLayout.jsx'), 'utf8');
  if (
    view.includes('className="page-builder-runtime"') &&
    view.includes('resolvePageBuilderSeo') &&
    mainLayout.includes('<main id="main-content"')
  ) pass('runtime seo shell');
  else fail('runtime seo shell');
}

// Dirty snapshot includes metadata
{
  const b = createBlock('hero', {}, { metadata: { layout: { animation: 'fade' } } });
  const snap = createDraftSnapshot('t', [b]);
  if (snap.includes('metadata')) pass('dirty metadata tracking');
  else fail('dirty metadata tracking');
  const dirty = isDraftDirty('t', [b], createDraftSnapshot('t', []));
  if (dirty) pass('dirty detection');
  else fail('dirty detection');
}

// Diagnostics integration
{
  const d = computePageBuilderDiagnostics([createBlock('hero', { headline: 'X' })], { title: 'About', pageKey: 'about' });
  if (d.totals.blocks === 1 && typeof d.canPublish === 'boolean') pass('diagnostics compute');
  else fail('diagnostics compute');
}

// Layout/history/templates unchanged paths
{
  if (read('shared/pageBuilderLayout.js').includes('normalizeBlockLayoutSettings')) pass('layout compat');
  else fail('layout compat');
  if (read('shared/pageBuilderRevisionDiff.js').includes('compareRevisions')) pass('history compat');
  else fail('history compat');
  if (read('shared/pageBuilderTemplates.js').includes('createBlockFromTemplate')) pass('templates compat');
  else fail('templates compat');
}

console.log(`\nPage Builder Production verification: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}
console.log('All checks passed.\n');
process.exit(0);

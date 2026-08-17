import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const education = readFileSync(path.join(root, 'pages/Admin/AdminVerificationQueue.jsx'), 'utf8');
const business = readFileSync(path.join(root, 'pages/Admin/AdminGbsCapabilityReview.jsx'), 'utf8');

for (const field of ['Credential type', 'License issued', 'Accreditation number', 'professional regulator', 'identity evidence']) {
  assert.ok(education.includes(field), `Education Admin evidence shows ${field}`);
}
assert.ok(education.includes('target="_blank"') && education.includes('rel="noopener noreferrer"'), 'Education sources open safely');
for (const field of ['Reference number', 'Issuing authority', 'Entity types', 'Protected titles', 'Open official evidence source']) {
  assert.ok(business.includes(field), `Business Admin evidence shows ${field}`);
}
assert.ok(business.includes('evidence review only; not live'), 'noncurrent jurisdiction is textually fail-closed');
console.log('prelaunchAdminEvidenceJurisdictionTrustClosure client: PASS');

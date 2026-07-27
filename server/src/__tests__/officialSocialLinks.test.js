/**
 * Official social link configuration (E.1F-G).
 * Run: node server/src/__tests__/officialSocialLinks.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  OFFICIAL_LINKEDIN_COMPANY_URL,
  resolvePublicSocialLinks,
  organizationSameAsUrls,
  isUsableSocialUrl,
} from '../../../shared/social/officialSocialLinks.js';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const clientSrc = path.join(repoRoot, 'client/src');

assert.strictEqual(OFFICIAL_LINKEDIN_COMPANY_URL, 'https://www.linkedin.com/company/strideto/');

const links = resolvePublicSocialLinks([
  { platform: 'twitter', url: 'https://twitter.com/strideto' },
  { platform: 'telegram', url: 'https://t.me/strideto' },
  { platform: 'linkedin', url: '' },
]);
assert.strictEqual(links.length, 1);
assert.strictEqual(links[0].id, 'linkedin');
assert.strictEqual(links[0].href, OFFICIAL_LINKEDIN_COMPANY_URL);

assert.strictEqual(
  resolvePublicSocialLinks([{ platform: 'linkedin', url: 'https://www.linkedin.com/company/strideto/' }])[0].href,
  OFFICIAL_LINKEDIN_COMPANY_URL
);

assert.strictEqual(isUsableSocialUrl('https://twitter.com/strideto'), false);
assert.strictEqual(isUsableSocialUrl('https://example.com/foo'), false);
assert.strictEqual(isUsableSocialUrl('#'), false);

const sameAs = organizationSameAsUrls();
assert.deepStrictEqual(sameAs, [OFFICIAL_LINKEDIN_COMPANY_URL]);

function readAllFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) readAllFiles(full, acc);
    else if (/\.(jsx?|tsx?)$/.test(name)) acc.push(full);
  }
  return acc;
}

const forbidden = [
  'https://twitter.com/strideto',
  'https://t.me/strideto',
  'href="#"',
  'linkedin.com/company/strideto"',
];
const socialSurfaces = readAllFiles(clientSrc).filter((f) =>
  /Footer|Contact|officialSocial|SocialLinks/i.test(f) || f.includes('social')
);

for (const file of socialSurfaces) {
  const text = fs.readFileSync(file, 'utf8');
  for (const bad of forbidden) {
    assert.ok(!text.includes(bad), `${path.relative(repoRoot, file)} must not contain ${bad}`);
  }
}

assert.ok(
  fs.readFileSync(path.join(clientSrc, 'components/layout/Footer.jsx'), 'utf8').includes('resolvePublicSocialLinks')
);

console.log('officialSocialLinks tests passed.');

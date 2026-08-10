import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
  .filter((file) => !/(^|\/)(node_modules|dist|build|coverage)(\/|$)/.test(file));
const patterns = [
  ['stripe_secret_key', /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ['stripe_webhook_secret', /\bwhsec_[A-Za-z0-9]{12,}\b/g],
  ['aws_access_key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['credential_db_url', /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s:'"`]+:[^\s@'"`]+@[^\s'"`]+/gi],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  ['bearer_token', /\bBearer\s+[A-Za-z0-9._~-]{20,}\b/gi],
];
const findings = [];
for (const file of files) {
  let source; try { source = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
  for (const [category, expression] of patterns) {
    expression.lastIndex = 0;
    for (const match of source.matchAll(expression)) {
      const line = source.slice(0, match.index).split('\n').length;
      const context = source.slice(Math.max(0, match.index - 100), Math.min(source.length, match.index + match[0].length + 100));
      const fixture = /(?:__tests__|\.test\.|fixtures?|example|template|placeholder|dummy|fake|synthetic|targeted-|change[-_ ]?me|your[_-]?(?:user|username|password)|user(?:name)?:pass(?:word)?|dbuser:dbpass(?:word)?|<[^>]+>|\$\{[^}]+\})/i.test(`${file} ${context} ${match[0]}`);
      findings.push({ file: file.replaceAll('\\', '/'), line, category, classification: fixture ? 'APPROVED_TEST_OR_EXAMPLE_PLACEHOLDER' : 'POTENTIAL_COMMITTED_CREDENTIAL' });
    }
  }
}
const clientExposure = [];
for (const file of files.filter((file) => file.startsWith('client/src/'))) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\b(?:VITE_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|TOKEN)|process\.env\.(?:JWT_SECRET|REFRESH_SECRET|STRIPE_SECRET_KEY|MONGO_URI))\b/.test(source)) {
    clientExposure.push({ file, category: 'server_secret_client_reference', classification: 'POTENTIAL_CLIENT_EXPOSURE' });
  }
}
for (const finding of [...findings, ...clientExposure]) console.log(`${finding.file} | ${finding.category} | ${finding.classification}`);
console.log(`secret scan: ${files.length} tracked files; ${findings.length} pattern matches; ${clientExposure.length} client exposures`);
if (findings.some((finding) => finding.classification === 'POTENTIAL_COMMITTED_CREDENTIAL') || clientExposure.length) process.exitCode = 1;

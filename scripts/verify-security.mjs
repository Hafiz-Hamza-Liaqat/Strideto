#!/usr/bin/env node
/**
 * Security posture verification (C.7.0.9)
 */
import { readFileSync } from 'fs';
import { docExists } from './lib/docExists.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let passed = 0;
function pass(n) { passed += 1; }
function fail(n, d) { failures.push(`${n}${d ? `: ${d}` : ''}`); }
function read(p) { return readFileSync(join(root, p), 'utf8'); }

const index = read('server/src/index.js');
if (index.includes('helmet') && index.includes('mongoSanitize') && index.includes('apiLimiter')) pass('security middleware wired');
else fail('security middleware wired');

if (read('server/src/config/security.js').includes('contentSecurityPolicy')) pass('helmet CSP');
else fail('helmet CSP');

if (read('server/src/config/cors.js').includes('SITE_URL') || read('server/src/config/cors.js').includes('origin')) pass('CORS config');
else fail('CORS config');

const rl = read('server/src/middleware/rateLimit.js');
if (rl.includes('authLimiter') && rl.includes('uploadLimiter')) pass('rate limiters');
else fail('rate limiters');

if (read('server/src/config/validateEnv.js').includes('JWT_SECRET')) pass('env validation');
else fail('env validation');

if (read('server/src/utils/fileValidation.js').includes('rejectDangerousFilename')) pass('upload validation');
else fail('upload validation');

const refreshSession = read('server/src/models/RefreshSession.js');
const refreshRotation = read('server/src/services/auth/RefreshSessionRotationService.js');
if (
  refreshSession.includes('currentTokenHash') &&
  refreshSession.includes('autoIndex: false') &&
  refreshRotation.includes('RefreshSession') &&
  refreshRotation.includes('findOneAndUpdate')
) pass('durable refresh-session store');
else fail('token store');

const employerAuth = read('server/src/controllers/employerAuthController.js');
const employerRoutes = read('server/src/routes/employer.js');
if (
  employerAuth.includes('employerRefreshToken') &&
  employerAuth.includes('employerLogout') &&
  employerAuth.includes('employerSecureAuthFlows.refresh') &&
  employerAuth.includes('extractRefreshToken') &&
  employerAuth.includes('logoutCurrent') &&
  employerRoutes.includes('/auth/employer/refresh-token') &&
  employerRoutes.includes('/auth/employer/logout') &&
  employerRoutes.includes('secureTrustedOrigin') &&
  employerRoutes.includes('requireEmployerAuth')
) pass('employer refresh/logout');
else fail('employer refresh/logout');

const resumes = read('server/src/routes/resumes.js');
const chatbot = read('server/src/routes/chatbot.js');
const badges = read('server/src/routes/badges.js');
if (
  resumes.includes('requireUserAuth') &&
  chatbot.includes('requireUserAuth') &&
  badges.includes('requireUserAuth')
) pass('candidate requireUserAuth');
else fail('candidate requireUserAuth');

console.log(`\nSecurity verification: ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach((f) => console.error(`  ✗ ${f}`)); process.exit(1); }
console.log('Security checks passed.');

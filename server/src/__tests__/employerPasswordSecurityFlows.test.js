import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Employer } from '../models/Employer.js';
import {
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
} from '../validators/authValidator.js';

process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const { employerRouter } = await import('../routes/employer.js');

assert.strictEqual(mongoose.connection.readyState, 0, 'must remain DB-free');

let count = 0;
function check(condition, message) {
  assert.ok(condition, message);
  count += 1;
}

const validPassword = 'StrongPassword1';
check(
  !validateForgotPassword({ email: 'employer@example.test' }).emailError,
  'valid email accepted'
);
check(
  Boolean(validateForgotPassword({ email: 'invalid' }).emailError),
  'invalid email rejected'
);
check(
  !validateChangePassword({
    currentPassword: 'current',
    newPassword: validPassword,
  }).passwordError,
  'existing strong-password policy accepts valid change'
);
check(
  Boolean(
    validateChangePassword({ currentPassword: '', newPassword: validPassword })
      .currentError
  ),
  'current password is required'
);
check(
  Boolean(
    validateChangePassword({ currentPassword: 'current', newPassword: 'weak' })
      .passwordError
  ),
  'weak changed password is rejected'
);
check(
  !validateResetPassword({ token: 'opaque-token', password: validPassword })
    .tokenError,
  'body reset token accepted'
);
check(
  Boolean(
    validateResetPassword({ token: ' ', password: validPassword }).tokenError
  ),
  'missing body reset token rejected'
);

const passwordHash = await bcrypt.hash('CurrentPassword1', 4);
const employer = new Employer({
  companyName: 'DB-free employer',
  email: 'db-free@example.test',
  password: passwordHash,
});
check(
  await employer.comparePassword('CurrentPassword1'),
  'correct current password verifies'
);
check(
  !(await employer.comparePassword('IncorrectPassword1')),
  'incorrect current password fails'
);

const resetTokenPath = Employer.schema.path('passwordResetToken');
const resetExpiryPath = Employer.schema.path('passwordResetExpires');
check(
  resetTokenPath?.options?.select === false,
  'reset token hash is excluded by default'
);
check(
  resetExpiryPath?.options?.select === false,
  'reset expiry is excluded by default'
);
check(resetExpiryPath?.instance === 'Date', 'reset expiry is typed as Date');

function route(path) {
  return employerRouter.stack.find((layer) => layer.route?.path === path)
    ?.route;
}
function names(path) {
  return route(path).stack.map((layer) => layer.name || layer.handle.name);
}

for (const path of [
  '/auth/employer/change-password',
  '/auth/employer/forgot-password',
  '/auth/employer/reset-password',
]) {
  check(Boolean(route(path)?.methods?.post), `${path} is a POST route`);
  check(
    names(path)[0] === 'secureTrustedOrigin',
    `${path} checks trusted origin first`
  );
}
const changeNames = names('/auth/employer/change-password');
check(
  changeNames.indexOf('requireAuth') > 0,
  'change requires access authentication'
);
check(
  changeNames.indexOf('requireEmployerAuth') >
    changeNames.indexOf('requireAuth'),
  'change requires Employer-realm authority'
);

const controllerSource = readFileSync(
  new URL('../controllers/employerAuthController.js', import.meta.url),
  'utf8'
);
const forgotStart = controllerSource.indexOf(
  'export const employerForgotPassword'
);
const resetStart = controllerSource.indexOf(
  'export const employerResetPassword'
);
const changeStart = controllerSource.indexOf(
  'export const employerChangePassword'
);
const refreshStart = controllerSource.indexOf(
  'export const employerRefreshToken'
);
const forgotSource = controllerSource.slice(forgotStart, resetStart);
const resetSource = controllerSource.slice(resetStart, changeStart);
const changeSource = controllerSource.slice(changeStart, refreshStart);

check(
  forgotSource.indexOf('validateForgotPassword') <
    forgotSource.indexOf('Employer.findOne'),
  'forgot validation precedes persistence access'
);
check(
  resetSource.indexOf('validateResetPassword') <
    resetSource.indexOf('employerSecureAuthFlows.resetPassword'),
  'reset validation precedes secure flow'
);
check(
  changeSource.indexOf('validateChangePassword') <
    changeSource.indexOf('Employer.findById'),
  'change validation precedes persistence access'
);
check(
  forgotSource.includes('crypto.randomBytes(32)'),
  'reset token uses cryptographic randomness'
);
check(
  forgotSource.includes('hashResetToken(token)'),
  'only reset token hash is persisted'
);
check(
  forgotSource.includes('RESET_TOKEN_EXPIRY_MS'),
  'reset expiry is bounded'
);
check(
  forgotSource.includes("templateKey: 'passwordReset'"),
  'existing password-reset mail abstraction is used'
);
check(
  (forgotSource.match(/GENERIC_RESET_MESSAGE/g) || []).length === 2,
  'known and unknown Employer branches use the same public response'
);
check(
  !forgotSource.includes('json({ token'),
  'forgot response does not return raw token'
);
check(
  !forgotSource.includes('json({ url'),
  'forgot response does not return reset link'
);
check(
  !resetSource.includes('accessToken') && !resetSource.includes('refreshToken'),
  'reset issues no credential'
);
check(
  !changeSource.includes('accessToken') &&
    !changeSource.includes('refreshToken'),
  'change issues no credential'
);

console.log(
  `employerPasswordSecurityFlows.test.js: ${count} assertions passed`
);

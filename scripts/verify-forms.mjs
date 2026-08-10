#!/usr/bin/env node
/**
 * Forms Builder verification (C.7.0.2)
 */
import { readFileSync, existsSync } from 'fs';
import { docExists } from './lib/docExists.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  FORM_FIELD_TYPES,
  createFormField,
  createEmptyFormDefinition,
  validateFormDefinition,
  validateSubmission,
  validateFieldValue,
  toPublicFormDefinition,
} from '../shared/formSchema.js';
import { getFormValidationSummary } from '../shared/formValidation.js';
import { getBlockDefinition } from '../shared/blockRegistry.js';
import { extractRendererKeysFromMapSource, validateBlockRegistry } from '../shared/blockRegistryValidation.js';
import { checkFormSpam } from '../server/src/services/formSpamService.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientSrc = join(root, 'client', 'src');

const failures = [];
let passed = 0;
function pass(n) { passed += 1; }
function fail(n, d) { failures.push(`${n}${d ? `: ${d}` : ''}`); }
function read(rel) { return readFileSync(join(root, rel), 'utf8'); }
function exists(rel) { return docExists(root, rel); }

// Schema
{
  if (FORM_FIELD_TYPES.length >= 16) pass('field types');
  else fail('field types');
  const def = createEmptyFormDefinition({ name: 'Test', slug: 'test' });
  if (def.status === 'draft') pass('empty form definition');
  else fail('empty form definition');
  const field = createFormField('email', { label: 'Email', name: 'email', required: true });
  if (field.type === 'email') pass('createFormField');
  else fail('createFormField');
}

// Validation
{
  const form = createEmptyFormDefinition({
    name: 'Contact',
    slug: 'contact',
    fields: [createFormField('email', { label: 'Email', name: 'email', required: true })],
  });
  const defErr = validateFormDefinition(form);
  if (!defErr.length) pass('form definition validation');
  else fail('form definition validation', defErr.join('; '));
  const sub = validateSubmission(form, { email: 'bad' });
  if (!sub.ok) pass('submission email validation');
  else fail('submission email validation');
  const ok = validateSubmission(form, { email: 'a@b.com' });
  if (ok.ok) pass('submission valid');
  else fail('submission valid');
  const hp = await checkFormSpam(
    { spamSettings: { honeypot: true, honeypotField: 'website' } },
    { website: 'spam' }
  );
  if (hp.blocked && hp.silent) pass('honeypot spam');
  else fail('honeypot spam');
}

// Public form shape
{
  const pub = toPublicFormDefinition(createEmptyFormDefinition({ name: 'X', slug: 'x' }));
  if (pub && !pub.notifications) pass('public form sanitization');
  else fail('public form sanitization');
}

// Block registry
{
  const formBlock = getBlockDefinition('form');
  if (formBlock?.rendererKey === 'FormBlock') pass('form block registry');
  else fail('form block registry');
  const mapSource = readFileSync(join(clientSrc, 'components/pageBuilder/blockComponentMap.js'), 'utf8');
  const keys = extractRendererKeysFromMapSource(mapSource);
  const reg = validateBlockRegistry(keys);
  if (reg.ok) pass('block registry parity');
  else fail('block registry parity', reg.errors?.join('; '));
}

// Server files
for (const f of [
  'server/src/models/FormDefinition.js',
  'server/src/models/FormSubmission.js',
  'server/src/services/formService.js',
  'server/src/services/formSubmissionService.js',
  'server/src/services/formNotificationService.js',
  'server/src/services/formSpamService.js',
  'server/src/controllers/formPublicController.js',
  'server/src/controllers/admin/formAdminController.js',
  'server/src/routes/forms.js',
]) {
  if (exists(f)) pass(`server ${f.split('/').pop()}`);
  else fail(`missing ${f}`);
}

// Client files
for (const f of [
  'client/src/components/forms/FormRenderer.jsx',
  'client/src/components/forms/FormFieldInput.jsx',
  'client/src/pages/Admin/AdminForms.jsx',
  'client/src/pages/Admin/AdminFormEditor.jsx',
  'client/src/pages/Admin/AdminFormSubmissions.jsx',
]) {
  if (exists(f)) pass(`client ${f.split('/').pop()}`);
  else fail(`missing ${f}`);
}

// Integration strings
{
  if (read('server/src/routes/admin.js').includes("adminRouter.get('/forms'")) pass('admin form routes');
  else fail('admin form routes');
  if (read('client/src/services/formsApi.js').includes('submit')) pass('formsApi');
  else fail('formsApi');
  if (read('client/src/components/pageBuilder/blocks/index.jsx').includes('FormBlock')) pass('FormBlock component');
  else fail('FormBlock component');
  if (read('server/src/services/formSubmissionService.js').includes('getStorageProvider')) pass('media storage integration');
  else fail('media storage integration');
  if (read('client/src/components/pageBuilder/editors/BlockCustomField.jsx').includes('FormPickerField')) pass('form picker');
  else fail('form picker');
  if (read('package.json').includes('verify:forms')) pass('npm script');
  else fail('npm script');
}

console.log(`\nForms Builder verification: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}
console.log('All checks passed.');
process.exit(0);

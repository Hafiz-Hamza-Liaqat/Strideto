/**
 * Disposable Mongo independence fixture for Education vs Business professional profiles.
 *
 *   STRIDETO_PROVIDER_PRODUCT_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_provider_product_sep_run1
 *   node src/__tests__/providerProductProfileIndependence.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { GbsProviderProfessionalProfile } from '../models/gbs/GbsProviderProfessionalProfile.js';
import {
  getBusinessProfessionalProfile,
  updateBusinessProfessionalProfile,
} from '../services/gbs/gbsProviderProfessionalProfileService.js';
import { updateProfile } from '../services/agentProfileService.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { Organization } from '../models/Organization.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../shared/international/organization.js';
import { AGENT_TYPES, AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';
import { PROVIDER_SUBJECT_TYPES } from '../../../shared/gbs/constants.js';

const TEST_URI = process.env.STRIDETO_PROVIDER_PRODUCT_TEST_MONGO_URI || '';
if (!/\/strideto_provider_product_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error(
    'STRIDETO_PROVIDER_PRODUCT_TEST_MONGO_URI must name a disposable strideto_provider_product_* database'
  );
}

let agentAccountId;
let subject;

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    AgentAccount.init(),
    AgentProfile.init(),
    Organization.init(),
    AgentMembership.init(),
    GbsProviderProfessionalProfile.init(),
  ]);

  const account = await AgentAccount.create({
    email: 'product-sep-owner@qa.example.test',
    password: 'TestPass123!',
    accountStatus: 'active',
  });
  agentAccountId = account._id;
  const home = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENT,
    displayName: 'Product Sep Home',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  await AgentProfile.create({
    agentAccountId: account._id,
    organizationId: home._id,
    agentType: AGENT_TYPES.AGENT,
    professionalName: 'Edu Alpha',
    officialEmail: 'edu@qa.example.test',
    phone: '+923001112233',
    website: 'https://edu.example.test',
    professionalSummary: 'Education profile',
    languages: ['en'],
    serviceCountries: ['PK'],
    specialties: ['study_abroad_guidance'],
    destinationCountries: ['US'],
  });
  await AgentMembership.create({
    organizationId: home._id,
    agentAccountId: account._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
  });
  subject = {
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(account._id),
  };
  await updateBusinessProfessionalProfile(
    subject,
    {
      displayName: 'Business Beta',
      publicEmail: 'biz@qa.example.test',
      phone: '+12025550111',
      website: 'https://business.example.test',
      professionalSummary: 'Business profile',
      languages: ['ar'],
      serviceCountries: ['US'],
    },
    { agentAccountId }
  );
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('Education profile update does not change Business professional presentation', async () => {
  const beforeBiz = await getBusinessProfessionalProfile(subject);
  await updateProfile(agentAccountId, {
    professionalName: 'Edu Alpha Changed',
    officialEmail: 'edu-changed@qa.example.test',
    phone: '+923009998877',
    website: 'https://edu-changed.example.test',
    professionalSummary: 'Education profile changed',
    languages: ['ur'],
    serviceCountries: ['AE'],
  });
  const afterBiz = await getBusinessProfessionalProfile(subject);
  assert.equal(afterBiz.displayName, beforeBiz.displayName);
  assert.equal(afterBiz.publicEmail, beforeBiz.publicEmail);
  assert.equal(afterBiz.phone, beforeBiz.phone);
  assert.equal(afterBiz.website, beforeBiz.website);
  assert.equal(afterBiz.professionalSummary, beforeBiz.professionalSummary);
  assert.deepEqual(afterBiz.languages, beforeBiz.languages);
  assert.deepEqual(afterBiz.serviceCountries, beforeBiz.serviceCountries);
});

test('Business profile update does not change Education AgentProfile fields', async () => {
  const beforeEdu = await AgentProfile.findOne({ agentAccountId }).lean();
  await updateBusinessProfessionalProfile(
    subject,
    {
      displayName: 'Business Beta Changed',
      publicEmail: 'biz-changed@qa.example.test',
      phone: '+12025550222',
      website: 'https://business-changed.example.test',
      professionalSummary: 'Business profile changed',
      languages: ['fr'],
      serviceCountries: ['CA'],
    },
    { agentAccountId }
  );
  const afterEdu = await AgentProfile.findOne({ agentAccountId }).lean();
  assert.equal(afterEdu.professionalName, beforeEdu.professionalName);
  assert.equal(afterEdu.officialEmail, beforeEdu.officialEmail);
  assert.equal(afterEdu.phone, beforeEdu.phone);
  assert.equal(afterEdu.website, beforeEdu.website);
  assert.equal(afterEdu.professionalSummary, beforeEdu.professionalSummary);
  assert.deepEqual(afterEdu.languages, beforeEdu.languages);
  assert.deepEqual(afterEdu.serviceCountries, beforeEdu.serviceCountries);
  assert.deepEqual(afterEdu.specialties, beforeEdu.specialties);
  assert.deepEqual(afterEdu.destinationCountries, beforeEdu.destinationCountries);
});

test('Business write rejects Education-only fields', async () => {
  await assert.rejects(
    () => updateBusinessProfessionalProfile(
      subject,
      { specialties: ['study_abroad_guidance'], destinationCountries: ['UK'] },
      { agentAccountId }
    ),
    (err) => err.code === 'education_fields_rejected'
  );
});

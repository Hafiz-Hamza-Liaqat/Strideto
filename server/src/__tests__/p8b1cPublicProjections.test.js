import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  projectPublicCompany,
  projectPublicEmployer,
  projectPublicJobListItem,
  projectPublicLegacyInstitution,
  projectPublicLegacyInstitutionListItem,
  projectPublicUniversity,
  projectPublicUniversityListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const root = path.resolve(process.cwd());
const institutionController = fs.readFileSync(path.join(root, 'server/src/controllers/institutionsController.js'), 'utf8');
const profileController = fs.readFileSync(path.join(root, 'server/src/controllers/publicProfileController.js'), 'utf8');
const canonicalInstitutionModel = fs.readFileSync(path.join(root, 'server/src/models/education/CanonicalInstitution.js'), 'utf8');

const internals = {
  privateSentinel: 'private',
  adminNotes: 'admin-only',
  internalNotes: 'internal-only',
  ownerId: 'owner-id',
  userId: 'user-id',
  billing: { plan: 'private' },
  launchEligible: true,
  createdBy: 'creator-id',
  updatedBy: 'updater-id',
  __v: 4,
  views: 12,
  approvalStatus: 'pending',
};

function assertNoKeys(value, keys = Object.keys(internals)) {
  const json = JSON.stringify(value);
  for (const key of keys) assert.equal(json.includes(`"${key}"`), false, `public DTO must not expose ${key}`);
}

test('LI1-LI7: legacy institution detail is positive, public, and slug-led', () => {
  const source = {
    _id: 'legacy-id', slug: 'public-school', name: 'Public School', type: 'school',
    country: 'Pakistan', city: 'Lahore', province: 'Punjab', address: 'Public address',
    phone: '+92 42 0000000', email: 'office@school.example', website: 'https://school.example',
    imageUrl: 'https://cdn.example/school.jpg', logoUrl: 'https://cdn.example/logo.png',
    description: 'Public description', programs: ['Science'], facilities: ['Library'],
    accreditation: 'Public accreditation', establishedYear: 1990,
    related: [{ _id: 'related-id', slug: 'related-school', name: 'Related School', ...internals }],
    ...internals,
  };
  const result = projectPublicLegacyInstitution(source, { related: source.related });
  assert.equal(result.slug, 'public-school');
  assert.equal(result.phone, source.phone);
  assert.equal(result.email, source.email);
  assert.equal(result.website, 'https://school.example/');
  assert.equal(result.related[0].slug, 'related-school');
  assert.equal(result.related[0].description, undefined);
  assert.equal(result.related[0]._id, 'related-id');
  assertNoKeys(result);
});

test('LI2-LI3: legacy institution list is bounded', () => {
  const result = projectPublicLegacyInstitutionListItem({
    _id: 'legacy-id', slug: 'public-school', name: 'Public School', type: 'school',
    country: 'Pakistan', city: 'Lahore', province: 'Punjab', logoUrl: 'https://cdn.example/logo.png',
    description: 'detail-only', facilities: ['detail-only'], ...internals,
  });
  assert.deepEqual(Object.keys(result).sort(), ['_id', 'city', 'country', 'logoUrl', 'name', 'province', 'slug', 'type'].sort());
  assertNoKeys(result);
});

test('LI8-LI9: legacy route policy remains separate from canonical institution routing', () => {
  assert.match(institutionController, /const filter = \{ status: 'active' \}/);
  assert.match(institutionController, /projectPublicLegacyInstitutionListItem/);
  assert.match(institutionController, /projectPublicLegacyInstitution\(doc/);
  assert.match(institutionController, /slug: slugOrId/);
  assert.match(institutionController, /status: 'active'/);
  assert.doesNotMatch(institutionController, /res\.json\(\{ \.\.\.doc/);
  assert.match(canonicalInstitutionModel, /export const CanonicalInstitution/);
  assert.doesNotMatch(institutionController, /CanonicalInstitution/);
});

test('U1-U6: University profile projection preserves page facts and bounded nested records', () => {
  const result = projectPublicUniversity({
    _id: 'university-id', name: 'Public University', slug: 'public-university', country: 'Pakistan',
    city: 'Lahore', province: 'Punjab', website: 'https://university.example', description: 'Description',
    logoUrl: 'https://cdn.example/logo.png', ranking: 3, type: 'public',
    programs: [{ name: 'Computer Science', degree: 'BS', duration: '4 years', _id: 'private-program-id' }],
    gallery: ['https://cdn.example/gallery.jpg'], reviewSummary: 'Public reviews',
    socialLinks: { linkedin: 'https://linkedin.com/company/example' }, ...internals,
  }, {
    admissions: [{ _id: 'admission-id', slug: 'admission', program: 'BS CS', session: 'Fall', ...internals }],
    scholarships: [{ _id: 'scholarship-id', slug: 'scholarship', title: 'Award', provider: 'Provider', ...internals }],
    foreignStudies: [{ _id: 'foreign-id', program: 'Study abroad', country: 'UK', ...internals }],
  });
  assert.equal(result.slug, 'public-university');
  assert.equal(result.programs[0].name, 'Computer Science');
  assert.equal(result.programs[0]._id, undefined);
  assert.equal(result.admissions[0].program, 'BS CS');
  assert.equal(result.scholarships[0].title, 'Award');
  assert.equal(result.foreignStudies[0].country, 'UK');
  assertNoKeys(result);
  assert.equal(projectPublicUniversityListItem({ ...result, description: 'private detail' }).description, undefined);
});

test('CE1-CE6: Company projection preserves public organization facts only', () => {
  const result = projectPublicCompany({
    _id: 'company-id', name: 'Public Company', slug: 'public-company', description: 'Description',
    website: 'https://company.example', industry: 'Technology', companySize: '50-100',
    location: 'Lahore', city: 'Lahore', province: 'Punjab', country: 'Pakistan',
    logoUrl: 'https://cdn.example/logo.png', socialLinks: { linkedin: 'https://linkedin.com/company/example' },
    verified: true, verificationLevel: 'verified', benefits: ['Health'],
    officeLocations: [{ city: 'Lahore', province: 'Punjab', address: 'Office' }], ...internals,
  });
  assert.equal(result.slug, 'public-company');
  assert.equal(result.website, 'https://company.example/');
  assert.equal(result.billing, undefined);
  assertNoKeys(result);
});

test('CE1-CE7: Employer projection excludes account/workspace data', () => {
  const result = projectPublicEmployer({
    _id: 'employer-id', companyName: 'Public Employer', slug: 'public-employer',
    email: 'private@example.com', phone: '+92 300 0000000', website: 'https://employer.example',
    companyDescription: 'Description', logoUrl: 'https://cdn.example/logo.png', industry: 'Technology',
    verified: true, verificationLevel: 'verified', isPublicProfile: true,
    password: 'hash', accountStatus: 'active', permissions: ['private'], ...internals,
  });
  assert.equal(result.companyName, 'Public Employer');
  assert.equal(result.email, undefined);
  assert.equal(result.password, undefined);
  assert.equal(result.accountStatus, undefined);
  assertNoKeys(result);
});

test('U5/CE4: nested public jobs use the established positive Job list projection', () => {
  const result = projectPublicJobListItem({
    _id: 'job-id', title: 'Public Job', slug: 'public-job', company: 'Public Company',
    location: 'Lahore', status: 'active', approvalStatus: 'approved',
    description: 'private detail', adminNotes: 'private', ownerId: 'private', ...internals,
  });
  assert.equal(result.title, 'Public Job');
  assert.equal(result.description, undefined);
  assert.equal(result.adminNotes, undefined);
  assertNoKeys(result);
});

test('profile controllers use positive projections and preserve public visibility gates', () => {
  assert.match(profileController, /isPublicProfile: \{ \$ne: false \}/);
  assert.match(profileController, /status: 'active'/);
  assert.match(profileController, /projectPublicEmployer\(employer\)/);
  assert.match(profileController, /projectPublicCompany\(company\)/);
  assert.match(profileController, /projectPublicUniversity\(university\)/);
  assert.match(profileController, /projectPublicJobListItem/);
  assert.match(profileController, /data\.map\(projectPublicCompanyListItem\)/);
  assert.match(profileController, /data\.map\(projectPublicUniversityListItem\)/);
  assert.doesNotMatch(profileController, /company,\s*employer,\s*stats/);
  assert.doesNotMatch(profileController, /activeJobs:\s*activeJobs,/);
  assert.doesNotMatch(profileController, /activeJobs:\s*jobs,/);
});

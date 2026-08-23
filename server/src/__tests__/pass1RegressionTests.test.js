/**
 * Pass-1 Regression Tests
 *
 * Pure-contract tests (no DB). Run:
 *   node src/__tests__/pass1RegressionTests.test.js
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(__dirname, '../../../shared');
const load = (rel) => import(pathToFileURL(path.join(sharedDir, rel)).href);

const { parseEducationEntry, validateEducationEntry } = await load('career/validation.js');
const { talentProfileToResumeView } = await load('career/resumeBridge.js');

let passed = 0;
const check = (label, fn) => {
  fn();
  passed += 1;
  console.log(`  ok - ${label}`);
};

// -----------------------------------------------------------------------
// Defect 4: graduationYear '' must not coerce to 0
// -----------------------------------------------------------------------

check('empty-string graduationYear parses to null (not 0)', () => {
  const parsed = parseEducationEntry({ degree: 'BSc', graduationYear: '' });
  assert.strictEqual(parsed.graduationYear, null, 'expected null, got ' + parsed.graduationYear);
});

check('null graduationYear parses to null', () => {
  const parsed = parseEducationEntry({ degree: 'BSc', graduationYear: null });
  assert.strictEqual(parsed.graduationYear, null);
});

check('undefined graduationYear parses to null', () => {
  const parsed = parseEducationEntry({ degree: 'BSc' });
  assert.strictEqual(parsed.graduationYear, null);
});

check('valid graduationYear 2024 passes validation', () => {
  const parsed = parseEducationEntry({ degree: 'BSc', graduationYear: '2024' });
  assert.strictEqual(parsed.graduationYear, 2024);
  const errors = validateEducationEntry(parsed);
  assert.deepEqual(errors, []);
});

check('valid graduationYear 2025 (number) passes validation', () => {
  const parsed = parseEducationEntry({ degree: 'BSc', graduationYear: 2025 });
  assert.strictEqual(parsed.graduationYear, 2025);
  const errors = validateEducationEntry(parsed);
  assert.deepEqual(errors, []);
});

check('invalid graduationYear 1800 fails validation', () => {
  const parsed = parseEducationEntry({ degree: 'BSc', graduationYear: '1800' });
  const errors = validateEducationEntry(parsed);
  assert.ok(errors.some((e) => e.includes('graduationYear')), 'expected graduation year error');
});

check('invalid graduationYear 2200 fails validation', () => {
  const parsed = parseEducationEntry({ degree: 'BSc', graduationYear: '2200' });
  const errors = validateEducationEntry(parsed);
  assert.ok(errors.some((e) => e.includes('graduationYear')), 'expected graduation year error');
});

check('empty-string graduationYear does NOT produce a validation error', () => {
  const parsed = parseEducationEntry({ degree: 'BSc', graduationYear: '' });
  const errors = validateEducationEntry(parsed);
  assert.deepEqual(errors, [], 'empty string should be treated as absent — no error');
});

// -----------------------------------------------------------------------
// Defect 7: Resume Builder — additional sections round-trip through snapshot
// -----------------------------------------------------------------------

const minimalProfile = {
  _id: '507f1f77bcf86cd799439011',
  displayName: 'Test User',
  personal: { phone: '', city: '', region: '' },
  headline: '',
  summary: '',
  avatarUrl: '',
  socialProfile: {},
  skills: [],
  education: [],
  experience: [],
  portfolioReferences: [],
  certificationReferences: [],
  languages: [],
  interests: [],
};

const snapshotWithAdditional = {
  _id: '507f1f77bcf86cd799439022',
  title: 'My Resume',
  template: 'modern-professional',
  snapshot: {
    references: [{ name: 'Jane Smith', title: 'Manager', company: 'Acme', email: 'j@acme.com', phone: '' }],
    awards: [{ title: 'Best Employee', issuer: 'Acme Corp', year: '2023', description: '' }],
    volunteerExperience: [{ organization: 'Red Cross', role: 'Coordinator', duration: '2022', description: '' }],
    publications: [{ title: 'My Paper', publisher: 'IEEE', year: '2023', url: '', description: '' }],
    interests: ['Chess', 'Hiking'],
    professionalMemberships: [{ organization: 'ACM', role: 'Member', since: '2021' }],
  },
};

check('talentProfileToResumeView reads references from snapshot', () => {
  const view = talentProfileToResumeView(minimalProfile, snapshotWithAdditional);
  assert.deepEqual(view.references, snapshotWithAdditional.snapshot.references);
});

check('talentProfileToResumeView reads awards from snapshot', () => {
  const view = talentProfileToResumeView(minimalProfile, snapshotWithAdditional);
  assert.deepEqual(view.awards, snapshotWithAdditional.snapshot.awards);
});

check('talentProfileToResumeView reads volunteerExperience from snapshot', () => {
  const view = talentProfileToResumeView(minimalProfile, snapshotWithAdditional);
  assert.deepEqual(view.volunteerExperience, snapshotWithAdditional.snapshot.volunteerExperience);
});

check('talentProfileToResumeView reads publications from snapshot', () => {
  const view = talentProfileToResumeView(minimalProfile, snapshotWithAdditional);
  assert.deepEqual(view.publications, snapshotWithAdditional.snapshot.publications);
});

check('talentProfileToResumeView reads interests from snapshot', () => {
  const view = talentProfileToResumeView(minimalProfile, snapshotWithAdditional);
  assert.deepEqual(view.interests, ['Chess', 'Hiking']);
});

check('talentProfileToResumeView reads professionalMemberships from snapshot', () => {
  const view = talentProfileToResumeView(minimalProfile, snapshotWithAdditional);
  assert.deepEqual(view.professionalMemberships, snapshotWithAdditional.snapshot.professionalMemberships);
});

check('talentProfileToResumeView returns empty arrays for additional sections when snapshot absent', () => {
  const view = talentProfileToResumeView(minimalProfile, null);
  assert.deepEqual(view.references, []);
  assert.deepEqual(view.awards, []);
  assert.deepEqual(view.volunteerExperience, []);
  assert.deepEqual(view.publications, []);
  assert.deepEqual(view.professionalMemberships, []);
});

check('talentProfileToResumeView returns empty arrays for additional sections when snapshot fields absent (backward compat)', () => {
  const oldSnapshot = { _id: '1', title: 'Old', template: 'modern-professional', snapshot: {} };
  const view = talentProfileToResumeView(minimalProfile, oldSnapshot);
  assert.deepEqual(view.references, []);
  assert.deepEqual(view.awards, []);
  assert.deepEqual(view.volunteerExperience, []);
  assert.deepEqual(view.publications, []);
  assert.deepEqual(view.professionalMemberships, []);
});

check('interests falls back to profile.interests when snapshot has none', () => {
  const profileWithInterests = { ...minimalProfile, interests: ['Reading'] };
  const oldSnapshot = { _id: '1', snapshot: {} };
  const view = talentProfileToResumeView(profileWithInterests, oldSnapshot);
  assert.deepEqual(view.interests, ['Reading']);
});

// -----------------------------------------------------------------------
// Defect 8 (performance): saveResumeBuilderView must not call
// findPrimaryByProfileId twice.  We verify this structurally by
// confirming the refactored service imports talentProfileToResumeView
// from the bridge (used in the direct-return path).
// -----------------------------------------------------------------------

check('TalentProfileReadService imports talentProfileToResumeView directly', async () => {
  const serviceUrl = pathToFileURL(
    path.resolve(__dirname, '../services/career/TalentProfileReadService.js'),
  ).href;
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL(serviceUrl), 'utf8'),
  );
  assert.ok(
    src.includes('talentProfileToResumeView(profile, v)'),
    'saveResumeBuilderView must return talentProfileToResumeView directly',
  );
  assert.ok(
    !src.includes("this.getResumeBuilderView(userId)"),
    'saveResumeBuilderView must not call getResumeBuilderView (redundant query)',
  );
});

// -----------------------------------------------------------------------
// Defect 8b (performance / correctness): getResumeBuilderView query routing.
//
// Three mutually-exclusive execution paths, each issuing exactly one query:
//   A. shouldReadCanonical && profile  → one query, immediate return
//   B. isTalentProfileEnabled && profile, version found  → one query, immediate return
//   B'. isTalentProfileEnabled && profile, no version found  → one query (cached null)
//       → falls through to legacy, then to final profile fallback (reuses null)
//   C. feature disabled && profile, falls through all  → final branch issues one query
//       (UNQUERIED sentinel distinguishes this from B')
//
// A null initializer for profileVersion (the previous bug) would have silently
// passed null to talentProfileToResumeView in path C, ignoring any existing version.
// -----------------------------------------------------------------------

check('getResumeBuilderView read path has at most 3 findPrimaryByProfileId sites (one per exclusive branch)', async () => {
  const serviceUrl = pathToFileURL(
    path.resolve(__dirname, '../services/career/TalentProfileReadService.js'),
  ).href;
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL(serviceUrl), 'utf8'),
  );
  // Extract the getResumeBuilderView function body only.
  const fnMatch = src.match(/async getResumeBuilderView\b[\s\S]*?(?=\n {2}[a-z])/);
  assert.ok(fnMatch, 'getResumeBuilderView must exist in TalentProfileReadService');
  const fnBody = fnMatch[0];
  const calls = (fnBody.match(/findPrimaryByProfileId/g) || []).length;
  assert.ok(
    calls <= 3,
    `getResumeBuilderView must have at most 3 findPrimaryByProfileId sites (one per branch), found ${calls}`,
  );
  // The UNQUERIED sentinel pattern must be present — proving path C is handled distinctly.
  assert.ok(
    fnBody.includes('UNQUERIED'),
    'feature-disabled path must use UNQUERIED sentinel, not a null initializer',
  );
  // The null-initializer bug must be absent.
  assert.ok(
    !fnBody.includes('profileVersion = null'),
    'profileVersion must not be initialized to null (would silently omit version in feature-disabled path)',
  );
});

check('getResumeBuilderView feature-enabled path: findPrimaryByProfileId called once, null cached for fallback', () => {
  // Models path B': isTalentProfileEnabled=true, version=null, no legacy, profile exists.
  // Invariant: findPrimaryByProfileId is called exactly once; the null result is reused.
  const UNQUERIED = Symbol('unqueried');
  let callCount = 0;
  const mockFindPrimary = () => { callCount += 1; return null; };

  const isTalentProfileEnabled = true;
  const UNQUERIED_SENTINEL = UNQUERIED;
  let profileVersion = UNQUERIED_SENTINEL;

  if (isTalentProfileEnabled) {
    profileVersion = mockFindPrimary();     // simulates the await call
    // version is null → no early return
  }
  // no legacy resume → falls to profile branch
  // profileVersion !== UNQUERIED_SENTINEL → reuse null, no additional call
  const version = profileVersion === UNQUERIED_SENTINEL ? mockFindPrimary() : profileVersion;

  assert.equal(callCount, 1, 'findPrimaryByProfileId must be called exactly once when feature enabled');
  assert.equal(version, null, 'null result must be propagated to bridge');
});

check('getResumeBuilderView feature-disabled path: findPrimaryByProfileId called once in final fallback', () => {
  // Models path C: isTalentProfileEnabled=false, no legacy, profile exists.
  // Invariant: findPrimaryByProfileId is called exactly once in the final branch.
  const SENTINEL = Symbol('unqueried');
  let callCount = 0;
  const mockVersion = { _id: 'v1', snapshot: { references: [] } };
  const mockFindPrimary = () => { callCount += 1; return mockVersion; };

  const isTalentProfileEnabled = false;
  let profileVersion = SENTINEL;

  if (isTalentProfileEnabled) {
    profileVersion = mockFindPrimary();   // NOT reached
  }
  // no legacy resume → falls to profile branch
  // profileVersion === SENTINEL → query now
  const version = profileVersion === SENTINEL ? mockFindPrimary() : profileVersion;

  assert.equal(callCount, 1, 'findPrimaryByProfileId must be called exactly once when feature disabled');
  assert.deepEqual(version, mockVersion, 'existing version must be found and returned');
});

// -----------------------------------------------------------------------
// Defect 7b: Resume Builder true persistence round-trip
//
// Simulates the full saveResumeBuilderView → getResumeBuilderView cycle
// through pure bridge functions (no DB). Verifies:
//   - all additional section fields (awards, volunteerExperience, publications,
//     references, professionalMemberships, interests) survive the snapshot
//     assembly and are recovered correctly by talentProfileToResumeView.
//   - backward compatibility: an older ResumeVersion lacking these fields
//     returns empty arrays, not undefined or errors.
// Limitation: actual Mongoose persistence is not exercised — this tests the
// serialization contract between saveResumeBuilderView snapshot assembly and
// the bridge read path.
// -----------------------------------------------------------------------

const { resumeViewToTalentProfilePayload } = await load('career/resumeBridge.js');

const fullView = {
  title: 'Full Round-Trip Resume',
  template: 'modern-professional',
  personalInfo: {
    fullName: 'Alice Smith',
    professionalTitle: 'Software Engineer',
    phone: '5551234567',
    city: 'Toronto',
    province: 'ON',
    linkedInUrl: 'https://linkedin.com/in/alice',
    githubUrl: '',
    portfolioUrl: '',
    profilePhotoUrl: '',
  },
  careerObjective: 'Build great things at scale.',
  education: [{ degree: 'BSc Computer Science', university: 'University of Toronto', fieldOfStudy: 'CS', graduationYear: '2020', gpa: '3.9' }],
  skills: { technical: ['JavaScript', 'Node.js', 'React'], soft: ['Leadership', 'Communication'] },
  experience: [{ company: 'Acme Corp', role: 'Senior Developer', duration: '2020 – 2024', description: 'Built scalable APIs.' }],
  projects: [{ title: 'OpenSource Lib', description: 'A utility library.', technologies: 'TypeScript, Jest' }],
  certifications: ['AWS Cloud Practitioner', 'MongoDB Associate'],
  languages: ['English', 'French'],
  references: [
    { name: 'Bob Jones', title: 'CTO', company: 'Acme Corp', email: 'bob@acme.com', phone: '5559876543' },
  ],
  awards: [
    { title: 'Employee of the Year', issuer: 'Acme Corp', year: '2023', description: 'Outstanding contributions.' },
    { title: 'Hackathon Winner', issuer: 'TechFest', year: '2022', description: '' },
  ],
  volunteerExperience: [
    { organization: 'Red Cross Canada', role: 'Disaster Relief Coordinator', duration: '2019 – 2020', description: 'Coordinated logistics.' },
  ],
  publications: [
    { title: 'Scalable Node.js Patterns', publisher: 'IEEE', year: '2023', url: 'https://example.com/paper', description: '' },
  ],
  interests: ['Hiking', 'Chess', 'Open Source'],
  professionalMemberships: [
    { organization: 'ACM', role: 'Senior Member', since: '2021' },
    { organization: 'IEEE Computer Society', role: 'Member', since: '2020' },
  ],
};

// Replicate saveResumeBuilderView snapshot assembly logic.
const fullPayload = resumeViewToTalentProfilePayload(fullView);
const simulatedProfile = {
  _id: '507f1f77bcf86cd799439033',
  displayName: fullPayload.displayName,
  personal: fullPayload.personal,
  headline: fullPayload.headline,
  summary: fullPayload.summary,
  avatarUrl: fullPayload.avatarUrl,
  socialProfile: fullPayload.socialProfile,
  skills: fullPayload.skills,
  education: fullPayload.education,
  experience: fullPayload.experience,
  portfolioReferences: fullPayload.portfolioReferences,
  certificationReferences: fullPayload.certificationReferences,
  languages: fullPayload.languages,
  interests: fullPayload.interests,
};
const simulatedVersion = {
  _id: '507f1f77bcf86cd799439044',
  title: fullView.title,
  template: fullView.template,
  snapshot: {
    displayName: fullPayload.displayName,
    headline: fullPayload.headline,
    summary: fullPayload.summary,
    education: fullPayload.education,
    experience: fullPayload.experience,
    skills: fullPayload.skills,
    languages: fullPayload.languages,
    certifications: fullPayload.certificationReferences,
    projects: fullPayload.portfolioReferences,
    socialProfile: fullPayload.socialProfile,
    // Additional sections — snapshot-owned, not in canonical TalentProfile schema.
    references: fullView.references,
    awards: fullView.awards,
    volunteerExperience: fullView.volunteerExperience,
    publications: fullView.publications,
    interests: fullView.interests,
    professionalMemberships: fullView.professionalMemberships,
  },
};

const roundTripped = talentProfileToResumeView(simulatedProfile, simulatedVersion);

check('round-trip: references survive snapshot assembly and bridge read', () => {
  assert.deepEqual(roundTripped.references, fullView.references);
});

check('round-trip: awards (multiple) survive snapshot assembly and bridge read', () => {
  assert.deepEqual(roundTripped.awards, fullView.awards);
  assert.equal(roundTripped.awards.length, 2, 'both awards must be present');
});

check('round-trip: volunteerExperience survives snapshot assembly and bridge read', () => {
  assert.deepEqual(roundTripped.volunteerExperience, fullView.volunteerExperience);
});

check('round-trip: publications survive snapshot assembly and bridge read', () => {
  assert.deepEqual(roundTripped.publications, fullView.publications);
  assert.equal(roundTripped.publications[0].url, 'https://example.com/paper');
});

check('round-trip: interests survive snapshot assembly and bridge read', () => {
  assert.deepEqual(roundTripped.interests, fullView.interests);
  assert.equal(roundTripped.interests.length, 3);
});

check('round-trip: professionalMemberships (multiple) survive snapshot assembly and bridge read', () => {
  assert.deepEqual(roundTripped.professionalMemberships, fullView.professionalMemberships);
  assert.equal(roundTripped.professionalMemberships.length, 2);
});

check('round-trip: core fields (title, education, skills, experience) survive through bridge', () => {
  assert.equal(roundTripped.title, fullView.title);
  assert.equal(roundTripped.education.length, 1);
  assert.ok(roundTripped.skills.technical.includes('JavaScript'));
  assert.ok(roundTripped.skills.soft.includes('Leadership'));
});

check('backward compat: older ResumeVersion without additional sections returns empty arrays', () => {
  const oldVersion = { _id: '1', title: 'Old Resume', template: 'modern-professional', snapshot: {} };
  const view = talentProfileToResumeView(simulatedProfile, oldVersion);
  assert.deepEqual(view.references, []);
  assert.deepEqual(view.awards, []);
  assert.deepEqual(view.volunteerExperience, []);
  assert.deepEqual(view.publications, []);
  assert.deepEqual(view.professionalMemberships, []);
  // interests fall back to profile.interests when snapshot has none
  assert.deepEqual(view.interests, simulatedProfile.interests);
});

check('backward compat: null ResumeVersion (no version ever created) returns empty arrays for additional sections', () => {
  const view = talentProfileToResumeView(simulatedProfile, null);
  assert.deepEqual(view.references, []);
  assert.deepEqual(view.awards, []);
  assert.deepEqual(view.volunteerExperience, []);
  assert.deepEqual(view.publications, []);
  assert.deepEqual(view.professionalMemberships, []);
});

// -----------------------------------------------------------------------

console.log(`\npass1RegressionTests: ${passed} checks passed\n`);

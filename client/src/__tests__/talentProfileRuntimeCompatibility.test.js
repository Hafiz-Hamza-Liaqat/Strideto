import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PROFILE_TABS,
  formToProfilePayload,
  formatListInput,
  profileToForm,
} from '../pages/TalentProfile/talentProfileMapper.js';
import {
  GRADING_SYSTEMS,
  GRADING_SYSTEM_LABELS,
  normalizeGradingSystem,
} from '../../../shared/career/studentProfile.js';

const legacyProfile = Object.freeze({
  displayName: 'Historical Student',
  personal: { dateOfBirth: null, phone: null, timeZone: undefined },
  socialProfile: null,
  preferences: {
    preferredCountries: 'PK',
    preferredIndustries: null,
    salaryExpectation: null,
  },
  education: [
    { institution: 'Historical University', gpa: '4.2', gradingSystem: 'gpa-5' },
    { institution: 'Unknown legacy', gradeValue: '78%', gradingSystem: 'weighted_average' },
    { institution: 'Missing legacy', gradeValue: '3.33' },
  ],
  experience: { company: 'Historical Employer', achievements: null },
  skills: ['JavaScript'],
  languages: ['English'],
  certificationReferences: ['Historical certificate'],
  portfolioReferences: [{ title: 'Historical project', technologies: 'React' }],
  examScores: [{ testType: null, testDate: null }],
  studyGoals: [{ destinationCountries: 'GB', targetYear: null }],
  studentPreferences: null,
  budgetProfile: null,
});

test('legacy and current profile shapes produce safe state for every editor tab', () => {
  const before = JSON.stringify(legacyProfile);
  const form = profileToForm(legacyProfile, 'student@example.test');

  assert.deepEqual(PROFILE_TABS.slice(0, 11), [
    'personal', 'contact', 'career', 'education', 'tests', 'goals',
    'experience', 'skills', 'languages', 'certifications', 'portfolio',
  ]);
  assert.equal(typeof form.personal, 'object');
  assert.equal(typeof form.socialProfile, 'object');
  assert.equal(formatListInput(form.preferences.preferredCountries), 'PK');
  for (const key of [
    'education', 'examScores', 'studyGoals', 'experience', 'skills', 'languages',
    'certificationReferences', 'portfolioReferences',
  ]) assert.ok(Array.isArray(form[key]), `${key} must be render-safe`);
  assert.equal(JSON.stringify(legacyProfile), before, 'mapping must not mutate persisted API data');
});

test('grading-system aliases are deterministic and numeric grades are never guessed', () => {
  assert.equal(normalizeGradingSystem('percentage'), 'percentage');
  assert.equal(normalizeGradingSystem('GPA-4'), 'gpa_4');
  assert.equal(normalizeGradingSystem('gpa 5 point'), 'gpa_5');
  assert.equal(normalizeGradingSystem('GPA10'), 'gpa_10');
  assert.equal(normalizeGradingSystem('letter grades'), 'grade_letters');
  assert.equal(normalizeGradingSystem('A-Level'), 'a_levels');
  assert.equal(normalizeGradingSystem('78%'), null);
  assert.equal(normalizeGradingSystem('4.2'), null);
  assert.equal(normalizeGradingSystem('3.33%'), null);
  assert.equal(normalizeGradingSystem('gpa'), null);
});

test('invalid and missing legacy grading systems stay visible for correction without false assignment', () => {
  const form = profileToForm(legacyProfile);
  assert.equal(form.education[0].gradingSystem, 'gpa_5');
  assert.equal(form.education[0].gradeValue, '4.2');
  assert.equal(form.education[1].gradingSystem, '');
  assert.equal(form.education[1]._legacyGradingSystem, 'weighted_average');
  assert.equal(form.education[2].gradingSystem, '');

  const payload = formToProfilePayload(form);
  assert.equal(payload.education[0].gradingSystem, 'gpa_5');
  assert.equal(payload.education[0].gradeValue, '4.2');
  assert.equal(payload.education[1].gradingSystem, '');
  assert.equal('_legacyGradingSystem' in payload.education[1], false);
});

test('selector contract covers every canonical grading system with a user-facing label', () => {
  assert.deepEqual(Object.keys(GRADING_SYSTEM_LABELS).sort(), [...GRADING_SYSTEMS].sort());
  for (const value of GRADING_SYSTEMS) {
    assert.ok(GRADING_SYSTEM_LABELS[value]);
  }

  const formSource = readFileSync(
    fileURLToPath(new URL('../pages/TalentProfile/TalentProfileForm.jsx', import.meta.url)),
    'utf8'
  );
  assert.match(formSource, /GRADING_SYSTEMS\.map/);
  assert.match(formSource, /Grading system needs selection/);
  assert.doesNotMatch(formSource, /gradingSystem'\) \+ ' \(e\.g\./);
});

test('every grading system survives editor save/reload with no grade conversion', () => {
  const sourceGrades = ['78%', '3.33', '4.2', '9.1', 'A', 'A*', '38', 'A', 'B', '1', 'A1', '92', '88', 'custom'];
  const profile = {
    education: GRADING_SYSTEMS.map((gradingSystem, index) => ({
      institution: `Institution ${index + 1}`,
      gradingSystem,
      gradeValue: sourceGrades[index],
    })),
  };
  const saved = formToProfilePayload(profileToForm(profile));
  const reloaded = profileToForm(saved);
  assert.deepEqual(reloaded.education.map((entry) => entry.gradingSystem), GRADING_SYSTEMS);
  assert.deepEqual(reloaded.education.map((entry) => entry.gradeValue), sourceGrades);
});

test('FormField permits a control plus help text for Contact and Career', () => {
  const fieldSource = readFileSync(
    fileURLToPath(new URL('../components/common/FormField.jsx', import.meta.url)),
    'utf8'
  );
  assert.match(fieldSource, /Children\.toArray\(children\)/);
  assert.doesNotMatch(fieldSource, /Children\.only\(children\)/);
});

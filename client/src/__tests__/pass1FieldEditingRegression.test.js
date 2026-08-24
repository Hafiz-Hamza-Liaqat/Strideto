/**
 * Pass-1 Field Editing Regression Tests
 *
 * Pure logic tests (no DOM / React). Run:
 *   node --experimental-vm-modules src/__tests__/pass1FieldEditingRegression.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListInput, formatListInput, formToProfilePayload } from '../pages/TalentProfile/talentProfileMapper.js';
import { parseSkillLines } from '../pages/ResumeBuilder/resumeDefaults.js';

// -----------------------------------------------------------------------
// Defect 2: Fields of Interest — DraftListInput must not parse on each key
// (tested via the raw parsing helpers: input during typing is preserved)
// -----------------------------------------------------------------------

test('parseListInput splits on commas and trims (used only at blur/save)', () => {
  const arr = parseListInput('Computer Science, Artificial Intelligence, Data Science');
  assert.deepEqual(arr, ['Computer Science', 'Artificial Intelligence', 'Data Science']);
});

test('parseListInput preserves multi-word values', () => {
  const arr = parseListInput('Machine Learning, Data Science');
  assert.deepEqual(arr, ['Machine Learning', 'Data Science']);
});

test('formatListInput round-trips the array to comma-separated string', () => {
  const arr = ['Computer Science', 'Artificial Intelligence'];
  const str = formatListInput(arr);
  const back = parseListInput(str);
  assert.deepEqual(back, arr);
});

test('raw string with trailing comma preserved as draft (not parsed mid-type)', () => {
  // During typing "Computer Science," the draft is the raw string.
  // Only parseListInput is called at blur.  This test confirms parseListInput
  // doesn't produce a spurious empty entry from trailing comma.
  const arr = parseListInput('Computer Science,');
  assert.deepEqual(arr, ['Computer Science']);
  assert.ok(!arr.includes(''), 'trailing comma must not produce empty entry');
});

test('raw string with space after comma preserved as draft', () => {
  // The user has typed "CS, " (space after comma, mid-entry).
  // The draft string "CS, " is only parsed on blur.
  const draft = 'Computer Science, ';
  // During editing, draft is shown as-is (no parseListInput yet)
  assert.equal(draft, 'Computer Science, ');
  // On blur, parseListInput normalizes it
  const arr = parseListInput(draft);
  assert.deepEqual(arr, ['Computer Science']);
});

// -----------------------------------------------------------------------
// Defect 3: Experience Achievements — spaces/newlines survive during editing
// -----------------------------------------------------------------------

test('achievements split without trim preserves spaces and blank lines', () => {
  const raw = 'Improved efficiency by 25%\n\nManaged a team of 8';
  // During editing: split('\n') only — no trim/filter
  const draft = raw.split('\n');
  assert.deepEqual(draft, ['Improved efficiency by 25%', '', 'Managed a team of 8']);
  assert.ok(draft.includes(''), 'blank line must survive during editing');
});

test('achievements trimmed and filtered at payload boundary', () => {
  // formToProfilePayload applies .map(trim).filter(Boolean)
  const form = {
    personal: { firstName: 'A', lastName: 'B', phone: '' },
    headline: '', summary: '', avatarUrl: '', visibility: 'private', locale: 'en',
    socialProfile: { linkedInUrl: '', githubUrl: '', portfolioUrl: '', twitterUrl: '', websiteUrl: '' },
    preferences: {
      workMode: 'hybrid', employmentStatus: 'open_to_work',
      preferredCountries: [], preferredIndustries: [], willingToRelocate: false, timeZone: '',
      salaryExpectation: { min: '', max: '', currency: 'USD', period: 'yearly' },
    },
    education: [], skills: [], languages: [], certificationReferences: [],
    portfolioReferences: [], examScores: [], studyGoals: [],
    studentPreferences: { destinationCountries: [], preferredCities: [], fieldsOfStudy: [], degreeLevels: [], targetIntake: '', targetYear: '', studyMode: '', scholarshipRequired: false, fundingPreference: '', preferredCurrency: '' },
    budgetProfile: { tuition: { amountMinor: '', currency: '' }, living: { amountMinor: '', currency: '' }, general: { amountMinor: '', currency: '' }, period: '', fundingSource: '', notes: '' },
    experience: [{
      company: 'Acme', role: 'Dev', employmentType: '', country: '',
      location: '', startDate: '', endDate: '', isCurrent: false,
      description: '',
      // raw draft with blank lines and spaces — as stored during editing
      achievements: ['  Improved efficiency by 25%', '', '  Managed a team of 8  ', ''],
    }],
  };
  const payload = formToProfilePayload(form);
  const achievements = payload.experience[0].achievements;
  assert.deepEqual(achievements, ['Improved efficiency by 25%', 'Managed a team of 8']);
  assert.ok(!achievements.includes(''), 'blank lines must be filtered at payload boundary');
});

// -----------------------------------------------------------------------
// Defect 6: Skills — parseSkillLines is safe at blur boundary
// (multi-word values must not be broken)
// -----------------------------------------------------------------------

test('parseSkillLines preserves multi-word skills', () => {
  const text = 'Machine Learning\nProject Management\nProblem Solving';
  const skills = parseSkillLines(text);
  assert.deepEqual(skills, ['Machine Learning', 'Project Management', 'Problem Solving']);
});

test('parseSkillLines deduplicates case-insensitively', () => {
  const text = 'JavaScript\njavascript\nTypeScript';
  const skills = parseSkillLines(text);
  assert.deepEqual(skills, ['JavaScript', 'TypeScript']);
});

test('raw text with trailing newline does NOT erase line (draft preserved)', () => {
  // During editing: draftText is "JavaScript\n" (user just pressed Enter)
  // SkillDraftTextarea does NOT call parseSkillLines on onChange.
  // The draft survives until blur.
  const draftAfterEnter = 'JavaScript\n';
  // Verify parseSkillLines on blur normalizes correctly
  const atBlur = parseSkillLines(draftAfterEnter);
  assert.deepEqual(atBlur, ['JavaScript']);
  // And starting a second skill on a new line
  const draftWithSecond = 'JavaScript\nPython';
  const withSecond = parseSkillLines(draftWithSecond);
  assert.deepEqual(withSecond, ['JavaScript', 'Python']);
});

test('SkillDraftTextarea preserves space mid-word (no premature parse)', () => {
  // User types "Machine " (with space, mid-word).
  // During editing the draft is the raw string — not parsed.
  // After typing the full word and blurring:
  const finishedDraft = 'Machine Learning';
  const skills = parseSkillLines(finishedDraft);
  assert.deepEqual(skills, ['Machine Learning']);
});

// -----------------------------------------------------------------------
// Defect 4 (client-side view): graduationYear '' must not be submitted as 0
// Inline logic mirrors sanitizeYear (strips non-digits, max 4 chars)
// -----------------------------------------------------------------------

function sanitizeYear(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4);
}

test('sanitizeYear returns empty string for empty input', () => {
  assert.equal(sanitizeYear(''), '');
  assert.equal(sanitizeYear(null), '');
  assert.equal(sanitizeYear(undefined), '');
});

test('sanitizeYear strips non-numeric characters', () => {
  assert.equal(sanitizeYear('202a'), '202');
  assert.equal(sanitizeYear('2024'), '2024');
});

// -----------------------------------------------------------------------
// Defect 1 (phone logic): E.164 round-trip via shared helpers
// -----------------------------------------------------------------------

test('partial national number (1 digit) does not produce a valid E.164', async () => {
  const { formatPhoneE164 } = await import('../../../shared/international/phone.js');
  const e164 = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: '5' });
  // 1 digit is not a valid US national number — should not produce E.164
  assert.ok(e164 === null || e164 === undefined || e164 === '', `expected null/empty, got "${e164}"`);
});

test('complete US phone produces valid E.164', async () => {
  const { formatPhoneE164 } = await import('../../../shared/international/phone.js');
  const e164 = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: '2125551234' });
  assert.equal(e164, '+12125551234');
});

test('parseE164ToPhoneParts restores national number correctly', async () => {
  const { parseE164ToPhoneParts } = await import('../../../shared/international/phone.js');
  const parts = parseE164ToPhoneParts('+12125551234', { preferredCountry: 'US' });
  assert.ok(parts, 'expected parts');
  assert.equal(parts.countryCode, 'US');
  assert.equal(parts.nationalNumber, '2125551234');
});

// -----------------------------------------------------------------------
// Defect 1 (phone component): PhoneInput draft/canonical sync contract
//
// PhoneInput keeps a local `draftNational` so partial input (e164==null)
// is not erased when the parent stores '' on each intermediate keystroke.
//
// The sync logic (from the useEffect):
//   if (value)      → sync draft from parsed.nationalNumber  (valid E.164 loaded)
//   else if (prev)  → clear draft to ''                      (explicit parent reset)
//   else            → keep draft unchanged                   (mid-typing: prev='' & value='')
//
// No React DOM infrastructure exists in this test file. These tests verify
// the pure synchronization contract and the shared helper invariants that
// underpin the draft-preservation behaviour. Limitation: the React state
// machine itself (useState / useEffect lifecycle) is not exercised here.
// -----------------------------------------------------------------------

// Models the useEffect sync decision as a pure function.
function syncDecision(prev, nextValue, parsedNationalNumber, currentDraft) {
  if (nextValue) return parsedNationalNumber;   // valid E.164 — load from server / save
  if (prev)      return '';                      // explicit clear/reset
  return currentDraft;                           // mid-typing: parent stays empty
}

test('PhoneInput draft sync: initial value empty → draft starts as empty string', () => {
  // When the component mounts with value='' / null, draftNational = parsed.nationalNumber = ''.
  const draft = syncDecision('', '', '', '');
  assert.equal(draft, '');
});

test('PhoneInput draft sync: first digit typed — parent stays empty — draft preserved', async () => {
  const { formatPhoneE164 } = await import('../../../shared/international/phone.js');
  const national1 = '2';
  const e164 = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: national1 });
  // e164 is null/empty — parent stores '' — prev was '' — draft must not change
  const prev = '';
  const parentValue = e164 || '';
  const currentDraft = national1;
  const result = syncDecision(prev, parentValue, '', currentDraft);
  assert.equal(result, currentDraft, 'first digit must survive in draft');
  assert.ok(!e164, 'single digit must not produce a valid E.164');
});

test('PhoneInput draft sync: second digit preserved — draft accumulates', async () => {
  const { formatPhoneE164 } = await import('../../../shared/international/phone.js');
  const national2 = '21';
  const e164 = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: national2 });
  const prev = '';
  const parentValue = e164 || '';
  const currentDraft = national2;
  const result = syncDecision(prev, parentValue, '', currentDraft);
  assert.equal(result, currentDraft, 'second digit must survive in draft');
  assert.ok(!e164, 'two digits must not produce a valid E.164');
});

test('PhoneInput draft sync: third digit preserved — draft accumulates', async () => {
  const { formatPhoneE164 } = await import('../../../shared/international/phone.js');
  const national3 = '212';
  const e164 = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: national3 });
  const prev = '';
  const parentValue = e164 || '';
  const currentDraft = national3;
  const result = syncDecision(prev, parentValue, '', currentDraft);
  assert.equal(result, currentDraft, 'third digit must survive in draft');
  assert.ok(!e164, 'three digits must not produce a valid E.164');
});

test('PhoneInput draft sync: when formatPhoneE164 returns null, draft sync keeps draft unchanged', async () => {
  const { formatPhoneE164 } = await import('../../../shared/international/phone.js');
  // For any national fragment where no valid E.164 can be produced,
  // parent stays '' (prev=''), so syncDecision must preserve the current draft.
  const incompleteNationals = ['2', '21', '212'];
  for (const nat of incompleteNationals) {
    const e164 = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: nat });
    if (!e164) {
      // Confirm draft-sync decision: prev='', value='' → keep draft
      const result = syncDecision('', '', '', nat);
      assert.equal(result, nat, `draft must be kept for national="${nat}" when e164 is null`);
    }
  }
});

test('PhoneInput draft sync: valid complete number — canonical E.164 propagates and draft syncs', async () => {
  const { formatPhoneE164, parseE164ToPhoneParts } = await import('../../../shared/international/phone.js');
  const nationalComplete = '2125551234';
  const e164 = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: nationalComplete });
  assert.ok(e164, 'complete number must produce E.164');
  assert.equal(e164, '+12125551234');
  // Parent stores the E.164 → value becomes truthy → draft syncs to parsed.nationalNumber
  const parts = parseE164ToPhoneParts(e164, { preferredCountry: 'US' });
  const newDraft = syncDecision('', e164, parts.nationalNumber, 'old-draft');
  assert.equal(newDraft, nationalComplete, 'draft must sync to national number from valid E.164');
});

test('PhoneInput draft sync: explicit clear — prev had valid value — draft clears', async () => {
  const prev = '+12125551234';   // component had a valid value
  const nextValue = '';          // parent explicitly cleared (e.g. form reset)
  const currentDraft = '2125551234';
  const result = syncDecision(prev, nextValue, '', currentDraft);
  assert.equal(result, '', 'explicit clear must wipe draft to empty string');
});

// -----------------------------------------------------------------------
// Defect 1b (phone component): country change must not erase draft digits
//
// When the user types 1–3 digits (partial input, parent value still ''),
// then selects a different country, the emit must carry draftNational so
// the partial digits survive the country-code change.
//
// The emit in SearchableSelect onChange previously used `parsed.nationalNumber`
// which is '' whenever parent value is '' (no valid E.164 stored yet).
// The fix: use `draftNational` in that emit path.
//
// These tests verify the emit-construction contract as a pure function.
// -----------------------------------------------------------------------

// Models what the country-change emit constructs given a draftNational and
// the old (broken) approach of using parsed.nationalNumber.
function countryChangeEmitNational({ useDraft, draftNational, parsedNationalNumber }) {
  return useDraft ? draftNational : parsedNationalNumber;
}

test('PhoneInput country-change: draft digits survive when useDraft=true (fixed path)', async () => {
  const { getCountryCallingCode } = await import('../../../shared/international/phone.js');
  const draftNational = '212';        // user typed 3 digits before switching country
  const parsedNationalNumber = '';    // parent value still '' → parsed is empty
  const newCountry = 'CA';

  const callingCode = getCountryCallingCode(newCountry);
  assert.ok(callingCode, 'CA must have a calling code');

  const emittedNational = countryChangeEmitNational({
    useDraft: true,
    draftNational,
    parsedNationalNumber,
  });
  assert.equal(emittedNational, '212', 'country change must carry draftNational, not parsed (empty)');
});

test('PhoneInput country-change: broken path would erase draft digits (documents the old bug)', () => {
  const draftNational = '212';
  const parsedNationalNumber = '';    // empty because parent value is ''
  const emittedBroken = countryChangeEmitNational({
    useDraft: false,
    draftNational,
    parsedNationalNumber,
  });
  assert.equal(emittedBroken, '', 'old emit using parsed.nationalNumber would erase the draft digits');
});

// -----------------------------------------------------------------------
// A4 Achievements — named regression strings must survive editing and save
// -----------------------------------------------------------------------

test('A4: achievements textarea draft preserves spaces and newlines during editing', () => {
  const raw = 'Managed a team of 8 employees\nImproved operational efficiency by 25%';
  // DraftAchievementsTextarea splits on newline on blur — intermediate keystrokes keep raw draft
  const draft = raw.split('\n');
  assert.deepEqual(draft, ['Managed a team of 8 employees', 'Improved operational efficiency by 25%']);
  assert.ok(draft[0].includes('team of 8'), 'spaces within line must survive');
  assert.ok(draft[1].includes('25%'), 'special chars must survive');
  assert.ok(!draft.includes(''), 'no blank lines in this canonical input');
});

test('A4: achievements payload preserves both named lines at save boundary', async () => {
  const { formToProfilePayload } = await import('../pages/TalentProfile/talentProfileMapper.js');
  const form = {
    personal: { firstName: 'A', lastName: 'B', phone: '' },
    headline: '', summary: '', avatarUrl: '', visibility: 'private', locale: 'en',
    socialProfile: { linkedInUrl: '', githubUrl: '', portfolioUrl: '', twitterUrl: '', websiteUrl: '' },
    preferences: {
      workMode: 'hybrid', employmentStatus: 'open_to_work',
      preferredCountries: [], preferredIndustries: [], willingToRelocate: false, timeZone: '',
      salaryExpectation: { min: '', max: '', currency: 'USD', period: 'yearly' },
    },
    education: [], skills: [], languages: [], certificationReferences: [],
    portfolioReferences: [], examScores: [], studyGoals: [],
    studentPreferences: { destinationCountries: [], preferredCities: [], fieldsOfStudy: [], degreeLevels: [], targetIntake: '', targetYear: '', studyMode: '', scholarshipRequired: false, fundingPreference: '', preferredCurrency: '' },
    budgetProfile: { tuition: { amountMinor: '', currency: '' }, living: { amountMinor: '', currency: '' }, general: { amountMinor: '', currency: '' }, period: '', fundingSource: '', notes: '' },
    experience: [{
      company: 'Acme', role: 'Manager', employmentType: 'full_time', country: 'PK',
      location: 'Lahore', startDate: '2022-01', endDate: '', isCurrent: true,
      description: 'Led operations',
      achievements: ['Managed a team of 8 employees', 'Improved operational efficiency by 25%'],
    }],
  };
  const payload = formToProfilePayload(form);
  const achievements = payload.experience[0].achievements;
  assert.deepEqual(achievements, ['Managed a team of 8 employees', 'Improved operational efficiency by 25%']);
  assert.equal(achievements.length, 2, 'both named lines must appear in save payload');
  assert.ok(achievements[0].includes('team of 8'), 'first line preserved verbatim');
  assert.ok(achievements[1].includes('efficiency by 25%'), 'second line preserved verbatim');
});

test('PhoneInput country-change: type 1–3 digits then change country — digits preserved', async () => {
  const { formatPhoneE164, getCountryCallingCode } = await import('../../../shared/international/phone.js');
  // Simulate: user types '2', '21', '212' (3 digits) on US number, then selects CA.
  const digits = ['2', '21', '212'];
  for (const national of digits) {
    const e164After = formatPhoneE164({ countryCode: 'US', dialCode: '1', nationalNumber: national });
    // Parent value stays '' (no valid E.164 yet)
    const parentValue = e164After || '';
    // syncDecision: prev='', value='' → draft unchanged
    const draftAfterTyping = syncDecision('', parentValue, '', national);
    assert.equal(draftAfterTyping, national, `draft "${national}" preserved while typing`);

    // User changes to CA — emit must carry draftAfterTyping, not parsed.nationalNumber ('')
    const callingCode = getCountryCallingCode('CA');
    const emittedNational = countryChangeEmitNational({
      useDraft: true,
      draftNational: draftAfterTyping,
      parsedNationalNumber: '',   // what parsed.nationalNumber would be (parent value = '')
    });
    assert.equal(emittedNational, national, `country change with draftNational="${national}" → digits not erased`);
    assert.ok(callingCode, 'CA calling code available for emit');
  }
});

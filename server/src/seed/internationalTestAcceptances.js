/**
 * P7-C verified TestAcceptance launch pack.
 *
 * Claims are intentionally small and source-backed. This seed only inserts
 * absent claims after resolving the canonical P7-A/P7-C1B entities. It never
 * updates an existing claim, creates entities, or infers scores between tests.
 */
import { TestAcceptance } from '../models/education/TestAcceptance.js';
import { Test } from '../models/education/Test.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Program } from '../models/education/Program.js';
import { ACCEPTANCE_STATUSES, ACCEPTANCE_SCOPES } from '../../../shared/education/acceptanceExplorer.js';
import { DEGREE_LEVELS, PUB_STATUSES } from '../../../shared/education/taxonomy.js';

export const INTERNATIONAL_ACCEPTANCE_VERIFIED_AT = '2026-09-01T00:00:00.000Z';

const source = (sourceUrl, publisher, evidenceRef) => ({
  sourceType: 'official_university',
  sourceUrl,
  publisher,
  evidenceRef,
  retrievedAt: INTERNATIONAL_ACCEPTANCE_VERIFIED_AT,
  verifiedAt: INTERNATIONAL_ACCEPTANCE_VERIFIED_AT,
});

const section = (sectionName, minimum, scale = '') => ({ sectionName, minimum, scale });

const institutionClaim = (institutionSlug, testSlug, values) => ({
  institutionSlug, testSlug, acceptanceScope: ACCEPTANCE_SCOPES.INSTITUTION,
  acceptanceStatus: ACCEPTANCE_STATUSES.ACCEPTED, ...values,
});

const programClaim = (institutionSlug, programSlug, testSlug, values) => ({
  institutionSlug, programSlug, testSlug, acceptanceScope: ACCEPTANCE_SCOPES.PROGRAM,
  acceptanceStatus: ACCEPTANCE_STATUSES.ACCEPTED, degreeLevels: [DEGREE_LEVELS.MASTER], ...values,
});

const TRINITY_ENGLISH = 'https://www.tcd.ie/study/english-language-requirements/';
const TRINITY_DATA_SCIENCE = 'https://www.tcd.ie/courses/postgraduate/courses/computer-science---data-science--mscpgraddip/';
const TRINITY_COMPUTER_SCIENCE = 'https://www.tcd.ie/scss/courses/undergraduate/computer-science/';
const UCD_ENGLISH = 'https://www.ucd.ie/graduatestudies/t4media/UCDPostgradProspectus2026.pdf';
const UCL_ENGLISH = 'https://www.ucl.ac.uk/study/prospective-students/graduate/how-apply/english-language-requirements';
const MELB_MIT = 'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/entry-requirements';
const MELB_MIS = 'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-systems/entry-requirements/';
const TORONTO_SGS = 'https://www.sgs.utoronto.ca/future-students/admission-application-requirements/english-language-proficiency-testing/';
const AUCKLAND_PG = 'https://www.auckland.ac.nz/assets/study/applications-and-admissions/entry-requirements/postgraduate-entry-requirements/postgraduate-english-language-requirements/2026%2BPG%2BEnglish%2BLanguage%2BProficiency%2BRequirements%2B05.pdf';
const AUCKLAND_UG = 'https://www.auckland.ac.nz/en/study/applications-and-admissions/entry-requirements/undergraduate-entry-requirements/undergraduate-english-language-requirements.doc.html';

export const INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK = [
  institutionClaim('trinity-college-dublin', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Listening', 6), section('Reading', 6), section('Writing', 6), section('Speaking', 6)], conditions: 'Band B standard entry; results must be issued within two years before course start.', sources: [source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  institutionClaim('trinity-college-dublin', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Reading', 4), section('Listening', 4), section('Speaking', 4), section('Writing', 4)], conditions: 'After 21 January 2026 6-point scale; results must be issued within two years before course start.', sources: [source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  institutionClaim('trinity-college-dublin', 'pte-academic', { minimumOverallScore: 69, sectionMinimums: [section('Listening', 59), section('Reading', 59), section('Speaking', 59), section('Writing', 59)], conditions: 'Band B standard entry; results must be issued within two years before course start.', sources: [source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  institutionClaim('trinity-college-dublin', 'duolingo-english-test', { minimumOverallScore: 120, sectionMinimums: [section('Literacy', 100), section('Comprehension', 100), section('Conversation', 100), section('Production', 100)], conditions: 'Integrated scores; results must be issued within two years before course start.', sources: [source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),

  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science-data-science', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Listening', 6), section('Reading', 6), section('Writing', 6), section('Speaking', 6)], conditions: 'Band B requirement for this postgraduate programme; results must be issued within two years before course start.', sources: [source(TRINITY_DATA_SCIENCE, 'Trinity College Dublin', 'Computer Science - Data Science (M.Sc./P.Grad.Dip)'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science-data-science', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Reading', 4), section('Listening', 4), section('Speaking', 4), section('Writing', 4)], conditions: 'Band B requirement for this postgraduate programme on the post-21 January 2026 6-point scale; results must be issued within two years before course start.', sources: [source(TRINITY_DATA_SCIENCE, 'Trinity College Dublin', 'Computer Science - Data Science (M.Sc./P.Grad.Dip)'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science-data-science', 'pte-academic', { minimumOverallScore: 69, sectionMinimums: [section('Listening', 59), section('Reading', 59), section('Speaking', 59), section('Writing', 59)], conditions: 'Band B requirement for this postgraduate programme; results must be issued within two years before course start.', sources: [source(TRINITY_DATA_SCIENCE, 'Trinity College Dublin', 'Computer Science - Data Science (M.Sc./P.Grad.Dip)'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science-data-science', 'duolingo-english-test', { minimumOverallScore: 120, sectionMinimums: [section('Literacy', 100), section('Comprehension', 100), section('Conversation', 100), section('Production', 100)], conditions: 'Band B requirement for this postgraduate programme; results must be issued within two years before course start.', sources: [source(TRINITY_DATA_SCIENCE, 'Trinity College Dublin', 'Computer Science - Data Science (M.Sc./P.Grad.Dip)'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),

  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Listening', 6), section('Reading', 6), section('Writing', 6), section('Speaking', 6)], degreeLevels: [DEGREE_LEVELS.BACHELOR], conditions: 'Band B requirement for this undergraduate programme; results must be issued within two years before course start.', sources: [source(TRINITY_COMPUTER_SCIENCE, 'Trinity College Dublin', 'Computer Science - School of Computer Science and Statistics'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Reading', 4), section('Listening', 4), section('Speaking', 4), section('Writing', 4)], degreeLevels: [DEGREE_LEVELS.BACHELOR], conditions: 'Band B requirement for this undergraduate programme on the post-21 January 2026 6-point scale; results must be issued within two years before course start.', sources: [source(TRINITY_COMPUTER_SCIENCE, 'Trinity College Dublin', 'Computer Science - School of Computer Science and Statistics'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science', 'pte-academic', { minimumOverallScore: 69, sectionMinimums: [section('Listening', 59), section('Reading', 59), section('Speaking', 59), section('Writing', 59)], degreeLevels: [DEGREE_LEVELS.BACHELOR], conditions: 'Band B requirement for this undergraduate programme; results must be issued within two years before course start.', sources: [source(TRINITY_COMPUTER_SCIENCE, 'Trinity College Dublin', 'Computer Science - School of Computer Science and Statistics'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),
  programClaim('trinity-college-dublin', 'trinity-college-dublin-computer-science', 'duolingo-english-test', { minimumOverallScore: 120, sectionMinimums: [section('Literacy', 100), section('Comprehension', 100), section('Conversation', 100), section('Production', 100)], degreeLevels: [DEGREE_LEVELS.BACHELOR], conditions: 'Band B requirement for this undergraduate programme; results must be issued within two years before course start.', sources: [source(TRINITY_COMPUTER_SCIENCE, 'Trinity College Dublin', 'Computer Science - School of Computer Science and Statistics'), source(TRINITY_ENGLISH, 'Trinity College Dublin', 'English Language Requirements')]}),

  institutionClaim('university-college-dublin', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Listening', 6), section('Reading', 6), section('Writing', 6), section('Speaking', 6)], conditions: 'UCD graduate taught and research programmes; applicants must meet the university English-language requirement.', sources: [source(UCD_ENGLISH, 'University College Dublin', 'UCD Postgraduate Prospectus 2026')]}),

  programClaim('university-college-london', 'university-college-london-computer-science-msc', 'ielts', { minimumOverallScore: 7, sectionMinimums: [section('Reading', 6.5), section('Writing', 6.5), section('Speaking', 6.5), section('Listening', 6.5)], intake: 'September 2026', conditions: 'UCL Level 2; test result must meet the single-test requirement and be no more than two years before enrolment.', sources: [source('https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computer-science-msc', 'University College London', 'Computer Science MSc'), source(UCL_ENGLISH, 'University College London', 'English Language requirements')]}),
  programClaim('university-college-london', 'university-college-london-computer-science-msc', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Reading', 4.5), section('Writing', 4.5), section('Speaking', 4.5), section('Listening', 4.5)], intake: 'September 2026', conditions: 'UCL Level 2 for tests taken from 21 January 2026; MyBest scores are not accepted.', sources: [source('https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computer-science-msc', 'University College London', 'Computer Science MSc'), source(UCL_ENGLISH, 'University College London', 'English Language requirements')]}),
  programClaim('university-college-london', 'university-college-london-computer-science-msc', 'pte-academic', { minimumOverallScore: 76, sectionMinimums: [section('Listening', 75), section('Reading', 75), section('Speaking', 75), section('Writing', 75)], intake: 'September 2026', conditions: 'UCL Level 2; the score must be achieved in a single test.', sources: [source('https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computer-science-msc', 'University College London', 'Computer Science MSc'), source(UCL_ENGLISH, 'University College London', 'English Language requirements')]}),
  programClaim('university-college-london', 'university-college-london-data-science-msc', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Reading', 6), section('Writing', 6), section('Speaking', 6), section('Listening', 6)], intake: 'September 2026', conditions: 'UCL Level 1; test result must be no more than two years before enrolment.', sources: [source('https://www.ucl.ac.uk/prospective-students/graduate/taught/degrees/data-science-msc', 'University College London', 'Data Science MSc'), source(UCL_ENGLISH, 'University College London', 'English Language requirements')]}),
  programClaim('university-college-london', 'university-college-london-data-science-msc', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Reading', 4), section('Writing', 4), section('Speaking', 4), section('Listening', 4)], intake: 'September 2026', conditions: 'UCL Level 1 for tests taken from 21 January 2026; MyBest scores are not accepted.', sources: [source('https://www.ucl.ac.uk/prospective-students/graduate/taught/degrees/data-science-msc', 'University College London', 'Data Science MSc'), source(UCL_ENGLISH, 'University College London', 'English Language requirements')]}),
  programClaim('university-college-london', 'university-college-london-data-science-msc', 'pte-academic', { minimumOverallScore: 75, sectionMinimums: [section('Listening', 67), section('Reading', 67), section('Speaking', 67), section('Writing', 67)], intake: 'September 2026', conditions: 'UCL Level 1; the score must be achieved in a single test.', sources: [source('https://www.ucl.ac.uk/prospective-students/graduate/taught/degrees/data-science-msc', 'University College London', 'Data Science MSc'), source(UCL_ENGLISH, 'University College London', 'English Language requirements')]}),

  programClaim('university-of-melbourne', 'university-of-melbourne-master-of-information-technology', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Writing', 6), section('Speaking', 6), section('Reading', 6), section('Listening', 6)], conditions: 'Academic English only; test must be taken at a test centre and within 24 months of intended study.', sources: [source(MELB_MIT, 'The University of Melbourne', 'Master of Information Technology: Entry requirements')]}),
  programClaim('university-of-melbourne', 'university-of-melbourne-master-of-information-technology', 'toefl-ibt', { minimumOverallScore: 81, sectionMinimums: [section('Writing', 19), section('Speaking', 19), section('Reading', 16), section('Listening', 16)], conditions: 'Internet-based test; 0-120 score report required; test-centre result within 24 months.', sources: [source(MELB_MIT, 'The University of Melbourne', 'Master of Information Technology: Entry requirements')]}),
  programClaim('university-of-melbourne', 'university-of-melbourne-master-of-information-technology', 'pte-academic', { minimumOverallScore: 64, sectionMinimums: [section('Writing', 60), section('Speaking', 60), section('Reading', 60), section('Listening', 60)], conditions: 'PTE Academic; test-centre result within 24 months.', sources: [source(MELB_MIT, 'The University of Melbourne', 'Master of Information Technology: Entry requirements')]}),
  programClaim('university-of-melbourne', 'university-of-melbourne-master-of-information-systems', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Writing', 6), section('Speaking', 6), section('Reading', 6), section('Listening', 6)], conditions: 'Academic English only; test must be taken at a test centre and within 24 months of intended study.', sources: [source(MELB_MIS, 'The University of Melbourne', 'Master of Information Systems: Entry requirements')]}),
  programClaim('university-of-melbourne', 'university-of-melbourne-master-of-information-systems', 'toefl-ibt', { minimumOverallScore: 81, sectionMinimums: [section('Writing', 19), section('Speaking', 19), section('Reading', 16), section('Listening', 16)], conditions: 'Internet-based test; 0-120 score report required; test-centre result within 24 months.', sources: [source(MELB_MIS, 'The University of Melbourne', 'Master of Information Systems: Entry requirements')]}),
  programClaim('university-of-melbourne', 'university-of-melbourne-master-of-information-systems', 'pte-academic', { minimumOverallScore: 64, sectionMinimums: [section('Writing', 60), section('Speaking', 60), section('Reading', 60), section('Listening', 60)], conditions: 'PTE Academic; test-centre result within 24 months.', sources: [source(MELB_MIS, 'The University of Melbourne', 'Master of Information Systems: Entry requirements')]}),

  institutionClaim('university-of-toronto', 'ielts', { minimumOverallScore: 7, sectionMinimums: [section('Listening', 6.5), section('Reading', 6.5), section('Writing', 6.5), section('Speaking', 6.5)], degreeLevels: [DEGREE_LEVELS.MASTER], conditions: 'University of Toronto graduate-school minimum; test must have been taken within the last 24 months. Graduate unit may require more.', sources: [source(TORONTO_SGS, 'University of Toronto School of Graduate Studies', 'English-Language Proficiency Testing')]}),
  institutionClaim('university-of-toronto', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Writing', 4.5), section('Speaking', 4)], degreeLevels: [DEGREE_LEVELS.MASTER], conditions: 'University of Toronto graduate-school 1-6 scale minimum from 21 January 2026; department may require more. No TOEFL conversion performed.', sources: [source(TORONTO_SGS, 'University of Toronto School of Graduate Studies', 'English-Language Proficiency Testing')]}),

  institutionClaim('university-of-auckland', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Listening', 6), section('Reading', 6), section('Writing', 6), section('Speaking', 6)], degreeLevels: [DEGREE_LEVELS.MASTER], effectiveFrom: '2026-05-01T00:00:00.000Z', conditions: 'Postgraduate minimum; requirements effective for applications received on or after 1 May 2026. Some programmes have higher requirements.', sources: [source(AUCKLAND_PG, 'The University of Auckland', 'Postgraduate English Language Proficiency Requirements 2026')]}),
  institutionClaim('university-of-auckland', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Writing', 4.5)], degreeLevels: [DEGREE_LEVELS.MASTER], effectiveFrom: '2026-05-01T00:00:00.000Z', conditions: 'Postgraduate 6-point scale; requirements effective for applications received on or after 1 May 2026. No conversion performed.', sources: [source(AUCKLAND_PG, 'The University of Auckland', 'Postgraduate English Language Proficiency Requirements 2026')]}),
  programClaim('university-of-auckland', 'university-of-auckland-master-of-information-technology', 'ielts', { minimumOverallScore: 6.5, sectionMinimums: [section('Listening', 6), section('Reading', 6), section('Writing', 6), section('Speaking', 6)], effectiveFrom: '2026-05-01T00:00:00.000Z', conditions: 'Postgraduate minimum; requirements effective for applications received on or after 1 May 2026.', sources: [source('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/master-of-information-technology-minfotech.html', 'The University of Auckland', 'Master of Information Technology'), source(AUCKLAND_PG, 'The University of Auckland', 'Postgraduate English Language Proficiency Requirements 2026')]}),
  programClaim('university-of-auckland', 'university-of-auckland-master-of-information-technology', 'toefl-ibt', { minimumOverallScore: 4.5, sectionMinimums: [section('Writing', 4.5)], effectiveFrom: '2026-05-01T00:00:00.000Z', conditions: 'Postgraduate 6-point scale; requirements effective for applications received on or after 1 May 2026. No conversion performed.', sources: [source('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/master-of-information-technology-minfotech.html', 'The University of Auckland', 'Master of Information Technology'), source(AUCKLAND_PG, 'The University of Auckland', 'Postgraduate English Language Proficiency Requirements 2026')]}),
  programClaim('university-of-auckland', 'university-of-auckland-master-of-information-technology', 'pte-academic', { minimumOverallScore: 58, sectionMinimums: [section('Listening', 50), section('Reading', 50), section('Speaking', 50), section('Writing', 50)], effectiveFrom: '2026-05-01T00:00:00.000Z', conditions: 'Postgraduate minimum; PTE Communicative score minimums apply.', sources: [source('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/master-of-information-technology-minfotech.html', 'The University of Auckland', 'Master of Information Technology'), source(AUCKLAND_PG, 'The University of Auckland', 'Postgraduate English Language Proficiency Requirements 2026')]}),
  programClaim('university-of-auckland', 'university-of-auckland-bachelor-of-science-computer-science', 'ielts', { minimumOverallScore: 6, sectionMinimums: [section('Listening', 5.5), section('Reading', 5.5), section('Writing', 5.5), section('Speaking', 5.5)], degreeLevels: [DEGREE_LEVELS.BACHELOR], conditions: 'Undergraduate minimum; results are valid for two years to the start of study.', sources: [source('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/computer-science/undergraduate/bsc-compsci-from-2019.html', 'The University of Auckland', 'Bachelor of Science (BSc) - majoring in Computer Science'), source(AUCKLAND_UG, 'The University of Auckland', 'Undergraduate English language requirements')]}),
  programClaim('university-of-auckland', 'university-of-auckland-bachelor-of-science-computer-science', 'toefl-ibt', { minimumOverallScore: 4, sectionMinimums: [section('Writing', 4)], degreeLevels: [DEGREE_LEVELS.BACHELOR], conditions: 'Undergraduate 6-point scale; the university also publishes an 80 overall/21 writing 120-point representation. No conversion performed.', sources: [source('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/computer-science/undergraduate/bsc-compsci-from-2019.html', 'The University of Auckland', 'Bachelor of Science (BSc) - majoring in Computer Science'), source(AUCKLAND_UG, 'The University of Auckland', 'Undergraduate English language requirements')]}),
  programClaim('university-of-auckland', 'university-of-auckland-bachelor-of-science-computer-science', 'pte-academic', { minimumOverallScore: 50, sectionMinimums: [section('Listening', 42), section('Reading', 42), section('Speaking', 42), section('Writing', 42)], degreeLevels: [DEGREE_LEVELS.BACHELOR], conditions: 'Undergraduate minimum; PTE Communicative score minimums apply.', sources: [source('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/computer-science/undergraduate/bsc-compsci-from-2019.html', 'The University of Auckland', 'Bachelor of Science (BSc) - majoring in Computer Science'), source(AUCKLAND_UG, 'The University of Auckland', 'Undergraduate English language requirements')]}),
];

const completeSource = (sources) => Array.isArray(sources) && sources.length > 0 && sources.every((item) => item?.sourceUrl?.startsWith('https://') && item.publisher && item.evidenceRef && item.verifiedAt && item.retrievedAt);
const eligible = (record) => Boolean(record?.testId && record?.institutionId && record?.acceptanceStatus && record?.acceptanceScope && record?.status === PUB_STATUSES.PUBLISHED && record?.verificationStatus === 'verified' && record?.freshnessState === 'fresh' && completeSource(record.sources));
const identity = (record) => record?.acceptanceScope === ACCEPTANCE_SCOPES.PROGRAM ? `${record.testId}::${record.acceptanceScope}::${record.institutionId}::${record.programId}::${record.intake || ''}` : `${record.testId}::${record.acceptanceScope}::${record.institutionId}::${record.intake || ''}`;

async function findExisting(model, payload) {
  return model.findOne({
    testId: payload.testId,
    acceptanceScope: payload.acceptanceScope,
    institutionId: payload.institutionId,
    programId: payload.programId,
    intake: payload.intake,
  });
}

export async function seedInternationalTestAcceptances({ models = {} } = {}) {
  const TestModel = models.Test || Test;
  const InstitutionModel = models.CanonicalInstitution || CanonicalInstitution;
  const ProgramModel = models.Program || Program;
  const AcceptanceModel = models.TestAcceptance || TestAcceptance;
  const result = { claims: [], summary: {}, scholarshipInferenceCount: 0 };

  for (const definition of INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK) {
    const test = await TestModel.findOne({ slug: definition.testSlug });
    if (!test) { result.claims.push({ ...definition, status: 'missing-test' }); continue; }
    const institution = await InstitutionModel.findOne({ slug: definition.institutionSlug });
    if (!institution) { result.claims.push({ ...definition, status: 'missing-institution' }); continue; }
    let program = null;
    if (definition.programSlug) {
      program = await ProgramModel.findOne({ slug: definition.programSlug });
      if (!program) { result.claims.push({ ...definition, status: 'missing-program' }); continue; }
      if (String(program.institutionId) !== String(institution._id)) { result.claims.push({ ...definition, status: 'conflict' }); continue; }
    }
    if (!completeSource(definition.sources)) { result.claims.push({ ...definition, status: 'missing-source' }); continue; }
    const payload = {
      testId: test._id, institutionId: institution._id, programId: program?._id || null,
      countryCode: institution.countryCode, acceptanceStatus: definition.acceptanceStatus,
      acceptanceScope: definition.acceptanceScope, minimumOverallScore: definition.minimumOverallScore ?? null,
      sectionMinimums: definition.sectionMinimums || [], scoreNotes: definition.scoreNotes || '',
      degreeLevels: definition.degreeLevels || [], studyModes: definition.studyModes || [], intake: definition.intake || '',
      effectiveFrom: definition.effectiveFrom || null, effectiveUntil: definition.effectiveUntil || null,
      conditions: definition.conditions || '', waiverNotes: definition.waiverNotes || '', sources: definition.sources,
      verificationStatus: 'verified', freshnessState: 'fresh', lastVerifiedAt: INTERNATIONAL_ACCEPTANCE_VERIFIED_AT,
      status: PUB_STATUSES.PUBLISHED,
    };
    const existing = await findExisting(AcceptanceModel, payload);
    if (existing) {
      if (existing.acceptanceStatus && existing.acceptanceStatus !== payload.acceptanceStatus) {
        result.claims.push({ ...definition, status: 'conflict' });
        continue;
      }
      result.claims.push({ ...definition, status: eligible(existing) ? 'existing-eligible' : 'existing-incomplete' });
      continue;
    }
    const created = await AcceptanceModel.create(payload);
    result.claims.push({ ...definition, status: 'inserted', _id: created._id });
  }
  result.summary = result.claims.reduce((counts, claim) => { counts[claim.status] = (counts[claim.status] || 0) + 1; return counts; }, {});
  result.ok = result.claims.every((claim) => ['inserted', 'existing-eligible'].includes(claim.status));
  result.blocking = result.claims.filter((claim) => !['inserted', 'existing-eligible'].includes(claim.status));
  return result;
}

export { eligible, completeSource, identity };

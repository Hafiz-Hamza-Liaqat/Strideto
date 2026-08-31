/**
 * P7-C1B canonical international institution/program launch pack.
 *
 * This pack contains identity data only. It deliberately does not create
 * TestAcceptance records, requirements, rankings, fees, or admissions claims.
 * Existing records are never updated: a rerun only inserts absent, verified
 * records and reports collisions for editorial review.
 */
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Program } from '../models/education/Program.js';
import { PUB_STATUSES, DEGREE_LEVELS, ACADEMIC_FIELDS, STUDY_MODES, INSTITUTION_TYPES } from '../../../shared/education/taxonomy.js';

export const INTERNATIONAL_INSTITUTIONS_VERIFIED_AT = '2026-09-01T00:00:00.000Z';

const evidence = (sourceUrl, publisher, title) => ({
  sourceType: 'official_university',
  sourceUrl,
  publisher,
  retrievedAt: INTERNATIONAL_INSTITUTIONS_VERIFIED_AT,
  verifiedAt: INTERNATIONAL_INSTITUTIONS_VERIFIED_AT,
  evidenceRef: title,
});

const institution = (values) => ({
  ...values,
  institutionType: INSTITUTION_TYPES.UNIVERSITY,
  status: PUB_STATUSES.PUBLISHED,
  isFixture: false,
  dataClass: 'canonical',
  environment: 'production',
  launchEligible: true,
  demoOnly: false,
});

const program = (values) => ({
  ...values,
  status: PUB_STATUSES.PUBLISHED,
  isFixture: false,
  dataClass: 'canonical',
  environment: 'production',
  launchEligible: true,
  demoOnly: false,
  verificationStatus: 'verified',
  freshnessState: 'fresh',
  lastVerifiedAt: INTERNATIONAL_INSTITUTIONS_VERIFIED_AT,
});

export const INTERNATIONAL_INSTITUTION_LAUNCH_PACK = [
  {
    institution: institution({
      officialName: 'Trinity College Dublin, The University of Dublin',
      slug: 'trinity-college-dublin', countryCode: 'IE', city: 'Dublin',
      officialWebsite: 'https://www.tcd.ie/', officialDomain: 'tcd.ie',
      sources: [evidence('https://www.tcd.ie/', 'Trinity College Dublin', 'Trinity College Dublin official website')],
    }),
    programs: [
      program({ name: 'Computer Science - Data Science', slug: 'trinity-college-dublin-computer-science-data-science', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'IE', officialProgramUrl: 'https://www.tcd.ie/courses/postgraduate/courses/computer-science---data-science--mscpgraddip/', sources: [evidence('https://www.tcd.ie/courses/postgraduate/courses/computer-science---data-science--mscpgraddip/', 'Trinity College Dublin', 'Computer Science - Data Science (M.Sc./P.Grad.Dip)')] }),
      program({ name: 'Computer Science', slug: 'trinity-college-dublin-computer-science', degreeLevel: DEGREE_LEVELS.BACHELOR, field: ACADEMIC_FIELDS.COMPUTING, country: 'IE', officialProgramUrl: 'https://www.tcd.ie/scss/courses/undergraduate/computer-science/', sources: [evidence('https://www.tcd.ie/scss/courses/undergraduate/computer-science/', 'Trinity College Dublin', 'Computer Science - School of Computer Science and Statistics')] }),
    ],
  },
  {
    institution: institution({
      officialName: 'University College Dublin', slug: 'university-college-dublin', countryCode: 'IE', city: 'Dublin',
      officialWebsite: 'https://www.ucd.ie/', officialDomain: 'ucd.ie',
      sources: [evidence('https://www.ucd.ie/', 'University College Dublin', 'University College Dublin official website')],
    }),
    programs: [
      program({ name: 'Computer Science (Conversion)', slug: 'university-college-dublin-computer-science-conversion', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'IE', officialProgramUrl: 'https://hub.ucd.ie/usis/!W_HU_MENU.P_PUBLISH?MAJR=T195&p_tag=PROG', sources: [evidence('https://hub.ucd.ie/usis/!W_HU_MENU.P_PUBLISH?MAJR=T195&p_tag=PROG', 'University College Dublin', 'Computer Science (Conversion)')] }),
      program({ name: 'Computer Science (Negotiated Learning)', slug: 'university-college-dublin-computer-science-negotiated-learning', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'IE', officialProgramUrl: 'https://hub.ucd.ie/usis/!W_HU_MENU.P_PUBLISH?MAJR=T150&p_tag=PROG', sources: [evidence('https://hub.ucd.ie/usis/!W_HU_MENU.P_PUBLISH?MAJR=T150&p_tag=PROG', 'University College Dublin', 'MSc Computer Science (Negotiated Learning)')] }),
    ],
  },
  {
    institution: institution({
      officialName: 'University College London', slug: 'university-college-london', countryCode: 'GB', city: 'London',
      officialWebsite: 'https://www.ucl.ac.uk/', officialDomain: 'ucl.ac.uk',
      sources: [evidence('https://www.ucl.ac.uk/', 'University College London', 'University College London official website')],
    }),
    programs: [
      program({ name: 'Computer Science MSc', slug: 'university-college-london-computer-science-msc', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'GB', officialProgramUrl: 'https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computer-science-msc', sources: [evidence('https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computer-science-msc', 'University College London', 'Computer Science MSc')] }),
      program({ name: 'Data Science MSc', slug: 'university-college-london-data-science-msc', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'GB', officialProgramUrl: 'https://www.ucl.ac.uk/prospective-students/graduate/taught/degrees/data-science-msc', sources: [evidence('https://www.ucl.ac.uk/prospective-students/graduate/taught/degrees/data-science-msc', 'University College London', 'Data Science MSc')] }),
    ],
  },
  {
    institution: institution({
      officialName: 'The University of Melbourne', slug: 'university-of-melbourne', countryCode: 'AU', city: 'Melbourne',
      officialWebsite: 'https://www.unimelb.edu.au/', officialDomain: 'unimelb.edu.au',
      sources: [evidence('https://www.unimelb.edu.au/', 'The University of Melbourne', 'The University of Melbourne official website')],
    }),
    programs: [
      program({ name: 'Master of Information Technology', slug: 'university-of-melbourne-master-of-information-technology', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'AU', officialProgramUrl: 'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/', sources: [evidence('https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/', 'The University of Melbourne', 'Master of Information Technology')] }),
      program({ name: 'Master of Information Systems', slug: 'university-of-melbourne-master-of-information-systems', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.BUSINESS, studyMode: STUDY_MODES.FULL_TIME, country: 'AU', officialProgramUrl: 'https://study.unimelb.edu.au/find/courses/graduate/master-of-information-systems/', sources: [evidence('https://study.unimelb.edu.au/find/courses/graduate/master-of-information-systems/', 'The University of Melbourne', 'Master of Information Systems')] }),
    ],
  },
  {
    institution: institution({
      officialName: 'University of Toronto', slug: 'university-of-toronto', countryCode: 'CA', city: 'Toronto',
      officialWebsite: 'https://www.utoronto.ca/', officialDomain: 'utoronto.ca',
      sources: [evidence('https://www.utoronto.ca/', 'University of Toronto', 'University of Toronto official website')],
    }),
    programs: [
      program({ name: 'Master of Science in Computer Science', slug: 'university-of-toronto-master-of-science-computer-science', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'CA', officialProgramUrl: 'https://www.sgs.utoronto.ca/programs/computer-science/', sources: [evidence('https://www.sgs.utoronto.ca/programs/computer-science/', 'University of Toronto School of Graduate Studies', 'Computer Science - School of Graduate Studies')] }),
      program({ name: 'Master of Management Analytics', slug: 'university-of-toronto-master-of-management-analytics', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.BUSINESS, studyMode: STUDY_MODES.FULL_TIME, country: 'CA', officialProgramUrl: 'https://www.rotman.utoronto.ca/programs/specialized-programs/master-of-management-analytics/', sources: [evidence('https://www.rotman.utoronto.ca/programs/specialized-programs/master-of-management-analytics/', 'Rotman School of Management, University of Toronto', 'Master of Management Analytics')] }),
    ],
  },
  {
    institution: institution({
      officialName: 'The University of Auckland', slug: 'university-of-auckland', countryCode: 'NZ', city: 'Auckland',
      officialWebsite: 'https://www.auckland.ac.nz/', officialDomain: 'auckland.ac.nz',
      sources: [evidence('https://www.auckland.ac.nz/', 'The University of Auckland', 'The University of Auckland official website')],
    }),
    programs: [
      program({ name: 'Master of Information Technology', slug: 'university-of-auckland-master-of-information-technology', degreeLevel: DEGREE_LEVELS.MASTER, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'NZ', officialProgramUrl: 'https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/master-of-information-technology-minfotech.html', sources: [evidence('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/master-of-information-technology-minfotech.html', 'The University of Auckland', 'Master of Information Technology')] }),
      program({ name: 'Bachelor of Science (BSc) - majoring in Computer Science', slug: 'university-of-auckland-bachelor-of-science-computer-science', degreeLevel: DEGREE_LEVELS.BACHELOR, field: ACADEMIC_FIELDS.COMPUTING, studyMode: STUDY_MODES.FULL_TIME, country: 'NZ', officialProgramUrl: 'https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/computer-science/undergraduate/bsc-compsci-from-2019.html', sources: [evidence('https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/computer-science/undergraduate/bsc-compsci-from-2019.html', 'The University of Auckland', 'Bachelor of Science (BSc) - majoring in Computer Science')] }),
    ],
  },
];

const normalize = (value) => String(value || '').trim().toLowerCase();
const domainOf = (value) => {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
const sourceComplete = (sources) => Array.isArray(sources) && sources.some((source) => source?.sourceUrl?.startsWith('https://') && source?.publisher && source?.verifiedAt);
const institutionEligible = (record) => Boolean(record?.officialName && record?.slug && record?.countryCode && record?.officialWebsite?.startsWith('https://') && record?.launchEligible === true && record?.isFixture !== true && record?.demoOnly !== true && record?.status === PUB_STATUSES.PUBLISHED && sourceComplete(record.sources));
const programEligible = (record) => Boolean(record?.name && record?.slug && record?.institutionId && record?.officialProgramUrl?.startsWith('https://') && record?.launchEligible === true && record?.isFixture !== true && record?.demoOnly !== true && record?.status === PUB_STATUSES.PUBLISHED && sourceComplete(record.sources));

async function first(model, queries) {
  for (const query of queries) {
    const found = await model.findOne(query);
    if (found) return found;
  }
  return null;
}

function classifyExisting(record, eligible) {
  return eligible(record) ? 'existing-eligible' : 'existing-incomplete';
}

async function classifyInstitution(model, definition) {
  const desiredDomain = domainOf(definition.officialWebsite);
  const existing = await first(model, [
    { slug: definition.slug },
    { officialDomain: desiredDomain },
    { officialName: definition.officialName },
  ]);
  if (!existing) return { status: 'inserted', record: await model.create(definition) };
  const sameSlug = normalize(existing.slug) === normalize(definition.slug);
  const sameDomain = normalize(existing.officialDomain) === desiredDomain;
  if (sameSlug && (sameDomain || !existing.officialDomain)) {
    return { status: classifyExisting(existing, institutionEligible), record: existing };
  }
  return { status: sameDomain ? 'possible-duplicate' : 'conflict', record: existing };
}

async function classifyProgram(model, definition, institutionId) {
  const existing = await first(model, [
    { slug: definition.slug },
    { officialProgramUrl: definition.officialProgramUrl },
  ]);
  if (!existing) return { status: 'inserted', record: await model.create({ ...definition, institutionId }) };
  if (normalize(existing.slug) === normalize(definition.slug) && String(existing.institutionId) === String(institutionId)) {
    return { status: classifyExisting(existing, programEligible), record: existing };
  }
  return { status: 'conflict', record: existing };
}

export async function seedInternationalInstitutions({ models = {} } = {}) {
  const InstitutionModel = models.CanonicalInstitution || CanonicalInstitution;
  const ProgramModel = models.Program || Program;
  const result = { institutions: [], programs: [], summary: {}, testAcceptanceCreated: 0 };

  for (const pack of INTERNATIONAL_INSTITUTION_LAUNCH_PACK) {
    const institutionResult = await classifyInstitution(InstitutionModel, pack.institution);
    result.institutions.push({ name: pack.institution.officialName, slug: pack.institution.slug, status: institutionResult.status });
    if (!institutionResult.record || ['conflict', 'possible-duplicate', 'existing-incomplete'].includes(institutionResult.status)) {
      for (const item of pack.programs) result.programs.push({ name: item.name, slug: item.slug, institution: pack.institution.slug, status: 'missing-source' });
      continue;
    }
    for (const item of pack.programs) {
      const programResult = await classifyProgram(ProgramModel, item, institutionResult.record._id);
      result.programs.push({ name: item.name, slug: item.slug, institution: pack.institution.slug, status: programResult.status });
    }
  }

  result.summary = [...result.institutions, ...result.programs].reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
  const blocking = result.institutions.concat(result.programs).filter((item) => !['inserted', 'existing-eligible'].includes(item.status));
  result.ok = blocking.length === 0;
  result.blocking = blocking;
  return result;
}

export { institutionEligible, programEligible, domainOf };

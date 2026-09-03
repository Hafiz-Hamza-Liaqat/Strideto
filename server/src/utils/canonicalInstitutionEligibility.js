import { Program } from '../models/education/Program.js';
import { TestAcceptance } from '../models/education/TestAcceptance.js';
import { currentAcceptanceMongoFilter } from '../../../shared/publicDiscovery/publicTruth.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';

/**
 * Build the derived facts shared by canonical-institution sitemap and SEO
 * eligibility. Both surfaces must evaluate the same published program and
 * current accepted-test evidence.
 */
export async function getCanonicalInstitutionEligibilityContext(institutionIds = []) {
  const ids = institutionIds.filter(Boolean);
  if (!ids.length) {
    return {
      programCountByInstitutionId: new Map(),
      acceptedTestCountByInstitutionId: new Map(),
    };
  }

  const [programCounts, acceptanceCounts] = await Promise.all([
    Program.aggregate([
      {
        $match: withFixtureExclusion({
          status: 'published',
          institutionId: { $in: ids },
        }),
      },
      { $group: { _id: '$institutionId', count: { $sum: 1 } } },
    ]),
    TestAcceptance.aggregate([
      {
        $match: {
          institutionId: { $in: ids },
          ...currentAcceptanceMongoFilter(),
        },
      },
      { $group: { _id: '$institutionId', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    programCountByInstitutionId: new Map(
      programCounts.map((row) => [String(row._id), row.count])
    ),
    acceptedTestCountByInstitutionId: new Map(
      acceptanceCounts.map((row) => [String(row._id), row.count])
    ),
  };
}

export function canonicalInstitutionEligibilityFacts(context, institutionId) {
  return {
    programCount: context.programCountByInstitutionId.get(String(institutionId)) || 0,
    acceptedTestCount: context.acceptedTestCountByInstitutionId.get(String(institutionId)) || 0,
  };
}

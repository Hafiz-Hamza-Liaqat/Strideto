/**
 * Exact-subject display labels for Admin GBS moderation.
 * Independent = AgentProfile.professionalName. Agency = Organization display/legal name.
 * Never uses memberships[0].
 */
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import { AgentProfile } from '../../models/agent/AgentProfile.js';
import { Organization } from '../../models/Organization.js';

export function subjectKindLabel(subjectType) {
  return subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION ? 'Agency' : 'Independent';
}

export async function resolveProviderSubjectLabels(rows = []) {
  const agentIds = [
    ...new Set(
      rows
        .filter((row) => row.subjectType === PROVIDER_SUBJECT_TYPES.AGENT)
        .map((row) => String(row.subjectId))
    ),
  ];
  const orgIds = [
    ...new Set(
      rows
        .filter((row) => row.subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION)
        .map((row) => String(row.subjectId))
    ),
  ];

  const [profiles, orgs] = await Promise.all([
    agentIds.length
      ? AgentProfile.find({ agentAccountId: { $in: agentIds } })
          .select('agentAccountId professionalName')
          .lean()
      : [],
    orgIds.length
      ? Organization.find({ _id: { $in: orgIds } })
          .select('displayName legalName')
          .lean()
      : [],
  ]);

  const agents = new Map(
    profiles.map((row) => [String(row.agentAccountId), row.professionalName || 'Independent Provider'])
  );
  const agencies = new Map(
    orgs.map((row) => [String(row._id), row.displayName || row.legalName || 'Agency'])
  );

  return rows.map((row) => {
    const subjectId = String(row.subjectId);
    const subjectType = row.subjectType;
    const subjectKind = subjectKindLabel(subjectType);
    const subjectLabel =
      subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION
        ? agencies.get(subjectId) || 'Agency'
        : agents.get(subjectId) || 'Independent Provider';
    return { subjectType, subjectId, subjectKind, subjectLabel };
  });
}

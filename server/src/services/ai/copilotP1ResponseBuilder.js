/**
 * COPILOT-P1 — Deterministic response builder.
 *
 * Builds structured response blocks from tool results when AI provider is not configured.
 * Never fabricates platform data — only formats authorized tool output.
 */
import {
  RESPONSE_BLOCK_TYPES,
  MATCH_LABEL,
  SCHOLARSHIP_ELIGIBILITY,
  COPILOT_P1_BOUNDS,
} from '../../../../shared/ai/copilotP1.js';
import { ANSWER_TYPES, GROUNDING_STATUS } from '../../../../shared/ai/copilot.js';

const ELIGIBILITY_LABELS = {
  [SCHOLARSHIP_ELIGIBILITY.LIKELY_MATCH]: 'Potential match based on available profile information',
  [SCHOLARSHIP_ELIGIBILITY.POSSIBLE_MATCH]: 'Possible match — more profile details would improve confidence',
  [SCHOLARSHIP_ELIGIBILITY.INSUFFICIENT_INFORMATION]: 'Insufficient information to assess eligibility',
};

const MATCH_LABELS = {
  [MATCH_LABEL.STRONG_FIT]: 'Strong fit',
  [MATCH_LABEL.POTENTIAL_FIT]: 'Potential fit',
  [MATCH_LABEL.STRETCH]: 'Stretch opportunity',
  [MATCH_LABEL.INSUFFICIENT_INFO]: 'Limited match data',
};

function formatOpportunityCard(item, type) {
  const base = {
    entityType: type,
    id: item._id || item.entityId || item.id,
    title: item.title || item.name,
    secondary: item.company || item.organization || item.provider || item.institutionName,
    location: item.location || item.country || item.countryCode,
    workMode: item.workMode,
    deadline: item.deadline || item.activeDeadlines?.[0]?.deadline || null,
    matchLabel: item.matchLabel ? MATCH_LABELS[item.matchLabel] || item.matchLabel : null,
    reasons: item.matchReasons || [],
    gaps: item.matchGaps || [],
    canonicalLink: item.canonicalLink,
    salaryRange: item.salaryRange ?? null,
    fundingType: item.fundingType ?? null,
    eligibilityHint: item.eligibilityHint ? ELIGIBILITY_LABELS[item.eligibilityHint] || item.eligibilityHint : null,
  };
  if (base.salaryRange == null && type === 'job') base.salaryRange = 'Unknown / Not provided';
  return base;
}

export function buildP1ResponseBlocks(intent, toolResults, userContext, options = {}) {
  const blocks = [];
  const resultRefs = { jobIds: [], internshipIds: [], scholarshipRefs: [], programIds: [] };

  if (options.writeRequested) {
    blocks.push({
      type: RESPONSE_BLOCK_TYPES.WRITE_UNSUPPORTED,
      text: 'I can help you review opportunities and open application pages, but I won\'t submit an application or change your profile without an explicit supported confirmation workflow.',
    });
  }

  for (const tr of toolResults) {
    if (!tr.ok) {
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.TEXT,
        text: `Some data could not be loaded (${tr.tool}: ${tr.error}).`,
      });
      continue;
    }

    if (tr.tool === 'get_user_context' && tr.data) {
      const missing = tr.data.missingProfileFields?.length
        ? ` Missing: ${tr.data.missingProfileFields.join(', ')}.`
        : '';
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.TEXT,
        text: `Profile: ${tr.data.displayName || 'Student'}. Skills: ${(tr.data.skills || []).slice(0, 5).join(', ') || 'none listed'}.${missing}`,
      });
      if (tr.data.missingProfileFields?.length) {
        blocks.push({
          type: RESPONSE_BLOCK_TYPES.PROFILE_GAP,
          missingFields: tr.data.missingProfileFields,
          text: 'Adding these fields can improve recommendations.',
        });
      }
    }

    if (tr.tool === 'search_jobs' && tr.data?.items) {
      const items = tr.data.items.slice(0, COPILOT_P1_BOUNDS.MAX_RESULTS_DEFAULT);
      resultRefs.jobIds = items.map((i) => String(i._id)).filter(Boolean);
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST,
        entityType: 'job',
        intro: items.length
          ? `I found ${items.length} published role(s) on Strideto.`
          : 'No matching published jobs found under current filters.',
        items: items.map((i) => formatOpportunityCard(i, 'job')),
      });
    }

    if (tr.tool === 'search_internships' && tr.data?.items) {
      const items = tr.data.items.slice(0, COPILOT_P1_BOUNDS.MAX_RESULTS_DEFAULT);
      resultRefs.internshipIds = items.map((i) => String(i._id)).filter(Boolean);
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST,
        entityType: 'internship',
        intro: items.length
          ? `I found ${items.length} published internship(s).`
          : 'No matching published internships found.',
        items: items.map((i) => formatOpportunityCard(i, 'internship')),
      });
    }

    if (tr.tool === 'search_scholarships' && tr.data?.items) {
      const items = tr.data.items.slice(0, COPILOT_P1_BOUNDS.MAX_RESULTS_DEFAULT);
      resultRefs.scholarshipRefs = items.map((i) => ({
        id: String(i.entityId || i._id),
        system: i.scholarshipSystem || 'cms',
      })).filter((r) => r.id && r.system);
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST,
        entityType: 'scholarship',
        intro: items.length
          ? `I found ${items.length} scholarship(s). Eligibility is guidance only — not guaranteed.`
          : 'No matching scholarships found.',
        items: items.map((i) => formatOpportunityCard(i, 'scholarship')),
      });
    }

    if (tr.tool === 'search_programs' && tr.data?.items) {
      const items = tr.data.items.slice(0, COPILOT_P1_BOUNDS.MAX_RESULTS_DEFAULT);
      resultRefs.programIds = items.map((i) => String(i.entityId)).filter(Boolean);
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST,
        entityType: 'program',
        intro: items.length ? `I found ${items.length} program(s).` : 'No matching programs found.',
        items: items.map((i) => formatOpportunityCard({ ...i, name: i.name }, 'program')),
      });
    }

    if (tr.tool === 'get_saved_items' && tr.data?.items) {
      const items = tr.data.items;
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST,
        entityType: 'saved',
        intro: items.length ? `You have ${items.length} saved item(s).` : 'You have no saved opportunities yet.',
        items: items.map((i) => ({
          entityType: i.type,
          id: i.id,
          title: i.title,
          secondary: i.company || i.provider || i.organization,
          canonicalLink: i.canonicalLink,
        })),
      });
    }

    if (tr.tool === 'get_application_summary' && tr.data?.items) {
      const items = tr.data.items;
      const pending = items.filter((i) => !['rejected', 'hired', 'accepted', 'withdrawn'].includes(String(i.status).toLowerCase()));
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.TEXT,
        text: items.length
          ? `You have ${items.length} application(s) on record${pending.length ? `; ${pending.length} may need attention.` : '.'}`
          : 'You have no applications recorded yet.',
      });
      if (items.length) {
        blocks.push({
          type: RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST,
          entityType: 'application',
          items: items.slice(0, 10).map((i) => ({
            title: i.title,
            secondary: i.company || i.organization,
            status: i.status,
            appliedAt: i.appliedAt,
            canonicalLink: i.canonicalLink,
          })),
        });
      }
    }

    if (tr.tool === 'compare_opportunities' && tr.data?.comparison) {
      blocks.push({
        type: RESPONSE_BLOCK_TYPES.COMPARISON,
        entityType: tr.data.type,
        rows: tr.data.comparison,
      });
    }
  }

  if (intent === 'plan' && userContext) {
    const planItems = [];
    if (userContext.missingProfileFields?.length) {
      planItems.push({ kind: 'profile', text: `Complete profile: ${userContext.missingProfileFields.slice(0, 3).join(', ')}` });
    }
    if (userContext.savedCounts?.jobs > 0) {
      planItems.push({ kind: 'platform_fact', text: `You have ${userContext.savedCounts.jobs} saved job(s) to review.` });
    }
    planItems.push({ kind: 'recommendation', text: 'Review upcoming deadlines on saved opportunities.' });
    blocks.push({
      type: RESPONSE_BLOCK_TYPES.PLAN,
      items: planItems,
    });
  }

  return { blocks, resultRefs };
}

export function synthesizeAnswerFromBlocks(blocks, providerConfigured = false) {
  if (!blocks.length) {
    return {
      answer: 'I need a bit more detail to help. Try asking about jobs, scholarships, programs, or your saved opportunities.',
      answerType: ANSWER_TYPES.UNAVAILABLE,
      groundingStatus: GROUNDING_STATUS.INSUFFICIENT_EVIDENCE,
    };
  }

  const textParts = blocks
    .filter((b) => b.type === RESPONSE_BLOCK_TYPES.TEXT || b.type === RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST)
    .map((b) => b.text || b.intro)
    .filter(Boolean);

  const writeBlock = blocks.find((b) => b.type === RESPONSE_BLOCK_TYPES.WRITE_UNSUPPORTED);
  if (writeBlock) textParts.unshift(writeBlock.text);

  let answer = textParts.join('\n\n');
  if (!providerConfigured) {
    answer = answer || 'Results are based on Strideto platform data. An AI language model is not configured — review the structured results below.';
  }

  return {
    answer,
    answerType: providerConfigured ? ANSWER_TYPES.SYNTHESIS : ANSWER_TYPES.DETERMINISTIC,
    groundingStatus: GROUNDING_STATUS.WELL_GROUNDED,
  };
}

export function buildNavigationActions(blocks) {
  const actions = [];
  for (const block of blocks) {
    if (block.type !== RESPONSE_BLOCK_TYPES.OPPORTUNITY_LIST) continue;
    for (const item of block.items || []) {
      if (item.canonicalLink?.path) {
        actions.push({
          type: 'navigate',
          label: item.canonicalLink.label || 'View',
          path: item.canonicalLink.path,
          entityType: block.entityType,
          entityId: item.id,
        });
      }
    }
  }
  return actions.slice(0, 10);
}

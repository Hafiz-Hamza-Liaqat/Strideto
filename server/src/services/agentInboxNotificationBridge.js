/**
 * Agent-realm inbox fan-out (Phase 5). In-app only. Never throws into callers.
 * No email, SMS, push, or worker enqueue.
 */
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { createUserNotificationOnce } from './notificationService.js';
import { AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';

async function finishQuietly(fn) {
  try {
    return await fn();
  } catch {
    return { created: false };
  }
}

export async function notifyAgentAccount({
  agentAccountId,
  type,
  title,
  body,
  link,
  category = 'system',
  dedupeKey,
  metadata,
} = {}) {
  if (!agentAccountId || !type || !title) return { created: false };
  return finishQuietly(() => createUserNotificationOnce({
    recipientType: 'agent',
    agentAccountId,
    category,
    type,
    title,
    body,
    link,
    metadata,
    dedupeKey,
  }));
}

export async function notifyAgentMembership({ membershipId, ...payload } = {}) {
  if (!membershipId) return { created: false };
  const membership = await AgentMembership.findById(membershipId).select('agentAccountId active').lean();
  if (!membership?.active || !membership.agentAccountId) return { created: false };
  return notifyAgentAccount({ agentAccountId: membership.agentAccountId, ...payload });
}

export async function notifyAgentOrganizationOwners({
  organizationId,
  roles = [AGENT_MEMBER_ROLES.OWNER, AGENT_MEMBER_ROLES.ADMIN],
  ...payload
} = {}) {
  if (!organizationId) return { created: 0 };
  const members = await AgentMembership.find({
    organizationId,
    active: true,
    role: { $in: roles },
  }).select('agentAccountId').lean();
  let created = 0;
  for (const member of members) {
    const outcome = await notifyAgentAccount({
      ...payload,
      agentAccountId: member.agentAccountId,
      dedupeKey: payload.dedupeKey ? `${payload.dedupeKey}:agent:${member.agentAccountId}` : undefined,
    });
    if (outcome?.created) created += 1;
  }
  return { created };
}

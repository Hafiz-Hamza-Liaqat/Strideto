/**
 * MKT-P4 — create-only index provisioning for application communication collections.
 * autoIndex remains false in production unless MONGO_AUTO_INDEX=1.
 */
import { ApplicationMessage } from '../../models/ApplicationMessage.js';
import { ApplicationInterviewInvitation } from '../../models/ApplicationInterviewInvitation.js';
import {
  compareCriticalIndexes,
  inspectIndexesSafely,
  provisionMissingIndexes,
} from './criticalIndexProvision.js';

export const APPLICATION_MESSAGE_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'application_message_client_idempotency_unique',
    key: Object.freeze({ applicationId: 1, clientMessageId: 1 }),
    unique: true,
    partialFilterExpression: Object.freeze({
      clientMessageId: Object.freeze({ $type: 'string', $gt: '' }),
    }),
  }),
  Object.freeze({
    name: 'application_message_history',
    key: Object.freeze({ applicationId: 1, createdAt: 1, _id: 1 }),
  }),
]);

export const APPLICATION_INTERVIEW_INVITATION_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'application_interview_invitation_app_status',
    key: Object.freeze({ applicationId: 1, status: 1, createdAt: -1 }),
  }),
]);

export async function provisionMktP4CommunicationIndexes({
  messageCollection = ApplicationMessage.collection,
  invitationCollection = ApplicationInterviewInvitation.collection,
} = {}) {
  const messages = await provisionMissingIndexes({
    collection: messageCollection,
    expected: APPLICATION_MESSAGE_CRITICAL_INDEXES,
  });
  const invitations = await provisionMissingIndexes({
    collection: invitationCollection,
    expected: APPLICATION_INTERVIEW_INVITATION_CRITICAL_INDEXES,
  });
  return { messages, invitations };
}

export async function verifyMktP4CommunicationIndexes({
  messageCollection = ApplicationMessage.collection,
  invitationCollection = ApplicationInterviewInvitation.collection,
} = {}) {
  const messageInspection = await inspectIndexesSafely(() => messageCollection.indexes());
  const invitationInspection = await inspectIndexesSafely(() => invitationCollection.indexes());
  const messages = compareCriticalIndexes(
    APPLICATION_MESSAGE_CRITICAL_INDEXES,
    messageInspection.indexes
  );
  const invitations = compareCriticalIndexes(
    APPLICATION_INTERVIEW_INVITATION_CRITICAL_INDEXES,
    invitationInspection.indexes
  );
  return {
    ok: messages.ok && invitations.ok,
    messages,
    invitations,
  };
}

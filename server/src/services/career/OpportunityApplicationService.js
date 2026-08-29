import { TalentProfileRepository } from '../../repositories/career/TalentProfileRepository.js';
import { DocumentRepository } from '../../repositories/career/DocumentRepository.js';
import { ProfileDocumentRepository } from '../../repositories/career/ProfileDocumentRepository.js';
import { OpportunityApplicationRepository } from '../../repositories/career/OpportunityApplicationRepository.js';
import { TalentProfileService } from './TalentProfileService.js';
import { ApplicationValidationService, ApplicationStageMachineService } from './ApplicationValidationService.js';
import { resolveOpportunityReference } from './OpportunityResolverService.js';
import { emitCareerEvent } from './CareerEventBus.js';
import { trackApplicationAnalyticsFromEvent, scheduleApplicationReminderJob } from './careerApplicationBridge.js';
import { normalizeLocale } from '../../../../shared/localization/localeResolver.js';
import {
  assertStudentMayTransition,
  getStudentAllowedTransitions,
  isInternalEmployerApplication,
  resolveApplicationChannel,
  resolveStageAuthority,
} from '../../../../shared/career/applicationAuthority.js';

function actorFromUserId(userId) {
  return { type: 'talent', id: String(userId) };
}

function toPlain(doc) {
  return doc?.toObject ? doc.toObject() : doc;
}

function projectStudentApplication(application) {
  const plain = toPlain(application);
  // MKT-P4 / PRIV-02: employer hiring notes must never surface on the candidate read API.
  if (Array.isArray(plain.notes)) {
    plain.notes = plain.notes.filter((note) => note?.visibility !== 'employer_scoped');
  }
  const machineTransitions = ApplicationStageMachineService.getAllowedTransitions(
    plain.stageTemplateId,
    plain.pipelineStage
  );
  return {
    ...plain,
    applicationChannel: resolveApplicationChannel(plain),
    stageAuthority: resolveStageAuthority(plain),
    allowedTransitions: getStudentAllowedTransitions(plain, machineTransitions),
  };
}

function stageEventType(toStage) {
  if (toStage === 'withdrawn') return 'ApplicationWithdrawn';
  if (toStage === 'accepted') return 'OfferAccepted';
  return 'StageChanged';
}

async function ensureTalentProfile(userId, actor) {
  let profile = await TalentProfileRepository.findByUserId(userId);
  if (!profile) {
    profile = await TalentProfileService.getOrCreateForUser(userId, actor);
  }
  return profile;
}

async function getOwnedApplication(userId, applicationId) {
  const app = await OpportunityApplicationRepository.findByIdForUser(applicationId, userId);
  if (!app) {
    const err = new Error('Application not found');
    err.status = 404;
    throw err;
  }
  if (app.status === 'archived') {
    const err = new Error('Application is archived');
    err.status = 410;
    throw err;
  }
  return app;
}

function emitApplicationEvent(eventType, application, payload, actor, extra = {}) {
  const event = emitCareerEvent(
    eventType,
    {
      applicationId: String(application._id),
      talentProfileId: String(application.talentProfileId),
      opportunityType: application.opportunityRef?.opportunityType,
      opportunityId: application.opportunityRef?.opportunityId
        ? String(application.opportunityRef.opportunityId)
        : null,
      pipelineStage: application.pipelineStage,
      ...payload,
    },
    {
      actor,
      aggregateType: 'OpportunityApplication',
      aggregateId: application._id,
      locale: application.locale,
      market: application.market,
      ...extra,
    }
  );
  trackApplicationAnalyticsFromEvent(event, { userId: application.userId });
  return event;
}

export const OpportunityApplicationService = {
  async listForUser(userId, query = {}) {
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const skip = Math.max(0, parseInt(query.skip, 10) || 0);
    const rows = await OpportunityApplicationRepository.findActiveByUser(userId, {
      limit,
      skip,
      stage: query.stage,
    });
    return rows.map((row) => projectStudentApplication(row));
  },

  async getById(userId, applicationId) {
    return projectStudentApplication(await getOwnedApplication(userId, applicationId));
  },

  async create(userId, body, actor) {
    const parsed = ApplicationValidationService.assertCreate(body);
    const profile = await ensureTalentProfile(userId, actor);

    const opportunityRef = parsed.opportunityRef || {
      opportunityType: body.opportunityType,
      opportunityId: body.opportunityId || null,
      locale: parsed.locale,
      market: parsed.market,
    };

    if (!opportunityRef.opportunityType) {
      const err = new Error('opportunityType is required');
      err.status = 400;
      throw err;
    }

    let resolved = null;
    if (opportunityRef.opportunityId) {
      resolved = await resolveOpportunityReference(opportunityRef);
      const existing = await OpportunityApplicationRepository.findByTalentAndOpportunity(
        profile._id,
        opportunityRef.opportunityType,
        opportunityRef.opportunityId
      );
      if (existing) {
        const err = new Error('Application already exists for this opportunity');
        err.status = 409;
        err.applicationId = String(existing._id);
        throw err;
      }
    }

    const templateId = ApplicationStageMachineService.resolveTemplateId(opportunityRef.opportunityType);
    const initialStage = ApplicationStageMachineService.getInitialStage(opportunityRef.opportunityType);
    const now = new Date();

    const application = await OpportunityApplicationRepository.create({
      userId,
      talentProfileId: profile._id,
      opportunityRef: {
        opportunityType: opportunityRef.opportunityType,
        opportunityId: opportunityRef.opportunityId || null,
        locale: normalizeLocale(opportunityRef.locale || parsed.locale || profile.locale),
        market: opportunityRef.market || parsed.market || profile.market || '',
      },
      organizationId: resolved?.organizationId || parsed.organizationId || null,
      pipelineStage: initialStage,
      stageTemplateId: templateId,
      source: parsed.source || (opportunityRef.opportunityId ? 'platform' : 'external'),
      status: 'active',
      title: parsed.title || resolved?.title || parsed.companyName || '',
      externalUrl: parsed.externalUrl || '',
      companyName: parsed.companyName || '',
      locale: normalizeLocale(parsed.locale || profile.locale),
      market: parsed.market || profile.market || '',
      metadata: parsed.metadata || {},
      appliedAt: initialStage === 'applied' ? now : null,
      stageHistory: [{
        fromStage: initialStage,
        toStage: initialStage,
        at: now,
        byActorType: actor?.type || 'talent',
        byActorId: actor?.id || userId,
        reason: 'created',
      }],
    });

    const plain = toPlain(application);
    if (plain.organizationId) {
      const { recordHandoffConsent, CONSENT_PURPOSES } = await import('../consentGrantService.js');
      await recordHandoffConsent({
        subjectId: userId,
        counterpartyId: plain.organizationId,
        counterpartyType: 'employer',
        purpose: CONSENT_PURPOSES.EMPLOYER_APPLICATION,
        resourceScope: `opportunity_application:${plain._id}`,
        grantedAt: now,
        provenance: 'student_job_apply',
        auditIdentity: `opportunity_application:${plain._id}`,
      });
    }
    emitApplicationEvent('ApplicationCreated', plain, { initialStage }, actor || actorFromUserId(userId));
    return projectStudentApplication(plain);
  },

  async update(userId, applicationId, body, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    if (body?.pipelineStage !== undefined || body?.status !== undefined) {
      const err = new Error('Pipeline stage cannot be set via update');
      err.status = 403;
      err.code = 'STUDENT_CANNOT_SET_EMPLOYER_STATE';
      throw err;
    }
    const parsed = ApplicationValidationService.assertUpdate(body);

    const updated = await OpportunityApplicationRepository.updateById(existing._id, {
      title: parsed.title ?? existing.title,
      externalUrl: parsed.externalUrl ?? existing.externalUrl,
      companyName: parsed.companyName ?? existing.companyName,
      locale: parsed.locale ?? existing.locale,
      market: parsed.market ?? existing.market,
      metadata: parsed.metadata ?? existing.metadata,
    });

    const plain = toPlain(updated);
    emitApplicationEvent(
      'ApplicationUpdated',
      plain,
      { changedFields: Object.keys(parsed) },
      actor || actorFromUserId(userId)
    );
    return projectStudentApplication(plain);
  },

  async transitionStage(userId, applicationId, body, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    const transition = ApplicationValidationService.assertStageTransition(
      body,
      existing.pipelineStage,
      existing.opportunityRef.opportunityType
    );
    transition.byActorType = 'talent';
    transition.byActorId = userId;

    ApplicationStageMachineService.assertTransition(
      existing.stageTemplateId,
      existing.pipelineStage,
      transition.toStage
    );
    assertStudentMayTransition(existing, transition.toStage);

    const historyEntry = {
      fromStage: existing.pipelineStage,
      toStage: transition.toStage,
      at: new Date(),
      byActorType: transition.byActorType,
      byActorId: transition.byActorId || userId,
      reason: transition.reason,
      metadata: transition.metadata,
    };

    const patch = { appliedAt: existing.appliedAt };
    if (transition.toStage === 'applied' && !existing.appliedAt) {
      patch.appliedAt = new Date();
    }

    await OpportunityApplicationRepository.updateById(existing._id, patch);
    const updated = await OpportunityApplicationRepository.pushStageHistory(existing._id, historyEntry);
    const plain = toPlain(updated);

    if (transition.toStage === 'withdrawn') {
      const { revokeHandoffConsent, CONSENT_PURPOSES } = await import('../consentGrantService.js');
      await revokeHandoffConsent({
        subjectId: userId,
        purpose: CONSENT_PURPOSES.EMPLOYER_APPLICATION,
        resourceScope: `opportunity_application:${existing._id}`,
        counterpartyId: existing.organizationId,
      });
    }
    const eventType = stageEventType(transition.toStage);
    emitApplicationEvent(
      eventType,
      plain,
      {
        fromStage: historyEntry.fromStage,
        toStage: historyEntry.toStage,
        reason: historyEntry.reason,
      },
      actor || actorFromUserId(userId)
    );
    return projectStudentApplication(plain);
  },

  async addNote(userId, applicationId, body, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    const parsed = ApplicationValidationService.assertNote(body);
    const note = {
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByActorType: actor?.type || 'talent',
      createdByActorId: actor?.id || userId,
    };

    const updated = await OpportunityApplicationRepository.pushNote(existing._id, note);
    const plain = toPlain(updated);
    const added = plain.notes[plain.notes.length - 1];
    emitApplicationEvent('NoteAdded', plain, { noteId: String(added._id) }, actor || actorFromUserId(userId));
    return plain;
  },

  async attachDocument(userId, applicationId, body, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    const parsed = ApplicationValidationService.assertDocumentReference(body);

    let label = parsed.label;
    let url = parsed.url;

    if (parsed.documentId) {
      const doc = await DocumentRepository.findByIdForUser(parsed.documentId, userId);
      if (!doc) {
        const err = new Error('Document not found');
        err.status = 404;
        throw err;
      }
      label = label || doc.label;
      parsed.profileDocumentId = parsed.profileDocumentId || doc.legacyProfileDocumentId;
      parsed.documentId = doc._id;
    } else if (parsed.profileDocumentId) {
      const legacy = await ProfileDocumentRepository.findByIdForUser(parsed.profileDocumentId, userId);
      if (!legacy) {
        const doc = await DocumentRepository.findByIdForUser(parsed.profileDocumentId, userId);
        if (!doc) {
          const err = new Error('Document not found');
          err.status = 404;
          throw err;
        }
        label = label || doc.label;
        url = url || doc.metadata?.fileUrl || '';
        parsed.documentId = doc._id;
      } else {
        label = label || legacy.label;
        url = url || legacy.metadata?.fileUrl || '';
      }
    }

    const docRef = {
      ...parsed,
      label,
      url,
      attachedAt: new Date(),
      attachedByUserId: userId,
    };

    const updated = await OpportunityApplicationRepository.pushDocument(existing._id, docRef);
    const plain = toPlain(updated);
    const added = plain.documentReferences[plain.documentReferences.length - 1];
    emitApplicationEvent(
      'DocumentAttached',
      plain,
      { documentReferenceId: String(added._id), role: added.role },
      actor || actorFromUserId(userId)
    );
    return plain;
  },

  async removeDocument(userId, applicationId, documentRefId) {
    await getOwnedApplication(userId, applicationId);
    return OpportunityApplicationRepository.pullDocument(applicationId, documentRefId);
  },

  async addReminder(userId, applicationId, body, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    const parsed = ApplicationValidationService.assertReminder(body);
    const reminder = {
      ...parsed,
      remindAt: new Date(parsed.remindAt),
      createdAt: new Date(),
    };

    const updated = await OpportunityApplicationRepository.pushReminder(existing._id, reminder);
    const plain = toPlain(updated);
    const added = plain.reminderReferences[plain.reminderReferences.length - 1];
    emitApplicationEvent(
      'ReminderCreated',
      plain,
      { reminderId: String(added._id), remindAt: added.remindAt },
      actor || actorFromUserId(userId)
    );
    scheduleApplicationReminderJob(added, existing._id, userId);
    return plain;
  },

  async updateReminder(userId, applicationId, reminderId, body) {
    await getOwnedApplication(userId, applicationId);
    const patch = ApplicationValidationService.assertReminder(body);
    if (patch.remindAt) patch.remindAt = new Date(patch.remindAt);
    const updated = await OpportunityApplicationRepository.updateReminder(applicationId, reminderId, patch);
    if (!updated) {
      const err = new Error('Reminder not found');
      err.status = 404;
      throw err;
    }
    return toPlain(updated);
  },

  async removeReminder(userId, applicationId, reminderId) {
    await getOwnedApplication(userId, applicationId);
    return OpportunityApplicationRepository.pullReminder(applicationId, reminderId);
  },

  async archive(userId, applicationId, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    const updated = await OpportunityApplicationRepository.archiveById(existing._id);
    const plain = toPlain(updated);
    emitApplicationEvent('ApplicationArchived', plain, {}, actor || actorFromUserId(userId));
    return plain;
  },

  async addContact(userId, applicationId, body, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    const parsed = ApplicationValidationService.assertContact(body);
    const contact = { ...parsed, createdAt: new Date() };
    const updated = await OpportunityApplicationRepository.pushContact(existing._id, contact);
    const plain = toPlain(updated);
    const added = plain.contacts[plain.contacts.length - 1];
    emitApplicationEvent(
      'ContactAdded',
      plain,
      { contactId: String(added._id), name: added.name, role: added.role },
      actor || actorFromUserId(userId)
    );
    return plain;
  },

  async removeContact(userId, applicationId, contactId) {
    await getOwnedApplication(userId, applicationId);
    return toPlain(await OpportunityApplicationRepository.pullContact(applicationId, contactId));
  },

  async upsertInterview(userId, applicationId, body, actor) {
    const existing = await getOwnedApplication(userId, applicationId);
    // PF-EMP-INT-B4: an interview on an employer-linked application carries a
    // legacyApplicationId — the exact link the Employer scheduler writes through in
    // B1–B3 — so its appointment is Employer-owned. The candidate tracker may read
    // that appointment but must never overwrite scheduledAt / timeZone / mode /
    // meetingUrl / location or the Employer's outcome. Reject before the
    // read-modify-write so a blocked candidate save performs zero persistence, zero
    // `updatedAt` churn, and emits no event or invitation. Purely self-tracked
    // applications (no employer, legacyApplicationId null) keep a candidate-owned
    // appointment the candidate may still manage themselves.
    if (existing.legacyApplicationId || isInternalEmployerApplication(existing)) {
      const err = new Error('This interview is scheduled by the employer and cannot be edited here.');
      err.status = 403;
      throw err;
    }
    const parsed = ApplicationValidationService.assertInterview(body);
    if (parsed.scheduledAt) parsed.scheduledAt = new Date(parsed.scheduledAt);
    const interview = { ...(existing.interview || {}), ...parsed };
    const updated = await OpportunityApplicationRepository.setInterview(existing._id, interview);
    const plain = toPlain(updated);
    emitApplicationEvent(
      'InterviewScheduled',
      plain,
      {
        // PF-EMP-INT-B4: carry the exact OpportunityApplication id so the notification
        // bridge links to /applications/<id> for this legitimate self-tracked write
        // instead of falling back to the generic /applications list. The base payload's
        // `applicationId` is not the field careerNotificationBridge reads.
        opportunityApplicationId: String(plain._id),
        scheduledAt: plain.interview?.scheduledAt,
        timeZone: plain.interview?.timeZone,
        mode: plain.interview?.mode,
      },
      actor || actorFromUserId(userId)
    );
    return plain;
  },

  getAllowedTransitions(application) {
    return getStudentAllowedTransitions(application);
  },
};

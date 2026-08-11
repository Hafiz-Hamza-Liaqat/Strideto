import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { applicationsApi } from '../../services/applicationsApi';
import { StageBadge } from '../../components/applications/StageBadge';
import { StageTimeline } from '../../components/applications/StageTimeline';
import { StageTransitionControl } from '../../components/applications/StageTransitionControl';
import { NoteComposer } from '../../components/applications/NoteComposer';
import { ReminderForm } from '../../components/applications/ReminderForm';
import { DocumentAttachPanel } from '../../components/applications/DocumentAttachPanel';
import { ContactsPanel } from '../../components/applications/ContactsPanel';
import { InterviewPanel } from '../../components/applications/InterviewPanel';
import { ApplicationEditPanel } from '../../components/applications/ApplicationEditPanel';
import { ActivityFeed } from '../../components/timeline/ActivityFeed';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags';
import {
  applicationDisplayTitle,
  formatApplicationDate,
  opportunityDetailRoute,
} from '../../utils/applicationUi';

function Section({ title, children, id }) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation(['applications', 'common']);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(() => {
    if (!isOpportunityApplicationEnabled() || !id) return Promise.resolve();
    return applicationsApi
      .getById(id)
      .then(({ data }) => setApplication(data));
  }, [id]);

  useEffect(() => {
    if (!isOpportunityApplicationEnabled() || !id) {
      setLoading(false);
      return;
    }
    load()
      .catch((err) => setError(err.response?.data?.error || t('applications:loadError')))
      .finally(() => setLoading(false));
  }, [id, t, load]);

  async function afterMutation(promise) {
    await promise;
    await load();
  }

  if (!isOpportunityApplicationEnabled()) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-gray-600 dark:text-gray-400" role="alert">{t('applications:featureDisabled')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <ListingCardSkeleton />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-600 dark:text-red-400" role="alert">{error || t('applications:notFound')}</p>
        <Link to={ROUTES.APPLICATIONS} className="text-primary dark:text-mint mt-4 inline-block hover:underline">
          {t('applications:backToList')}
        </Link>
      </div>
    );
  }

  const title = applicationDisplayTitle(application, t);
  const type = application.opportunityRef?.opportunityType;
  const listingRoute = opportunityDetailRoute(application);

  return (
    <>
      <SeoHead title={title} noindex />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 min-w-0 w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={ROUTES.APPLICATIONS} className="text-sm text-primary dark:text-mint hover:underline">
            {t('applications:backToList')}
          </Link>
          <button
            type="button"
            disabled={archiving}
            onClick={async () => {
              setArchiving(true);
              try {
                await applicationsApi.archive(id);
                window.location.href = ROUTES.APPLICATIONS;
              } catch (err) {
                setError(err.response?.data?.error || t('applications:tracker.archiveError'));
              } finally {
                setArchiving(false);
              }
            }}
            className="text-sm text-red-600 dark:text-red-400 hover:underline min-h-[44px]"
          >
            {t('applications:tracker.archive')}
          </button>
        </div>

        <header className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">{title}</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {type ? t(`applications:opportunityTypes.${type}`) : ''}
                {application.companyName ? ` · ${application.companyName}` : ''}
              </p>
            </div>
            <StageBadge stage={application.pipelineStage} />
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {application.stageAuthority === 'personal'
              ? t('applications:authority.personalEditable')
              : t('applications:authority.employerReadOnly')}
            {application.applicationChannel === 'external_personal'
              ? ` ${t('applications:authority.outsideStrideto')}`
              : ''}
          </p>
          <div className="mt-3">
            <ApplicationEditPanel
              application={application}
              onSave={async (body) => {
                await afterMutation(applicationsApi.update(id, body));
              }}
            />
          </div>
          <dl className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">{t('applications:detail.currentStage')}</dt>
              <dd className="font-medium text-gray-900 dark:text-white mt-0.5">
                {t(`applications:stages.${application.pipelineStage}`, { defaultValue: application.pipelineStage })}
              </dd>
            </div>
            {application.appliedAt && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{t('applications:detail.appliedAt')}</dt>
                <dd className="font-medium text-gray-900 dark:text-white mt-0.5">
                  <time dateTime={application.appliedAt}>
                    {formatApplicationDate(application.appliedAt, i18n.language, { time: true })}
                  </time>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 dark:text-gray-400">{t('applications:detail.source')}</dt>
              <dd className="font-medium text-gray-900 dark:text-white mt-0.5">
                {t(`applications:sources.${application.source || 'platform'}`, { defaultValue: application.source })}
              </dd>
            </div>
            {application.externalUrl && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500 dark:text-gray-400">{t('applications:detail.externalUrl')}</dt>
                <dd className="mt-0.5">
                  <a href={application.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-mint hover:underline break-all">
                    {application.externalUrl}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {listingRoute && (
            <p className="mt-4">
              <Link to={listingRoute} className="text-sm text-primary dark:text-mint hover:underline">
                {t('applications:detail.viewOpportunity')}
              </Link>
            </p>
          )}
        </header>

        <Section
          title={
            application.stageAuthority === 'personal'
              ? t('applications:authority.myTrackingStatus')
              : t('applications:tracker.stageManagement')
          }
          id="stage-mgmt"
        >
          <StageTransitionControl
            currentStage={application.pipelineStage}
            allowedTransitions={application.allowedTransitions || []}
            onTransition={async (payload) => {
              await afterMutation(applicationsApi.transitionStage(id, payload));
            }}
          />
        </Section>

        <Section title={t('applications:detail.stageHistoryTitle')} id="stage-history-heading">
          <StageTimeline history={application.stageHistory} />
        </Section>

        <Section title={t('applications:tracker.interviewTitle')} id="interview-heading">
          <InterviewPanel
            interview={application.interview || {}}
            // PF-EMP-INT-B4: an employer-linked application (legacyApplicationId set) has
            // an Employer-owned appointment — render it read-only. The server also
            // rejects candidate writes to it, so this is presentation, not the boundary.
            employerOwned={Boolean(application.legacyApplicationId) || application.stageAuthority === 'employer'}
            onSave={async (body) => {
              await afterMutation(applicationsApi.upsertInterview(id, body));
            }}
          />
        </Section>

        <Section title={t('applications:detail.notesTitle')} id="notes-heading">
          {(application.notes || []).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('applications:detail.noNotes')}</p>
          ) : (
            <ul className="space-y-3" role="list">
              {(application.notes || []).map((note) => (
                <li key={note._id} className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{note.body}</p>
                  <time className="text-xs text-gray-500 dark:text-gray-400 mt-1 block" dateTime={note.createdAt}>
                    {formatApplicationDate(note.createdAt, i18n.language, { time: true })}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <NoteComposer
            onAdd={async (body) => {
              await afterMutation(applicationsApi.addNote(id, body));
            }}
          />
        </Section>

        <Section title={t('applications:detail.documentsTitle')} id="documents-heading">
          <DocumentAttachPanel
            documents={application.documentReferences || []}
            onAttach={async (body) => {
              await afterMutation(applicationsApi.attachDocument(id, body));
            }}
            onRemove={async (docId) => {
              await afterMutation(applicationsApi.removeDocument(id, docId));
            }}
          />
        </Section>

        <Section title={t('applications:detail.remindersTitle')} id="reminders-heading">
          {(application.reminderReferences || []).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('applications:detail.noReminders')}</p>
          ) : (
            <ul className="space-y-2" role="list">
              {(application.reminderReferences || []).map((r) => (
                <li key={r._id} className="text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{r.title}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                      <time dateTime={r.remindAt}>{formatApplicationDate(r.remindAt, i18n.language, { time: true })}</time>
                      {' · '}
                      {t(`applications:reminderStatus.${r.status}`, { defaultValue: r.status })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={async () => {
                      await afterMutation(applicationsApi.removeReminder(id, r._id));
                    }}
                  >
                    {t('applications:tracker.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ReminderForm
            onAdd={async (body) => {
              await afterMutation(applicationsApi.addReminder(id, body));
            }}
          />
        </Section>

        <Section title={t('applications:tracker.contactsTitle')} id="contacts-heading">
          <ContactsPanel
            contacts={application.contacts || []}
            onAdd={async (body) => {
              await afterMutation(applicationsApi.addContact(id, body));
            }}
            onRemove={async (contactId) => {
              await afterMutation(applicationsApi.removeContact(id, contactId));
            }}
          />
        </Section>

        <Section title={t('applications:detail.activityTitle')} id="activity-heading">
          <ActivityFeed applicationId={application._id} fallbackItems={application.activityReferences || []} />
        </Section>
      </div>
    </>
  );
}

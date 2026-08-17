import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { agentPublicApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { loginLocationState } from '../../utils/loginReturn.js';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';
import { AGENT_NON_AUTHORITY_DISCLAIMER, NO_GUARANTEE_DISCLAIMER } from '@shared/publicDiscovery/publicTruth.js';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { StridetoVerifiedMark } from '../../components/agent/StridetoVerifiedMark';
import { AUTHORITY_KINDS } from '@shared/publicDiscovery/publicTruth.js';
import { SeoHead } from '../../components/seo';
import { humanizeSpecialtySlug } from '../../utils/availabilityWindows';
import { agentServiceCategoryLabel } from '@shared/agent/serviceTaxonomy.js';
import { educationServicePublicPriceLabel } from '@shared/agent/servicePricing.js';

function approvalKindLabel(agentType) {
  if (agentType === 'agency') return 'Approved Agency';
  if (agentType === 'agent') return 'Approved Independent Agent';
  return 'Approved provider';
}

export default function AgentPublicProfile() {
  const { slug } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState({ aggregate: { averageRating: null, reviewCount: 0 }, reviews: [], verifiedMeaning: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    agentPublicApi.getProfile(slug)
      .then((p) => {
        if (cancelled) return null;
        setProfile(p.data.profile);
        return agentPublicApi.getReviews(slug)
          .then((r) => { if (!cancelled) setReviews(r.data); })
          .catch(() => {
            if (!cancelled) {
              setReviews({ aggregate: { averageRating: null, reviewCount: 0 }, reviews: [], verifiedMeaning: '' });
            }
          });
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? 'This profile is not publicly available.' : 'Unable to load this profile.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);
  if (loading) {
    return (
      <>
        <SeoHead title="Agent profile | Strideto" noindex />
        <div className="mx-auto max-w-4xl px-4 py-10"><h1 className="text-2xl font-semibold">Education Provider profile</h1><p className="mt-3 text-slate-500 dark:text-gray-400" role="status">Loading profile…</p></div>
      </>
    );
  }
  if (error) {
    return (
      <>
        <SeoHead title="Agent profile | Strideto" noindex />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <h1 className="text-2xl font-semibold">Education Provider profile</h1>
          <p className="rounded-lg bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" role="alert">{error}</p>
          <Link to={ROUTES.AGENT_PUBLIC_DIRECTORY} className="mt-4 inline-block text-blue-700 dark:text-blue-300">Back to directory</Link>
        </div>
      </>
    );
  }
  const website = publicHttpUrlOrNull(profile.website);
  const consultState = loginLocationState(location);
  const name = profile.professionalName || 'Agent profile';
  const kindLabel = approvalKindLabel(profile.agentType);
  const specialties = (profile.specialties || []).map(humanizeSpecialtySlug);
  return (
    <>
      <SeoHead
        title={`${name} | Strideto`}
        description={profile.professionalSummary || `${kindLabel} profile on Strideto.`}
        canonical={`${ROUTES.AGENT_PUBLIC_DIRECTORY}/${profile.slug || slug}`}
      />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 overflow-x-hidden min-w-0">
        <Link to={ROUTES.AGENT_PUBLIC_DIRECTORY} className="text-sm text-blue-700 dark:text-blue-300">← Agent directory</Link>
        <header className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">{kindLabel}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 break-words-safe">
                Organization / marketplace profile approval. Not Professional Credential Verified, Registered Agent Verified, or government approval.
              </p>
              <h1 className="mt-2 text-3xl font-semibold break-words-safe">{profile.professionalName}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-gray-400 break-words-safe">
                {profile.countryCode}{profile.officeLocation?.city ? ` · ${profile.officeLocation.city}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StridetoVerifiedMark
                  verified={profile.educationProfessionalVerification?.verified === true}
                  scope={profile.educationProfessionalVerification?.scope || 'education_mobility'}
                />
                <div className="mt-0"><PublicTrustBadge kind={AUTHORITY_KINDS.AGENT_STATEMENT} /></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.trustBadges || []).map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-800 dark:bg-green-950/40 dark:text-green-200 break-words-safe"
                >
                  {String(badge).replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-5 whitespace-pre-line text-slate-700 dark:text-gray-200 break-words-safe">{profile.professionalSummary}</p>
          {website ? (
            <a href={website} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-blue-700 dark:text-blue-300 break-words-safe">
              Visit professional website
            </a>
          ) : null}
        </header>
        <section className="grid gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">Languages</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300 break-words-safe">{(profile.languages || []).join(', ') || 'Not provided'}</p>
          </div>
          <div>
            <h2 className="font-semibold">Destination countries</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300 break-words-safe">{(profile.destinationCountries || []).join(', ') || 'Not provided'}</p>
          </div>
          <div className="sm:col-span-2">
            <h2 className="font-semibold">Specialties</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300 break-words-safe">{specialties.join(', ') || 'Not provided'}</p>
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Active services</h2>
          {(profile.services || []).length === 0 ? (
            <p className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm text-slate-500 dark:text-gray-400">
              No active services published.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {profile.services.map((service) => (
                <article key={service._id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 min-w-0">
                  <h3 className="font-medium break-words-safe">{service.title}</h3>
                  <p className="mt-1 text-xs font-medium text-blue-700 dark:text-blue-300">{agentServiceCategoryLabel(service.category)}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 break-words-safe">{service.description}</p>
                  <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">
                    {String(service.deliveryMode || '').replaceAll('_', ' ')} · {educationServicePublicPriceLabel(service)}
                  </p>
                  {service.durationEstimate ? <p className="mt-2 text-xs text-slate-600 dark:text-gray-300">Provider-estimated duration: {service.durationEstimate}</p> : null}
                  {service.eligibilityNotes ? <p className="mt-2 whitespace-pre-line text-xs text-slate-600 dark:text-gray-300 break-words-safe"><strong>Eligibility or limitations:</strong> {service.eligibilityNotes}</p> : null}
                  <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">Price and duration are Provider-maintained information. Display does not mean payment has been processed or an outcome is guaranteed.</p>
                  {isAuthenticated ? (
                    <Link to={`/consultations/new?serviceId=${service._id}`} className="mt-4 inline-block rounded bg-blue-700 px-3 py-2 text-sm text-white min-h-[44px]">
                      Request consultation
                    </Link>
                  ) : (
                    <Link to={ROUTES.LOGIN} state={consultState} className="mt-4 inline-block rounded bg-blue-700 px-3 py-2 text-sm text-white min-h-[44px]">
                      Sign in to request consultation
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-xl font-semibold">Verified interaction reviews</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
            {reviews.aggregate.reviewCount
              ? `${reviews.aggregate.averageRating} / 5 from ${reviews.aggregate.reviewCount} reviews`
              : 'No verified reviews yet.'}
          </p>
          <div className="mt-3 space-y-3">
            {reviews.reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <p className="font-medium">{review.rating} / 5 · Verified interaction</p>
                {review.title ? <h3 className="mt-2 font-semibold">{review.title}</h3> : null}
                <p className="mt-2 text-sm text-slate-700 dark:text-gray-200">{review.body}</p>
                {review.response ? (
                  <div className="mt-3 rounded bg-slate-50 p-3 dark:bg-slate-900/60 text-sm">
                    <strong>{review.response.label}</strong>
                    <p>{review.response.body}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">{reviews.verifiedMeaning}</p>
        </section>
        <p className="text-xs text-slate-500 dark:text-gray-400">{AGENT_NON_AUTHORITY_DISCLAIMER} {NO_GUARANTEE_DISCLAIMER}</p>
      </div>
    </>
  );
}

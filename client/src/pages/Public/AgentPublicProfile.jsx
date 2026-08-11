import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { agentPublicApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { loginLocationState } from '../../utils/loginReturn.js';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';
import { AGENT_NON_AUTHORITY_DISCLAIMER, NO_GUARANTEE_DISCLAIMER } from '@shared/publicDiscovery/publicTruth.js';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { AUTHORITY_KINDS } from '@shared/publicDiscovery/publicTruth.js';
import { SeoHead } from '../../components/seo';

export default function AgentPublicProfile() {
  const { slug } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null); const [reviews, setReviews] = useState({ aggregate: { averageRating: null, reviewCount: 0 }, reviews: [], verifiedMeaning: '' }); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
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
  if (loading) return <><SeoHead title="Agent profile | Strideto" noindex /><div className="mx-auto max-w-4xl px-4 py-10 text-slate-500" role="status">Loading profile…</div></>;
  if (error) return <><SeoHead title="Agent profile | Strideto" noindex /><div className="mx-auto max-w-4xl px-4 py-10"><p className="rounded-lg bg-amber-50 p-4 text-amber-800" role="alert">{error}</p><Link to={ROUTES.AGENT_PUBLIC_DIRECTORY} className="mt-4 inline-block text-blue-700">Back to directory</Link></div></>;
  const website = publicHttpUrlOrNull(profile.website);
  const consultState = loginLocationState(location);
  const name = profile.professionalName || 'Agent profile';
  return <><SeoHead title={`${name} | Strideto`} description={profile.professionalSummary || `Approved ${profile.agentType || 'agent'} profile on Strideto.`} canonical={`${ROUTES.AGENT_PUBLIC_DIRECTORY}/${profile.slug || slug}`} /><div className="mx-auto max-w-4xl space-y-6 px-4 py-10 overflow-x-hidden"><Link to={ROUTES.AGENT_PUBLIC_DIRECTORY} className="text-sm text-blue-700">← Agent directory</Link><header className="rounded-xl border bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-blue-700">Approved {profile.agentType}</p><h1 className="mt-1 text-3xl font-semibold break-words-safe">{profile.professionalName}</h1><p className="mt-2 text-sm text-slate-500 break-words-safe">{profile.countryCode}{profile.officeLocation?.city ? ` · ${profile.officeLocation.city}` : ''}</p><div className="mt-2"><PublicTrustBadge kind={AUTHORITY_KINDS.AGENT_STATEMENT} /></div></div><div className="flex flex-wrap gap-2">{profile.trustBadges.map((badge) => <span key={badge} className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-800">{badge.replaceAll('_', ' ')}</span>)}</div></div><p className="mt-5 whitespace-pre-line text-slate-700 break-words-safe">{profile.professionalSummary}</p>{website && <a href={website} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-blue-700 break-words-safe">Visit professional website</a>}</header>
    <section className="grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2"><div><h2 className="font-semibold">Languages</h2><p className="mt-1 text-sm text-slate-600">{profile.languages.join(', ') || 'Not provided'}</p></div><div><h2 className="font-semibold">Destination countries</h2><p className="mt-1 text-sm text-slate-600">{profile.destinationCountries.join(', ') || 'Not provided'}</p></div><div className="sm:col-span-2"><h2 className="font-semibold">Specialties</h2><p className="mt-1 text-sm text-slate-600">{profile.specialties.join(', ') || 'Not provided'}</p></div></section>
    <section><h2 className="text-xl font-semibold">Active services</h2>{profile.services.length === 0 ? <p className="mt-3 rounded-xl border bg-white p-5 text-sm text-slate-500">No active services published.</p> : <div className="mt-3 grid gap-4 sm:grid-cols-2">{profile.services.map((service) => <article key={service._id} className="rounded-xl border bg-white p-5 min-w-0"><h3 className="font-medium break-words-safe">{service.title}</h3><p className="mt-2 text-sm text-slate-600 break-words-safe">{service.description}</p><p className="mt-3 text-xs text-slate-500">{service.deliveryMode} · {service.pricingMode.replaceAll('_', ' ')}</p>{isAuthenticated ? <Link to={`/consultations/new?serviceId=${service._id}`} className="mt-4 inline-block rounded bg-blue-700 px-3 py-2 text-sm text-white min-h-[44px]">Request consultation</Link> : <Link to={ROUTES.LOGIN} state={consultState} className="mt-4 inline-block rounded bg-blue-700 px-3 py-2 text-sm text-white min-h-[44px]">Sign in to request consultation</Link>}</article>)}</div>}</section><section><h2 className="text-xl font-semibold">Verified interaction reviews</h2><p className="mt-1 text-sm text-slate-600">{reviews.aggregate.reviewCount ? `${reviews.aggregate.averageRating} / 5 from ${reviews.aggregate.reviewCount} reviews` : 'No verified reviews yet.'}</p><div className="mt-3 space-y-3">{reviews.reviews.map((review) => <article key={review.id} className="rounded-xl border bg-white p-5"><p className="font-medium">{review.rating} / 5 · Verified interaction</p>{review.title && <h3 className="mt-2 font-semibold">{review.title}</h3>}<p className="mt-2 text-sm text-slate-700">{review.body}</p>{review.response && <div className="mt-3 rounded bg-slate-50 p-3 text-sm"><strong>{review.response.label}</strong><p>{review.response.body}</p></div>}</article>)}</div><p className="mt-3 text-xs text-slate-500">{reviews.verifiedMeaning}</p></section><p className="text-xs text-slate-500">{AGENT_NON_AUTHORITY_DISCLAIMER} {NO_GUARANTEE_DISCLAIMER}</p></div></>;
}

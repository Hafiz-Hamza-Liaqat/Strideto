import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';

export default function EmployerAcceptInvitation() {
  const { t } = useTranslation(['employer', 'common']);
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { employer, refreshEmployer } = useEmployerAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t('employer:inviteTokenMissing'));
      return;
    }
    employerApi
      .previewInvite(token)
      .then(({ data }) => setPreview(data))
      .catch((err) => setError(err.response?.data?.error || t('employer:invitePreviewFailed')));
  }, [token, t]);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await employerApi.acceptInvite(token);
      await refreshEmployer?.();
      navigate(ROUTES.EMPLOYER_DASHBOARD);
    } catch (err) {
      setError(err.response?.data?.error || t('employer:inviteAcceptFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-main dark:bg-secondary">
      <SeoHead title={t('employer:acceptInviteSeoTitle')} description={t('employer:acceptInviteSeoDesc')} noindex />
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h1 className="text-xl font-semibold">{t('employer:acceptInviteHeading')}</h1>
        {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
        {preview ? (
          <p className="text-sm">
            {t('employer:invitePreview', { org: preview.organizationName, role: preview.role, status: preview.status })}
          </p>
        ) : null}
        {!employer ? (
          <p className="text-sm">
            <Link className="text-primary hover:underline" to={`${ROUTES.EMPLOYER_LOGIN}?next=/employer/accept-invitation?token=${encodeURIComponent(token)}`}>
              {t('employer:signInToAccept')}
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" to={ROUTES.EMPLOYER_REGISTER}>
              {t('employer:registerEmployer')}
            </Link>
          </p>
        ) : (
          <button
            type="button"
            disabled={busy || !token || preview?.status !== 'pending'}
            onClick={accept}
            className="w-full min-h-[44px] bg-primary text-white rounded-lg disabled:opacity-50"
          >
            {t('employer:acceptInvite')}
          </button>
        )}
      </div>
    </div>
  );
}

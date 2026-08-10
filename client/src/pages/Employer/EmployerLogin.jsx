import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';
import { isOnboardingComplete, markOnboardingPending } from '../../onboarding';

export default function EmployerLogin() {
  const { t } = useTranslation(['employer', 'common', 'forms']);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error: ctxError, setError: setCtxError } = useEmployerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || ROUTES.EMPLOYER_DASHBOARD;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCtxError?.(null);
    setSubmitting(true);
    try {
      const emp = await login(email.trim().toLowerCase(), password);
      const empId = emp?._id ? String(emp._id) : 'employer';
      if (!isOnboardingComplete({ userId: empId })) {
        markOnboardingPending();
        navigate(ROUTES.HOME, { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setCtxError?.(err.response?.data?.error || t('employer:loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead title={t('employer:loginTitle')} description={t('forms:employerLogin.seoDescription')} noindex />
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-4 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">{t('employer:loginHeading')}</h1>
            <p className="text-slate-600 mt-1 mb-6">{t('employer:loginSubtitle')}</p>
            {ctxError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{ctxError}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="employer-login-email" className="block text-sm font-medium text-[#0F172A] mb-1">{t('common:email')}</label>
                <input
                  id="employer-login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
                />
              </div>
              <div>
                <label htmlFor="employer-login-password" className="block text-sm font-medium text-[#0F172A] mb-1">{t('common:password')}</label>
                <input
                  id="employer-login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#635BFF] hover:bg-[#4F46E5] text-white font-medium rounded-lg disabled:opacity-50"
              >
                {submitting ? t('common:signingIn') : t('common:signIn')}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-600">
              {t('employer:noEmployerAccount')}{' '}
              <Link to={ROUTES.EMPLOYER_REGISTER} className="text-[#635BFF] font-medium hover:underline">
                {t('common:register')}
              </Link>
            </p>
          </div>
          <p className="mt-4 text-center">
            <Link to={ROUTES.HOME} className="text-sm text-slate-500 hover:text-[#635BFF]">
              {t('employer:backToStrideto')}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { EMPLOYER_ROLES } from '@shared/employer/team.js';

const INVITE_ROLES = [EMPLOYER_ROLES.ADMIN, EMPLOYER_ROLES.RECRUITER, EMPLOYER_ROLES.VIEWER];

export default function EmployerTeam() {
  const { t } = useTranslation(['employer', 'common']);
  const { employer } = useEmployerAuth();
  const canManage = (employer?.capabilities || []).includes('team.manage');
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [q, setQ] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(EMPLOYER_ROLES.RECRUITER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [teamRes, inviteRes] = await Promise.all([
      employerApi.listTeam({ q: q || undefined }),
      employerApi.listInvites(),
    ]);
    setMembers(teamRes.data.data || []);
    setInvites(inviteRes.data.data || []);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err.response?.data?.error || t('employer:teamLoadFailed')))
      .finally(() => setLoading(false));
  }, [load, t]);

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setInviteLink('');
    try {
      const { data } = await employerApi.createInvite({ email, role });
      setNotice(t('employer:inviteCreated'));
      setInviteLink(data.acceptPath ? `${window.location.origin}${data.acceptPath}` : '');
      setEmail('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || t('employer:inviteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (membershipId, nextRole) => {
    setBusy(true);
    setError('');
    try {
      await employerApi.updateMember(membershipId, { role: nextRole });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || t('employer:roleChangeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (membershipId) => {
    if (!window.confirm(t('employer:confirmRemoveMember'))) return;
    setBusy(true);
    setError('');
    try {
      await employerApi.removeMember(membershipId);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || t('employer:removeMemberFailed'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (invitationId) => {
    setBusy(true);
    setError('');
    try {
      await employerApi.revokeInvite(invitationId);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || t('employer:revokeInviteFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SeoHead title={t('employer:teamSeoTitle')} description={t('employer:teamSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:navTeam')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:teamIntro')}</p>
      {error ? <p className="mb-4 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-green-800 dark:text-green-200" role="status">{notice}</p> : null}
      {inviteLink ? (
        <p className="mb-4 text-sm break-all bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg">
          {t('employer:inviteLinkHint')} {inviteLink}
        </p>
      ) : null}

      <div className="mb-4">
        <label htmlFor="employer-team-search" className="sr-only">{t('common:search')}</label>
        <input
          id="employer-team-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('employer:teamSearchPlaceholder')}
          className="w-full max-w-md min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
        />
      </div>

      {loading ? <p>{t('common:loading')}</p> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-8">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900">
              <tr>
                <th className="p-3">{t('employer:teamEmail')}</th>
                <th className="p-3">{t('employer:teamRole')}</th>
                {canManage ? <th className="p-3">{t('common:actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr><td className="p-4" colSpan={3}>{t('employer:teamEmpty')}</td></tr>
              ) : members.map((m) => (
                <tr key={m.membershipId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 break-all">{m.email}</td>
                  <td className="p-3">
                    {canManage ? (
                      <select
                        aria-label={t('employer:teamRole')}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => changeRole(m.membershipId, e.target.value)}
                        className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2"
                      >
                        {Object.values(EMPLOYER_ROLES).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : m.role}
                  </td>
                  {canManage ? (
                    <td className="p-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(m.membershipId)}
                        className="min-h-[44px] text-red-700 dark:text-red-300"
                      >
                        {t('employer:removeMember')}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <>
          <h2 className="text-lg font-semibold mb-3">{t('employer:pendingInvites')}</h2>
          <ul className="mb-6 space-y-2">
            {invites.length === 0 ? <li className="text-sm text-slate-500">{t('employer:noPendingInvites')}</li> : null}
            {invites.map((inv) => (
              <li key={inv.invitationId} className="flex flex-wrap items-center gap-3 text-sm">
                <span>{inv.email} · {inv.role} · {inv.status}</span>
                <button type="button" disabled={busy} onClick={() => revoke(inv.invitationId)} className="min-h-[44px] text-red-700">
                  {t('employer:revokeInvite')}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={invite} className="max-w-xl space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <h2 className="font-semibold">{t('employer:inviteMember')}</h2>
            <label className="block text-sm">
              {t('employer:inviteEmail')}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              />
            </label>
            <label className="block text-sm">
              {t('employer:teamRole')}
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              >
                {INVITE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <button type="submit" disabled={busy} className="min-h-[44px] px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50">
              {t('employer:sendInvite')}
            </button>
            <p className="text-xs text-slate-500">{t('employer:inviteEmailNotConfigured')}</p>
          </form>
        </>
      ) : null}
    </>
  );
}

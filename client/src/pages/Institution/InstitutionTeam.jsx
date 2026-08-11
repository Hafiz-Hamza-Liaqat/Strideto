import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { INSTITUTION_ROLE_LABELS } from '../../../../shared/institution/institutionPortal.js';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionTeam() {
  const { account, organizationId } = useInstitutionAuth();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [managerRole, setManagerRole] = useState('viewer');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [invite, setInvite] = useState({ email: '', role: 'viewer' });
  const [tokenOnce, setTokenOnce] = useState('');

  const load = () => Promise.all([
    institutionPortalApi.team(organizationId),
    institutionPortalApi.dashboard(organizationId),
    institutionPortalApi.listInvites(organizationId).catch(() => ({ data: { data: [] } })),
  ]).then(([team, dashboard, inviteRes]) => {
    setMembers(team.data.members || []);
    setManagerRole(dashboard.data.membership?.role || 'viewer');
    setInvites(inviteRes.data.data || inviteRes.data.invites || []);
  }).catch((requestError) => setError(requestError.response?.data?.error || 'Team settings are unavailable.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const canManage = ['owner', 'admin'].includes(managerRole);
  const filtered = members.filter((m) => !q || (m.account?.email || '').toLowerCase().includes(q.toLowerCase()));

  const sendInvite = async (event) => {
    event.preventDefault(); setError(''); setNotice(''); setTokenOnce('');
    try {
      const { data } = await institutionPortalApi.createInvite(organizationId, invite);
      setTokenOnce(data.acceptPath || '');
      setNotice('Invitation created. Email delivery is not configured — share the accept link once.');
      setInvite({ email: '', role: 'viewer' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Invite failed.');
    }
  };

  if (loading) return <PageState>Loading Institution team…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Team</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Roles map to existing vocabulary: Owner, Admin, Admissions / Program Manager (editor), Viewer. Last owner cannot be removed. Team membership never grants Student or Vault access. Cross-Institution membership is denied.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {notice ? <PageState tone="success">{notice} {tokenOnce}</PageState> : null}
      <Panel title="Institution account">
        <p className="break-all text-sm text-gray-800 dark:text-gray-200">{account?.email}</p>
        <StatusBadge value={managerRole} label={INSTITUTION_ROLE_LABELS[managerRole] || managerRole} />
      </Panel>
      <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter members" aria-label="Filter members" />
      <Panel title="Active members">
        {filtered.length ? filtered.map((member) => (
          <div key={member._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2">
            <div>
              <p className="break-all text-sm font-semibold text-gray-900 dark:text-white">{member.account?.email}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{INSTITUTION_ROLE_LABELS[member.role] || humanize(member.role)}</p>
            </div>
            {canManage && member.role !== 'owner' ? (
              <div className="flex flex-wrap gap-2">
                <select className={`${fieldClass} w-auto`} defaultValue={member.role} id={`role-${member._id}`} aria-label={`Role for ${member.account?.email}`}>
                  <option value="admin">Admin</option>
                  <option value="editor">Admissions / Program Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button className={primaryButton} type="button" onClick={() => {
                  const role = document.getElementById(`role-${member._id}`).value;
                  institutionPortalApi.updateMemberRole(organizationId, member._id, role).then(load).catch((err) => setError(err.response?.data?.error || 'Role change failed.'));
                }}>Update role</button>
                <button className={secondaryButton} type="button" onClick={() => institutionPortalApi.revokeMember(organizationId, member._id).then(load).catch((err) => setError(err.response?.data?.error || 'Remove failed.'))}>Remove</button>
              </div>
            ) : <StatusBadge value={member.role} />}
          </div>
        )) : <PageState>No members match.</PageState>}
      </Panel>
      {canManage ? (
        <Panel title="Invitations">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={sendInvite}>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Email<input required type="email" className={`${fieldClass} mt-1`} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Role
              <select className={`${fieldClass} mt-1`} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="editor">Admissions / Program Manager</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <div className="sm:col-span-2"><button className={primaryButton}>Send invite</button></div>
          </form>
          {invites.map((inv) => (
            <p key={inv.invitationId} className="mt-2 text-sm text-gray-700 dark:text-gray-300">{inv.email} · {inv.role} · {inv.status}
              <button className="ml-2 text-primary underline" type="button" onClick={() => institutionPortalApi.revokeInvite(organizationId, inv.invitationId).then(load)}>Revoke</button>
            </p>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

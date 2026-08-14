import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_PERMISSION_GROUPS, defaultPermissionsForInvite } from '@shared/provider/providerDomainPermissions.js';
import { publicProviderDomainProjection } from '@shared/provider/providerDomains.js';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2';

export default function AgentTeam() {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [q, setQ] = useState('');
  const [agencyDomains, setAgencyDomains] = useState([]);
  const [selectedDomains, setSelectedDomains] = useState([]);

  const load = async () => {
    const [teamRes, inviteRes, ctxRes] = await Promise.all([
      agentApi.getTeam({ params: { q } }),
      agentApi.getTeamInvites().catch(() => ({ data: { data: [] } })),
      agentApi.getProviderDomainContext().catch(() => ({ data: { workspaces: [] } })),
    ]);
    setMembers(teamRes.data.members || []);
    setInvites(inviteRes.data.data || []);
    const agency = [...new Set((ctxRes.data.workspaces || [])
      .filter((w) => w.kind === 'agency')
      .map((w) => w.domainId))];
    setAgencyDomains(agency);
    setSelectedDomains((current) => current.filter((id) => agency.includes(id)));
  };

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error || 'Unable to load team.')).finally(() => setLoading(false));
  }, []);

  const toggle = async (member) => {
    setBusy(member._id); setError('');
    try { await agentApi.changeMemberStatus(member.agentAccountId, !member.active); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Unable to update membership.'); }
    finally { setBusy(''); }
  };

  const changeRole = async (member, nextRole) => {
    setBusy(member._id); setError('');
    try { await agentApi.changeMemberRole(member.agentAccountId, nextRole); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Unable to change role.'); }
    finally { setBusy(''); }
  };

  const invite = async (event) => {
    event.preventDefault(); setBusy('invite'); setError(''); setInviteLink('');
    if (!selectedDomains.length) {
      setError('Select at least one provider domain this team member should work on.');
      setBusy('');
      return;
    }
    try {
      const domainAccess = selectedDomains.map((domainId) => ({
        domainId,
        permissions: defaultPermissionsForInvite({ domainId, role }),
      }));
      const { data } = await agentApi.createTeamInvite({ email, role, domainAccess });
      const link = `${window.location.origin}${ROUTES.AGENT_ACCEPT_INVITATION}?token=${data.token}`;
      setInviteLink(link);
      setEmail('');
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Unable to create invitation.'); }
    finally { setBusy(''); }
  };

  const revoke = async (invitationId) => {
    setBusy(invitationId);
    try { await agentApi.revokeTeamInvite(invitationId); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Unable to revoke invitation.'); }
    finally { setBusy(''); }
  };

  if (loading) return <p className="text-sm text-slate-500 dark:text-gray-400">Loading team…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Agency team</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Roles remain owner, admin, and member. Last owner cannot be deactivated. Domain access is required on every invite and does not grant professional verification.
        </p>
      </div>
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
      <label className="text-sm text-gray-900 dark:text-white">Search members
        <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => load().catch(() => {})} className={inputClass} placeholder="Email or role" />
      </label>
      {members.length === 0 ? (
        <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm text-slate-500">No agency team is available for this account. Individual professionals do not have a team.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900"><tr><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Domains</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member._id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 break-words-safe">{member.email || member.agentAccountId}</td>
                  <td className="p-3">
                    {member.role === 'owner' ? 'owner' : (
                      <select value={member.role} disabled={busy === member._id} onChange={(e) => changeRole(member, e.target.value)} className={inputClass}>
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    )}
                  </td>
                  <td className="p-3 break-words-safe">
                    {(member.domainAccess || []).map((row) => publicProviderDomainProjection(row.domainId)?.shortName || row.domainId).join(', ') || 'legacy education'}
                  </td>
                  <td className="p-3">{member.active ? 'Active' : 'Inactive'}</td>
                  <td className="p-3">
                    <button disabled={busy === member._id || member.role === 'owner'} onClick={() => toggle(member)} className="text-primary disabled:text-slate-400 min-h-[44px]">
                      {member.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={invite} className="max-w-xl space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Invite member</h2>
        <label className="text-sm text-gray-900 dark:text-white">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></label>
        <label className="text-sm text-gray-900 dark:text-white">Role
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="admin">admin</option>
            <option value="member">member</option>
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-gray-900 dark:text-white">What should this team member work on? <span className="text-red-700">*</span></legend>
          {agencyDomains.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Activate a provider domain for this agency before inviting operational access.</p>
          ) : agencyDomains.map((domainId) => {
            const def = publicProviderDomainProjection(domainId);
            const groups = PROVIDER_DOMAIN_PERMISSION_GROUPS[domainId] || [];
            return (
              <label key={domainId} className="mt-2 flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                <input
                  type="checkbox"
                  checked={selectedDomains.includes(domainId)}
                  onChange={() => setSelectedDomains((current) => (
                    current.includes(domainId) ? current.filter((id) => id !== domainId) : [...current, domainId]
                  ))}
                />
                <span className="min-w-0">
                  <span className="font-medium break-words">{def?.publicName || domainId}</span>
                  <span className="block text-xs text-slate-500">
                    {groups.filter((g, i, arr) => arr.findIndex((x) => x.publicLabel === g.publicLabel) === i).map((g) => g.publicLabel).join(' · ')}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <button disabled={busy === 'invite' || selectedDomains.length === 0} className="rounded-lg bg-primary px-4 py-2 text-sm text-white min-h-[44px] disabled:opacity-50">Send invite</button>
        <p className="text-xs text-slate-500">Email delivery is not configured. Share the one-time link locally. Duplicate pending invites are rejected. Invite access is not professional verification.</p>
        {inviteLink ? <p className="text-xs break-words-safe text-gray-800 dark:text-gray-200">Invite link: {inviteLink}</p> : null}
      </form>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Pending invitations</h2>
        <ul className="mt-2 space-y-2">
          {invites.length === 0 ? <li className="text-sm text-slate-500">No pending invitations.</li> : null}
          {invites.map((inv) => (
            <li key={inv.invitationId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
              <span className="break-words-safe">{inv.email} · {inv.role} · {inv.status}</span>
              <button type="button" disabled={busy === inv.invitationId} onClick={() => revoke(inv.invitationId)} className="text-red-700 min-h-[44px]">Revoke</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

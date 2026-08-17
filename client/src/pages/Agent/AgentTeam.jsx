import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_PERMISSION_GROUPS, PROVIDER_DOMAIN_PERMISSIONS, defaultPermissionsForInvite } from '@shared/provider/providerDomainPermissions.js';
import { PROVIDER_DOMAIN_IDS, publicProviderDomainProjection } from '@shared/provider/providerDomains.js';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2';

function dutyLabels(member, domainId) {
  const access = (member.domainAccess || []).find((row) => row.domainId === domainId);
  if (!access) {
    return domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES ? 'No Business access' : 'No Education access';
  }
  const groups = PROVIDER_DOMAIN_PERMISSION_GROUPS[domainId] || [];
  const labels = groups
    .filter((g) => (access.permissions || []).includes(g.permissionId))
    .filter((g, i, arr) => arr.findIndex((x) => x.publicLabel === g.publicLabel) === i)
    .map((g) => g.publicLabel);
  return labels.length ? labels.join(' · ') : 'Workspace access';
}

export default function AgentTeam({ focusDomainId = null }) {
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
  const [grantCaseDocuments, setGrantCaseDocuments] = useState(false);

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
      .map((w) => w.domainId)
      .filter((id) => !focusDomainId || id === focusDomainId))];
    setAgencyDomains(agency);
    setSelectedDomains((current) => {
      const next = current.filter((id) => agency.includes(id));
      if (focusDomainId && agency.includes(focusDomainId) && !next.includes(focusDomainId)) {
        return [...next, focusDomainId];
      }
      return next;
    });
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

  const removeFocusDomainAccess = async (member) => {
    if (!focusDomainId) return;
    setBusy(member._id);
    setError('');
    try {
      const next = (member.domainAccess || []).filter((row) => row.domainId !== focusDomainId);
      await agentApi.updateMemberDomainAccess({
        targetAgentAccountId: member.agentAccountId,
        domainAccess: next,
        expectedVersion: member.recordVersion,
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to remove domain assignment.');
    } finally {
      setBusy('');
    }
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
      const domainAccess = selectedDomains.map((domainId) => {
        const permissions = defaultPermissionsForInvite({ domainId, role });
        if (
          grantCaseDocuments
          && domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
          && !permissions.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE)
        ) {
          permissions.push(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE);
        }
        return { domainId, permissions };
      });
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

  const heading = focusDomainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
    ? 'Business Team'
    : focusDomainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY
      ? 'Education Team'
      : 'Agency team';
  const intro = focusDomainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
    ? 'Business-domain duties for this agency. Membership rows may be shared with Education; removing Business access does not delete Education duties or the underlying member. Domain access is not professional verification.'
    : focusDomainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY
      ? 'Education-domain duties for this agency. Membership rows may be shared with Business; removing Education access does not delete Business duties or the underlying member. Domain access is not professional verification.'
      : 'Roles remain owner, admin, and member. Last owner cannot be deactivated. Domain access is required on every invite and does not grant professional verification. Case document access is a separate sensitive duty and is never granted by owner or admin role alone.';

  const visibleMembers = focusDomainId
    ? members.filter((member) => (member.domainAccess || []).some((row) => row.domainId === focusDomainId))
    : members;
  const visibleInvites = focusDomainId
    ? invites.filter((inv) => (inv.domainAccess || []).some((row) => row.domainId === focusDomainId))
    : invites;
  const removeLabel = focusDomainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
    ? 'Remove Business access'
    : focusDomainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY
      ? 'Remove Education access'
      : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{intro}</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
      <label className="text-sm text-gray-900 dark:text-white">Search members
        <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => load().catch(() => {})} className={inputClass} placeholder="Email or role" />
      </label>
      {visibleMembers.length === 0 ? (
        <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm text-slate-500">
          {focusDomainId
            ? 'No team members currently have this professional domain assigned.'
            : 'No agency team is available for this account. Individual professionals do not have a team.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-gray-900"><tr><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">{focusDomainId ? 'Domain duties' : 'Domains'}</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
            <tbody>
              {visibleMembers.map((member) => (
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
                    {focusDomainId
                      ? dutyLabels(member, focusDomainId)
                      : ((member.domainAccess || []).map((row) => publicProviderDomainProjection(row.domainId)?.shortName || row.domainId).join(', ') || 'legacy education')}
                  </td>
                  <td className="p-3">{member.active ? 'Active' : 'Inactive'}</td>
                  <td className="p-3">
                    {focusDomainId && removeLabel && member.role !== 'owner' ? (
                      <button
                        type="button"
                        disabled={busy === member._id}
                        onClick={() => removeFocusDomainAccess(member)}
                        className="text-primary disabled:text-slate-400 min-h-[44px]"
                      >
                        {removeLabel}
                      </button>
                    ) : (
                      <button disabled={busy === member._id || member.role === 'owner'} onClick={() => toggle(member)} className="text-primary disabled:text-slate-400 min-h-[44px]">
                        {member.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
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
                  disabled={Boolean(focusDomainId)}
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
        {selectedDomains.includes(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) ? (
          <label className="flex items-start gap-2 text-sm text-gray-900 dark:text-white">
            <input
              type="checkbox"
              checked={grantCaseDocuments}
              onChange={(e) => setGrantCaseDocuments(e.target.checked)}
            />
            <span>Grant Case document review duty (sensitive). Not included for owner or admin by default.</span>
          </label>
        ) : null}
        <button disabled={busy === 'invite' || selectedDomains.length === 0} className="rounded-lg bg-primary px-4 py-2 text-sm text-white min-h-[44px] disabled:opacity-50">Send invite</button>
        <p className="text-xs text-slate-500">Email delivery is not configured. Share the one-time link locally. Duplicate pending invites are rejected. Invite access is not professional verification.</p>
        {inviteLink ? <p className="text-xs break-words-safe text-gray-800 dark:text-gray-200">Invite link: {inviteLink}</p> : null}
      </form>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Pending invitations</h2>
        <ul className="mt-2 space-y-2">
          {visibleInvites.length === 0 ? <li className="text-sm text-slate-500">No pending invitations.</li> : null}
          {visibleInvites.map((inv) => (
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

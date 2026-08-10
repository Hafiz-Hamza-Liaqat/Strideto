import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton } from './InstitutionUi';

export default function InstitutionTeam() {
  const { account, organizationId } = useInstitutionAuth();
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState('viewer');
  const [managerRole, setManagerRole] = useState('viewer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([institutionPortalApi.team(organizationId), institutionPortalApi.dashboard(organizationId)])
      .then(([team, dashboard]) => { setMembers(team.data.members || []); setManagerRole(dashboard.data.membership?.role || 'viewer'); })
      .catch((requestError) => setError(requestError.response?.data?.error || 'Team settings are unavailable.'))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const canManage = ['owner', 'admin'].includes(managerRole);
  const update = async (memberId) => {
    try { await institutionPortalApi.updateMemberRole(organizationId, memberId, role); setMembers((current) => current.map((member) => member._id === memberId ? { ...member, role } : member)); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Member role could not be changed.'); }
  };

  if (loading) return <PageState>Loading Institution team…</PageState>;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-blue-700">Membership and account</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Team and settings</h1><p className="mt-2 text-sm text-slate-600">The server enforces owner/admin team authority. Viewer and editor roles cannot manage membership.</p></div>{error ? <PageState tone="error" role="alert">{error}</PageState> : null}<Panel title="Institution account"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-medium text-slate-600">Signed in as</dt><dd className="break-all text-slate-900">{account?.email}</dd></div><div><dt className="font-medium text-slate-600">Membership role</dt><dd><StatusBadge value={managerRole} /></dd></div><div><dt className="font-medium text-slate-600">Commerce</dt><dd>Not configured</dd></div><div><dt className="font-medium text-slate-600">Student and Vault access</dt><dd>Not available</dd></div></dl></Panel><Panel title="Active team members">{members.length ? <ul className="space-y-3">{members.map((member) => <li key={member._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div className="min-w-0"><p className="break-all text-sm font-semibold text-slate-900">{member.account?.email || 'Account unavailable'}</p><p className="mt-1 text-xs text-slate-600">Current role: {humanize(member.role)}</p></div>{canManage && member.role !== 'owner' ? <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor={`role-${member._id}`}>New role for {member.account?.email}</label><select id={`role-${member._id}`} className={`${fieldClass} w-auto`} value={role} onChange={(event) => setRole(event.target.value)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className={primaryButton} onClick={() => update(member._id)}>Update role</button></div> : <StatusBadge value={member.role} />}</li>)}</ul> : <PageState>No active team members were returned.</PageState>}</Panel><PageState role="note">Team invitations are unavailable because Mission 18 exposes no Institution invitation endpoint. No fake invite control is shown.</PageState></div>;
}

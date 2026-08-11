import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ACADEMIC_FIELDS, DEGREE_LEVELS, STUDY_MODES } from '@shared/education/taxonomy.js';
import { PROGRAM_REQUIREMENT_TYPES, REQUIREMENT_SEMANTICS } from '@shared/education/scholarshipIntelligence.js';
import { ACCEPTANCE_SCOPES, ACCEPTANCE_STATUSES } from '@shared/education/acceptanceExplorer.js';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';

const initialProgram = { name: '', degreeLevel: 'bachelor', field: 'other', campus: '', instructionLanguage: '', studyMode: 'full_time', durationMonths: '', officialProgramUrl: '', country: '', admissionRequirementsUrl: '', intakeLabel: '', intakeDeadline: '', tuitionAmountMinor: '', tuitionCurrency: '', tuitionPer: 'year' };

export default function InstitutionProgramEditor() {
  const { programId } = useParams();
  const editing = Boolean(programId);
  const { organizationId } = useInstitutionAuth();
  const navigate = useNavigate();
  const [program, setProgram] = useState(initialProgram);
  const [authority, setAuthority] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requirement, setRequirement] = useState({ requirementType: 'academic', semantics: 'required', description: '', intake: '' });
  const [acceptance, setAcceptance] = useState({ testId: '', acceptanceScope: 'program', acceptanceStatus: 'accepted', minimumOverallScore: '', intake: '' });

  useEffect(() => {
    const requests = [institutionPortalApi.dashboard(organizationId)];
    if (editing) requests.push(institutionPortalApi.program(organizationId, programId));
    Promise.all(requests).then(([dashboard, detail]) => {
      setAuthority(dashboard.data);
      if (detail?.data?.program) {
        const item = detail.data.program;
        setProgram({ ...initialProgram, ...item, intakeLabel: item.intakes?.[0]?.cycleLabel || '', intakeDeadline: item.intakes?.[0]?.deadlineAt?.slice?.(0, 10) || '', tuitionAmountMinor: item.tuition?.amountMinor ?? '', tuitionCurrency: item.tuition?.currency || '', tuitionPer: item.tuition?.per || 'year' });
      }
    }).catch((requestError) => setError(requestError.response?.data?.error || 'Program editor is unavailable.')).finally(() => setLoading(false));
  }, [editing, organizationId, programId]);

  const canManage = authority?.verificationStatus === 'approved' && authority?.claimState === 'approved' && ['owner', 'admin', 'editor'].includes(authority?.membership?.role);
  const set = (key) => (event) => setProgram((current) => ({ ...current, [key]: event.target.value }));
  const payload = () => ({
    name: program.name.trim(), degreeLevel: program.degreeLevel, field: program.field, campus: program.campus.trim(), studyMode: program.studyMode,
    durationMonths: program.durationMonths ? Number(program.durationMonths) : undefined, officialProgramUrl: program.officialProgramUrl.trim(), country: program.country.trim().toUpperCase(), admissionRequirementsUrl: program.admissionRequirementsUrl.trim(),
    intakes: program.intakeLabel ? [{ cycleLabel: program.intakeLabel.trim(), deadlineAt: program.intakeDeadline || null }] : [],
    tuition: program.tuitionCurrency && program.tuitionAmountMinor !== '' ? { amountMinor: Number(program.tuitionAmountMinor), currency: program.tuitionCurrency.trim().toUpperCase(), per: program.tuitionPer } : null,
    instructionLanguage: program.instructionLanguage || '',
  });

  const save = async (event) => {
    event.preventDefault(); setNotice(''); setError('');
    if (!program.name.trim()) { setError('Program name is required.'); document.getElementById('institution-program-name')?.focus(); return; }
    setBusy(true);
    try {
      if (editing) await institutionPortalApi.updateProgram(organizationId, programId, payload());
      else {
        const created = await institutionPortalApi.createProgram(organizationId, payload());
        await institutionPortalApi.updateProgram(organizationId, created.data.program._id, payload());
        navigate(`/institution/programs/${created.data.program._id}/edit`, { replace: true });
      }
      setNotice('Program draft saved. High-impact fields remain subject to review and change history.');
    } catch (requestError) { setError(requestError.response?.data?.error || 'Program could not be saved. Your values are preserved.'); }
    finally { setBusy(false); }
  };

  const addRequirement = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await institutionPortalApi.createRequirement(organizationId, programId, requirement); setNotice('Requirement draft recorded with Institution-official provenance.'); setRequirement({ ...requirement, description: '' }); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Requirement could not be recorded.'); }
    finally { setBusy(false); }
  };

  const addAcceptance = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await institutionPortalApi.createTestAcceptance(organizationId, { ...acceptance, programId, minimumOverallScore: acceptance.minimumOverallScore === '' ? null : Number(acceptance.minimumOverallScore) }); setNotice('TestAcceptance draft recorded. Country-level rules remain protected.'); }
    catch (requestError) { setError(requestError.response?.data?.error || 'TestAcceptance could not be recorded.'); }
    finally { setBusy(false); }
  };

  if (loading) return <PageState>Loading Program editor…</PageState>;
  if (!canManage) return <div className="space-y-4"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Program authority unavailable</h1><PageState tone="warning">Approved organization verification, an approved canonical claim, and an authorized Institution role are required. Client routing does not override server authority.</PageState><Link className={secondaryButton} to={ROUTES.INSTITUTION_PROGRAMS}>Back to Programs</Link></div>;

  const select = (key, label, values) => <label className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}<select className={`${fieldClass} mt-1`} value={program[key]} onChange={set(key)}>{Object.values(values).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>;

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-semibold text-primary">Institution-owned canonical content</p><h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{editing ? 'Edit Program draft' : 'Create Program draft'}</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Ownership is checked by the server against the approved canonical Institution claim.</p></div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}{notice ? <PageState tone="success">{notice}</PageState> : null}
      <Panel title="Program details"><form className="grid gap-4 sm:grid-cols-2" onSubmit={save}><label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Program name<input id="institution-program-name" className={`${fieldClass} mt-1`} value={program.name} onChange={set('name')} /></label>{select('degreeLevel', 'Degree level', DEGREE_LEVELS)}{select('field', 'Academic field', ACADEMIC_FIELDS)}{select('studyMode', 'Study mode', STUDY_MODES)}<label className="text-sm font-medium text-gray-800 dark:text-gray-200">Duration in months<input type="number" min="1" className={`${fieldClass} mt-1`} value={program.durationMonths} onChange={set('durationMonths')} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Campus<input className={`${fieldClass} mt-1`} value={program.campus} onChange={set('campus')} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Instruction language<input className={`${fieldClass} mt-1`} value={program.instructionLanguage || ''} onChange={set('instructionLanguage')} placeholder="en" /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Country code<input maxLength="2" className={`${fieldClass} mt-1`} value={program.country} onChange={set('country')} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Official Program URL<input type="url" className={`${fieldClass} mt-1`} value={program.officialProgramUrl} onChange={set('officialProgramUrl')} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Admission requirements URL<input type="url" className={`${fieldClass} mt-1`} value={program.admissionRequirementsUrl} onChange={set('admissionRequirementsUrl')} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Intake label<input className={`${fieldClass} mt-1`} value={program.intakeLabel} onChange={set('intakeLabel')} placeholder="Autumn 2027" /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Intake deadline<input type="date" className={`${fieldClass} mt-1`} value={program.intakeDeadline} onChange={set('intakeDeadline')} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Tuition minor units<input type="number" min="0" className={`${fieldClass} mt-1`} value={program.tuitionAmountMinor} onChange={set('tuitionAmountMinor')} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Tuition currency<input maxLength="3" className={`${fieldClass} mt-1`} value={program.tuitionCurrency} onChange={set('tuitionCurrency')} placeholder="JPY" /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Tuition period<select className={`${fieldClass} mt-1`} value={program.tuitionPer} onChange={set('tuitionPer')}><option value="year">Year</option><option value="semester">Semester</option><option value="program">Whole Program</option></select></label><div className="flex items-end"><button className={primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button></div></form></Panel>
      {editing ? <div className="grid gap-4 xl:grid-cols-2"><Panel title="Add Program requirement"><form className="space-y-4" onSubmit={addRequirement}><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Requirement type<select className={`${fieldClass} mt-1`} value={requirement.requirementType} onChange={(event) => setRequirement({ ...requirement, requirementType: event.target.value })}>{Object.values(PROGRAM_REQUIREMENT_TYPES).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Semantics<select className={`${fieldClass} mt-1`} value={requirement.semantics} onChange={(event) => setRequirement({ ...requirement, semantics: event.target.value })}>{Object.values(REQUIREMENT_SEMANTICS).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Source-backed description<textarea required className={`${fieldClass} mt-1 min-h-24`} value={requirement.description} onChange={(event) => setRequirement({ ...requirement, description: event.target.value })} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Intake (optional)<input className={`${fieldClass} mt-1`} value={requirement.intake} onChange={(event) => setRequirement({ ...requirement, intake: event.target.value })} /></label><button className={primaryButton} disabled={busy}>Record requirement draft</button></form></Panel><Panel title="Add TestAcceptance"><form className="space-y-4" onSubmit={addAcceptance}><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Test catalog ID<input required className={`${fieldClass} mt-1`} value={acceptance.testId} onChange={(event) => setAcceptance({ ...acceptance, testId: event.target.value })} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Scope<select className={`${fieldClass} mt-1`} value={acceptance.acceptanceScope} onChange={(event) => setAcceptance({ ...acceptance, acceptanceScope: event.target.value })}>{[ACCEPTANCE_SCOPES.PROGRAM, ACCEPTANCE_SCOPES.PROGRAM_INTAKE, ACCEPTANCE_SCOPES.INSTITUTION].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Acceptance status<select className={`${fieldClass} mt-1`} value={acceptance.acceptanceStatus} onChange={(event) => setAcceptance({ ...acceptance, acceptanceStatus: event.target.value })}>{Object.values(ACCEPTANCE_STATUSES).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Minimum overall score<input type="number" className={`${fieldClass} mt-1`} value={acceptance.minimumOverallScore} onChange={(event) => setAcceptance({ ...acceptance, minimumOverallScore: event.target.value })} /></label><label className="text-sm font-medium text-gray-800 dark:text-gray-200">Program intake (optional)<input className={`${fieldClass} mt-1`} value={acceptance.intake} onChange={(event) => setAcceptance({ ...acceptance, intake: event.target.value })} /></label><button className={primaryButton} disabled={busy}>Record TestAcceptance draft</button><p className="text-xs text-gray-600 dark:text-gray-400">Country-level acceptance cannot be modified by an Institution.</p></form></Panel></div> : <PageState role="note">Save the Program first to add intake-scoped requirements and TestAcceptance records.</PageState>}
    </div>
  );
}

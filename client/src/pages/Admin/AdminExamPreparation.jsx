import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { PERMISSIONS } from '../../config/rbac';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { adminFieldClass, textToLines } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { adminContentApi } from '../../services/adminContentApi';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const TABS = ['exams', 'mcqs', 'quizzes', 'pastPapers'];

const EMPTY_EXAM = { name: '', code: '', description: '', status: 'active' };
const EMPTY_MCQ = { question: '', examId: '', subject: '', options: '', correctIndex: '0', status: 'active' };
const EMPTY_QUIZ = { title: '', examId: '', timeLimit: '30', status: 'active' };
const EMPTY_PAST_PAPER = { title: '', examId: '', year: '', subject: '', fileUrl: '', status: 'active' };

export default function AdminExamPreparation() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();

  const [tab, setTab] = useState('exams');
  const [exams, setExams] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_EXAM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const loadExams = useCallback(async () => {
    try {
      const res = await adminContentApi.listExams();
      setExams(res.data?.data || []);
    } catch {
      setExams([]);
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let res;
      if (tab === 'exams') res = await adminContentApi.listExams();
      else if (tab === 'mcqs') res = await adminContentApi.listMcqs();
      else if (tab === 'quizzes') res = await adminContentApi.listQuizzes();
      else res = await adminContentApi.listPastPapers();
      setRows(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('admin:loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { loadTabData(); }, [loadTabData]);

  const emptyForm = () => {
    if (tab === 'exams') return EMPTY_EXAM;
    if (tab === 'mcqs') return EMPTY_MCQ;
    if (tab === 'quizzes') return EMPTY_QUIZ;
    return EMPTY_PAST_PAPER;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (row) => {
    if (tab === 'exams') {
      setForm({ ...EMPTY_EXAM, name: row.name || '', code: row.code || '', description: row.description || '', status: row.status || 'active' });
    } else if (tab === 'mcqs') {
      setForm({
        ...EMPTY_MCQ,
        question: row.question || '',
        examId: row.examId || '',
        subject: row.subject || '',
        options: Array.isArray(row.options) ? row.options.join('\n') : '',
        correctIndex: String(row.correctIndex ?? 0),
        status: row.status || 'active',
      });
    } else if (tab === 'quizzes') {
      setForm({
        ...EMPTY_QUIZ,
        title: row.title || '',
        examId: row.examId?._id || row.examId || '',
        timeLimit: String(row.durationMinutes ?? 30),
        status: row.status || 'active',
      });
    } else {
      setForm({
        ...EMPTY_PAST_PAPER,
        title: row.title || '',
        examId: row.examId?._id || row.examId || '',
        year: row.year ?? '',
        subject: row.subject || '',
        fileUrl: row.fileUrl || '',
        status: row.status || 'active',
      });
    }
    setEditingId(row._id);
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (tab === 'exams') {
        if (!form.name?.trim()) { toast.error(t('admin:titleRequired')); return; }
        if (editingId) await adminContentApi.updateExam(editingId, form);
        else await adminContentApi.createExam(form);
      } else if (tab === 'mcqs') {
        const options = textToLines(form.options);
        if (!form.question?.trim() || options.length < 2) {
          toast.error('Question and at least 2 options required');
          return;
        }
        const payload = {
          question: form.question,
          examId: form.examId || undefined,
          subject: form.subject || undefined,
          options,
          correctIndex: Number(form.correctIndex) || 0,
          status: form.status,
        };
        if (editingId) await adminContentApi.updateMcq(editingId, payload);
        else await adminContentApi.createMcq(payload);
      } else if (tab === 'quizzes') {
        if (!form.title?.trim() || !form.examId) {
          toast.error('Title and exam are required');
          return;
        }
        const payload = {
          title: form.title,
          examId: form.examId,
          durationMinutes: Number(form.timeLimit) || 30,
          status: form.status,
        };
        if (editingId) await adminContentApi.updateQuiz(editingId, payload);
        else await adminContentApi.createQuiz(payload);
      } else {
        if (!form.title?.trim() || !form.examId) {
          toast.error('Title and exam are required');
          return;
        }
        const payload = {
          title: form.title,
          examId: form.examId,
          year: form.year ? Number(form.year) : undefined,
          subject: form.subject || undefined,
          fileUrl: form.fileUrl || undefined,
          status: form.status,
        };
        if (editingId) await adminContentApi.updatePastPaper(editingId, payload);
        else await adminContentApi.createPastPaper(payload);
      }
      toast.success(t('admin:saved'));
      setFormOpen(false);
      loadTabData();
      if (tab !== 'exams') loadExams();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (id) => {
    try {
      if (tab === 'exams') await adminContentApi.deleteExam(id);
      else if (tab === 'mcqs') await adminContentApi.deleteMcq(id);
      else if (tab === 'quizzes') await adminContentApi.deleteQuiz(id);
      else await adminContentApi.deletePastPaper(id);
      toast.success(t('admin:deleted'));
      loadTabData();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const examLabel = (examId) => {
    const id = examId?._id || examId;
    const match = exams.find((e) => e._id === id);
    return match?.name || id || '—';
  };

  const columnsByTab = {
    exams: [
      { key: 'name', label: t('admin:colName') },
      { key: 'code', label: 'Code' },
      { key: 'status', label: t('status'), render: (row) => <AdminStatusBadge value={row.status} /> },
      {
        key: 'actions',
        label: t('admin:colActions'),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => openEdit(row)} className="text-xs underline">{t('common:edit')}</button>
            <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
          </div>
        ),
      },
    ],
    mcqs: [
      { key: 'question', label: 'Question', render: (row) => <span className="line-clamp-2">{row.question}</span> },
      { key: 'examId', label: 'Exam', render: (row) => examLabel(row.examId) },
      { key: 'subject', label: 'Subject' },
      {
        key: 'actions',
        label: t('admin:colActions'),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => openEdit(row)} className="text-xs underline">{t('common:edit')}</button>
            <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
          </div>
        ),
      },
    ],
    quizzes: [
      { key: 'title', label: t('admin:colTitle') },
      { key: 'examId', label: 'Exam', render: (row) => examLabel(row.examId) },
      { key: 'durationMinutes', label: 'Time (min)' },
      {
        key: 'actions',
        label: t('admin:colActions'),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => openEdit(row)} className="text-xs underline">{t('common:edit')}</button>
            <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
          </div>
        ),
      },
    ],
    pastPapers: [
      { key: 'title', label: t('admin:colTitle') },
      { key: 'examId', label: 'Exam', render: (row) => examLabel(row.examId) },
      { key: 'year', label: 'Year' },
      { key: 'subject', label: 'Subject' },
      {
        key: 'actions',
        label: t('admin:colActions'),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => openEdit(row)} className="text-xs underline">{t('common:edit')}</button>
            <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
          </div>
        ),
      },
    ],
  };

  const tabLabels = {
    exams: 'Exams',
    mcqs: 'MCQs',
    quizzes: 'Quizzes',
    pastPapers: 'Past Papers',
  };

  const renderForm = () => {
    if (tab === 'exams') {
      return (
        <>
          <input className={adminFieldClass} placeholder={t('admin:colName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={adminFieldClass} placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <textarea rows={3} className={adminFieldClass} placeholder={t('admin:fieldDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">{t('admin:statusActive')}</option>
            <option value="draft">{t('admin:statusDraft')}</option>
          </AdminSelectBare>
        </>
      );
    }
    if (tab === 'mcqs') {
      return (
        <>
          <textarea rows={3} className={adminFieldClass} placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
          <AdminSelectBare  value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}>
            <option value="">Select exam</option>
            {exams.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </AdminSelectBare>
          <input className={adminFieldClass} placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea rows={4} className={adminFieldClass} placeholder="Options (one per line)" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
          <input className={adminFieldClass} type="number" min="0" placeholder="Correct option index (0-based)" value={form.correctIndex} onChange={(e) => setForm({ ...form, correctIndex: e.target.value })} />
        </>
      );
    }
    if (tab === 'quizzes') {
      return (
        <>
          <input className={adminFieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <AdminSelectBare  value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}>
            <option value="">Select exam</option>
            {exams.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </AdminSelectBare>
          <input className={adminFieldClass} type="number" placeholder="Time limit (minutes)" value={form.timeLimit} onChange={(e) => setForm({ ...form, timeLimit: e.target.value })} />
        </>
      );
    }
    return (
      <>
        <input className={adminFieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <AdminSelectBare  value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}>
          <option value="">Select exam</option>
          {exams.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </AdminSelectBare>
        <input className={adminFieldClass} type="number" placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        <input className={adminFieldClass} placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <input className={adminFieldClass} placeholder="File URL" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} />
      </>
    );
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_MCQS}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageExamPrep', { defaultValue: 'Exam Preparation' })}</h1>
          <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
            {t('admin:create')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>

        <AdminDataTable
          columns={columnsByTab[tab]}
          data={rows}
          loading={loading}
          error={error}
          emptyMessage={t('admin:noData')}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-lg mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('common:edit') : t('admin:create')} — {tabLabels[tab]}</h3>
              <div className="grid gap-3">{renderForm()}</div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common:cancel')}</button>
                <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">{saving ? t('admin:saving') : t('admin:save')}</button>
              </div>
            </div>
          </div>
        )}

        {confirm && (
          <AdminConfirmDialog
            open
            title={t('admin:bulkDeleteConfirm')}
            onConfirm={() => removeRow(confirm.id)}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}

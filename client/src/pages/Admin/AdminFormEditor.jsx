import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FORM_FIELD_TYPES,
  FORM_CATEGORIES,
  createFormField,
  createEmptyFormDefinition,
  slugifyFormName,
  validateFormDefinition,
} from '@shared/formSchema.js';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { FormRenderer } from '../../components/forms/FormRenderer';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { useToast } from '../../context/ToastContext';

const FIELD_TYPE_LABELS = {
  text: 'Text',
  textarea: 'Textarea',
  email: 'Email',
  phone: 'Phone',
  number: 'Number',
  date: 'Date',
  select: 'Select',
  radio: 'Radio',
  checkbox: 'Checkbox',
  'multi-checkbox': 'Multi-checkbox',
  file: 'File upload',
  url: 'URL',
  hidden: 'Hidden',
  divider: 'Divider',
  heading: 'Heading',
  richtext: 'Rich text',
  consent: 'Consent',
};

function SortableFieldRow({ field, selected, onSelect, onToggleCollapse, onDuplicate, onRemove, onPatch }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border ${selected ? 'border-primary ring-1 ring-primary' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <button type="button" className="cursor-grab text-gray-400 px-1" {...attributes} {...listeners} aria-label="Drag to reorder">⋮⋮</button>
        <button type="button" className="flex-1 text-left text-sm font-medium truncate" onClick={() => onSelect(field.id)}>
          {FIELD_TYPE_LABELS[field.type] || field.type}: {field.label || field.name}
        </button>
        <button type="button" className="text-xs text-gray-500" onClick={() => onToggleCollapse(field.id)}>{field.collapsed ? 'Expand' : 'Collapse'}</button>
        <button type="button" className="text-xs text-primary" onClick={() => onDuplicate(field.id)}>Dup</button>
        <button type="button" className="text-xs text-red-600" onClick={() => onRemove(field.id)}>Del</button>
      </div>
      {!field.collapsed && selected && (
        <div className="p-3 space-y-2 text-sm">
          <label className="block">
            <span className="text-xs text-gray-500">Label</span>
            <input className={adminFieldClass} value={field.label} onChange={(e) => onPatch(field.id, { label: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Name</span>
            <input className={adminFieldClass} value={field.name} onChange={(e) => onPatch(field.id, { name: e.target.value })} />
          </label>
          {!['divider', 'heading', 'richtext'].includes(field.type) && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => onPatch(field.id, { required: e.target.checked })} />
                Required
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Placeholder</span>
                <input className={adminFieldClass} value={field.placeholder || ''} onChange={(e) => onPatch(field.id, { placeholder: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Help text</span>
                <input className={adminFieldClass} value={field.helpText || ''} onChange={(e) => onPatch(field.id, { helpText: e.target.value })} />
              </label>
            </>
          )}
          {['select', 'radio', 'multi-checkbox'].includes(field.type) && (
            <label className="block">
              <span className="text-xs text-gray-500">Options (value|label per line)</span>
              <textarea
                className={adminFieldClass}
                rows={3}
                value={(field.options || []).map((o) => `${o.value}|${o.label}`).join('\n')}
                onChange={(e) => {
                  const options = e.target.value.split('\n').map((line) => {
                    const [value, label] = line.split('|');
                    return { value: (value || '').trim(), label: (label || value || '').trim() };
                  }).filter((o) => o.value);
                  onPatch(field.id, { options });
                }}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminFormEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = !id || id === 'new';
  const [form, setForm] = useState(() => createEmptyFormDefinition());
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    adminContentApi.getForm(id)
      .then(({ data }) => setForm(data.form))
      .catch(() => toast.error('Failed to load form'))
      .finally(() => setLoading(false));
  }, [id, isNew, toast]);

  const fieldIds = useMemo(() => (form.fields || []).map((f) => f.id), [form.fields]);

  const patchField = useCallback((fieldId, patch) => {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
    }));
  }, []);

  const addField = (type) => {
    const field = createFormField(type);
    setForm((f) => ({ ...f, fields: [...(f.fields || []), field] }));
    setSelectedId(field.id);
  };

  const removeField = (fieldId) => {
    setForm((f) => ({ ...f, fields: f.fields.filter((x) => x.id !== fieldId) }));
    if (selectedId === fieldId) setSelectedId(null);
  };

  const duplicateField = (fieldId) => {
    setForm((f) => {
      const idx = f.fields.findIndex((x) => x.id === fieldId);
      if (idx < 0) return f;
      const copy = createFormField(f.fields[idx].type, { ...f.fields[idx], id: undefined, name: `${f.fields[idx].name}_copy` });
      const next = [...f.fields];
      next.splice(idx + 1, 0, copy);
      return { ...f, fields: next };
    });
  };

  const toggleCollapse = (fieldId) => {
    patchField(fieldId, { collapsed: !form.fields.find((f) => f.id === fieldId)?.collapsed });
    setSelectedId(fieldId);
  };

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setForm((f) => {
      const oldIndex = f.fields.findIndex((x) => x.id === active.id);
      const newIndex = f.fields.findIndex((x) => x.id === over.id);
      return { ...f, fields: arrayMove(f.fields, oldIndex, newIndex) };
    });
  };

  const save = async (publish = false) => {
    const payload = {
      ...form,
      status: publish ? 'published' : form.status,
      slug: form.slug || slugifyFormName(form.name),
    };
    const errors = validateFormDefinition(payload);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await adminContentApi.createForm(payload);
        toast.success('Form created');
        navigate(`${ROUTES.ADMIN}/forms/${data.form._id}`, { replace: true });
      } else {
        await adminContentApi.updateForm(id, payload);
        toast.success('Form saved');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.details?.[0] || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500 p-6">Loading…</p>;

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SITE}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={`${ROUTES.ADMIN}/forms`} className="text-sm text-primary underline">← Forms</Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{isNew ? 'New Form' : form.name}</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => save(false)} className="px-4 py-2 rounded-lg border text-sm">Save draft</button>
            <button type="button" disabled={saving} onClick={() => save(true)} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">Publish</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h3 className="font-semibold">Form settings</h3>
              <label className="block text-sm">
                Name
                <input className={adminFieldClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label className="block text-sm">
                Slug
                <input className={adminFieldClass} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              </label>
              <label className="block text-sm">
                Category
                <select className={adminFieldClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {FORM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                Description
                <textarea className={adminFieldClass} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </label>
              <label className="block text-sm">
                Success message
                <textarea className={adminFieldClass} rows={2} value={form.successMessage} onChange={(e) => setForm((f) => ({ ...f, successMessage: e.target.value }))} />
              </label>
              <label className="block text-sm">
                Redirect URL (optional)
                <input className={adminFieldClass} value={form.redirectUrl} onChange={(e) => setForm((f) => ({ ...f, redirectUrl: e.target.value }))} />
              </label>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold mb-2">Notifications</h3>
              <label className="flex items-center gap-2 text-sm mb-2">
                <input type="checkbox" checked={form.notifications?.sendAdminEmail !== false} onChange={(e) => setForm((f) => ({ ...f, notifications: { ...f.notifications, sendAdminEmail: e.target.checked } }))} />
                Send admin email
              </label>
              <input className={`${adminFieldClass} mb-2`} placeholder="Admin email" value={form.notifications?.adminEmail || ''} onChange={(e) => setForm((f) => ({ ...f, notifications: { ...f.notifications, adminEmail: e.target.value } }))} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(form.notifications?.sendUserConfirmation)} onChange={(e) => setForm((f) => ({ ...f, notifications: { ...f.notifications, sendUserConfirmation: e.target.checked } }))} />
                Send user confirmation
              </label>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold mb-2">Spam protection</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.spamSettings?.honeypot !== false} onChange={(e) => setForm((f) => ({ ...f, spamSettings: { ...f.spamSettings, honeypot: e.target.checked } }))} />
                Honeypot field
              </label>
              <label className="block text-sm mt-2">
                CAPTCHA provider
                <select className={adminFieldClass} value={form.spamSettings?.captchaProvider || 'none'} onChange={(e) => setForm((f) => ({ ...f, spamSettings: { ...f.spamSettings, captchaProvider: e.target.value } }))}>
                  <option value="none">None (default)</option>
                  <option value="recaptcha">reCAPTCHA</option>
                  <option value="turnstile">Cloudflare Turnstile</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold mb-2">Add field</h3>
              <div className="flex flex-wrap gap-1">
                {FORM_FIELD_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => addField(t)} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:border-primary">
                    {FIELD_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {(form.fields || []).map((field) => (
                    <SortableFieldRow
                      key={field.id}
                      field={field}
                      selected={selectedId === field.id}
                      onSelect={setSelectedId}
                      onToggleCollapse={toggleCollapse}
                      onDuplicate={duplicateField}
                      onRemove={removeField}
                      onPatch={patchField}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-gray-50/50 dark:bg-gray-900/30 sticky top-4 self-start">
            <h3 className="font-semibold mb-4">Live preview</h3>
            <FormRenderer form={{ ...form, status: 'published' }} preview />
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
}

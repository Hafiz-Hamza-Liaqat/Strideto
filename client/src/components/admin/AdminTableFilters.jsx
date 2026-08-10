import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminSelectBare, adminFieldClass } from '../admin/AdminFormFields';

export function AdminTableFilters({ filters, values, onChange, fields = [] }) {
  const { t } = useTranslation('admin');
  const idPrefix = useId().replace(/:/g, '');

  if (Array.isArray(filters)) {
    return (
      <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {filters.map((field) => {
          const id = `${idPrefix}-${field.key}`;
          const label = field.label || field.placeholder || field.key;
          const value = values?.[field.key] ?? '';
          return (
            <div key={field.key} className="w-full min-w-0 sm:flex-1 sm:min-w-[160px]">
              <label htmlFor={id} className="sr-only">{label}</label>
              {field.type === 'select' ? (
                <AdminSelectBare
                  id={id}
                  aria-label={label}
                  value={value}
                  onChange={(event) => onChange({ [field.key]: event.target.value })}
                  className={adminFieldClass}
                >
                  {(field.options || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelectBare>
              ) : (
                <input
                  id={id}
                  type={field.type === 'search' ? 'search' : field.type || 'text'}
                  aria-label={label}
                  placeholder={field.placeholder || label}
                  value={value}
                  onChange={(event) => onChange({ [field.key]: event.target.value })}
                  className={adminFieldClass}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const currentFilters = filters || {};
  const update = (key, value) => onChange({ ...currentFilters, [key]: value });

  return (
    <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      {fields.includes('search') && (
        <input
          type="search"
          aria-label={t('filterSearch')}
          placeholder={t('filterSearch')}
          value={currentFilters.search || ''}
          onChange={(e) => update('search', e.target.value)}
          className={`w-full sm:flex-1 sm:min-w-[160px] min-w-0 ${adminFieldClass}`}
        />
      )}
      {fields.includes('status') && (
        <AdminSelectBare
          aria-label={t('filterAll')}
          value={currentFilters.status || currentFilters.approvalStatus || ''}
          onChange={(e) => update(fields.includes('approvalStatus') ? 'approvalStatus' : 'status', e.target.value)}
          className={adminFieldClass}
        >
          <option value="">{t('filterAll')}</option>
          <option value="draft">{t('statusDraft')}</option>
          <option value="active">{t('statusActive')}</option>
          <option value="closed">{t('statusClosed')}</option>
          <option value="pending">{t('filterPending')}</option>
          <option value="approved">{t('filterApproved')}</option>
          <option value="rejected">{t('filterRejected')}</option>
          <option value="completed">{t('statusCompleted')}</option>
          <option value="failed">{t('statusFailed')}</option>
          <option value="refunded">{t('statusRefunded')}</option>
          <option value="suspended">{t('statusSuspended')}</option>
        </AdminSelectBare>
      )}
      {fields.includes('approvalStatus') && !fields.includes('status') && (
        <AdminSelectBare
          aria-label={t('filterAll')}
          value={currentFilters.approvalStatus || ''}
          onChange={(e) => update('approvalStatus', e.target.value)}
          className={adminFieldClass}
        >
          <option value="">{t('filterAll')}</option>
          <option value="pending">{t('filterPending')}</option>
          <option value="approved">{t('filterApproved')}</option>
          <option value="rejected">{t('filterRejected')}</option>
        </AdminSelectBare>
      )}
      {fields.includes('country') && (
        <input
          type="text"
          aria-label={t('countryPlaceholder')}
          placeholder={t('countryPlaceholder')}
          value={currentFilters.country || ''}
          onChange={(e) => update('country', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('funding') && (
        <input
          type="text"
          aria-label={t('fieldFunding')}
          placeholder={t('fieldFunding')}
          value={currentFilters.funding || ''}
          onChange={(e) => update('funding', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('province') && (
        <input
          type="text"
          aria-label={t('filterProvince')}
          placeholder={t('filterProvince')}
          value={currentFilters.province || ''}
          onChange={(e) => update('province', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('city') && (
        <input
          type="text"
          aria-label={t('filterCity')}
          placeholder={t('filterCity')}
          value={currentFilters.city || ''}
          onChange={(e) => update('city', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('category') && (
        <input
          type="text"
          aria-label={t('filterCategory')}
          placeholder={t('filterCategory')}
          value={currentFilters.category || ''}
          onChange={(e) => update('category', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('employer') && (
        <input
          type="text"
          aria-label={t('filterEmployer')}
          placeholder={t('filterEmployer')}
          value={currentFilters.employer || ''}
          onChange={(e) => update('employer', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('role') && (
        <AdminSelectBare
          aria-label={t('filterAllRoles')}
          value={currentFilters.role || ''}
          onChange={(e) => update('role', e.target.value)}
          className={adminFieldClass}
        >
          <option value="">{t('filterAllRoles')}</option>
          <option value="User">{t('roleStudent')}</option>
          <option value="Editor">{t('roleEditor')}</option>
          <option value="Moderator">{t('roleModerator')}</option>
          <option value="Admin">{t('roleAdmin')}</option>
          <option value="SuperAdmin">{t('roleSuperAdmin')}</option>
        </AdminSelectBare>
      )}
      {fields.includes('provider') && (
        <AdminSelectBare
          aria-label={t('filterAllGateways')}
          value={currentFilters.provider || ''}
          onChange={(e) => update('provider', e.target.value)}
          className={adminFieldClass}
        >
          <option value="">{t('filterAllGateways')}</option>
          <option value="stripe">Stripe</option>
          <option value="manual">Manual</option>
        </AdminSelectBare>
      )}
      {fields.includes('featured') && (
        <AdminSelectBare
          aria-label={t('filterFeatured')}
          value={currentFilters.featured || ''}
          onChange={(e) => update('featured', e.target.value)}
          className={adminFieldClass}
        >
          <option value="">{t('filterAll')}</option>
          <option value="true">{t('filterFeatured')}</option>
        </AdminSelectBare>
      )}
      {fields.includes('from') && (
        <input
          type="date"
          aria-label={t('filterFromDate')}
          value={currentFilters.from || ''}
          onChange={(e) => update('from', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('to') && (
        <input
          type="date"
          aria-label={t('filterToDate')}
          value={currentFilters.to || ''}
          onChange={(e) => update('to', e.target.value)}
          className={adminFieldClass}
        />
      )}
      {fields.includes('action') && (
        <input
          type="text"
          aria-label={t('filterAction')}
          placeholder={t('filterAction')}
          value={currentFilters.action || ''}
          onChange={(e) => update('action', e.target.value)}
          className={adminFieldClass}
        />
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminTableFilters } from './AdminTableFilters';
import { AdminStatusBadge, formatAdminDate } from './adminTableUtils';

export function AdminDataTable({
  columns = [],
  data = [],
  rowKey = '_id',
  loading = false,
  error = '',
  emptyMessage,
  pagination,
  onPageChange,
  sort,
  onSort,
  filters,
  onFiltersChange,
  filterFields = ['search', 'status'],
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = [],
  onBulkAction,
  exportResource,
  onExport,
  stickyHeader = true,
  tableLabel,
  actions = [],
  onRowClick,
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [hiddenCols, setHiddenCols] = useState({});

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols[c.key]),
    [columns, hiddenCols]
  );

  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(row[rowKey]));
  const someSelected = selectedIds.length > 0;
  const hasRowActions = !!onRowClick || actions.length > 0;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) onSelectionChange([]);
    else onSelectionChange(data.map((row) => row[rowKey]));
  };

  const toggleRow = (id) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter((x) => x !== id));
    else onSelectionChange([...selectedIds, id]);
  };

  const handleSort = (key) => {
    if (!onSort || !key) return;
    if (sort?.key === key) {
      onSort({ key, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      onSort({ key, order: 'desc' });
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {filters && onFiltersChange && (
        <AdminTableFilters filters={filters} onChange={onFiltersChange} fields={filterFields} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {columns.length > 1 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {columns.map((col) => (
              <label key={col.key} className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={!hiddenCols[col.key]}
                  onChange={() => setHiddenCols((h) => ({ ...h, [col.key]: !h[col.key] }))}
                  className="rounded"
                  aria-label={t('admin:toggleColumn', { column: col.label })}
                />
                {col.label}
              </label>
            ))}
          </div>
        )}
        {exportResource && onExport && (
          <div className="flex flex-wrap gap-2 ml-auto">
            {['csv', 'xlsx', 'pdf'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onExport(exportResource, fmt)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t('admin:exportFormat', { format: fmt.toUpperCase() })}
              </button>
            ))}
          </div>
        )}
      </div>

      {someSelected && bulkActions.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-primary/10 dark:bg-primary/20">
          <span className="text-sm text-gray-700 dark:text-gray-300 self-center">
            {t('admin:selectedCount', { count: selectedIds.length })}
          </span>
          {bulkActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onBulkAction?.(action.id, selectedIds)}
              className={`px-3 py-1.5 text-sm rounded-lg ${action.danger ? 'bg-red-600 text-white' : 'bg-primary text-white'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 py-8 text-center">{emptyMessage || t('admin:noData')}</p>
      ) : (
        <div
          className="table-scroll rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          role="region"
          aria-label={tableLabel || t('admin:dataTable')}
          tabIndex={0}
        >
          <table className="min-w-full text-sm">
            <thead className={stickyHeader ? 'sticky top-0 z-10 bg-gray-50 dark:bg-gray-800' : ''}>
              <tr>
                {selectable && (
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={t('admin:selectAll')}
                    />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                    scope="col"
                  >
                    {col.label}
                    {sort?.key === col.key && (sort.order === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                ))}
                {hasRowActions && <th scope="col" className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('admin:actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {data.map((row) => (
                <tr key={row[rowKey]} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {selectable && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row[rowKey])}
                        onChange={() => toggleRow(row[rowKey])}
                        aria-label={t('admin:selectRow')}
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-gray-900 dark:text-gray-100 break-words-safe max-w-xs">
                      {col.render
                        ? col.render(row)
                        : col.type === 'status'
                          ? <AdminStatusBadge value={row[col.key]} />
                          : col.type === 'date'
                            ? formatAdminDate(row[col.key])
                            : row[col.key] ?? '—'}
                    </td>
                  ))}
                  {hasRowActions && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {onRowClick && (
                          <button type="button" onClick={() => onRowClick(row)} className="min-h-[44px] px-2 text-sm text-primary dark:text-mint underline">
                            {t('admin:view')}
                          </button>
                        )}
                        {actions.map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            disabled={action.disabled?.(row)}
                            onClick={() => action.onClick?.(row)}
                            className="min-h-[44px] px-2 text-sm text-primary dark:text-mint underline disabled:opacity-50 disabled:no-underline"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            {t('admin:paginationSummary', {
              page: pagination.page,
              pages: pagination.pages,
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40"
            >
              {t('admin:prevPage')}
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40"
            >
              {t('admin:nextPage')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

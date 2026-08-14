/**
 * Phase 17D-4 Admin GBS queue table.
 * Independent of protected Admin list/filter WIP files.
 */
export function AdminGbsQueueTable({ caption, columns, rows, loading, error, emptyLabel }) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-live="polite">
        <p className="sr-only">Loading</p>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-100 p-3" role="alert">
        {error}
      </p>
    );
  }
  if (!rows?.length) {
    return (
      <p className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-200">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto min-w-0 rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full min-w-[640px] text-sm text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700 align-top">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-3 break-words max-w-[16rem] text-gray-900 dark:text-gray-100">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminGbsPagination({ pagination, onPageChange, label }) {
  const page = pagination?.page || 1;
  const pages = pagination?.pages || pagination?.totalPages || 1;
  const total = pagination?.total || 0;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={label}>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

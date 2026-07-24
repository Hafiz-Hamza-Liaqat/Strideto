import { useCallback, useEffect, useState, useRef } from 'react';
import { adminContentApi } from '../../services/adminContentApi';
import { resolveImagePreviewUrl } from '../admin/AdminImageUrlField';
import { adminFieldClass } from '../admin/AdminImageUrlField';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

/**
 * Modal asset picker — select from Media Library (C.7.0.1).
 * @param {{ open: boolean; onClose: () => void; onSelect: (asset: { url: string; asset: object }) => void; title?: string }} props
 */
export function MediaAssetPicker({ open, onClose, onSelect, title = 'Select from Media Library' }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('grid');
  const panelRef = useRef(null);
  useOverlayA11y({ open, onClose, containerRef: panelRef, trapFocus: true });

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data } = await adminContentApi.listMediaAssets({
        page,
        limit: 24,
        search: search.trim() || undefined,
        folder: folder || undefined,
        sort: 'createdAt',
        order: 'desc',
      });
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [open, page, search, folder]);

  useEffect(() => {
    if (!open) return;
    adminContentApi.listMediaFolders().then(({ data }) => setFolders(data?.folders || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    load();
  }, [load]);

  const previewUrl = useCallback((asset) => {
    return resolveImagePreviewUrl(asset.thumbnailUrl || asset.storageUrl || '');
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 outline-none"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Close</button>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <input
            className={`${adminFieldClass} flex-1 min-w-[160px]`}
            placeholder="Search assets…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select className={adminFieldClass} value={folder} onChange={(e) => { setFolder(e.target.value); setPage(1); }}>
            <option value="">All folders</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button type="button" className={`px-3 py-2 text-sm ${view === 'grid' ? 'bg-primary text-white' : ''}`} onClick={() => setView('grid')}>Grid</button>
            <button type="button" className={`px-3 py-2 text-sm ${view === 'list' ? 'bg-primary text-white' : ''}`} onClick={() => setView('list')}>List</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : !items.length ? (
            <p className="text-sm text-gray-500">No assets found. Upload files in Media Library first.</p>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((asset) => (
                <button
                  key={asset._id}
                  type="button"
                  className="group rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-left hover:ring-2 hover:ring-primary focus:ring-2 focus:ring-primary"
                  onClick={() => onSelect({ url: asset.storageUrl || asset.largeUrl || asset.mediumUrl, asset })}
                >
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                    <img src={previewUrl(asset)} alt={asset.altText || asset.filename} className="max-h-full max-w-full object-contain" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate text-gray-800 dark:text-gray-200">{asset.filename}</p>
                    <p className="text-[10px] text-gray-500">{asset.width}×{asset.height}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((asset) => (
                <li key={asset._id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded"
                    onClick={() => onSelect({ url: asset.storageUrl || asset.largeUrl, asset })}
                  >
                    <img src={previewUrl(asset)} alt="" className="h-12 w-12 rounded object-cover bg-gray-100" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{asset.filename}</p>
                      <p className="text-xs text-gray-500">{asset.folder} · {asset.mimeType}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm">
          <span className="text-gray-500">{total} asset{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} className="px-2 py-1 rounded border disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>{page} / {pages}</span>
            <button type="button" disabled={page >= pages} className="px-2 py-1 rounded border disabled:opacity-40" onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { resolveImagePreviewUrl } from '../../components/admin/AdminImageUrlField';
import { MediaAssetDetailPanel, MediaUploadDropzone } from '../../components/media/MediaLibraryParts';
import { PERMISSIONS } from '../../config/rbac';
import { adminContentApi } from '../../services/adminContentApi';
import { useToast } from '../../context/ToastContext';

export default function AdminMediaLibrary() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [folders, setFolders] = useState([]);
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, foldersRes] = await Promise.all([
        adminContentApi.listMediaAssets({
          page,
          limit: 24,
          search: search.trim() || undefined,
          folder: folder || undefined,
          sort,
          order,
        }),
        adminContentApi.listMediaFolders(),
      ]);
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 1);
      setFolders(foldersRes.data?.folders || []);
    } catch {
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  }, [page, search, folder, sort, order, toast]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (asset) => {
    try {
      const { data } = await adminContentApi.getMediaAsset(asset._id);
      setSelected(data.asset);
    } catch {
      setSelected(asset);
    }
  };

  const previewUrl = (asset) => resolveImagePreviewUrl(asset.thumbnailUrl || asset.storageUrl);

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SITE}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Media Library</h1>
            <p className="text-sm text-gray-500 mt-1">Centralized digital assets for page builder, blogs, CMS, and ads.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium"
          >
            {showUpload ? 'Hide upload' : 'Upload'}
          </button>
        </div>

        {showUpload && (
          <MediaUploadDropzone
            folder={folder || 'general'}
            onUploaded={() => { load(); setShowUpload(false); }}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <input
            className={`${adminFieldClass} w-full min-w-0 sm:flex-1 sm:min-w-[180px]`}
            placeholder="Search filename, alt, tags…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select className={adminFieldClass} value={folder} onChange={(e) => { setFolder(e.target.value); setPage(1); }}>
            <option value="">All folders</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className={adminFieldClass} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="createdAt">Date</option>
            <option value="filename">Filename</option>
            <option value="fileSize">Size</option>
          </select>
          <select className={adminFieldClass} value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button type="button" className={`px-3 py-2 text-sm ${view === 'grid' ? 'bg-primary text-white' : ''}`} onClick={() => setView('grid')}>Grid</button>
            <button type="button" className={`px-3 py-2 text-sm ${view === 'list' ? 'bg-primary text-white' : ''}`} onClick={() => setView('list')}>List</button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            {loading ? (
              <p className="text-gray-500">Loading…</p>
            ) : !items.length ? (
              <p className="text-gray-500">No assets yet — upload your first image.</p>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map((asset) => (
                  <button
                    key={asset._id}
                    type="button"
                    onClick={() => openDetail(asset)}
                    className={`rounded-lg border overflow-hidden text-left transition ring-offset-2 ${
                      selected?._id === asset._id ? 'ring-2 ring-primary border-primary' : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <img src={previewUrl(asset)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{asset.filename}</p>
                      <p className="text-[10px] text-gray-500">{asset.folder}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                {items.map((asset) => (
                  <li key={asset._id}>
                    <button
                      type="button"
                      onClick={() => openDetail(asset)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <img src={previewUrl(asset)} alt="" className="h-14 w-14 rounded object-cover bg-gray-100" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{asset.filename}</p>
                        <p className="text-xs text-gray-500">{asset.folder} · {asset.mimeType} · {asset.width}×{asset.height}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-gray-500">{total} assets</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} className="px-2 py-1 rounded border disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>{page} / {pages}</span>
                <button type="button" disabled={page >= pages} className="px-2 py-1 rounded border disabled:opacity-40" onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </div>

          {selected && (
            <MediaAssetDetailPanel
              asset={selected}
              onClose={() => setSelected(null)}
              onUpdated={(asset) => { setSelected(asset); load(); }}
              onDeleted={() => { setSelected(null); load(); }}
            />
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
}

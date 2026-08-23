import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { getAccessToken } from '../../services/axiosBase';
import { refreshUserAccessToken } from '../../services/axiosBase';
import { resolveImagePreviewUrl } from '../admin/AdminImageUrlField';
import { adminFieldClass } from '../admin/AdminImageUrlField';
import { useToast } from '../../context/ToastContext';

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`;
}

/**
 * Upload with progress via XHR (supports cancel).
 */
function uploadWithProgress(file, { folder, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const token = getAccessToken();

    if (!token) {
      reject(new Error('Authentication required'));
      return;
    }

    const attemptUpload = (token, retried = false) => {
      if (signal?.aborted) {
        reject(new Error('Cancelled'));
        return;
      }

      const form = new FormData();
      form.append('files', file);
      if (folder) form.append('folder', folder);

      const xhr = new XMLHttpRequest();
      const base = API_BASE_URL.replace(/\/$/, '');

      xhr.open('POST', `${base}/admin/media/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress)
          onProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = async () => {
        if (xhr.status === 401 && !retried) {
          try {
            const newToken = await refreshUserAccessToken();

            if (!newToken) {
              reject(new Error('Authentication required'));
              return;
            }

            if (signal?.aborted) {
              reject(new Error('Cancelled'));
              return;
            }

            attemptUpload(newToken, true);
          } catch {
            reject(new Error('Authentication required'));
          }

          return;
        }

        try {
          const data = JSON.parse(xhr.responseText || '{}');

          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else if (xhr.status === 409 && data.duplicate)
            resolve({ duplicate: true, asset: data.asset });
          else reject(new Error(data.error || 'Upload failed'));
        } catch {
          reject(new Error('Invalid upload response'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            xhr.abort();
            reject(new Error('Cancelled'));
          },
          { once: true }
        );
      }

      xhr.send(form);
    };

    attemptUpload(token);
  });
}

function UploadQueueItem({ item, onRetry, onCancel }) {
  const statusClass =
    item.status === 'error'
      ? 'text-red-600'
      : item.status === 'done'
        ? 'text-green-600'
        : 'text-gray-600';
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="flex-1 truncate">{item.file.name}</span>
      {item.status === 'uploading' && (
        <>
          <div className="w-24 h-2 rounded bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <button
            type="button"
            className="text-xs text-gray-500"
            onClick={() => onCancel(item.id)}
          >
            Cancel
          </button>
        </>
      )}
      {item.status === 'queued' && (
        <span className="text-xs text-gray-400">Queued</span>
      )}
      {item.status === 'error' && (
        <>
          <span className="text-xs text-red-600">{item.error}</span>
          <button
            type="button"
            className="text-xs text-primary"
            onClick={() => onRetry(item)}
          >
            Retry
          </button>
        </>
      )}
      {item.status === 'done' && (
        <span className={`text-xs ${statusClass}`}>
          {item.duplicate ? 'Duplicate' : 'Done'}
        </span>
      )}
    </li>
  );
}

export function MediaUploadDropzone({ folder = 'general', onUploaded }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState([]);
  const controllersRef = useRef(new Map());

  const processFile = useCallback(
    async (item) => {
      const controller = new AbortController();
      controllersRef.current.set(item.id, controller);
      setQueue((q) =>
        q.map((x) =>
          x.id === item.id
            ? { ...x, status: 'uploading', progress: 0, error: '' }
            : x
        )
      );
      try {
        const result = await uploadWithProgress(item.file, {
          folder,
          signal: controller.signal,
          onProgress: (p) =>
            setQueue((q) =>
              q.map((x) => (x.id === item.id ? { ...x, progress: p } : x))
            ),
        });
        const duplicate = Boolean(result.duplicate);
        setQueue((q) =>
          q.map((x) =>
            x.id === item.id
              ? { ...x, status: 'done', duplicate, progress: 100 }
              : x
          )
        );
        if (duplicate) toast.info(`Duplicate detected: ${item.file.name}`);
        else toast.success(`Uploaded ${item.file.name}`);
        onUploaded?.(result);
      } catch (err) {
        if (err.message !== 'Cancelled') {
          setQueue((q) =>
            q.map((x) =>
              x.id === item.id
                ? { ...x, status: 'error', error: err.message }
                : x
            )
          );
        }
      } finally {
        controllersRef.current.delete(item.id);
      }
    },
    [folder, onUploaded, toast]
  );

  const enqueue = useCallback(
    (files) => {
      const list = Array.from(files || []).filter((f) =>
        f.type.startsWith('image/')
      );
      if (!list.length) return;
      const newItems = list.map((file, i) => ({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        status: 'queued',
        progress: 0,
        error: '',
        duplicate: false,
      }));
      setQueue((q) => [...q, ...newItems]);
      newItems.forEach((item) => processFile(item));
    },
    [processFile]
  );

  const cancelItem = (id) => {
    controllersRef.current.get(id)?.abort();
    setQueue((q) => q.filter((x) => x.id !== id));
  };

  const retryItem = (item) => {
    const fresh = { ...item, status: 'queued', progress: 0, error: '' };
    setQueue((q) => q.map((x) => (x.id === item.id ? fresh : x)));
    processFile(fresh);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          enqueue(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary/60'
        }`}
      >
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Drag & drop images here
        </p>
        <p className="text-xs text-gray-500 mt-1">
          or click to browse · JPEG, PNG, GIF, WebP · max 10MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            enqueue(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {queue.length > 0 && (
        <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 px-3">
          {queue.map((item) => (
            <UploadQueueItem
              key={item.id}
              item={item}
              onRetry={retryItem}
              onCancel={cancelItem}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function MediaAssetDetailPanel({
  asset,
  onClose,
  onUpdated,
  onDeleted,
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => ({
    filename: asset?.filename || '',
    altText: asset?.altText || '',
    caption: asset?.caption || '',
    folder: asset?.folder || 'general',
    tags: (asset?.tags || []).join(', '),
    metadata: { ...(asset?.metadata || {}) },
  }));
  const [usage, setUsage] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadUsage = useCallback(async () => {
    if (!asset?._id) return;
    try {
      const { data } = await adminContentApi.getMediaAssetUsage(asset._id);
      setUsage(data?.usage || []);
    } catch {
      setUsage([]);
    }
  }, [asset?._id]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const { data } = await adminContentApi.updateMediaAsset(asset._id, body);
      toast.success('Metadata saved');
      onUpdated?.(data.asset);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await adminContentApi.deleteMediaAsset(asset._id);
      toast.success('Asset deleted');
      onDeleted?.(asset._id);
      onClose?.();
    } catch (err) {
      const u = err.response?.data?.usage;
      if (u?.length)
        toast.error(
          `In use by ${u.length} location(s) — remove references first`
        );
      else toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  if (!asset) return null;
  const preview = resolveImagePreviewUrl(
    asset.thumbnailUrl || asset.storageUrl
  );

  return (
    <aside className="w-full lg:w-96 shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 p-4 space-y-4 overflow-y-auto max-h-[70vh]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm">Asset details</h3>
        <button
          type="button"
          className="text-xs text-gray-500"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <img
          src={preview}
          alt={form.altText}
          className="w-full max-h-48 object-contain"
        />
      </div>
      <p className="text-xs text-gray-500">
        {asset.width}×{asset.height} · {formatBytes(asset.fileSize)} ·{' '}
        {asset.mimeType}
      </p>

      <label className="block text-xs">
        <span className="text-gray-600">Filename</span>
        <input
          className={`${adminFieldClass} mt-0.5`}
          value={form.filename}
          onChange={(e) => setForm((f) => ({ ...f, filename: e.target.value }))}
        />
      </label>
      <label className="block text-xs">
        <span className="text-gray-600">Alt text</span>
        <input
          className={`${adminFieldClass} mt-0.5`}
          value={form.altText}
          onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
        />
      </label>
      <label className="block text-xs">
        <span className="text-gray-600">Caption</span>
        <input
          className={`${adminFieldClass} mt-0.5`}
          value={form.caption}
          onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
        />
      </label>
      <label className="block text-xs">
        <span className="text-gray-600">Folder</span>
        <input
          className={`${adminFieldClass} mt-0.5`}
          value={form.folder}
          onChange={(e) => setForm((f) => ({ ...f, folder: e.target.value }))}
        />
      </label>
      <label className="block text-xs">
        <span className="text-gray-600">Tags (comma-separated)</span>
        <input
          className={`${adminFieldClass} mt-0.5`}
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
        />
      </label>

      {['credit', 'copyright', 'photographer', 'license', 'description'].map(
        (key) => (
          <label key={key} className="block text-xs">
            <span className="text-gray-600 capitalize">{key}</span>
            <input
              className={`${adminFieldClass} mt-0.5`}
              value={form.metadata[key] || ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  metadata: { ...f.metadata, [key]: e.target.value },
                }))
              }
            />
          </label>
        )
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
        >
          Save metadata
        </button>
        <button
          type="button"
          onClick={remove}
          className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-sm"
        >
          Delete
        </button>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-600 mb-2">Used in</h4>
        {usage.length ? (
          <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
            {usage.map((u, i) => (
              <li key={i} className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">{u.label}</span>
                <span className="text-gray-400">
                  {' '}
                  · {u.type}
                  {u.detail ? ` (${u.detail})` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">Not referenced anywhere yet</p>
        )}
      </div>
    </aside>
  );
}

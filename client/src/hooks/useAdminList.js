import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../services/axiosBase';

const DEFAULT_LIMIT = 25;

export function useAdminList(endpoint, { initialFilters = {}, limit = DEFAULT_LIMIT } = {}) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit, total: 0, pages: 0 });
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState({ key: 'createdAt', order: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef(null);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  const setPage = useCallback((page) => {
    setPagination((p) => ({ ...p, page }));
  }, []);

  const setLimit = useCallback((limit) => {
    setPagination((p) => ({ ...p, limit, page: 1 }));
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');

    const params = {
      page: pagination.page,
      limit: pagination.limit,
      sort: sort.key,
      order: sort.order,
      ...Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null)
      ),
    };

    axiosInstance
      .get(endpoint, { params, signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const body = res.data || {};
        setData(body.data || []);
        setPagination((p) => ({
          ...p,
          total: body.pagination?.total ?? body.total ?? 0,
          pages: body.pagination?.pages ?? body.pages ?? 0,
        }));
      })
      .catch((err) => {
        if (controller.signal.aborted || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.error || err.message || 'Failed to load');
        setData([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [endpoint, filters, pagination.page, pagination.limit, sort.key, sort.order, reloadKey]);

  return {
    data,
    pagination,
    filters,
    setFilters,
    sort,
    setSort,
    loading,
    error,
    setPage,
    setLimit,
    refetch,
    setError,
  };
}

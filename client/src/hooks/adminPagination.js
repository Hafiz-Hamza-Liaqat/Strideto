export function normalizeAdminPagination(body = {}, fallback = { page: 1, limit: 25, total: 0, pages: 0 }) {
  const pagination = body.pagination || {};
  return {
    page: pagination.page ?? body.page ?? fallback.page,
    limit: pagination.limit ?? body.limit ?? fallback.limit,
    total: pagination.total ?? body.total ?? fallback.total,
    pages: pagination.totalPages
      ?? pagination.pages
      ?? body.totalPages
      ?? body.pages
      ?? fallback.pages,
  };
}

import { Pagination } from '../ui/Pagination';

export default function CaseSectionPagination({ metadata, onPageChange, label }) {
  if (!metadata || metadata.totalPages <= 1) return null;
  return (
    <div className="mt-4" aria-label={`${label} pagination`}>
      <Pagination currentPage={metadata.page} totalPages={metadata.totalPages} onPageChange={onPageChange} />
    </div>
  );
}

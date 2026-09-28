import type { PaginationMeta } from '../../lib/types';

interface PaginationProps {
  pagination?: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, limit, total, totalPages } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-sm text-slate-700">
      <div className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-900">{start}</span> to{' '}
        <span className="font-medium text-slate-900">{end}</span> of{' '}
        <span className="font-medium text-slate-900">{total}</span> records
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-2 text-xs font-medium text-slate-600">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

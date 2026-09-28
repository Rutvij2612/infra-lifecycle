import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({ title, description, actionText, onAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border border-dashed border-slate-200 my-4">
      <div className="p-3 mb-3 bg-slate-100 rounded-full text-slate-500">
        {icon || (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <h4 className="text-base font-medium text-slate-800">{title}</h4>
      {description && <p className="mt-1 text-xs text-slate-500 max-w-md">{description}</p>}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-900 rounded shadow-xs transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

export function LoadingSpinner({ text = 'Loading records...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
      <div className="w-7 h-7 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      <p className="text-xs font-medium text-slate-600">{text}</p>
    </div>
  );
}

export function AlertBanner({
  type = 'info',
  message,
  onDismiss,
}: {
  type?: 'info' | 'success' | 'warning' | 'error';
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;

  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
  }[type];

  return (
    <div className={`flex items-start justify-between p-3 rounded-md border text-xs font-medium ${styles} mb-4`}>
      <div className="flex items-center gap-2">
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-current opacity-70 hover:opacity-100 ml-2">
          ✕
        </button>
      )}
    </div>
  );
}

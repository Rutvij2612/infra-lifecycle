interface ProgressBarProps {
  progress: number | null | undefined;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  statusColor?: 'default' | 'emerald' | 'amber' | 'blue';
}

export function ProgressBar({ progress, showLabel = true, size = 'md', statusColor = 'default' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Number(progress ?? 0)));

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size];

  let colorClass = 'bg-slate-700';
  if (statusColor === 'emerald' || pct === 100) {
    colorClass = 'bg-emerald-600';
  } else if (statusColor === 'amber' || pct < 40) {
    colorClass = 'bg-amber-500';
  } else if (statusColor === 'blue' || pct >= 40) {
    colorClass = 'bg-blue-600';
  }

  return (
    <div className="w-full flex items-center gap-2">
      <div className={`w-full bg-slate-200 rounded-full overflow-hidden ${heightClasses}`}>
        <div
          className={`${heightClasses} ${colorClass} transition-all duration-300 rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-slate-700 min-w-[36px] text-right">
          {pct}%
        </span>
      )}
    </div>
  );
}

'use client';

/**
 * Skip Navigation - allows keyboard users to skip to main content
 */
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      Skip to main content
    </a>
  );
}

/**
 * VisuallyHidden - hides content visually but keeps it accessible to screen readers
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * LiveRegion - announces dynamic content changes to screen readers
 */
export function LiveRegion({ children, politeness = 'polite' }: { children: React.ReactNode; politeness?: 'polite' | 'assertive' | 'off' }) {
  return (
    <div aria-live={politeness} aria-atomic="true" className="sr-only">
      {children}
    </div>
  );
}

/**
 * StatusBadge - accessible status indicator
 */
export function StatusBadge({ status, label }: { status: 'success' | 'warning' | 'error' | 'info' | 'neutral'; label: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}
      role="status"
    >
      {label}
    </span>
  );
}

/**
 * ProgressBar - accessible progress indicator
 */
export function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label} className="w-full">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {label && <span className="sr-only">{label}: {percentage}%</span>}
    </div>
  );
}

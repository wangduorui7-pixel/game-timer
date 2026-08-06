import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="gt-empty">
      <svg
        className="gt-empty__art"
        width="132"
        height="112"
        viewBox="0 0 132 112"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gt-empty-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
        </defs>
        {/* 星尘 */}
        <circle cx="16" cy="24" r="2" fill="var(--brand)" opacity="0.5" />
        <circle cx="116" cy="18" r="2.6" fill="var(--brand-2)" opacity="0.45" />
        <circle cx="106" cy="86" r="2" fill="var(--brand)" opacity="0.4" />
        <circle cx="24" cy="90" r="1.6" fill="var(--brand-2)" opacity="0.5" />
        {/* 沙漏 */}
        <path
          d="M44 20h44M44 92h44"
          stroke="url(#gt-empty-g)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M50 20c0 18 16 24 16 36s-16 18-16 36M82 20c0 18-16 24-16 36s16 18 16 36"
          stroke="url(#gt-empty-g)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <path
          d="M56 82c2-9 7-13 10-13s8 4 10 13z"
          fill="url(#gt-empty-g)"
          opacity="0.55"
        />
        <circle cx="66" cy="60" r="2.4" fill="var(--brand-2)" />
      </svg>
      <div className="gt-empty__title">{title}</div>
      {hint && <p className="gt-empty__hint">{hint}</p>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

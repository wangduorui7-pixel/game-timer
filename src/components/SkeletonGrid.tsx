import type { CSSProperties } from 'react';

export interface SkeletonGridProps {
  count?: number;
}

export function SkeletonGrid({ count = 6 }: SkeletonGridProps) {
  return (
    <div className="gt-grid" aria-busy="true" aria-label="正在加载活动数据">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="gt-skel" style={{ '--d': `${i * 110}ms` } as CSSProperties}>
          <div className="gt-skel__sheen" style={{ '--d': `${i * 110}ms` } as CSSProperties} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div className="gt-skel__bar" style={{ width: 62, height: 24, borderRadius: 999, margin: 0 }} />
            <div className="gt-skel__bar" style={{ width: 48, height: 24, borderRadius: 8, margin: 0 }} />
          </div>
          <div className="gt-skel__bar" style={{ width: '92%' }} />
          <div className="gt-skel__bar" style={{ width: '64%' }} />
          <div className="gt-skel__bar" style={{ width: '38%', height: 9, marginTop: 16 }} />
          <div className="gt-skel__bar" style={{ width: '56%', height: 28, marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

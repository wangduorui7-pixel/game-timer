import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CheckCircle2, Flame, LayoutList } from 'lucide-react';
import { prefersReducedMotion } from '../theme/tokens';

export interface StatsBarProps {
  total: number;
  done: number;
  /** 24 小时内截止的数量 */
  urgent: number;
}

/** 数字滚动增长：rAF + easeOutCubic，不使用 setInterval */
function useCountUp(value: number, duration = 700): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    if (prefersReducedMotion()) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return display;
}

interface StatProps {
  label: string;
  value: number;
  color: string;
  ink: string;
  icon: ReactNode;
  suffix?: string;
}

function Stat({ label, value, color, ink, icon, suffix }: StatProps) {
  const shown = useCountUp(value);
  return (
    <div className="gt-stat" style={{ '--sc': color, '--sc-ink': ink } as CSSProperties}>
      <div className="gt-stat__label">
        {icon}
        {label}
      </div>
      <div className="gt-stat__value">
        {shown}
        {suffix && <span style={{ fontSize: '0.5em', opacity: 0.6, marginLeft: 3 }}>{suffix}</span>}
      </div>
    </div>
  );
}

export function StatsBar({ total, done, urgent }: StatsBarProps) {
  return (
    <div className="gt-stats">
      <Stat
        label="全部活动"
        value={total}
        color="var(--brand)"
        ink="var(--text-1)"
        icon={<LayoutList size={13} />}
      />
      <Stat
        label="已完成"
        value={done}
        color="var(--success)"
        ink="var(--success-ink)"
        icon={<CheckCircle2 size={13} />}
        suffix={total > 0 ? `/ ${total}` : undefined}
      />
      <Stat
        label="24 小时内截止"
        value={urgent}
        color="var(--danger)"
        ink={urgent > 0 ? 'var(--danger-ink)' : 'var(--text-1)'}
        icon={<Flame size={13} />}
      />
    </div>
  );
}

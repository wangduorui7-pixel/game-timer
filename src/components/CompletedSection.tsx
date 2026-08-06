import { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import type { ActivityItem } from '../../shared/types';
import { ActivityCard } from './ActivityCard';

export interface CompletedSectionProps {
  activities: ActivityItem[];
  now: number;
  onToggleDone: (id: string, done: boolean) => void;
}

export function CompletedSection({ activities, now, onToggleDone }: CompletedSectionProps) {
  const [open, setOpen] = useState(false);
  if (activities.length === 0) return null;

  return (
    <section className="gt-completed">
      <button
        type="button"
        className="gt-completed__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CheckCircle2 size={17} style={{ color: 'var(--success)', flex: 'none' }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>已完成</span>
        <span className="gt-completed__badge">{activities.length}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--text-3)' }} className="hidden sm:inline">
          {open ? '收起' : '展开查看'}
        </span>
        <ChevronDown size={18} className="gt-completed__chev" data-open={open ? 'true' : 'false'} />
      </button>

      <div className="gt-collapse" data-open={open ? 'true' : 'false'}>
        <div className="gt-collapse__inner">
          <div className="gt-collapse__pad">
            <div className="gt-grid">
              {activities.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  now={now}
                  done
                  onToggleDone={onToggleDone}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

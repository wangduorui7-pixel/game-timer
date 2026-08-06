import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ActivityItem } from '../../shared/types';
import { GAME_META } from '../../shared/types';
import {
  CATEGORY_LABEL,
  formatDateTime,
  getUrgency,
  prefersReducedMotion,
} from '../theme/tokens';
import { CountdownText } from './CountdownText';

export interface ActivityCardProps {
  activity: ActivityItem;
  /** 全局 ticker 广播的时间戳 */
  now: number;
  done: boolean;
  onToggleDone: (id: string, done: boolean) => void;
}

const MAX_TILT = 6;

function ActivityCardImpl({ activity, now, done, onToggleDone }: ActivityCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const burstTimer = useRef<number | null>(null);
  const [burst, setBurst] = useState(false);

  const urgency = getUrgency(activity.endTime, now, activity.permanent);
  const meta = GAME_META[activity.game];

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
    },
    [],
  );

  /** 鼠标跟随：只写 CSS 变量，不触发 React 重渲染 */
  const handleMove = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el || prefersReducedMotion()) return;
    const { clientX, clientY } = e;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      el.style.setProperty('--ry', `${(px - 0.5) * 2 * MAX_TILT}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * 2 * MAX_TILT}deg`);
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    });
  }, []);

  const handleLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  const handleToggle = useCallback(() => {
    const next = !done;
    if (next) {
      setBurst(true);
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
      burstTimer.current = window.setTimeout(() => setBurst(false), 620);
    }
    onToggleDone(activity.id, next);
  }, [done, activity.id, onToggleDone]);

  const stateClass = [
    'gt-card',
    urgency === 'warn' && !done ? 'is-warn' : '',
    urgency === 'critical' && !done ? 'is-critical' : '',
    urgency === 'ended' ? 'is-ended' : '',
    done ? 'is-done' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const catLabel = CATEGORY_LABEL[activity.category] ?? activity.type ?? '活动';

  const titleNode = activity.url ? (
    <a
      className="gt-card__title"
      href={activity.url}
      target="_blank"
      rel="noreferrer noopener"
      title={activity.title}
    >
      {activity.title}
      <ExternalLink size={13} style={{ display: 'inline', marginLeft: 4, opacity: 0.6 }} />
    </a>
  ) : (
    <h3 className="gt-card__title" title={activity.title}>
      {activity.title}
    </h3>
  );

  return (
    <article
      ref={cardRef}
      className={stateClass}
      data-game={activity.game}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {activity.banner && (
        <div className="gt-card__bg" style={{ backgroundImage: `url(${activity.banner})` }} />
      )}
      <div className="gt-card__halo" />

      <div className="gt-card__content">
        <div className="gt-card__head">
          <span className="gt-card__game">
            <i />
            {meta.short}
          </span>
          <span className="gt-badge" data-cat={activity.category}>
            {catLabel}
          </span>
          {activity.source === 'manual' && <span className="gt-badge gt-badge--manual">补录</span>}

          <span style={{ flex: 1 }} />

          <button
            type="button"
            className="gt-check"
            aria-pressed={done}
            aria-label={done ? `取消完成：${activity.title}` : `标记完成：${activity.title}`}
            title={done ? '取消完成' : '标记为已完成'}
            data-burst={burst ? 'true' : 'false'}
            onClick={handleToggle}
          >
            <span className="gt-check__burst" />
            <span className="gt-check__ring" />
            <svg className="gt-check__svg" viewBox="0 0 24 24">
              <path className="gt-check__path" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </button>
        </div>

        {titleNode}

        <div className="gt-card__meta">
          {activity.permanent || !activity.endTime
            ? '长期开放'
            : `${formatDateTime(activity.startTime)} → ${formatDateTime(activity.endTime)}`}
        </div>

        <div className="gt-card__foot">
          <div style={{ minWidth: 0 }}>
            <div className="gt-card__cdlabel">
              {urgency === 'ended' ? '状态' : urgency === 'permanent' ? '状态' : '剩余时间'}
            </div>
            <CountdownText
              endTime={activity.endTime}
              now={now}
              permanent={activity.permanent}
              size="lg"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export const ActivityCard = memo(ActivityCardImpl);
ActivityCard.displayName = 'ActivityCard';

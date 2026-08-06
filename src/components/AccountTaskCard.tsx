import { memo, useMemo } from 'react';
import { CheckCircle2, RefreshCcw, Zap } from 'lucide-react';
import type { AccountTask, GameId, TaskPeriod } from '../../shared/types';
import { GAME_META } from '../../shared/types';
import { CountdownText } from './CountdownText';

export interface AccountTaskCardProps {
  game: GameId;
  /** 同一 group 下的任务 */
  group: string;
  tasks: AccountTask[];
  /** 全局单 ticker 广播的时间戳，组件内部绝不自己开定时器 */
  now: number;
}

export const PERIOD_LABEL: Record<TaskPeriod, string> = {
  daily: '每日',
  weekly: '每周',
  season: '赛季',
  permanent: '长期',
};

function pct(finished: number, total: number): number {
  if (total <= 0) return finished > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((finished / total) * 100)));
}

function AccountTaskCardImpl({ game, group, tasks, now }: AccountTaskCardProps) {
  const meta = GAME_META[game];

  const { doneCount, period, resetAt } = useMemo(() => {
    let done = 0;
    let reset: number | undefined;
    for (const t of tasks) {
      if (t.done) done += 1;
      // 同组取最近的一个重置时间
      if (t.resetAt && (reset === undefined || t.resetAt < reset)) reset = t.resetAt;
    }
    return { doneCount: done, period: tasks[0]?.period ?? 'daily', resetAt: reset };
  }, [tasks]);

  const allDone = doneCount === tasks.length && tasks.length > 0;

  return (
    <article
      className="gt-atcard"
      data-game={game}
      data-period={period}
      data-done={allDone ? 'true' : 'false'}
    >
      <div className="gt-atcard__halo" aria-hidden="true" />

      <div className="gt-atcard__head">
        <span className="gt-card__game">
          <i />
          {meta.short}
        </span>
        <span className="gt-atbadge" data-period={period}>
          {PERIOD_LABEL[period]}
        </span>
        <span className="gt-atbadge gt-atbadge--sync" title="数据由已绑定的游戏账号自动同步">
          <Zap size={11} />
          账号同步
        </span>
        <span style={{ flex: 1 }} />
        <span className="gt-atcard__ratio tabular">
          {doneCount}/{tasks.length}
        </span>
      </div>

      <h3 className="gt-atcard__title" title={group}>
        {allDone && <CheckCircle2 size={15} className="gt-atcard__tick" />}
        {group}
      </h3>

      <ul className="gt-atlist">
        {tasks.map((t) => {
          const p = pct(t.finished, t.total);
          return (
            <li key={t.id} className="gt-atitem" data-done={t.done ? 'true' : 'false'}>
              <div className="gt-atitem__row">
                <span className="gt-atitem__label" title={t.detail || t.label}>
                  {t.label}
                </span>
                <span className="gt-atitem__num tabular">
                  {t.total > 1 || t.finished > 1 ? (
                    <>
                      {t.finished}
                      <em>/{t.total}</em>
                    </>
                  ) : t.done ? (
                    '已完成'
                  ) : (
                    '未完成'
                  )}
                </span>
                <span className="gt-atitem__check" aria-hidden="true">
                  {t.done ? <CheckCircle2 size={14} /> : <span className="gt-atitem__circle" />}
                </span>
              </div>
              <div
                className="gt-atbar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p}
                aria-label={`${t.label} 完成度 ${p}%`}
              >
                <span className="gt-atbar__fill" style={{ width: `${p}%` }} />
              </div>
              {t.detail && <div className="gt-atitem__detail">{t.detail}</div>}
            </li>
          );
        })}
      </ul>

      {resetAt ? (
        <div className="gt-atcard__foot">
          <span className="gt-atcard__resetlabel">
            <RefreshCcw size={12} />
            距重置
          </span>
          <CountdownText endTime={resetAt} now={now} size="sm" />
        </div>
      ) : null}
    </article>
  );
}

export const AccountTaskCard = memo(AccountTaskCardImpl);
AccountTaskCard.displayName = 'AccountTaskCard';

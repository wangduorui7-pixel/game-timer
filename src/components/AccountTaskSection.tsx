import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Link2, RefreshCw, Zap } from 'lucide-react';
import type { AccountSnapshot, AccountTask, GameId } from '../../shared/types';
import { GAME_META } from '../../shared/types';
import { formatAgo } from '../theme/tokens';
import { AccountTaskCard } from './AccountTaskCard';

export interface AccountTaskSectionProps {
  snapshots: AccountSnapshot[];
  /** 全局单 ticker 广播的时间戳 */
  now: number;
  /** 当前用户选中的游戏，用于过滤 */
  games: GameId[];
  loading: boolean;
  refreshing: boolean;
  /** 请求级失败原因 */
  error: string | null;
  syncedAt: number | null;
  onRefresh: () => void;
  /** 打开绑定弹窗 */
  onManage: () => void;
  /** 一家都没绑定 */
  empty: boolean;
}

interface GameGroup {
  game: GameId;
  snapshot: AccountSnapshot;
  groups: { group: string; tasks: AccountTask[] }[];
}

/** 按游戏 → group 两级分组，保持后端返回的原始顺序 */
function buildGroups(snapshots: AccountSnapshot[], games: GameId[]): GameGroup[] {
  const out: GameGroup[] = [];
  for (const s of snapshots) {
    if (!games.includes(s.game)) continue;
    const map = new Map<string, AccountTask[]>();
    for (const t of s.tasks) {
      const list = map.get(t.group);
      if (list) list.push(t);
      else map.set(t.group, [t]);
    }
    out.push({
      game: s.game,
      snapshot: s,
      groups: [...map.entries()].map(([group, tasks]) => ({ group, tasks })),
    });
  }
  return out;
}

export function AccountTaskSection({
  snapshots,
  now,
  games,
  loading,
  refreshing,
  error,
  syncedAt,
  onRefresh,
  onManage,
  empty,
}: AccountTaskSectionProps) {
  const [open, setOpen] = useState(true);

  const grouped = useMemo(() => buildGroups(snapshots, games), [snapshots, games]);
  const failed = useMemo(
    () => grouped.filter((g) => !g.snapshot.ok || g.snapshot.tasks.length === 0),
    [grouped]
  );
  const withTasks = useMemo(() => grouped.filter((g) => g.groups.length > 0), [grouped]);

  // 一家都没绑：引导卡片
  if (empty) {
    return (
      <section className="gt-atsection">
        <div className="gt-atinvite">
          <span className="gt-atinvite__icon" aria-hidden="true">
            <Link2 size={20} />
          </span>
          <div className="gt-atinvite__text">
            <strong>绑定游戏账号，自动同步每日 / 周常完成情况</strong>
            <span>
              支持米哈游（原神 / 星铁 / 绝区零）、库洛（鸣潮）、鹰角（终末地）。
              凭据加密存本地服务器，只读不写，随时可解绑。
            </span>
          </div>
          <button type="button" className="gt-atinvite__btn" onClick={onManage}>
            去绑定账号
          </button>
        </div>
      </section>
    );
  }

  const totalGroups = withTasks.reduce((n, g) => n + g.groups.length, 0);

  // 已绑定但一条任务都没拉到：只显示一行提示，绝不影响下方活动倒计时
  if (!loading && totalGroups === 0) {
    return (
      <section className="gt-atsection">
        <div className="gt-atfail">
          <AlertTriangle size={16} className="gt-atfail__icon" />
          <div className="gt-atfail__text">
            <strong>账号任务暂时没同步到</strong>
            <span>
              {error ??
                failed.map((f) => f.snapshot.error).filter(Boolean).join('；') ??
                ''}
              {!error && failed.every((f) => !f.snapshot.error) && '凭据可能已失效，请重新绑定。'}
            </span>
          </div>
          <div className="gt-atfail__acts">
            <button type="button" className="gt-bindbtn" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={15} data-spin={refreshing ? 'true' : 'false'} className="gt-refresh-icon" />
              重试
            </button>
            <button type="button" className="gt-bindbtn gt-bindbtn--primary" onClick={onManage}>
              重新绑定
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (totalGroups === 0) return null;

  return (
    <section className="gt-atsection">
      <header className="gt-athead">
        <button
          type="button"
          className="gt-athead__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown size={16} className="gt-athead__chev" data-open={open ? 'true' : 'false'} />
          <span className="gt-athead__title">
            <Zap size={14} />
            账号任务
          </span>
          <span className="gt-athead__badge">{totalGroups}</span>
        </button>

        <span className="gt-athead__meta">
          {syncedAt ? `同步于 ${formatAgo(syncedAt, now)}` : loading ? '同步中…' : ''}
        </span>

        <button
          type="button"
          className="gt-bindbtn"
          onClick={onRefresh}
          disabled={refreshing}
          title="立即重新同步账号数据"
        >
          <RefreshCw
            size={15}
            className="gt-refresh-icon"
            data-spin={refreshing ? 'true' : 'false'}
          />
          同步
        </button>
        <button type="button" className="gt-bindbtn" onClick={onManage}>
          管理绑定
        </button>
      </header>

      {open && (
        <div className="gt-atbody">
          {/* 部分家失效：顶部一行提示，不遮挡已同步成功的内容 */}
          {failed.length > 0 && (
            <div className="gt-atwarn" role="status">
              <AlertTriangle size={14} />
              {failed
                .map((f) => `${GAME_META[f.game].short}：${f.snapshot.error ?? '暂无数据'}`)
                .join('　')}
              <button type="button" className="gt-atwarn__link" onClick={onManage}>
                去处理
              </button>
            </div>
          )}

          {withTasks.map((g) => (
            <div key={g.game} className="gt-atgame" data-game={g.game}>
              <div className="gt-atgame__title">
                <i aria-hidden="true" />
                {GAME_META[g.game].name}
                {g.snapshot.error && (
                  <span className="gt-atgame__warn" title={g.snapshot.error}>
                    部分数据缺失
                  </span>
                )}
              </div>
              <div className="gt-atgrid">
                {g.groups.map((grp) => (
                  <AccountTaskCard
                    key={`${g.game}:${grp.group}`}
                    game={g.game}
                    group={grp.group}
                    tasks={grp.tasks}
                    now={now}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

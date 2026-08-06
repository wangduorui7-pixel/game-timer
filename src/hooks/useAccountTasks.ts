/**
 * 账号任务快照（真实完成度）。
 *
 * 硬性约束（SPEC 0.5）：
 * - 未站内登录 / 一家都没绑定 → **不发请求**，安静返回空。
 * - 任何失败都只落到 `error` 字段，绝不 throw、绝不阻塞活动倒计时主流程。
 * - 5 分钟自动刷新；页面隐藏时跳过，回到前台若已过期立刻补拉。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AccountSnapshot, GameId } from '../../shared/types';
import { APP_CONFIG } from '../config';
import { ApiError, apiGetAccountTasks, apiRefreshAccountTasks } from '../lib/api';
import { useAuth } from './useAuth';

export interface AccountTasksState {
  snapshots: AccountSnapshot[];
  /** 至少有一条任务的快照 */
  hasTasks: boolean;
  loading: boolean;
  refreshing: boolean;
  /** 整体请求级失败原因；单游戏失败在 snapshot.error 里 */
  error: string | null;
  /** 最近一次同步时间 ms epoch */
  syncedAt: number | null;
  refresh: (force?: boolean) => Promise<void>;
}

export interface UseAccountTasksOptions {
  /** 一家都没绑定时传 false，hook 会完全静默 */
  enabled: boolean;
}

export function useAccountTasks(
  games: GameId[],
  { enabled }: UseAccountTasksOptions
): AccountTasksState {
  const { user, loading: authLoading } = useAuth();
  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用字符串做依赖，避免调用方每次渲染新建数组导致无限拉取
  const gamesKey = games.join(',');
  const seqRef = useRef(0);
  const hasDataRef = useRef(false);
  const active = enabled && !!user;

  const load = useCallback(
    async (force = false) => {
      if (!active) {
        setSnapshots([]);
        setError(null);
        hasDataRef.current = false;
        return;
      }
      const list = gamesKey ? (gamesKey.split(',') as GameId[]) : [];
      const seq = ++seqRef.current;

      if (force) setRefreshing(true);
      else if (!hasDataRef.current) setLoading(true);

      try {
        const res = force ? await apiRefreshAccountTasks(list) : await apiGetAccountTasks(list);
        if (seq !== seqRef.current) return;
        setSnapshots(res.snapshots ?? []);
        hasDataRef.current = true;
        setError(null);
      } catch (e) {
        if (seq !== seqRef.current) return;
        // 静默降级：只记录原因，界面上折叠成一行提示，不弹错、不清空已有数据
        setError(e instanceof ApiError ? e.message : '账号任务同步失败');
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [active, gamesKey]
  );

  useEffect(() => {
    if (authLoading) return;
    void load(false);
  }, [load, authLoading]);

  useEffect(() => {
    if (authLoading || !active) return;
    let lastRun = Date.now();

    const tick = (): void => {
      if (document.hidden) return;
      lastRun = Date.now();
      void load(false);
    };
    const id = setInterval(tick, APP_CONFIG.pollIntervalMs);

    const onVisible = (): void => {
      if (!document.hidden && Date.now() - lastRun >= APP_CONFIG.pollIntervalMs) tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, authLoading, active]);

  const hasTasks = useMemo(() => snapshots.some((s) => s.tasks.length > 0), [snapshots]);

  const syncedAt = useMemo(() => {
    if (!snapshots.length) return null;
    return snapshots.reduce((max, s) => Math.max(max, s.syncedAt || 0), 0) || null;
  }, [snapshots]);

  return { snapshots, hasTasks, loading, refreshing, error, syncedAt, refresh: load };
}

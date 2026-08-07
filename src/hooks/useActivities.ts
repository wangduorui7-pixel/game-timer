/**
 * 活动数据：拉取 / 轮询 / 强制刷新。
 * - GET  /api/activities?games=...   常规拉取（服务端 5 分钟内存缓存）
 * - POST /api/activities/refresh     强制绕过缓存
 * 单个游戏抓取失败不会整体报错，snapshot 里带 stale + error。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityItem, GameId, GameSnapshot } from '../../shared/types';
import { APP_CONFIG } from '../config';
import { ApiError, apiGetActivities, apiRefreshActivities } from '../lib/api';
import { useAuth } from './useAuth';

/** 静态快照模式：构建时注入 VITE_STATIC=1，前端不请求后端，直接读打包内的 activities.json */
const STATIC_MODE = (import.meta as { env?: Record<string, string> }).env?.VITE_STATIC === '1';

export interface ActivitiesState {
  snapshots: GameSnapshot[];
  /** 全部 snapshot 扁平合并后的活动列表（永久活动沉底，其余按截止时间升序） */
  activities: ActivityItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** force = true 走 /activities/refresh 强制重抓 */
  refresh: (force?: boolean) => Promise<void>;
  /** 最近一次成功抓取时间（ms epoch），无数据时为 null */
  lastUpdated: number | null;
  hasStale: boolean;
  /** 手动补录成功后就地插入，避免整轮重抓 */
  addActivity: (item: ActivityItem) => void;
}

function sortActivities(list: ActivityItem[]): ActivityItem[] {
  return [...list].sort((a, b) => {
    const ap = a.permanent || a.endTime === 0;
    const bp = b.permanent || b.endTime === 0;
    if (ap !== bp) return ap ? 1 : -1;
    if (ap) return a.title.localeCompare(b.title);
    return a.endTime - b.endTime;
  });
}

export function useActivities(games: GameId[]): ActivitiesState {
  const { user, loading: authLoading } = useAuth();
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用字符串做依赖，避免调用方每次渲染新建数组导致无限拉取
  const gamesKey = games.join(',');
  const hasDataRef = useRef(false);
  const seqRef = useRef(0);

  const load = useCallback(
    async (force = false) => {
      const list = gamesKey ? (gamesKey.split(',') as GameId[]) : [];
      const seq = ++seqRef.current;

      // 静态快照模式：直接从打包内联的 activities.json 读取，不请求后端、不轮询
      if (STATIC_MODE) {
        try {
          const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || './';
          const url = new URL('activities.json', new URL(base, location.href)).href;
          const res = await fetch(url).then((r) => r.json());
          if (seq !== seqRef.current) return;
          setSnapshots(res.snapshots ?? []);
          hasDataRef.current = true;
          setError(null);
        } catch {
          if (seq !== seqRef.current) return;
          setError('活动快照加载失败');
        } finally {
          if (seq === seqRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
        return;
      }

      if (force) setRefreshing(true);
      else if (!hasDataRef.current) setLoading(true);

      try {
        const res = force ? await apiRefreshActivities(list) : await apiGetActivities(list);
        if (seq !== seqRef.current) return; // 已有更新的请求，丢弃本次结果
        setSnapshots(res.snapshots);
        hasDataRef.current = true;
        setError(null);
      } catch (e) {
        if (seq !== seqRef.current) return;
        setError(e instanceof ApiError ? e.message : '活动数据加载失败，请稍后重试');
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [gamesKey]
  );

  // 首次 / 游戏集合变化 / 登录态变化（登录后要合并手动补录）时拉取
  useEffect(() => {
    if (authLoading) return;
    void load(false);
  }, [load, authLoading, user?.id]);

  // 5 分钟轮询；页面隐藏时跳过，恢复可见且已过期就立即补拉
  useEffect(() => {
    if (authLoading) return;
    if (STATIC_MODE) return; // 静态模式不轮询后端
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
  }, [load, authLoading]);

  const addActivity = useCallback((item: ActivityItem) => {
    setSnapshots((prev) => {
      const hit = prev.some((s) => s.game === item.game);
      if (!hit) {
        return [
          ...prev,
          { game: item.game, fetchedAt: Date.now(), ok: true, stale: false, activities: [item] },
        ];
      }
      return prev.map((s) =>
        s.game === item.game
          ? { ...s, activities: sortActivities([...s.activities, item]) }
          : s
      );
    });
  }, []);

  const activities = useMemo(
    () => sortActivities(snapshots.flatMap((s) => s.activities)),
    [snapshots]
  );

  const lastUpdated = useMemo(() => {
    if (!snapshots.length) return null;
    return snapshots.reduce((max, s) => Math.max(max, s.fetchedAt), 0) || null;
  }, [snapshots]);

  const hasStale = useMemo(() => snapshots.some((s) => s.stale), [snapshots]);

  return {
    snapshots,
    activities,
    loading,
    refreshing,
    error,
    refresh: load,
    lastUpdated,
    hasStale,
    addActivity,
  };
}

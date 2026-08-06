/**
 * 完成状态（双模式）：
 * - 未登录：读写 localStorage['gt_completions']
 * - 登录后：读写 /api/completions，乐观更新 + 失败回滚
 * - 登录瞬间做一次合并迁移：把本地已标记的推到服务端，成功后清空本地。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompletionMap } from '../../shared/types';
import { apiGetCompletions, apiSetCompletion } from '../lib/api';
import { readJson, writeJson } from '../lib/storage';
import { useAuth } from './useAuth';

const LS_KEY = 'gt_completions';

function readLocal(): CompletionMap {
  const raw = readJson<Record<string, unknown>>(LS_KEY, {});
  const out: CompletionMap = {};
  for (const [id, at] of Object.entries(raw)) {
    if (typeof at === 'number' && Number.isFinite(at)) out[id] = at;
  }
  return out;
}

export interface CompletionsState {
  completions: CompletionMap;
  isDone: (activityId: string) => boolean;
  toggle: (activityId: string, done: boolean) => void;
  /** 登录后首次拉取 / 迁移中 */
  syncing: boolean;
}

export function useCompletions(): CompletionsState {
  const { user, loading: authLoading } = useAuth();
  const [completions, setCompletions] = useState<CompletionMap>(() => readLocal());
  const [syncing, setSyncing] = useState(false);
  const lastUserId = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const uid = user?.id ?? null;
    if (uid === lastUserId.current) return;
    lastUserId.current = uid;

    // 登出：回落到本地存储
    if (uid === null) {
      setCompletions(readLocal());
      return;
    }

    let alive = true;
    setSyncing(true);
    void (async () => {
      try {
        const server = await apiGetCompletions();
        const local = readLocal();
        const pending = Object.keys(local).filter((id) => !(id in server));

        if (pending.length) {
          const results = await Promise.allSettled(
            pending.map((id) => apiSetCompletion(id, true))
          );
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') server[pending[i]] = local[pending[i]];
          });
        }
        // 迁移完成，本地只作未登录态的存储
        writeJson(LS_KEY, {});
        if (alive) setCompletions(server);
      } catch {
        /* 拉取失败保持当前状态，下次登录/刷新再试 */
      } finally {
        if (alive) setSyncing(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id, authLoading]);

  const toggle = useCallback(
    (activityId: string, done: boolean) => {
      const snapshot = completions;
      const next: CompletionMap = { ...completions };
      if (done) next[activityId] = Date.now();
      else delete next[activityId];

      setCompletions(next); // 乐观更新

      if (!user) {
        writeJson(LS_KEY, next);
        return;
      }
      apiSetCompletion(activityId, done).catch(() => {
        setCompletions(snapshot); // 失败回滚
      });
    },
    [completions, user]
  );

  const isDone = useCallback(
    (activityId: string) => completions[activityId] !== undefined,
    [completions]
  );

  return { completions, isDone, toggle, syncing };
}

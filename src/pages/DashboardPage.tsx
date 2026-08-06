import { useCallback, useMemo, useState } from 'react';
import {
  CATEGORY_IDS,
  GAME_IDS,
  type ActivityCategory,
  type ActivityItem,
  type GameId,
} from '../../shared/types';

import { AccountBindingDialog } from '../components/AccountBindingDialog';
import { AccountTaskSection } from '../components/AccountTaskSection';
import { ActivityCard } from '../components/ActivityCard';
import { AppHeader } from '../components/AppHeader';
import { AuthDialog } from '../components/AuthDialog';
import { CategoryFilterBar } from '../components/CategoryFilterBar';
import { CompletedSection } from '../components/CompletedSection';
import { EmptyState } from '../components/EmptyState';
import { GameFilterBar } from '../components/GameFilterBar';
import { ManualActivityDialog } from '../components/ManualActivityDialog';
import { ParticleBackground } from '../components/ParticleBackground';
import { SkeletonGrid } from '../components/SkeletonGrid';
import { StaleBanner } from '../components/StaleBanner';
import { StatsBar } from '../components/StatsBar';

import { APP_CONFIG } from '../config';
import { useAccountTasks } from '../hooks/useAccountTasks';
import { useActivities } from '../hooks/useActivities';
import { useAuth } from '../hooks/useAuth';
import { useBindings } from '../hooks/useBindings';
import { useCompletions } from '../hooks/useCompletions';
import { usePrefs } from '../hooks/usePrefs';
import { useNow } from '../hooks/useTicker';

/**
 * 未完成排序，分三档：
 *   0 进行中（有截止且未到期）→ 按截止时间升序，最快截止的排最前
 *   1 长期开放（永久）
 *   2 已结束（endTime 已过）
 * 之前只把永久沉底，已过期条目因为 endTime 最小反而霸占列表首位，
 * 用户一进来先看到一堆「已结束」，这里按档位先分层再排。
 */
function ongoingRank(a: ActivityItem, now: number): 0 | 1 | 2 {
  if (a.permanent || a.endTime === 0) return 1;
  return a.endTime <= now ? 2 : 0;
}

function compareOngoing(a: ActivityItem, b: ActivityItem, now: number): number {
  const ra = ongoingRank(a, now);
  const rb = ongoingRank(b, now);
  if (ra !== rb) return ra - rb;
  if (ra === 1) return a.title.localeCompare(b.title);
  // 已结束的按「刚结束的排前面」，方便补勾完成
  if (ra === 2) return b.endTime - a.endTime;
  return a.endTime - b.endTime;
}

export function DashboardPage() {
  const now = useNow();
  const { user, logout, applySession } = useAuth();
  const { games, categories, theme, setGames, setCategories, toggleTheme } = usePrefs();
  const { snapshots, activities, loading, refreshing, error, refresh, lastUpdated, addActivity } =
    useActivities(GAME_IDS);
  const { completions, isDone, toggle } = useCompletions();

  const [authOpen, setAuthOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);

  const {
    bindings,
    loading: bindingLoading,
    error: bindingError,
    bind,
    unbind,
  } = useBindings();
  const {
    snapshots: accountSnapshots,
    loading: accountLoading,
    refreshing: accountRefreshing,
    error: accountError,
    refresh: refreshAccountTasks,
    syncedAt,
  } = useAccountTasks(games, { enabled: bindings.some((b) => b.bound) });

  const handleRefresh = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  // 五个游戏都要有计数，未选中的也展示真实数量（按当前分类口径统计）
  const counts = useMemo(() => {
    const map = Object.fromEntries(GAME_IDS.map((g) => [g, 0])) as Record<GameId, number>;
    for (const a of activities) if (categories.includes(a.category)) map[a.game] += 1;
    return map;
  }, [activities, categories]);

  // 分类计数按当前已选游戏口径统计，勾上就知道会多出多少条
  const categoryCounts = useMemo(() => {
    const map = Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<
      ActivityCategory,
      number
    >;
    for (const a of activities) if (games.includes(a.game)) map[a.category] += 1;
    return map;
  }, [activities, games]);

  const visible = useMemo(
    () => activities.filter((a) => games.includes(a.game) && categories.includes(a.category)),
    [activities, games, categories]
  );

  // 分档与紧急计数都按分钟粒度重算，避免每秒重排整张列表
  const minuteBucket = Math.floor(now / 60_000);
  const sortNow = minuteBucket * 60_000;

  const { ongoing, completed } = useMemo(() => {
    const ongoingList: ActivityItem[] = [];
    const completedList: ActivityItem[] = [];
    for (const a of visible) {
      if (completions[a.id] !== undefined) completedList.push(a);
      else ongoingList.push(a);
    }
    ongoingList.sort((a, b) => compareOngoing(a, b, sortNow));
    // 已完成按完成时间倒序，最近完成的在前
    completedList.sort((a, b) => (completions[b.id] ?? 0) - (completions[a.id] ?? 0));
    return { ongoing: ongoingList, completed: completedList };
  }, [visible, completions, sortNow]);

  const urgent = useMemo(
    () =>
      ongoing.filter(
        (a) =>
          !a.permanent &&
          a.endTime > 0 &&
          a.endTime > now &&
          a.endTime - now <= APP_CONFIG.urgentThresholdMs
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ongoing, minuteBucket]
  );

  const showSkeleton = loading && activities.length === 0;
  const showEmpty = !showSkeleton && ongoing.length === 0 && completed.length === 0;

  return (
    <div className="relative min-h-screen w-full">
      <ParticleBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <AppHeader
          theme={theme}
          onToggleTheme={toggleTheme}
          user={user}
          onLoginClick={() => setAuthOpen(true)}
          onLogout={logout}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          onBindingClick={() => {
            if (!user) setAuthOpen(true);
            else setBindOpen(true);
          }}
        />

        <StaleBanner snapshots={snapshots} onRetry={handleRefresh} />

        <StatsBar total={visible.length} done={completed.length} urgent={urgent} />

        <AccountTaskSection
          snapshots={accountSnapshots}
          now={now}
          games={games}
          loading={accountLoading}
          refreshing={accountRefreshing}
          error={accountError}
          syncedAt={syncedAt}
          onRefresh={() => void refreshAccountTasks(true)}
          onManage={() => setBindOpen(true)}
          empty={!bindingLoading && bindings.every((b) => !b.bound)}
        />

        <GameFilterBar selected={games} onChange={setGames} counts={counts} />

        <CategoryFilterBar
          selected={categories}
          onChange={setCategories}
          counts={categoryCounts}
        />

        <section className="flex flex-col gap-3">
          <header className="flex min-h-[32px] flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300">
              进行中 · {ongoing.length}
            </h2>
            {user && (
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
              >
                手动补录
              </button>
            )}
          </header>

          {showSkeleton ? (
            <SkeletonGrid count={8} />
          ) : showEmpty ? (
            <EmptyState
              title={error ? '数据没能加载出来' : '暂时没有可显示的活动'}
              hint={
                error ??
                (user
                  ? '可以点右上角刷新重试，或用「手动补录」自己加一条。'
                  : '可以点右上角刷新重试；登录后还能手动补录活动。')
              }
              action={
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-800 px-5 text-sm text-white transition hover:bg-slate-700 dark:bg-white/90 dark:text-slate-900 dark:hover:bg-white"
                >
                  {refreshing ? '正在刷新…' : '重新抓取'}
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {ongoing.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  now={now}
                  done={isDone(a.id)}
                  onToggleDone={toggle}
                />
              ))}
            </div>
          )}
        </section>

        <CompletedSection activities={completed} now={now} onToggleDone={toggle} />
      </div>

      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={(auth) => {
          applySession(auth);
          setAuthOpen(false);
        }}
      />

      <ManualActivityDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={(item) => {
          addActivity(item);
          setManualOpen(false);
        }}
      />

      <AccountBindingDialog
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        bindings={bindings}
        loading={bindingLoading}
        error={bindingError}
        bind={bind}
        unbind={unbind}
        onChanged={() => {
          void refreshAccountTasks(true);
        }}
      />
    </div>
  );
}

export default DashboardPage;

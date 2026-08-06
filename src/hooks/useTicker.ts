/**
 * 全局单例 ticker：整个 App 只有一个 setInterval，向所有订阅者广播 `now`。
 * 严禁在卡片等组件里各开定时器（SPEC 6.2 硬性验收点）。
 *
 * - 可见时 1s 一跳；页面隐藏（visibilitychange）降频到 30s；
 * - 重新可见立即补一次，避免回到前台还显示旧时间。
 */
import { createElement, Fragment, useEffect, useSyncExternalStore, type ReactNode } from 'react';

const ACTIVE_PERIOD = 1000;
const HIDDEN_PERIOD = 30_000;

let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
let timerPeriod = 0;
const listeners = new Set<() => void>();

function notify(): void {
  current = Date.now();
  listeners.forEach((fn) => fn());
}

function wantedPeriod(): number {
  return typeof document !== 'undefined' && document.hidden ? HIDDEN_PERIOD : ACTIVE_PERIOD;
}

function ensureTimer(period = wantedPeriod()): void {
  if (timer !== null && timerPeriod === period) return;
  if (timer !== null) clearInterval(timer);
  timerPeriod = period;
  timer = setInterval(notify, period);
}

function stopTimer(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
  timerPeriod = 0;
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) current = Date.now();
  listeners.add(listener);
  ensureTimer();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopTimer();
  };
}

function getSnapshot(): number {
  return current;
}

/** 订阅全局时钟，返回每秒更新的 `now`（ms epoch）。 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * 挂在 App 根部：托管唯一定时器的生命周期与页面可见性策略。
 * 不提供 context value —— 组件通过 `useNow()` 直接订阅，避免整棵树每秒重渲染。
 */
export function TickerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // 保底订阅：保证 provider 存活期间定时器一直在跑
    const unsubscribe = subscribe(() => {});

    const onVisibilityChange = (): void => {
      if (document.hidden) {
        ensureTimer(HIDDEN_PERIOD);
      } else {
        notify(); // 回到前台立刻补一次
        ensureTimer(ACTIVE_PERIOD);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribe();
    };
  }, []);

  return createElement(Fragment, null, children);
}

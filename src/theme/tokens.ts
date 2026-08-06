import type { ActivityCategory } from '../../shared/types';

/** 紧急度阈值（ms） */
export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export type Urgency = 'normal' | 'warn' | 'critical' | 'ended' | 'permanent';

/**
 * 依据剩余时间判定紧急度。
 * < 1h  -> critical（急促脉冲）
 * < 24h -> warn（呼吸辉光）
 */
export function getUrgency(endTime: number, now: number, permanent?: boolean): Urgency {
  if (permanent || endTime === 0) return 'permanent';
  const left = endTime - now;
  if (left <= 0) return 'ended';
  if (left < HOUR) return 'critical';
  if (left < DAY) return 'warn';
  return 'normal';
}

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function splitRemaining(ms: number): Remaining {
  const total = Math.max(0, ms);
  const sec = Math.floor(total / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    total,
  };
}

export const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** 分类中文名（type 字段可能是任意原始标签，这里做兜底展示） */
export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  gacha: '祈愿',
  activity: '活动',
  version: '版本',
  notice: '公告',
};

/** 「X 前」相对时间，输入 ms epoch */
export function formatAgo(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 10_000) return '刚刚';
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < HOUR) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  return `${Math.floor(diff / DAY)} 天前`;
}

/** 本地日期时间，如 08-14 18:00 */
export function formatDateTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 供 <input type="datetime-local"> 使用的本地时间字符串 */
export function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

/** 是否请求降低动效 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

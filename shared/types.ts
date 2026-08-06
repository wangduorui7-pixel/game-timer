export type GameId = 'genshin' | 'starrail' | 'zzz' | 'wuwa' | 'endfield';

export const GAME_IDS: GameId[] = ['genshin', 'starrail', 'zzz', 'wuwa', 'endfield'];

export const GAME_META: Record<GameId, { name: string; short: string; accent: string; accent2: string }> = {
  genshin:  { name: '原神',                 short: '原神',   accent: '#d8b26a', accent2: '#8fd0ff' },
  starrail: { name: '崩坏：星穹铁道',        short: '星铁',   accent: '#a98cff', accent2: '#ffd166' },
  zzz:      { name: '绝区零',               short: '绝区零', accent: '#b8f34a', accent2: '#ff5c8a' },
  wuwa:     { name: '鸣潮',                 short: '鸣潮',   accent: '#4fd1e8', accent2: '#7c8cff' },
  endfield: { name: '明日方舟：终末地',      short: '终末地', accent: '#ff8a3d', accent2: '#5ad1a5' },
};

export type ActivityCategory = 'activity' | 'gacha' | 'notice' | 'version';

export const CATEGORY_IDS: ActivityCategory[] = ['activity', 'gacha', 'version', 'notice'];

/** 默认展示的分类：版本更新说明（version）与公告（notice）是纯资讯，默认隐藏 */
export const DEFAULT_CATEGORIES: ActivityCategory[] = ['activity', 'gacha'];

export interface ActivityItem {
  /** 稳定 ID：`${game}:${hash(title+startTime)}`，刷新后必须保持不变 */
  id: string;
  game: GameId;
  /** 纯文本标题，必须剥离 HTML */
  title: string;
  /** 原始分类标签，如「活动公告」 */
  type: string;
  category: ActivityCategory;
  banner?: string;
  url?: string;
  /** ms epoch */
  startTime: number;
  /** ms epoch；永久活动为 0 */
  endTime: number;
  permanent: boolean;
  source: 'api' | 'scrape' | 'manual';
}

export interface GameSnapshot {
  game: GameId;
  fetchedAt: number;
  ok: boolean;
  stale: boolean;
  error?: string;
  activities: ActivityItem[];
}

export interface ActivitiesResponse {
  snapshots: GameSnapshot[];
}

export interface PublicUser {
  id: number;
  username: string;
  createdAt: number;
  mihoyoBound?: boolean;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface UserPrefs {
  games: GameId[];
  theme: 'dark' | 'light';
  /**
   * 展示哪些活动分类。可选字段：老客户端不传即视为 DEFAULT_CATEGORIES，
   * 服务端也永远接受不带该字段的 PUT，保持 API 向后兼容。
   */
  categories?: ActivityCategory[];
}

/** activityId -> 完成时间戳(ms) */
export type CompletionMap = Record<string, number>;

/* ---------------------------------------------------------------- 账号绑定 */

export type Provider = 'mihoyo' | 'kuro' | 'hypergryph';

export const PROVIDER_META: Record<Provider, { name: string; games: GameId[]; site: string }> = {
  mihoyo:     { name: '米哈游 · 米游社', games: ['genshin', 'starrail', 'zzz'], site: 'https://www.miyoushe.com' },
  kuro:       { name: '库洛 · 库街区',   games: ['wuwa'],                      site: 'https://www.kurobbs.com' },
  hypergryph: { name: '鹰角 · 森空岛',   games: ['endfield'],                  site: 'https://www.skland.com' },
};

export interface BindingInfo {
  provider: Provider;
  bound: boolean;
  nickname?: string;
  uid?: string;
  level?: number;
  region?: string;
  lastSyncAt?: number;
  /** 凭据是否仍有效 */
  valid: boolean;
  /** 中文失效原因 */
  error?: string;
  /** 掩码后的凭据预览，永不返回明文 */
  masked?: string;
}

export type TaskPeriod = 'daily' | 'weekly' | 'season' | 'permanent';

export interface AccountTask {
  /** `${game}:task:${key}` */
  id: string;
  game: GameId;
  /** 分组名，如「每日委托」「深境螺旋」 */
  group: string;
  label: string;
  period: TaskPeriod;
  finished: number;
  total: number;
  done: boolean;
  /** 周期重置时间 ms epoch */
  resetAt?: number;
  detail?: string;
}

export interface AccountSnapshot {
  game: GameId;
  provider: Provider;
  ok: boolean;
  syncedAt: number;
  error?: string;
  tasks: AccountTask[];
}

export interface BindingsResponse {
  bindings: BindingInfo[];
}

export interface AccountTasksResponse {
  snapshots: AccountSnapshot[];
}

export interface DailyNote {
  game: GameId;
  /** 树脂 / 开拓力 / 电量 */
  stamina: { current: number; max: number; recoverySeconds: number };
  dailyTask: { finished: number; total: number };
  weekly?: { finished: number; total: number; label: string };
  expedition?: { finished: number; total: number };
  extra?: { label: string; finished: number; total: number }[];
}

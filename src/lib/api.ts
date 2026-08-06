/**
 * 后端 API 封装（严格对应 SPEC 第 4 节）。
 * - 自动携带 `Authorization: Bearer <token>`，token 存 localStorage['gt_token']
 * - 统一错误处理：抛出 ApiError（message 为后端返回的中文原因）
 * - 401 自动清 token 并广播登出（登录/注册接口除外，避免把「密码错误」当成掉线）
 */
import type {
  AccountTasksResponse,
  ActivitiesResponse,
  ActivityItem,
  AuthResponse,
  BindingInfo,
  BindingsResponse,
  CompletionMap,
  DailyNote,
  GameId,
  Provider,
  PublicUser,
  UserPrefs,
} from '../../shared/types';

const BASE = '/api';
const TOKEN_KEY = 'gt_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ------------------------------------------------------------------ token */

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 隐私模式下 localStorage 不可用，忽略 */
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** 注册 401 回调（useAuth 在挂载时接管，用于自动登出） */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

/* ---------------------------------------------------------------- request */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** true = 401 不触发全局登出（登录/注册场景） */
  keepSession?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, '网络连接失败，请检查网络后重试');
  }

  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `请求失败（HTTP ${res.status}）`;
    if (res.status === 401 && !opts.keepSession) {
      setToken(null);
      unauthorizedHandler?.();
    }
    throw new ApiError(res.status, message);
  }

  return data as T;
}

function gamesQuery(games?: GameId[]): string {
  return games && games.length ? `?games=${games.join(',')}` : '';
}

/* ------------------------------------------------------------- 活动数据 */

export function apiGetActivities(games?: GameId[]): Promise<ActivitiesResponse> {
  return request<ActivitiesResponse>(`/activities${gamesQuery(games)}`);
}

export function apiRefreshActivities(games?: GameId[]): Promise<ActivitiesResponse> {
  return request<ActivitiesResponse>(`/activities/refresh${gamesQuery(games)}`, { method: 'POST' });
}

/* ----------------------------------------------------------------- 账号 */

export function apiLogin(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { username, password },
    keepSession: true,
  });
}

export function apiRegister(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { username, password },
    keepSession: true,
  });
}

export function apiMe(): Promise<{ user: PublicUser | null }> {
  return request<{ user: PublicUser | null }>('/auth/me');
}

/* ----------------------------------------------------------------- 偏好 */

export function apiGetPrefs(): Promise<UserPrefs> {
  return request<UserPrefs>('/prefs');
}

export function apiSavePrefs(patch: Partial<UserPrefs>): Promise<UserPrefs> {
  return request<UserPrefs>('/prefs', { method: 'PUT', body: patch });
}

/* ------------------------------------------------------------- 完成状态 */

export function apiGetCompletions(): Promise<CompletionMap> {
  return request<CompletionMap>('/completions');
}

export function apiSetCompletion(activityId: string, done: boolean): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/completions/${encodeURIComponent(activityId)}`, {
    method: 'PUT',
    body: { done },
  });
}

/* ------------------------------------------------------------- 手动补录 */

export interface ManualInput {
  game: GameId;
  title: string;
  endTime: number;
  startTime?: number;
  type?: string;
}

export function apiGetManual(): Promise<ActivityItem[]> {
  return request<{ items: ActivityItem[] }>('/manual').then((r) => r.items);
}

export function apiCreateManual(input: ManualInput): Promise<ActivityItem> {
  return request<{ item: ActivityItem }>('/manual', { method: 'POST', body: input }).then(
    (r) => r.item
  );
}

export function apiDeleteManual(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/manual/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/* --------------------------------------------------------- 账号绑定 */

/** 三家绑定状态；未绑定的也会占一格（bound:false） */
export function apiGetBindings(): Promise<BindingsResponse> {
  return request<BindingsResponse>('/bindings');
}

/**
 * 绑定/换绑。后端会真去打官方接口校验，
 * 失败抛 ApiError(400, '<中文原因>')，交给调用方原样展示。
 */
export function apiBindProvider(provider: Provider, credential: string): Promise<BindingInfo> {
  return request<{ binding: BindingInfo }>(`/bindings/${provider}`, {
    method: 'POST',
    body: { credential },
  }).then((r) => r.binding);
}

export function apiUnbindProvider(provider: Provider): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/bindings/${provider}`, { method: 'DELETE' });
}

/* --------------------------------------------------------- 账号任务 */

export function apiGetAccountTasks(games?: GameId[]): Promise<AccountTasksResponse> {
  return request<AccountTasksResponse>(`/account-tasks${gamesQuery(games)}`);
}

export function apiRefreshAccountTasks(games?: GameId[]): Promise<AccountTasksResponse> {
  return request<AccountTasksResponse>(`/account-tasks/refresh${gamesQuery(games)}`, {
    method: 'POST',
  });
}

/* --------------------------------------------------------- 米游社便笺 */

export interface MihoyoUid {
  game: string;
  uid: string;
  nickname: string;
  level: number;
}

export function apiBindMihoyo(cookie: string): Promise<{ ok: boolean; uidList: MihoyoUid[] }> {
  return request<{ ok: boolean; uidList: MihoyoUid[] }>('/bind/mihoyo', {
    method: 'POST',
    body: { cookie },
  });
}

export function apiGetNote(
  game: GameId
): Promise<{ ok: boolean; data?: DailyNote; error?: string }> {
  return request<{ ok: boolean; data?: DailyNote; error?: string }>(`/note/${game}`);
}

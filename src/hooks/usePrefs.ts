/**
 * 用户偏好：显示哪些游戏 + 展示哪些分类 + 主题。
 * - 未登录：localStorage['gt_games'] / ['gt_categories'] / ['gt_theme']
 * - 登录后：以 /api/prefs 为准；服务端还是默认值（没存过）时把本地推上去
 * 主题始终写 document.documentElement.dataset.theme，驱动 CSS 变量与 Tailwind darkMode。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CATEGORY_IDS,
  DEFAULT_CATEGORIES,
  GAME_IDS,
  type ActivityCategory,
  type GameId,
  type UserPrefs,
} from '../../shared/types';
import { apiGetPrefs, apiSavePrefs } from '../lib/api';
import { readJson, readRaw, writeJson, writeRaw } from '../lib/storage';
import { useAuth } from './useAuth';

type Theme = UserPrefs['theme'];

const LS_GAMES = 'gt_games';
const LS_THEME = 'gt_theme';
const LS_CATEGORIES = 'gt_categories';
const DEFAULT_THEME: Theme = 'light';

function readGames(): GameId[] {
  const raw = readJson<unknown>(LS_GAMES, null);
  if (!Array.isArray(raw)) return [...GAME_IDS];
  const picked = raw.filter((g): g is GameId => (GAME_IDS as string[]).includes(g as string));
  return picked.length ? Array.from(new Set(picked)) : [...GAME_IDS];
}

/**
 * 分类默认/可选值 = CATEGORY_IDS（现仅 活动 / 祈愿；版本说明与公告类已不再展示）。
 * 注意：这里允许「空数组」被原样保留，否则用户取消全部分类会被悄悄改回默认。
 * 但取消到 0 个由 UI 层兜底（至少留一个），这里只处理「从未存过」。
 */
function readCategories(): ActivityCategory[] {
  const raw = readJson<unknown>(LS_CATEGORIES, null);
  if (!Array.isArray(raw)) return [...DEFAULT_CATEGORIES];
  const picked = raw.filter((c): c is ActivityCategory =>
    (CATEGORY_IDS as string[]).includes(c as string)
  );
  return picked.length ? Array.from(new Set(picked)) : [...DEFAULT_CATEGORIES];
}

function readTheme(): Theme {
  return readRaw(LS_THEME) === 'dark' ? 'dark' : 'light';
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

/** 服务端没存过偏好时 getPrefs 返回默认值（五游全选 + dark + 默认分类），据此判断「服务端为空」 */
function isServerDefault(prefs: UserPrefs): boolean {
  return (
    prefs.theme === DEFAULT_THEME &&
    prefs.games.length === GAME_IDS.length &&
    sameSet(prefs.categories ?? DEFAULT_CATEGORIES, DEFAULT_CATEGORIES)
  );
}

export interface PrefsState {
  games: GameId[];
  categories: ActivityCategory[];
  theme: Theme;
  setGames: (games: GameId[]) => void;
  setCategories: (categories: ActivityCategory[]) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function usePrefs(): PrefsState {
  const { user, loading: authLoading } = useAuth();
  const [games, setGamesState] = useState<GameId[]>(() => readGames());
  const [categories, setCategoriesState] = useState<ActivityCategory[]>(() => readCategories());
  const [theme, setThemeState] = useState<Theme>(() => readTheme());

  // 供登录同步时读取「当前本地值」，避免把 games/theme 塞进依赖导致重复同步
  const localRef = useRef({ games, theme, categories });
  localRef.current = { games, theme, categories };

  // 主题落到 DOM
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // 登录后与服务端对齐
  const syncedUser = useRef<number | null>(null);
  useEffect(() => {
    if (authLoading) return;
    const uid = user?.id ?? null;
    if (uid === syncedUser.current) return;
    syncedUser.current = uid;
    if (uid === null) return;

    let alive = true;
    void (async () => {
      try {
        const server = await apiGetPrefs();
        if (!alive) return;
        const local = localRef.current;
        if (isServerDefault(server)) {
          // 服务端还没存过 → 把本地偏好推上去
          await apiSavePrefs({
            games: local.games,
            theme: local.theme,
            categories: local.categories,
          });
        } else {
          const serverCats = server.categories?.length ? server.categories : [...DEFAULT_CATEGORIES];
          setGamesState(server.games.length ? server.games : [...GAME_IDS]);
          setCategoriesState(serverCats);
          setThemeState(server.theme);
          writeJson(LS_GAMES, server.games);
          writeJson(LS_CATEGORIES, serverCats);
          writeRaw(LS_THEME, server.theme);
        }
      } catch {
        /* 偏好同步失败不影响主流程，继续用本地值 */
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id, authLoading]);

  const setGames = useCallback(
    (next: GameId[]) => {
      setGamesState(next);
      writeJson(LS_GAMES, next); // 本地始终写一份，登出后仍保留
      if (user) apiSavePrefs({ games: next }).catch(() => undefined);
    },
    [user]
  );

  const setCategories = useCallback(
    (next: ActivityCategory[]) => {
      setCategoriesState(next);
      writeJson(LS_CATEGORIES, next);
      if (user) apiSavePrefs({ categories: next }).catch(() => undefined);
    },
    [user]
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      writeRaw(LS_THEME, next);
      if (user) apiSavePrefs({ theme: next }).catch(() => undefined);
    },
    [user]
  );

  const toggleTheme = useCallback(() => {
    setTheme(localRef.current.theme === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return { games, categories, theme, setGames, setCategories, setTheme, toggleTheme };
}

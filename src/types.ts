/**
 * 前端类型出口：一律以 shared/types.ts 为准（跨端共享契约，只读）。
 * 此文件仅做转出，方便 src 内部用 `../types` 引用。
 */
export type {
  ActivityCategory,
  ActivityItem,
  ActivitiesResponse,
  CompletionMap,
  DailyNote,
  GameId,
  GameSnapshot,
  PublicUser,
  AuthResponse,
  UserPrefs,
} from '../shared/types';

export { GAME_IDS, GAME_META } from '../shared/types';

/** 主题标识，与 UserPrefs['theme'] 保持一致 */
export type Theme = 'dark' | 'light';

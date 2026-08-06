/**
 * 可选登录状态。启动时若本地有 token 就调 /api/auth/me 校验，失效则静默清掉。
 * 未登录不影响任何主流程（SPEC 6.3）。
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, PublicUser } from '../../shared/types';
import {
  apiLogin,
  apiMe,
  apiRegister,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from '../lib/api';

export interface AuthState {
  user: PublicUser | null;
  /** 首次 token 校验中 */
  loading: boolean;
  login: (username: string, password: string) => Promise<PublicUser>;
  register: (username: string, password: string) => Promise<PublicUser>;
  logout: () => void;
  /** 供 AuthDialog 的 onSuccess 直接落地已拿到的 token+user */
  applySession: (auth: AuthResponse) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!getToken());

  // 任何请求拿到 401 → 全局登出
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // 启动时校验本地 token
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let alive = true;
    apiMe()
      .then((res) => {
        if (!alive) return;
        if (res.user) setUser(res.user);
        else setToken(null);
      })
      .catch(() => {
        if (alive) setToken(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const applySession = useCallback((auth: AuthResponse) => {
    setToken(auth.token);
    setUser(auth.user);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const auth = await apiLogin(username, password);
      applySession(auth);
      return auth.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const auth = await apiRegister(username, password);
      applySession(auth);
      return auth.user;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, applySession }),
    [user, loading, login, register, logout, applySession]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内部使用');
  return ctx;
}

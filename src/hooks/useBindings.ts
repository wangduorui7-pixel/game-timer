/**
 * 三家游戏账号（米哈游 / 库洛 / 鹰角）的绑定状态。
 *
 * - 未站内登录时**不发任何请求**，直接返回空列表（SPEC 0.5：不得阻塞主流程）。
 * - bind() 失败时把后端返回的中文原因原样抛出，由弹窗展示；
 *   同时把该家标记为「无效 + 原因」，卡片能立刻变红。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BindingInfo, Provider } from '../../shared/types';
import { PROVIDER_META } from '../../shared/types';
import { ApiError, apiBindProvider, apiGetBindings, apiUnbindProvider } from '../lib/api';
import { useAuth } from './useAuth';

const ALL_PROVIDERS = Object.keys(PROVIDER_META) as Provider[];

function unbound(provider: Provider): BindingInfo {
  return { provider, bound: false, valid: false };
}

/** 后端只返回已知三家；缺项补成未绑定，保证 UI 恒定渲染三张卡 */
function normalize(list: BindingInfo[]): BindingInfo[] {
  const map = new Map(list.map((b) => [b.provider, b]));
  return ALL_PROVIDERS.map((p) => map.get(p) ?? unbound(p));
}

export interface BindingsState {
  bindings: BindingInfo[];
  /** 已成功绑定且凭据仍有效的家数 */
  boundCount: number;
  /** 有绑定但凭据失效的家 */
  invalid: BindingInfo[];
  loading: boolean;
  error: string | null;
  bind: (provider: Provider, credential: string) => Promise<BindingInfo>;
  unbind: (provider: Provider) => Promise<void>;
  reload: () => Promise<void>;
}

export function useBindings(): BindingsState {
  const { user, loading: authLoading } = useAuth();
  const [bindings, setBindings] = useState<BindingInfo[]>(() => normalize([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seqRef = useRef(0);
  const loggedIn = !!user;

  const reload = useCallback(async () => {
    if (!loggedIn) {
      setBindings(normalize([]));
      setError(null);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const res = await apiGetBindings();
      if (seq !== seqRef.current) return;
      setBindings(normalize(res.bindings ?? []));
      setError(null);
    } catch (e) {
      if (seq !== seqRef.current) return;
      // 拉不到绑定状态只是这块不可用，不能影响倒计时主流程
      setError(e instanceof ApiError ? e.message : '绑定状态加载失败');
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [reload, authLoading]);

  const patch = useCallback((provider: Provider, next: BindingInfo) => {
    setBindings((prev) => prev.map((b) => (b.provider === provider ? next : b)));
  }, []);

  const bind = useCallback(
    async (provider: Provider, credential: string) => {
      try {
        const binding = await apiBindProvider(provider, credential);
        patch(provider, binding);
        setError(null);
        return binding;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : '绑定失败，请稍后重试';
        // 保留已有展示信息（昵称等），只覆盖有效性与原因
        setBindings((prev) =>
          prev.map((b) => (b.provider === provider ? { ...b, valid: false, error: msg } : b))
        );
        throw e instanceof Error ? e : new Error(msg);
      }
    },
    [patch]
  );

  const unbind = useCallback(
    async (provider: Provider) => {
      await apiUnbindProvider(provider);
      patch(provider, unbound(provider));
    },
    [patch]
  );

  const boundCount = useMemo(
    () => bindings.filter((b) => b.bound && b.valid).length,
    [bindings]
  );
  const invalid = useMemo(() => bindings.filter((b) => b.bound && !b.valid), [bindings]);

  return { bindings, boundCount, invalid, loading, error, bind, unbind, reload };
}

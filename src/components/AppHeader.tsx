import { useEffect, useRef, useState } from 'react';
import { Hourglass, Link2, LogIn, LogOut, Moon, RefreshCw, Sun } from 'lucide-react';
import type { PublicUser } from '../../shared/types';
import { formatAgo } from '../theme/tokens';

export interface AppHeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  user: PublicUser | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** 最近一次成功抓取时间 ms epoch */
  lastUpdated: number | null;
  onBindingClick?: () => void;
}

export function AppHeader({
  theme,
  onToggleTheme,
  user,
  onLoginClick,
  onLogout,
  onRefresh,
  refreshing,
  lastUpdated,
  onBindingClick,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const isDark = theme === 'dark';

  return (
    <header className="gt-header">
      <div className="gt-header__inner">
        {/* 品牌 */}
        <div className="gt-brand">
          <span className="gt-brand__mark" aria-hidden="true">
            <Hourglass size={19} strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="gt-brand__title block">五游活动倒计时台</span>
            <span className="gt-brand__sub hidden sm:block">
              原神 · 星铁 · 绝区零 · 鸣潮 · 终末地
            </span>
          </span>
        </div>

        <span className="flex-1" />

        {/* 更新时间：>=768px 常驻显示 */}
        {lastUpdated !== null && (
          <span className="gt-updated gt-updated--desktop" title={new Date(lastUpdated).toLocaleString()}>
            <span className="gt-updated__dot" />
            数据更新于 {formatAgo(lastUpdated)}
          </span>
        )}

        {/* 刷新 */}
        <button
          type="button"
          className="gt-btn gt-btn--icon"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="刷新数据"
          title={refreshing ? '正在刷新…' : '刷新数据'}
        >
          <RefreshCw
            size={18}
            className="gt-refresh-icon"
            data-spin={refreshing ? 'true' : 'false'}
          />
        </button>

        {/* 主题切换 */}
        <button
          type="button"
          className="gt-theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? '切换到明亮主题' : '切换到深色主题'}
          title={isDark ? '切换到明亮主题' : '切换到深色主题'}
        >
          <span className="gt-theme-toggle__icon" data-hidden={isDark ? 'false' : 'true'}>
            <Moon size={18} />
          </span>
          <span className="gt-theme-toggle__icon" data-hidden={isDark ? 'true' : 'false'}>
            <Sun size={18} />
          </span>
        </button>

        {/* 账号 */}
        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="gt-btn"
              style={{ paddingLeft: 6, paddingRight: 10 }}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="gt-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
              <span className="hidden sm:inline max-w-[9rem] truncate">{user.username}</span>
            </button>
            {menuOpen && (
              <div className="gt-menu" role="menu">
                <div className="px-2.5 py-2 text-xs text-ink-3 leading-relaxed">
                  已登录 · 完成状态多端同步
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="gt-menu__item"
                  onClick={() => {
                    setMenuOpen(false);
                    onBindingClick?.();
                  }}
                >
                  <Link2 size={16} />
                  账号绑定
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="gt-menu__item gt-menu__item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button type="button" className="gt-btn gt-btn--primary" onClick={onLoginClick}>
            <LogIn size={17} />
            <span className="hidden sm:inline">登录</span>
          </button>
        )}
      </div>

    </header>
  );
}

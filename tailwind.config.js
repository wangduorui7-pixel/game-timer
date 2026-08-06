/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    // 与 SPEC 6.7 的断点硬指标对齐：<640 单列 / 640-1024 双列 / >1024 三~四列
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1600px',
    },
    extend: {
      colors: {
        // 语义色 —— 全部指向 index.css 的 CSS 变量，双主题自动跟随
        base: 'var(--bg-base)',
        elev: 'var(--bg-elev)',
        elev2: 'var(--bg-elev-2)',
        elev3: 'var(--bg-elev-3)',
        glass: 'var(--bg-glass)',
        sunken: 'var(--bg-sunken)',
        ink: {
          DEFAULT: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          inv: 'var(--text-inv)',
        },
        line: {
          DEFAULT: 'var(--border-1)',
          2: 'var(--border-2)',
          strong: 'var(--border-strong)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          2: 'var(--brand-2)',
          soft: 'var(--brand-soft)',
          ink: 'var(--brand-ink)',
        },
        danger: { DEFAULT: 'var(--danger)', ink: 'var(--danger-ink)', soft: 'var(--danger-soft)' },
        warn: { DEFAULT: 'var(--warn)', ink: 'var(--warn-ink)', soft: 'var(--warn-soft)' },
        success: { DEFAULT: 'var(--success)', ink: 'var(--success-ink)', soft: 'var(--success-soft)' },
        // 当前游戏主题色（由 [data-game] 注入）
        game: { DEFAULT: 'var(--ga)', 2: 'var(--ga2)', ink: 'var(--ga-ink)', soft: 'var(--ga-soft)' },

        // 兼容脚手架遗留组件里用到的旧别名，避免它们被删除前构建报错
        background: 'var(--bg-base)',
        foreground: 'var(--text-1)',
        muted: { DEFAULT: 'var(--bg-elev-2)', foreground: 'var(--text-2)' },
        border: 'var(--border-1)',
        input: 'var(--bg-elev-2)',
        card: { DEFAULT: 'var(--bg-elev)', foreground: 'var(--text-1)' },
        accent: {
          DEFAULT: 'var(--brand)',
          foreground: 'var(--text-inv)',
          light: 'var(--brand-soft)',
        },
        primary: { DEFAULT: 'var(--text-1)', foreground: 'var(--bg-base)' },
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        num: 'var(--font-num)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '22px',
        card: 'var(--card-radius)',
      },
      boxShadow: {
        e1: 'var(--shadow-1)',
        e2: 'var(--shadow-2)',
        e3: 'var(--shadow-3)',
        glow: '0 0 var(--glow-blur) -12px var(--ga)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
      spacing: {
        // 移动端最小热区
        touch: '44px',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.5, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translate3d(0, 14px, 0)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-9px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
        shimmer: 'shimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'spin-slow': 'spin 0.9s linear infinite',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
  corePlugins: {
    // 关闭 preflight 以免和 tdesign-react 基础样式打架；
    // 需要的重置已在 src/index.css 手工补齐。
    preflight: false,
  },
};

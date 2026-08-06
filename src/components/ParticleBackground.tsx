import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  /** 闪烁相位 */
  ph: number;
}

/** 依据视口面积推算粒子数，并封顶，避免大屏吃 CPU */
function particleCount(w: number, h: number): number {
  return Math.min(110, Math.max(28, Math.round((w * h) / 19000)));
}

/**
 * 星尘漂浮背景。
 * - 单条 requestAnimationFrame 循环，页面隐藏 / 组件卸载即停
 * - prefers-reduced-motion 时完全不启动 canvas
 * - 主题切换时重新取色（监听 <html data-theme> 变化）
 */
export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let raf: number | null = null;
    let running = false;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let tint = '255,255,255';
    let alpha = 0.7;
    let last = 0;

    const readTheme = () => {
      const styles = getComputedStyle(document.documentElement);
      const isLight = document.documentElement.dataset.theme === 'light';
      tint = isLight ? '40,60,120' : '190,215,255';
      const parsed = parseFloat(styles.getPropertyValue('--particle-alpha'));
      alpha = Number.isFinite(parsed) ? parsed : isLight ? 0.2 : 0.7;
    };

    const seed = () => {
      const n = particleCount(w, h);
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.05 - Math.random() * 0.16,
        r: 0.5 + Math.random() * 1.7,
        a: 0.25 + Math.random() * 0.75,
        ph: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = (t: number) => {
      if (!running) return;
      // 约束到 ~40fps，进一步降低占用
      if (t - last < 24) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = t;

      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.ph += 0.012;

        if (p.y < -6) {
          p.y = h + 6;
          p.x = Math.random() * w;
        }
        if (p.x < -6) p.x = w + 6;
        else if (p.x > w + 6) p.x = -6;

        const twinkle = 0.65 + Math.sin(p.ph) * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tint},${(p.a * twinkle * alpha).toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running || motionQuery.matches) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(draw);
    };

    const stop = () => {
      running = false;
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const onMotionChange = () => {
      if (motionQuery.matches) {
        stop();
        ctx.clearRect(0, 0, w, h);
      } else {
        start();
      }
    };

    readTheme();
    resize();
    start();

    // 主题切换 -> 重新取色
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      stop();
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <div className="gt-bg" aria-hidden="true">
      <div className="gt-bg__grad" />
      <div className="gt-bg__grid" />
      <canvas className="gt-bg__canvas" ref={canvasRef} />
      <div className="gt-bg__noise" />
    </div>
  );
}

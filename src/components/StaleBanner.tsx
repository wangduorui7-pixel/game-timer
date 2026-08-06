import { AlertTriangle, RotateCw } from 'lucide-react';
import type { GameSnapshot } from '../../shared/types';
import { GAME_META } from '../../shared/types';
import { formatAgo } from '../theme/tokens';

export interface StaleBannerProps {
  snapshots: GameSnapshot[];
  onRetry: () => void;
}

export function StaleBanner({ snapshots, onRetry }: StaleBannerProps) {
  const bad = snapshots.filter((s) => s.stale || !s.ok);
  if (bad.length === 0) return null;

  // 取最旧的一次成功缓存时间来提示
  const oldest = bad.reduce((min, s) => (s.fetchedAt && s.fetchedAt < min ? s.fetchedAt : min), Infinity);
  const agoText = Number.isFinite(oldest) && oldest > 0 ? formatAgo(oldest) : '未知时间';
  const names = bad.map((s) => GAME_META[s.game]?.short ?? s.game).join('、');
  const reasons = Array.from(new Set(bad.map((s) => s.error).filter(Boolean))) as string[];

  return (
    <div className="gt-stale" role="status">
      <span className="gt-stale__icon" aria-hidden="true">
        <AlertTriangle size={17} />
      </span>
      <span className="gt-stale__text">
        <strong>{names}</strong> 实时抓取失败，当前展示的是缓存数据 · 数据更新于 {agoText}
        {reasons.length > 0 && <span className="gt-stale__detail">原因：{reasons.join('；')}</span>}
      </span>
      <button type="button" className="gt-stale__btn" onClick={onRetry}>
        <RotateCw size={14} />
        点击重试
      </button>
    </div>
  );
}

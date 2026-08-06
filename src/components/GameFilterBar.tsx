import { CheckCheck } from 'lucide-react';
import type { GameId } from '../../shared/types';
import { GAME_IDS, GAME_META } from '../../shared/types';

export interface GameFilterBarProps {
  selected: GameId[];
  onChange: (games: GameId[]) => void;
  counts: Record<GameId, number>;
}

export function GameFilterBar({ selected, onChange, counts }: GameFilterBarProps) {
  const allOn = selected.length === GAME_IDS.length;

  const toggle = (id: GameId) => {
    const next = selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id];
    // 至少保留一个，全部取消等于什么都看不到
    onChange(next.length === 0 ? GAME_IDS.slice() : next);
  };

  return (
    <div
      className="gt-filter"
      role="group"
      aria-label="按游戏筛选"
    >
      {GAME_IDS.map((id: GameId) => {
        const on = selected.includes(id);
        const m = GAME_META[id];
        return (
          <button
            key={id}
            type="button"
            className="gt-chip"
            data-game={id}
            aria-pressed={on}
            title={m.name}
            onClick={() => toggle(id)}
          >
            <span className="gt-chip__dot" />
            {m.short}
            <span className="gt-chip__count">{counts[id] ?? 0}</span>
          </button>
        );
      })}

      {!allOn && (
        <button
          type="button"
          className="gt-chip"
          aria-pressed={false}
          onClick={() => onChange(GAME_IDS.slice())}
          title="选择全部游戏"
          style={{ filter: 'none', color: 'var(--text-2)' }}
        >
          <CheckCheck size={15} />
          全选
        </button>
      )}
    </div>
  );
}

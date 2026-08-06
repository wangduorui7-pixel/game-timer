import { CATEGORY_IDS, type ActivityCategory } from '../../shared/types';
import { CATEGORY_LABEL } from '../theme/tokens';

export interface CategoryFilterBarProps {
  selected: ActivityCategory[];
  onChange: (categories: ActivityCategory[]) => void;
  counts: Record<ActivityCategory, number>;
}

/**
 * 分类筛选。默认只勾选 活动 / 祈愿 / 版本，「公告」是纯资讯营销，默认关闭。
 * 与游戏筛选一致：多选、即时生效，选择由 usePrefs 持久化。
 */
export function CategoryFilterBar({ selected, onChange, counts }: CategoryFilterBarProps) {
  const toggle = (id: ActivityCategory) => {
    const next = selected.includes(id)
      ? selected.filter((c) => c !== id)
      : CATEGORY_IDS.filter((c) => c === id || selected.includes(c)); // 保持固定顺序
    // 至少留一个，否则整页空白
    onChange(next.length === 0 ? [id] : next);
  };

  return (
    <div className="gt-filter" role="group" aria-label="按分类筛选">
      <span className="gt-filter__label">分类</span>
      {CATEGORY_IDS.map((id) => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            className="gt-chip gt-chip--cat"
            data-cat={id}
            aria-pressed={on}
            title={`${CATEGORY_LABEL[id]}（${counts[id] ?? 0} 条）`}
            onClick={() => toggle(id)}
          >
            {CATEGORY_LABEL[id]}
            <span className="gt-chip__count">{counts[id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

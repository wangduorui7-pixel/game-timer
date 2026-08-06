import { memo } from 'react';
import { getUrgency, pad2, splitRemaining, DAY, HOUR } from '../theme/tokens';

export interface CountdownTextProps {
  /** ms epoch；0 表示无截止 */
  endTime: number;
  /** 由全局单 ticker 广播的当前时间，组件内部绝不自己开定时器 */
  now: number;
  permanent?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 单个数字槽：内层 <span> 用 key={char} 标识，
 * 数字变化时 React 会替换该节点，从而重新触发 gt-digit-roll 翻滚动画；
 * 未变化的位不会重挂载，也就不会闪。
 * 槽宽固定 1ch + tabular-nums，秒位跳动不会造成布局抖动。
 */
function Digit({ char }: { char: string }) {
  return (
    <span className="gt-digit" aria-hidden="true">
      <span className="gt-digit__v" key={char}>
        {char}
      </span>
    </span>
  );
}

function DigitGroup({ value }: { value: string }) {
  return (
    <>
      {value.split('').map((c, i) => (
        <Digit key={i} char={c} />
      ))}
    </>
  );
}

/**
 * 精度分层（按剩余时间自适应）：
 *  - ≥ 24h ：精确到「小时」  → D 天 HH 时
 *  - ≥ 60min：精确到「分钟」 → HH:MM
 *  - < 60min：精确到「秒」   → MM:SS
 * 紧急度辉光仍按原阈值：<24h 呼吸辉光，<1h 急促脉冲。
 */
function CountdownTextImpl({ endTime, now, permanent, size = 'md' }: CountdownTextProps) {
  const urgency = getUrgency(endTime, now, permanent);
  const cls = `gt-count gt-count--${size}`;

  if (urgency === 'permanent') {
    return (
      <span className={`${cls} is-permanent`}>
        <span className="gt-count__static">长期开放</span>
      </span>
    );
  }

  if (urgency === 'ended') {
    return (
      <span className={`${cls} is-ended`}>
        <span className="gt-count__static">已结束</span>
      </span>
    );
  }

  const left = endTime - now;
  const r = splitRemaining(left);
  const mode: 'day' | 'hm' | 'ms' = left >= DAY ? 'day' : left >= HOUR ? 'hm' : 'ms';

  const state = urgency === 'critical' ? ' is-critical' : urgency === 'warn' ? ' is-warn' : '';

  let label: string;
  let content: React.ReactNode;

  if (mode === 'day') {
    label = `${r.days}天${pad2(r.hours)}时`;
    content = (
      <>
        <DigitGroup value={String(r.days)} />
        <span className="gt-count__unit" aria-hidden="true">
          天
        </span>
        <DigitGroup value={pad2(r.hours)} />
        <span className="gt-count__unit" aria-hidden="true">
          时
        </span>
      </>
    );
  } else if (mode === 'hm') {
    label = `${pad2(r.hours)}:${pad2(r.minutes)}`;
    content = (
      <>
        <DigitGroup value={pad2(r.hours)} />
        <span className="gt-count__sep" aria-hidden="true">
          :
        </span>
        <DigitGroup value={pad2(r.minutes)} />
      </>
    );
  } else {
    label = `${pad2(r.minutes)}:${pad2(r.seconds)}`;
    content = (
      <>
        <DigitGroup value={pad2(r.minutes)} />
        <span className="gt-count__sep" aria-hidden="true">
          :
        </span>
        <DigitGroup value={pad2(r.seconds)} />
      </>
    );
  }

  return (
    <span className={cls + state} role="timer" aria-live="off" aria-label={`剩余 ${label}`}>
      <span className="gt-sr">{label}</span>
      {content}
    </span>
  );
}

export const CountdownText = memo(CountdownTextImpl);
CountdownText.displayName = 'CountdownText';

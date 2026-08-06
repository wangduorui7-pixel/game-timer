import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ActivityItem, GameId } from '../../shared/types';
import { GAME_IDS, GAME_META } from '../../shared/types';
// fe-core 提供，契约：
//   apiCreateManual({ game, title, endTime, startTime?, type? }) -> Promise<ActivityItem>
import { apiCreateManual } from '../lib/api';
import { toLocalInputValue } from '../theme/tokens';
import { GlassDialog } from './GlassDialog';

export interface ManualActivityDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: ActivityItem) => void;
}

const TYPE_OPTIONS = ['活动', '祈愿', '版本', '公告'];

export function ManualActivityDialog({ open, onClose, onCreated }: ManualActivityDialogProps) {
  const [game, setGame] = useState<GameId>('wuwa');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('活动');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (open) {
      setGame('wuwa');
      setTitle('');
      setType('活动');
      setStartTime('');
      // 默认给一个 7 天后的时间，减少手填成本
      setEndTime(toLocalInputValue(Date.now() + 7 * 86400_000));
      setTouched({});
      setServerError('');
      setSubmitting(false);
    }
  }, [open]);

  const endTs = endTime ? new Date(endTime).getTime() : NaN;
  const startTs = startTime ? new Date(startTime).getTime() : NaN;

  const errTitle = !title.trim()
    ? '请输入活动名称'
    : title.trim().length > 60
      ? '名称请控制在 60 字以内'
      : '';
  const errEnd = !endTime
    ? '请填写截止时间'
    : !Number.isFinite(endTs)
      ? '时间格式不正确'
      : endTs <= Date.now()
        ? '截止时间必须晚于当前时间'
        : '';
  const errStart =
    startTime && Number.isFinite(startTs) && Number.isFinite(endTs) && startTs >= endTs
      ? '开始时间需早于截止时间'
      : '';
  const invalid = !!errTitle || !!errEnd || !!errStart;

  const show = (field: string, err: string) => (touched[field] && err ? err : '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, endTime: true, startTime: true });
    setServerError('');
    if (invalid || submitting) return;

    setSubmitting(true);
    try {
      const item = await apiCreateManual({
        game,
        title: title.trim(),
        endTime: endTs,
        startTime: Number.isFinite(startTs) ? startTs : undefined,
        type,
      });
      onCreated(item);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg || '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title="手动补录活动"
      subtitle="鸣潮 / 终末地 暂未开放稳定接口时，可在此手工登记截止时间"
      width={468}
      footer={
        <>
          <button type="button" className="gt-btn" style={{ flex: 1 }} onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            form="gt-manual-form"
            className="gt-btn gt-btn--primary"
            style={{ flex: 2 }}
            disabled={submitting}
          >
            {submitting && <span className="gt-spinner" />}
            添加到倒计时
          </button>
        </>
      }
    >
      <form id="gt-manual-form" onSubmit={handleSubmit} noValidate className="contents">
        {serverError && (
          <div className="gt-alert" role="alert">
            <AlertCircle size={15} style={{ flex: 'none', marginTop: 1 }} />
            <span>{serverError}</span>
          </div>
        )}

        <div className="gt-field">
          <span className="gt-field__label">所属游戏</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GAME_IDS.map((g: GameId) => (
              <button
                key={g}
                type="button"
                className="gt-chip"
                data-game={g}
                aria-pressed={game === g}
                style={{ minHeight: 40, fontSize: 13 }}
                onClick={() => setGame(g)}
              >
                <span className="gt-chip__dot" />
                {GAME_META[g].short}
              </button>
            ))}
          </div>
        </div>

        <div className="gt-field">
          <label className="gt-field__label" htmlFor="gt-manual-title">
            活动名称<span className="gt-field__req">*</span>
          </label>
          <input
            id="gt-manual-title"
            className="gt-input"
            value={title}
            placeholder="例如：共鸣者「今汐」限时唤取"
            aria-invalid={!!show('title', errTitle)}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
          />
          {show('title', errTitle) && <span className="gt-field__err">{show('title', errTitle)}</span>}
        </div>

        <div className="gt-field">
          <label className="gt-field__label" htmlFor="gt-manual-type">
            分类
          </label>
          <select
            id="gt-manual-type"
            className="gt-input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="gt-field">
            <label className="gt-field__label" htmlFor="gt-manual-start">
              开始时间
            </label>
            <input
              id="gt-manual-start"
              className="gt-input"
              type="datetime-local"
              value={startTime}
              aria-invalid={!!show('startTime', errStart)}
              onChange={(e) => setStartTime(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, startTime: true }))}
            />
            {show('startTime', errStart) && (
              <span className="gt-field__err">{show('startTime', errStart)}</span>
            )}
          </div>

          <div className="gt-field">
            <label className="gt-field__label" htmlFor="gt-manual-end">
              截止时间<span className="gt-field__req">*</span>
            </label>
            <input
              id="gt-manual-end"
              className="gt-input"
              type="datetime-local"
              value={endTime}
              aria-invalid={!!show('endTime', errEnd)}
              onChange={(e) => setEndTime(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, endTime: true }))}
            />
            {show('endTime', errEnd) && (
              <span className="gt-field__err">{show('endTime', errEnd)}</span>
            )}
          </div>
        </div>
      </form>
    </GlassDialog>
  );
}

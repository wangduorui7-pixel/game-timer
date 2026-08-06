import type { ReactNode } from 'react';
import { Dialog } from 'tdesign-react';

export interface GlassDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** 头部标题下方的附加内容，如分段切换 */
  headExtra?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  width?: number;
}

/**
 * 以 tdesign Dialog 为骨架、外观完全自绘的玻璃弹窗。
 * 样式集中在 index.css 的 .gt-dialog / .gt-dlg 段落。
 */
export function GlassDialog({
  open,
  onClose,
  title,
  subtitle,
  headExtra,
  children,
  footer,
  width = 440,
}: GlassDialogProps) {
  return (
    <Dialog
      visible={open}
      onClose={onClose}
      className="gt-dialog"
      header={false}
      footer={false}
      placement="center"
      width={width}
      destroyOnClose
      preventScrollThrough
    >
      <div className="gt-dlg">
        <div className="gt-dlg__glow" aria-hidden="true" />
        <div className="gt-dlg__head">
          <div className="gt-dlg__title">{title}</div>
          {subtitle && <div className="gt-dlg__sub">{subtitle}</div>}
          {headExtra}
        </div>
        <div className="gt-dlg__body">{children}</div>
        <div className="gt-dlg__foot">{footer}</div>
      </div>
    </Dialog>
  );
}

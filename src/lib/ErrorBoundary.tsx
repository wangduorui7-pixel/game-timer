import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 局部兜底时可传自定义 UI */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/** 组件树异常兜底，避免单个组件崩溃导致整页白屏。 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          页面出了点小问题
        </h1>
        <p className="max-w-md break-words text-sm text-slate-500 dark:text-slate-400">
          {error.message || '未知错误'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="min-h-[44px] rounded-xl border border-slate-300 px-5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
          >
            重试
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] rounded-xl bg-slate-800 px-5 text-sm text-white transition hover:bg-slate-700 dark:bg-white/90 dark:text-slate-900 dark:hover:bg-white"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }
}

import { AuthProvider } from './hooks/useAuth';
import { TickerProvider } from './hooks/useTicker';
import { ErrorBoundary } from './lib/ErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';

/** 纯倒计时工具站，只有一个主页面，不引入路由。 */
export default function App() {
  return (
    <ErrorBoundary>
      <TickerProvider>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </TickerProvider>
    </ErrorBoundary>
  );
}

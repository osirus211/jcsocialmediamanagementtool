import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';
import { AuthProvider } from './components/auth/AuthProvider';
import { AppRouter } from './app/router';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { PWAInstallBanner } from './components/pwa/PWAInstallBanner';
import { OfflineBanner } from './components/pwa/OfflineBanner';

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OfflineBanner />
          <AppRouter />
          <PWAInstallBanner />
        </AuthProvider>
        {/* Add ReactQueryDevtools when @tanstack/react-query-devtools is installed */}
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

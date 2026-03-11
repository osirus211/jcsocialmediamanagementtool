/**
 * SuspenseWrapper Component
 * 
 * Wraps React.Suspense with PageLoader fallback and ErrorBoundary
 */

import { Suspense, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { PageLoader } from './PageLoader';

interface SuspenseWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SuspenseWrapper({ children, fallback }: SuspenseWrapperProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback || <PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
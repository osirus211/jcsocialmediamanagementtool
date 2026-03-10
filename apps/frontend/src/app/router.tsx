import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider';
import { UpgradeModalProvider } from '@/components/billing/UpgradeModalProvider';
import { DashboardPage } from '@/pages/Dashboard';
import { LoginPage } from '@/pages/auth/Login';
import { RegisterPage } from '@/pages/auth/Register';
import { WorkspaceListPage } from '@/pages/workspaces/WorkspaceList';
import { CreateWorkspacePage } from '@/pages/workspaces/CreateWorkspace';
import { WorkspaceSettingsPage } from '@/pages/workspaces/WorkspaceSettings';
import { ConnectedAccountsPage } from '@/pages/social/ConnectedAccounts';
import { ConnectChannelV2Page } from '@/pages/connect-v2/ConnectChannelV2'; // V2 Connect Flow
import { PostListPage } from '@/pages/posts/PostList';
import { CreatePostPage } from '@/pages/posts/CreatePost';
import { CalendarPage } from '@/pages/posts/Calendar';
import { FailedPostsPage } from '@/pages/posts/FailedPosts';
import { MediaLibraryPage } from '@/pages/media/MediaLibrary';
import { LinksPage } from '@/pages/links/Links';
import { EvergreenPage } from '@/pages/evergreen/EvergreenPage';
import { BulkImportPage } from '@/pages/bulk/BulkImportPage';
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage';
import { CustomDashboard } from '@/pages/analytics/CustomDashboard';
import { CompetitorPage } from '@/pages/analytics/CompetitorPage';
import { WebhooksPage } from '@/pages/settings/WebhooksPage';
import PricingPage from '@/pages/billing/Pricing';
import BillingPage from '@/pages/billing/Billing';
import BillingSuccessPage from '@/pages/billing/Success';
import BillingCancelPage from '@/pages/billing/Cancel';

import { NotFoundPage } from '@/pages/NotFound';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <WorkspaceProvider>
          <UpgradeModalProvider>
            <MainLayout />
          </UpgradeModalProvider>
        </WorkspaceProvider>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'workspaces',
        element: <WorkspaceListPage />,
      },
      {
        path: 'workspaces/create',
        element: <CreateWorkspacePage />,
      },
      {
        path: 'workspaces/:workspaceId/settings',
        element: <WorkspaceSettingsPage />,
      },
      {
        path: 'social/accounts',
        element: <ConnectedAccountsPage />,
      },
      {
        path: 'connect-v2',
        element: <ConnectChannelV2Page />, // V2 Connect Flow
      },
      {
        path: 'posts',
        element: <PostListPage />,
      },
      {
        path: 'posts/create',
        element: <CreatePostPage />,
      },
      {
        path: 'posts/calendar',
        element: <CalendarPage />,
      },
      {
        path: 'posts/failed',
        element: <FailedPostsPage />,
      },
      {
        path: 'bulk-import',
        element: <BulkImportPage />,
      },
      {
        path: 'media',
        element: <MediaLibraryPage />,
      },
      {
        path: 'links',
        element: <LinksPage />,
      },
      {
        path: 'evergreen',
        element: <EvergreenPage />,
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
      },
      {
        path: 'analytics/dashboard',
        element: <CustomDashboard />,
      },
      {
        path: 'analytics/competitors',
        element: <CompetitorPage />,
      },
      {
        path: 'settings/webhooks',
        element: <WebhooksPage />,
      },
      {
        path: 'pricing',
        element: <PricingPage />,
      },
      {
        path: 'billing',
        element: <BillingPage />,
      },
      {
        path: 'billing/success',
        element: <BillingSuccessPage />,
      },
      {
        path: 'billing/cancel',
        element: <BillingCancelPage />,
      },
    ],
  },
  {
    path: '/auth',
    element: (
      <PublicRoute>
        <AuthLayout />
      </PublicRoute>
    ),
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};

import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider';
import { UpgradeModalProvider } from '@/components/billing/UpgradeModalProvider';
import { SuspenseWrapper } from '@/components/ui/SuspenseWrapper';

// Auth pages
const LoginPage = lazy(() => import('@/pages/auth/Login').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/Register').then(module => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPassword').then(module => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPassword').then(module => ({ default: module.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmail').then(module => ({ default: module.VerifyEmailPage })));
const MagicLinkRequestPage = lazy(() => import('@/pages/auth/MagicLinkRequest').then(module => ({ default: module.MagicLinkRequestPage })));
const MagicLinkVerifyPage = lazy(() => import('@/pages/auth/MagicLinkVerify').then(module => ({ default: module.MagicLinkVerifyPage })));
const AcceptInvitePage = lazy(() => import('@/pages/AcceptInvite').then(module => ({ default: module.AcceptInvite })));

// Dashboard
const DashboardPage = lazy(() => import('@/pages/Dashboard').then(module => ({ default: module.DashboardPage })));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then(module => ({ default: module.default })));
const NotFoundPage = lazy(() => import('@/pages/NotFound').then(module => ({ default: module.NotFoundPage })));

// Workspaces
const WorkspaceListPage = lazy(() => import('@/pages/workspaces/WorkspaceList').then(module => ({ default: module.WorkspaceListPage })));
const CreateWorkspacePage = lazy(() => import('@/pages/workspaces/CreateWorkspace').then(module => ({ default: module.CreateWorkspacePage })));
const WorkspaceSettingsPage = lazy(() => import('@/pages/workspaces/WorkspaceSettings').then(module => ({ default: module.WorkspaceSettingsPage })));
const PendingInvitesPage = lazy(() => import('@/pages/workspaces/PendingInvitesPage').then(module => ({ default: module.PendingInvitesPage })));

// Social & Connections
const ConnectedAccountsPage = lazy(() => import('@/pages/social/ConnectedAccounts').then(module => ({ default: module.ConnectedAccountsPage })));
const ConnectChannelV2Page = lazy(() => import('@/pages/connect-v2/ConnectChannelV2').then(module => ({ default: module.ConnectChannelV2Page })));

// Posts & Calendar
const PostListPage = lazy(() => import('@/pages/posts/PostList').then(module => ({ default: module.PostListPage })));
const CreatePostPage = lazy(() => import('@/pages/posts/CreatePost').then(module => ({ default: module.CreatePostPage })));
const CalendarPage = lazy(() => import('@/pages/posts/Calendar').then(module => ({ default: module.CalendarPage })));
const QueuePage = lazy(() => import('@/pages/QueuePage').then(module => ({ default: module.default })));
const FailedPostsPage = lazy(() => import('@/pages/posts/FailedPosts').then(module => ({ default: module.FailedPostsPage })));

// Analytics
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));
const CustomDashboard = lazy(() => import('@/pages/analytics/CustomDashboard').then(module => ({ default: module.CustomDashboard })));
const CompetitorPage = lazy(() => import('@/pages/analytics/CompetitorPage').then(module => ({ default: module.CompetitorPage })));

// Settings
const WebhooksPage = lazy(() => import('@/pages/settings/WebhooksPage').then(module => ({ default: module.WebhooksPage })));
const AutomationPage = lazy(() => import('@/pages/settings/AutomationPage').then(module => ({ default: module.default })));
const UserProfilePage = lazy(() => import('@/pages/settings/UserProfilePage').then(module => ({ default: module.UserProfilePage })));
const AccountSettingsPage = lazy(() => import('@/pages/settings/AccountSettingsPage').then(module => ({ default: module.AccountSettingsPage })));
const SecuritySettingsPage = lazy(() => import('@/pages/settings/SecuritySettingsPage').then(module => ({ default: module.SecuritySettingsPage })));
const TwoFactorSetupPage = lazy(() => import('@/pages/settings/TwoFactorSetupPage').then(module => ({ default: module.TwoFactorSetupPage })));
const DataExportPage = lazy(() => import('@/pages/settings/DataExportPage').then(module => ({ default: module.DataExportPage })));
const NotificationPrefsPage = lazy(() => import('@/pages/settings/NotificationPrefsPage').then(module => ({ default: module.NotificationPrefsPage })));
const PlatformSettingsPage = lazy(() => import('@/pages/settings/PlatformSettingsPage').then(module => ({ default: module.default })));

// Team & Collaboration
const ApprovalsPage = lazy(() => import('@/pages/approvals/ApprovalsPage').then(module => ({ default: module.ApprovalsPage })));
const ActivityPage = lazy(() => import('@/pages/team/ActivityPage').then(module => ({ default: module.ActivityPage })));
const DraftsPage = lazy(() => import('@/pages/drafts/DraftsPage').then(module => ({ default: module.DraftsPage })));

// Content Tools
const MediaLibraryPage = lazy(() => import('@/pages/media/MediaLibrary').then(module => ({ default: module.MediaLibraryPage })));
const LinksPage = lazy(() => import('@/pages/links/Links').then(module => ({ default: module.LinksPage })));
const EvergreenPage = lazy(() => import('@/pages/evergreen/EvergreenPage').then(module => ({ default: module.EvergreenPage })));
const BulkImportPage = lazy(() => import('@/pages/bulk/BulkImportPage').then(module => ({ default: module.BulkImportPage })));
const RepurposePage = lazy(() => import('@/pages/repurpose/RepurposePage').then(module => ({ default: module.RepurposePage })));
const RSSPage = lazy(() => import('@/pages/rss/RSSPage').then(module => ({ default: module.RSSPage })));
const CampaignsPage = lazy(() => import('@/pages/campaigns/CampaignsPage').then(module => ({ default: module.default })));
const StockPhotosPage = lazy(() => import('@/pages/stock-photos/StockPhotosPage').then(module => ({ default: module.StockPhotosPage })));

// Billing
const PricingPage = lazy(() => import('@/pages/billing/Pricing').then(module => ({ default: module.default })));
const BillingPage = lazy(() => import('@/pages/billing/Billing').then(module => ({ default: module.default })));
const BillingSuccessPage = lazy(() => import('@/pages/billing/Success').then(module => ({ default: module.default })));
const BillingCancelPage = lazy(() => import('@/pages/billing/Cancel').then(module => ({ default: module.default })));

// Client Portal
const ClientPortalPage = lazy(() => import('@/pages/client-portal/ClientPortalPage').then(module => ({ default: module.ClientPortalPage })));
const ClientReviewPage = lazy(() => import('@/pages/client-portal/ClientReviewPage').then(module => ({ default: module.ClientReviewPage })));
const ClientPortalView = lazy(() => import('@/pages/client-portal/ClientPortalView').then(module => ({ default: module.ClientPortalView })));

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
        element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
      },
      {
        path: 'onboarding',
        element: <SuspenseWrapper><OnboardingPage /></SuspenseWrapper>,
      },
      {
        path: 'workspaces',
        element: <SuspenseWrapper><WorkspaceListPage /></SuspenseWrapper>,
      },
      {
        path: 'workspaces/create',
        element: <SuspenseWrapper><CreateWorkspacePage /></SuspenseWrapper>,
      },
      {
        path: 'workspaces/:workspaceId/settings',
        element: <SuspenseWrapper><WorkspaceSettingsPage /></SuspenseWrapper>,
      },
      {
        path: 'workspaces/:workspaceId/invites',
        element: <SuspenseWrapper><PendingInvitesPage /></SuspenseWrapper>,
      },
      {
        path: 'social/accounts',
        element: <SuspenseWrapper><ConnectedAccountsPage /></SuspenseWrapper>,
      },
      {
        path: 'connect-v2',
        element: <SuspenseWrapper><ConnectChannelV2Page /></SuspenseWrapper>,
      },
      {
        path: 'posts',
        element: <SuspenseWrapper><PostListPage /></SuspenseWrapper>,
      },
      {
        path: 'posts/create',
        element: <SuspenseWrapper><CreatePostPage /></SuspenseWrapper>,
      },
      {
        path: 'posts/calendar',
        element: <SuspenseWrapper><CalendarPage /></SuspenseWrapper>,
      },
      {
        path: 'queue',
        element: <SuspenseWrapper><QueuePage /></SuspenseWrapper>,
      },
      {
        path: 'posts/failed',
        element: <SuspenseWrapper><FailedPostsPage /></SuspenseWrapper>,
      },
      {
        path: 'drafts',
        element: <SuspenseWrapper><DraftsPage /></SuspenseWrapper>,
      },
      {
        path: 'approvals',
        element: <SuspenseWrapper><ApprovalsPage /></SuspenseWrapper>,
      },
      {
        path: 'team/activity',
        element: <SuspenseWrapper><ActivityPage /></SuspenseWrapper>,
      },
      {
        path: 'bulk-import',
        element: <SuspenseWrapper><BulkImportPage /></SuspenseWrapper>,
      },
      {
        path: 'media',
        element: <SuspenseWrapper><MediaLibraryPage /></SuspenseWrapper>,
      },
      {
        path: 'links',
        element: <SuspenseWrapper><LinksPage /></SuspenseWrapper>,
      },
      {
        path: 'evergreen',
        element: <SuspenseWrapper><EvergreenPage /></SuspenseWrapper>,
      },
      {
        path: 'repurpose',
        element: <SuspenseWrapper><RepurposePage /></SuspenseWrapper>,
      },
      {
        path: 'rss',
        element: <SuspenseWrapper><RSSPage /></SuspenseWrapper>,
      },
      {
        path: 'campaigns',
        element: <SuspenseWrapper><CampaignsPage /></SuspenseWrapper>,
      },
      {
        path: 'stock-photos',
        element: <SuspenseWrapper><StockPhotosPage /></SuspenseWrapper>,
      },
      {
        path: 'analytics',
        element: <SuspenseWrapper><AnalyticsPage /></SuspenseWrapper>,
      },
      {
        path: 'analytics/dashboard',
        element: <SuspenseWrapper><CustomDashboard /></SuspenseWrapper>,
      },
      {
        path: 'analytics/competitors',
        element: <SuspenseWrapper><CompetitorPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/profile',
        element: <SuspenseWrapper><UserProfilePage /></SuspenseWrapper>,
      },
      {
        path: 'settings/account',
        element: <SuspenseWrapper><AccountSettingsPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/security',
        element: <SuspenseWrapper><SecuritySettingsPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/2fa/setup',
        element: <SuspenseWrapper><TwoFactorSetupPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/data-export',
        element: <SuspenseWrapper><DataExportPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/notifications',
        element: <SuspenseWrapper><NotificationPrefsPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/webhooks',
        element: <SuspenseWrapper><WebhooksPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/automation',
        element: <SuspenseWrapper><AutomationPage /></SuspenseWrapper>,
      },
      {
        path: 'settings/platforms',
        element: <SuspenseWrapper><PlatformSettingsPage /></SuspenseWrapper>,
      },
      {
        path: 'pricing',
        element: <SuspenseWrapper><PricingPage /></SuspenseWrapper>,
      },
      {
        path: 'billing',
        element: <SuspenseWrapper><BillingPage /></SuspenseWrapper>,
      },
      {
        path: 'billing/success',
        element: <SuspenseWrapper><BillingSuccessPage /></SuspenseWrapper>,
      },
      {
        path: 'billing/cancel',
        element: <SuspenseWrapper><BillingCancelPage /></SuspenseWrapper>,
      },
      {
        path: 'client-portal',
        element: <SuspenseWrapper><ClientPortalPage /></SuspenseWrapper>,
      },
    ],
  },
  // Public client review page (no authentication required)
  {
    path: '/review/:token',
    element: <SuspenseWrapper><ClientReviewPage /></SuspenseWrapper>,
  },
  // Public client portal page (no authentication required)
  {
    path: '/portal/:slug',
    element: <SuspenseWrapper><ClientPortalView /></SuspenseWrapper>,
  },
  // Public invitation acceptance page (no authentication required)
  {
    path: '/accept-invite/:token',
    element: <SuspenseWrapper><AcceptInvitePage /></SuspenseWrapper>,
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
        element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
      },
      {
        path: 'register',
        element: <SuspenseWrapper><RegisterPage /></SuspenseWrapper>,
      },
      {
        path: 'forgot-password',
        element: <SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper>,
      },
      {
        path: 'reset-password',
        element: <SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>,
      },
      {
        path: 'verify-email',
        element: <SuspenseWrapper><VerifyEmailPage /></SuspenseWrapper>,
      },
      {
        path: 'magic-link',
        element: <SuspenseWrapper><MagicLinkRequestPage /></SuspenseWrapper>,
      },
      {
        path: 'magic-link/verify',
        element: <SuspenseWrapper><MagicLinkVerifyPage /></SuspenseWrapper>,
      },
    ],
  },
  {
    path: '*',
    element: <SuspenseWrapper><NotFoundPage /></SuspenseWrapper>,
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
};

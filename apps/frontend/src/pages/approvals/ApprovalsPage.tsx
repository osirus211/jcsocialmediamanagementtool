/**
 * Approvals Page
 * 
 * Full page for managing post approval workflow
 */

import React, { useState, useEffect } from 'react';
// import { ClockIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ApprovalQueuePanel } from '../../components/approvals/ApprovalQueuePanel';
import { ApprovalQueueItem } from '../../components/approvals/ApprovalQueueItem';
import { approvalsService, ApprovalQueueItem as ApprovalItem } from '../../services/approvals.service';
// import { toast } from 'react-hot-toast';

export const ApprovalsPage: React.FC = () => {
  const [stats, setStats] = useState({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
  });
  const [myPosts, setMyPosts] = useState<ApprovalItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingMyPosts, setLoadingMyPosts] = useState(true);

  const fetchStats = async () => {
    console.log('[DEBUG ApprovalsPage] fetchStats() called');
    try {
      const count = await approvalsService.getApprovalCount();
      console.log('[DEBUG ApprovalsPage] fetchStats() success', { pendingCount: count });
      setStats(prev => ({ ...prev, pending: count }));
    } catch (error) {
      console.error('[DEBUG ApprovalsPage] fetchStats() FAILED:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchMyPosts = async () => {
    console.log('[DEBUG ApprovalsPage] fetchMyPosts() called');
    try {
      const posts = await approvalsService.getMyPendingPosts();
      console.log('[DEBUG ApprovalsPage] fetchMyPosts() success', { posts });
      setMyPosts(posts);
    } catch (error) {
      console.error('[DEBUG ApprovalsPage] fetchMyPosts() FAILED:', error);
    } finally {
      setLoadingMyPosts(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchMyPosts();
  }, []);

  const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    loading?: boolean;
  }> = ({ title, value, icon, color, loading }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-lg ${color}`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          {loading ? (
            <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Approval Queue
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Review and manage posts awaiting approval
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Pending Approval"
          value={stats.pending}
          icon={<span className="text-yellow-600">⏰</span>}
          color="bg-yellow-100 dark:bg-yellow-900"
          loading={loadingStats}
        />
        <StatCard
          title="Approved Today"
          value={stats.approvedToday}
          icon={<span className="text-green-600">✅</span>}
          color="bg-green-100 dark:bg-green-900"
          loading={loadingStats}
        />
        <StatCard
          title="Rejected Today"
          value={stats.rejectedToday}
          icon={<span className="text-red-600">❌</span>}
          color="bg-red-100 dark:bg-red-900"
          loading={loadingStats}
        />
      </div>

      {/* Approval Queue Panel */}
      <div className="mb-8">
        <ApprovalQueuePanel />
      </div>

      {/* My Posts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            My Posts
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Posts you've submitted for approval
          </p>
        </div>

        <div className="p-6">
          {loadingMyPosts ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                    <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : myPosts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No posts submitted
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                You haven't submitted any posts for approval yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myPosts.map((post) => (
                <ApprovalQueueItem
                  key={post.postId}
                  item={post}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
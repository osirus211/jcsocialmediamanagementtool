/**
 * Approval Queue Panel Component
 * 
 * Full approval queue list with filtering and bulk actions
 */

import React, { useState, useEffect } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { ApprovalQueueItem } from './ApprovalQueueItem';
import { approvalsService, ApprovalQueueItem as ApprovalItem } from '../../services/approvals.service';
import { toast } from 'react-hot-toast';

type FilterTab = 'all' | 'awaiting' | 'approved' | 'rejected';

export const ApprovalQueuePanel: React.FC = () => {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [approvedToday, setApprovedToday] = useState<string[]>([]);
  const [rejectedToday, setRejectedToday] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const fetchApprovals = async () => {
    try {
      const data = await approvalsService.getPendingApprovals();
      setItems(data);
    } catch (error) {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = (postId: string) => {
    setApprovedToday(prev => [...prev, postId]);
    setItems(prev => prev.filter(item => item.postId !== postId));
  };

  const handleReject = (postId: string) => {
    setRejectedToday(prev => [...prev, postId]);
    setItems(prev => prev.filter(item => item.postId !== postId));
  };

  const handleBulkApprove = async () => {
    const pendingItems = getFilteredItems().filter(item => 
      !approvedToday.includes(item.postId) && !rejectedToday.includes(item.postId)
    );

    if (pendingItems.length === 0) {
      toast.error('No posts to approve');
      return;
    }

    setIsBulkApproving(true);
    try {
      await Promise.all(
        pendingItems.map(item => approvalsService.approvePost(item.postId))
      );
      
      setApprovedToday(prev => [...prev, ...pendingItems.map(item => item.postId)]);
      setItems(prev => prev.filter(item => !pendingItems.some(pending => pending.postId === item.postId)));
      
      toast.success(`Approved ${pendingItems.length} posts`);
      setShowBulkConfirm(false);
    } catch (error) {
      toast.error('Failed to approve some posts');
    } finally {
      setIsBulkApproving(false);
    }
  };

  const getFilteredItems = () => {
    switch (activeTab) {
      case 'awaiting':
        return items.filter(item => 
          !approvedToday.includes(item.postId) && !rejectedToday.includes(item.postId)
        );
      case 'approved':
        return items.filter(item => approvedToday.includes(item.postId));
      case 'rejected':
        return items.filter(item => rejectedToday.includes(item.postId));
      default:
        return items;
    }
  };

  const filteredItems = getFilteredItems();
  const pendingCount = items.filter(item => 
    !approvedToday.includes(item.postId) && !rejectedToday.includes(item.postId)
  ).length;

  const tabs = [
    { id: 'all' as FilterTab, label: 'All', count: items.length },
    { id: 'awaiting' as FilterTab, label: 'Awaiting Review', count: pendingCount },
    { id: 'approved' as FilterTab, label: 'Approved Today', count: approvedToday.length },
    { id: 'rejected' as FilterTab, label: 'Rejected Today', count: rejectedToday.length },
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pending Approvals
              </h2>
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending Approvals
            </h2>
            {pendingCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                {pendingCount}
              </span>
            )}
          </div>
          
          {pendingCount > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <CheckIcon className="w-4 h-4 mr-2" />
                Approve All
              </button>
              
              {showBulkConfirm && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-10">
                  <p className="text-sm text-gray-900 dark:text-white mb-3">
                    Are you sure you want to approve all {pendingCount} pending posts?
                  </p>
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => setShowBulkConfirm(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkApprove}
                      disabled={isBulkApproving}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBulkApproving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Confirm'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-200">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No posts pending approval
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'all' 
                ? "All caught up! No posts need your attention right now."
                : `No posts in the ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} category.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <ApprovalQueueItem
                key={item.postId}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { approvalsService } from '@/services/approvals.service';

export const Sidebar = () => {
  const [approvalCount, setApprovalCount] = useState(0);

  const fetchApprovalCount = async () => {
    try {
      const count = await approvalsService.getApprovalCount();
      setApprovalCount(count);
    } catch (error) {
      // Silently fail - don't show errors for background polling
    }
  };

  useEffect(() => {
    fetchApprovalCount();
    
    // Poll every 60 seconds
    const interval = setInterval(fetchApprovalCount, 60000);
    return () => clearInterval(interval);
  }, []);
  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="h-full flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            SMS
          </h2>
        </div>

        {/* Workspace Switcher */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <WorkspaceSwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <a
                href="/"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🏠</span>
                <span>Dashboard</span>
              </a>
            </li>
            <li>
              <a
                href="/analytics"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📊</span>
                <span>Analytics</span>
              </a>
            </li>
            <li>
              <a
                href="/posts"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📝</span>
                <span>Posts</span>
              </a>
            </li>
            <li>
              <a
                href="/drafts"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📄</span>
                <span>Drafts</span>
              </a>
            </li>
            <li>
              <a
                href="/repurpose"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>♻️</span>
                <span>Repurpose</span>
              </a>
            </li>
            <li>
              <a
                href="/rss"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📡</span>
                <span>RSS Feeds</span>
              </a>
            </li>
            <li>
              <a
                href="/campaigns"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🎯</span>
                <span>Campaigns</span>
              </a>
            </li>
            <li>
              <a
                href="/stock-photos"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📸</span>
                <span>Stock Photos</span>
              </a>
            </li>
            {/* Team Section */}
            <li className="pt-4">
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Team
              </div>
            </li>
            <li>
              <a
                href="/team/activity"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📋</span>
                <span>Activity</span>
              </a>
            </li>
            <li>
              <a
                href="/approvals"
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <div className="flex items-center gap-3">
                  <span>✅</span>
                  <span>Approvals</span>
                </div>
                {approvalCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    {approvalCount}
                  </span>
                )}
              </a>
            </li>
            <li>
              <a
                href="/client-portal"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>👥</span>
                <span>Client Portal</span>
              </a>
            </li>
            <li>
              <a
                href="/posts/calendar"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📅</span>
                <span>Calendar</span>
              </a>
            </li>
            <li>
              <a
                href="/bulk-import"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📤</span>
                <span>Bulk Import</span>
              </a>
            </li>
            <li>
              <a
                href="/social/accounts"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🔗</span>
                <span>Channels</span>
              </a>
            </li>
            <li>
              <a
                href="/links"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🔗</span>
                <span>Links</span>
              </a>
            </li>
            <li>
              <a
                href="/evergreen"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🔄</span>
                <span>Evergreen</span>
              </a>
            </li>
            <li>
              <a
                href="/billing"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>💳</span>
                <span>Billing</span>
              </a>
            </li>
            <li>
              <a
                href="/workspaces"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>⚙️</span>
                <span>Workspaces</span>
              </a>
            </li>
            <li>
              <a
                href="/settings/webhooks"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🔗</span>
                <span>Webhooks</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
};

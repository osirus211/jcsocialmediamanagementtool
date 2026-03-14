import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { invitationService, WorkspaceInvitation, InvitationStats } from '@/services/invitation.service';
import { WorkspaceRole } from '@/types/workspace.types';

/**
 * Pending Invites Management Page
 * 
 * Features:
 * - Stats summary (total sent, accepted rate, etc.)
 * - Search by email
 * - Filter by role and status
 * - Table with expiry countdown
 * - Bulk select and cancel
 * - Individual resend/cancel actions
 * - Pagination
 */
export const PendingInvitesPage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();

  // State
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'expired' | 'accepted' | 'revoked'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'member' | 'viewer'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Bulk selection
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);

  // Loading states
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());

  const isOwner = currentWorkspace?.userRole === WorkspaceRole.OWNER;
  const isAdmin = currentWorkspace?.userRole === WorkspaceRole.ADMIN || isOwner;

  useEffect(() => {
    if (workspaceId && isAdmin) {
      fetchInvitations();
      fetchStats();
    }
  }, [workspaceId, isAdmin, currentPage, statusFilter, roleFilter, searchQuery]);

  const fetchInvitations = async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const response = await invitationService.getInvitations({
        workspaceId,
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter,
        role: roleFilter,
        search: searchQuery || undefined,
      });

      setInvitations(response.invitations);
      setTotalPages(Math.ceil(response.pagination.total / itemsPerPage));
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!workspaceId) return;

    try {
      const stats = await invitationService.getInvitationStats(workspaceId);
      setStats(stats);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleResend = async (token: string) => {
    if (!workspaceId) return;

    try {
      setLoadingActions(prev => new Set(prev).add(token));
      await invitationService.resendInvitation(workspaceId, token);
      setSuccess('Invitation resent successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to resend invitation');
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(token);
        return newSet;
      });
    }
  };

  const handleCancel = async (token: string) => {
    if (!workspaceId) return;

    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      setLoadingActions(prev => new Set(prev).add(token));
      await invitationService.cancelInvitation(workspaceId, token);
      setSuccess('Invitation cancelled successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchInvitations();
      fetchStats();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to cancel invitation');
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(token);
        return newSet;
      });
    }
  };

  const handleBulkCancel = async () => {
    if (!workspaceId || selectedInvites.size === 0) return;

    if (!confirm(`Are you sure you want to cancel ${selectedInvites.size} invitations?`)) {
      return;
    }

    try {
      setIsLoading(true);
      const tokens = Array.from(selectedInvites);
      const result = await invitationService.bulkCancelInvitations(workspaceId, tokens);
      
      setSuccess(`Successfully cancelled ${result.successCount} invitations`);
      if (result.failureCount > 0) {
        setError(`${result.failureCount} invitations failed to cancel`);
      }
      
      setSelectedInvites(new Set());
      setIsAllSelected(false);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      
      fetchInvitations();
      fetchStats();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to cancel invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedInvites(new Set());
      setIsAllSelected(false);
    } else {
      const pendingTokens = invitations
        .filter(inv => inv.status === 'pending')
        .map(inv => inv.token);
      setSelectedInvites(new Set(pendingTokens));
      setIsAllSelected(true);
    }
  };

  const handleSelectInvite = (token: string) => {
    const newSelected = new Set(selectedInvites);
    if (newSelected.has(token)) {
      newSelected.delete(token);
    } else {
      newSelected.add(token);
    }
    setSelectedInvites(newSelected);
    setIsAllSelected(false);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      revoked: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    };

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status as keyof typeof badges] || badges.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getExpiryText = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      const pastDays = Math.abs(diffDays);
      return `Expired ${pastDays} day${pastDays !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 0) {
      return 'Expires today';
    } else if (diffDays === 1) {
      return 'Expires tomorrow';
    } else {
      return `Expires in ${diffDays} days`;
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You need admin permissions to manage invitations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/workspaces/${workspaceId}/settings`)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to workspace settings
          </button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Pending Invitations
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage workspace invitations and track acceptance rates
          </p>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSent}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Sent</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.accepted}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Accepted</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.expired}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Expired</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.acceptanceRate}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Acceptance Rate</div>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by email or inviter name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="accepted">Accepted</option>
                <option value="revoked">Revoked</option>
              </select>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedInvites.size > 0 && (
              <div className="mt-4 flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedInvites.size} invitation{selectedInvites.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={handleBulkCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  disabled={isLoading}
                >
                  Cancel Selected
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Invited By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sent Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </td>
                  </tr>
                ) : invitations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      {searchQuery || statusFilter !== 'all' || roleFilter !== 'all' 
                        ? 'No invitations match your filters' 
                        : 'No pending invitations'
                      }
                    </td>
                  </tr>
                ) : (
                  invitations.map((invitation) => (
                    <tr key={invitation._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        {invitation.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedInvites.has(invitation.token)}
                            onChange={() => handleSelectInvite(invitation.token)}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {invitation.invitedEmail}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="capitalize">{invitation.role}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {invitation.inviterName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {getExpiryText(invitation.expiresAt)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(invitation.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {invitation.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleResend(invitation.token)}
                                disabled={loadingActions.has(invitation.token)}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium disabled:opacity-50"
                              >
                                {loadingActions.has(invitation.token) ? 'Sending...' : 'Resend'}
                              </button>
                              <button
                                onClick={() => handleCancel(invitation.token)}
                                disabled={loadingActions.has(invitation.token)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50"
                              >
                                {loadingActions.has(invitation.token) ? 'Cancelling...' : 'Cancel'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
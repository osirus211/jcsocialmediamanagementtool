import React, { useState, useEffect } from 'react';
import { X, Mail, Users, Send, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { apiClient } from '@/lib/api-client';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PendingInvitation {
  _id: string;
  token: string;
  invitedEmail: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'expired';
  expiresAt: string;
  createdAt: string;
  inviterName: string;
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Load pending invitations when modal opens
  useEffect(() => {
    if (isOpen && currentWorkspace) {
      loadPendingInvites();
    }
  }, [isOpen, currentWorkspace]);

  const loadPendingInvites = async () => {
    if (!currentWorkspace) return;

    setLoadingInvites(true);
    try {
      const response = await apiClient.get(`/workspaces/${currentWorkspace._id}/invitations`);
      setPendingInvites(response.invitations || []);
    } catch (error: any) {
      console.error('Failed to load pending invites:', error);
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !emails.trim()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Parse emails (comma or space separated)
      const emailList = emails
        .split(/[,\s]+/)
        .map(email => email.trim())
        .filter(email => email && isValidEmail(email));

      if (emailList.length === 0) {
        setError('Please enter at least one valid email address');
        return;
      }

      // Send invitations
      const results = await Promise.allSettled(
        emailList.map(email =>
          apiClient.post(`/workspaces/${currentWorkspace._id}/invitations`, {
            email,
            role,
          })
        )
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      if (successful > 0) {
        setSuccess(`Successfully sent ${successful} invitation${successful > 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}`);
        setEmails('');
        loadPendingInvites(); // Refresh pending invites
      }

      if (failed > 0) {
        const failedResults = results
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map(result => result.reason?.response?.data?.message || result.reason?.message || 'Unknown error');
        
        setError(`Failed to send ${failed} invitation${failed > 1 ? 's' : ''}: ${failedResults[0]}`);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to send invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendInvite = async (token: string, email: string) => {
    if (!currentWorkspace) return;

    try {
      await apiClient.post(`/workspaces/${currentWorkspace._id}/invitations/${token}/resend`);
      setSuccess(`Invitation resent to ${email}`);
      loadPendingInvites();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (token: string, email: string) => {
    if (!currentWorkspace) return;

    try {
      await apiClient.delete(`/workspaces/${currentWorkspace._id}/invitations/${token}`);
      setSuccess(`Invitation revoked for ${email}`);
      loadPendingInvites();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to revoke invitation');
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Users className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Invite Team Members
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Invite Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Addresses
                </label>
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="Enter email addresses separated by commas or spaces&#10;example@company.com, another@company.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="viewer">Viewer - Can view content</option>
                  <option value="member">Member - Can create and edit content</option>
                  <option value="admin">Admin - Full workspace access</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                  <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !emails.trim()}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending Invitations...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Invitations
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Pending Invitations */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Pending Invitations ({pendingInvites.length})
            </h3>

            {loadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading invitations...</span>
              </div>
            ) : pendingInvites.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No pending invitations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite._id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {invite.invitedEmail}
                        </span>
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                          {invite.role}
                        </span>
                        {isExpired(invite.expiresAt) && (
                          <span className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3 mr-1" />
                        Sent {formatDate(invite.createdAt)} • Expires {formatDate(invite.expiresAt)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleResendInvite(invite.token, invite.invitedEmail)}
                        className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-md transition-colors"
                        title="Resend invitation"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(invite.token, invite.invitedEmail)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-md transition-colors"
                        title="Revoke invitation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
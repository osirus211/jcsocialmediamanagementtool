import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useAuthStore } from '@/store/auth.store';
import { WorkspaceRole, WorkspaceMember } from '@/types/workspace.types';
import { QueueSlotSettings } from '@/components/settings/QueueSlotSettings';
import { MemberPermissionsPanel } from '@/components/settings/MemberPermissionsPanel';
import { PermissionsSummaryBadge } from '@/components/settings/PermissionsSummaryBadge';
import { DeleteWorkspaceModal } from '@/components/workspace/DeleteWorkspaceModal';
import { BulkImportModal } from '@/components/workspace/BulkImportModal';
import { TransferOwnershipModal } from '@/components/workspace/TransferOwnershipModal';
import { InviteMemberModal } from '@/components/workspace/InviteMemberModal';

/**
 * Workspace Settings Page
 * 
 * Features:
 * - Update workspace name/slug
 * - Timezone and industry settings
 * - Member management (list, roles, remove)
 * - Leave workspace
 * - Delete workspace (multi-step confirmation)
 * - Role-based permissions
 */
export const WorkspaceSettingsPage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const {
    workspaces,
    currentWorkspace,
    members,
    membersLoaded,
    isLoading,
    fetchWorkspaceById,
    updateWorkspace,
    deleteWorkspace,
    fetchMembers,
    removeMember,
    updateMemberRole,
    leaveWorkspace,
  } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'queue'>('general');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMemberForPermissions, setSelectedMemberForPermissions] = useState<WorkspaceMember | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showTransferOwnershipModal, setShowTransferOwnershipModal] = useState(false);
  const [showInviteMemberModal, setShowInviteMemberModal] = useState(false);

  const workspace = workspaces.find((w) => w._id === workspaceId) || currentWorkspace;

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceById(workspaceId);
      fetchMembers(workspaceId);
    }
  }, [workspaceId, fetchWorkspaceById, fetchMembers]);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setSlug(workspace.slug);
      setDescription(workspace.description || '');
      setTimezone(workspace.settings?.timezone || 'UTC');
      setIndustry(workspace.settings?.industry || '');
    }
  }, [workspace]);

  const industryOptions = [
    { value: '', label: 'Select Industry (Optional)' },
    { value: 'marketing-agency', label: 'Marketing Agency' },
    { value: 'e-commerce', label: 'E-commerce' },
    { value: 'saas', label: 'SaaS' },
    { value: 'media', label: 'Media' },
    { value: 'non-profit', label: 'Non-profit' },
    { value: 'education', label: 'Education' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'other', label: 'Other' },
  ];

  const timezoneOptions = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  ];

  const isOwner = workspace?.userRole === WorkspaceRole.OWNER;
  const isAdmin = workspace?.userRole === WorkspaceRole.ADMIN || isOwner;

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!workspaceId || !workspace) return;

    try {
      await updateWorkspace(workspaceId, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        settings: {
          ...workspace.settings,
          timezone,
          industry: industry || undefined,
        },
      });
      setSuccess('Workspace updated successfully');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update workspace');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceId || !workspace) return;

    try {
      await deleteWorkspace(workspaceId);
      navigate('/workspaces');
    } catch (error: any) {
      throw error; // Let the modal handle the error
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!workspaceId || !workspace) return;

    if (!confirm(`Are you sure you want to leave "${workspace.name}"?`)) {
      return;
    }

    try {
      await leaveWorkspace(workspaceId);
      navigate('/workspaces');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to leave workspace');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo file must be smaller than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    try {
      setError('');
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(`/api/v1/workspaces/${workspaceId}/logo`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload logo');
      }

      const data = await response.json();
      setSuccess('Logo uploaded successfully');
      
      // Refresh workspace data
      await fetchWorkspaceById(workspaceId);
    } catch (error: any) {
      setError(error.message || 'Failed to upload logo');
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!workspaceId) return;

    const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId._id;
    const memberName = typeof member.userId === 'string' ? 'this member' : `${member.userId.firstName} ${member.userId.lastName}`;

    if (!confirm(`Are you sure you want to remove ${memberName}?`)) {
      return;
    }

    try {
      await removeMember(workspaceId, memberUserId);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleUpdateMemberRole = async (member: WorkspaceMember, newRole: WorkspaceRole) => {
    if (!workspaceId) return;

    const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId._id;

    try {
      await updateMemberRole(workspaceId, memberUserId, { role: newRole });
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update member role');
    }
  };

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/workspaces')}
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to workspaces
          </button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {workspace.name}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage workspace settings and members
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('general')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Members ({workspace.membersCount})
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'queue'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Queue Schedule
            </button>
          </nav>
        </div>

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

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Workspace Details */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Workspace Details
              </h2>

              <form onSubmit={handleUpdateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={!isAdmin || isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Workspace Slug
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">@</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase())}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={!isAdmin || isLoading}
                    />
                  </div>
                  <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ Changing the slug will break existing links and integrations
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of your workspace..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    disabled={!isAdmin || isLoading}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {description.length}/500 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={!isAdmin || isLoading}
                  >
                    {timezoneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Industry
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={!isAdmin || isLoading}
                  >
                    {industryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Workspace Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Workspace Logo
                  </label>
                  <div className="flex items-center gap-4">
                    {/* Current Logo */}
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
                      {workspace.clientPortal?.logoUrl ? (
                        <img
                          src={workspace.clientPortal.logoUrl}
                          alt="Workspace logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        workspace.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    
                    {/* Upload Button */}
                    {isAdmin && (
                      <div>
                        <input
                          type="file"
                          id="logo-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                          disabled={isLoading}
                        />
                        <label
                          htmlFor="logo-upload"
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Upload Logo
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          PNG, JPG up to 5MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Save Changes
                  </button>
                )}
              </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
                Danger Zone
              </h2>

              <div className="space-y-4">
                {!isOwner && (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Leave Workspace
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        You will lose access to this workspace
                      </p>
                    </div>
                    <button
                      onClick={handleLeaveWorkspace}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Leave
                    </button>
                  </div>
                )}

                {isOwner && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          Transfer Ownership
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Transfer ownership to another admin member
                        </p>
                      </div>
                      <button
                        onClick={() => setShowTransferOwnershipModal(true)}
                        className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                      >
                        Transfer
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          Delete Workspace
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Permanently delete this workspace and all its data
                        </p>
                      </div>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Members
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Manage workspace members and their roles
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowInviteMemberModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Invite Members
                    </button>
                    <button
                      onClick={() => setShowBulkImportModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Bulk Import
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {!membersLoaded ? (
                <div className="p-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : members.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No members found
                </div>
              ) : (
                members.map((member) => {
                  const memberUser = typeof member.userId === 'string' ? null : member.userId;
                  const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId._id;
                  const isCurrentUser = memberUserId === user?._id;

                  return (
                    <div key={member._id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {memberUser ? `${memberUser.firstName[0]}${memberUser.lastName[0]}` : '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {memberUser ? `${memberUser.firstName} ${memberUser.lastName}` : 'Unknown User'}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {memberUser?.email || 'No email'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Permissions Summary Badge */}
                        <PermissionsSummaryBadge member={member} />

                        {/* Role Selector */}
                        {isAdmin && member.role !== WorkspaceRole.OWNER && !isCurrentUser ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member, e.target.value as WorkspaceRole)}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white capitalize"
                          >
                            <option value={WorkspaceRole.ADMIN}>Admin</option>
                            <option value={WorkspaceRole.MEMBER}>Member</option>
                            <option value={WorkspaceRole.VIEWER}>Viewer</option>
                          </select>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm capitalize">
                            {member.role}
                          </span>
                        )}

                        {/* Manage Permissions Button */}
                        {isAdmin && (member.role === WorkspaceRole.MEMBER || member.role === WorkspaceRole.VIEWER) && (
                          <button
                            onClick={() => setSelectedMemberForPermissions(member)}
                            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          >
                            Manage Permissions
                          </button>
                        )}

                        {/* Remove Button */}
                        {isAdmin && member.role !== WorkspaceRole.OWNER && !isCurrentUser && (
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            title="Remove member"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Queue Schedule Tab */}
        {activeTab === 'queue' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <QueueSlotSettings />
          </div>
        )}
      </div>

      {/* Member Permissions Panel */}
      {selectedMemberForPermissions && (
        <MemberPermissionsPanel
          member={selectedMemberForPermissions}
          isOpen={!!selectedMemberForPermissions}
          onClose={() => setSelectedMemberForPermissions(null)}
        />
      )}

      {/* Delete Workspace Modal */}
      {workspace && (
        <DeleteWorkspaceModal
          workspace={workspace}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteWorkspace}
          isLoading={isLoading}
        />
      )}

      {/* Bulk Import Modal */}
      {workspaceId && (
        <BulkImportModal
          workspaceId={workspaceId}
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
        />
      )}

      {/* Transfer Ownership Modal */}
      {workspace && (
        <TransferOwnershipModal
          workspace={workspace}
          members={members}
          isOpen={showTransferOwnershipModal}
          onClose={() => setShowTransferOwnershipModal(false)}
        />
      )}

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={showInviteMemberModal}
        onClose={() => setShowInviteMemberModal(false)}
      />
    </div>
  );
};

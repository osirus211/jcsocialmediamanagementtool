import React, { useState, useEffect } from 'react';
import { WorkspaceMember, WorkspaceRole } from '@/types/workspace.types';
import { accountPermissionsService, EffectivePermissions } from '@/services/account-permissions.service';

interface PermissionsSummaryBadgeProps {
  member: WorkspaceMember;
}

export const PermissionsSummaryBadge: React.FC<PermissionsSummaryBadgeProps> = ({ member }) => {
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwnerOrAdmin = member.role === WorkspaceRole.OWNER || member.role === WorkspaceRole.ADMIN;
  const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId._id;

  useEffect(() => {
    if (!isOwnerOrAdmin) {
      loadPermissions();
    } else {
      setLoading(false);
    }
  }, [memberUserId, isOwnerOrAdmin]);

  const loadPermissions = async () => {
    try {
      const permissions = await accountPermissionsService.getEffectivePermissions(memberUserId);
      setEffectivePermissions(permissions);
    } catch (error) {
      // Silently fail - badge will show default state
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        Loading...
      </span>
    );
  }

  // Owner and Admin always have full access
  if (isOwnerOrAdmin) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Full Access
      </span>
    );
  }

  // For Editor and Viewer, check if they have custom permissions
  if (!effectivePermissions) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Default Access
      </span>
    );
  }

  const customPermissions = effectivePermissions.accountPermissions;
  const hasCustomPermissions = customPermissions.length > 0;

  if (!hasCustomPermissions) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Default Access
      </span>
    );
  }

  // Check if any permissions are restricted
  const hasRestrictedAccess = customPermissions.some(
    perm => !perm.canPost || !perm.canViewAnalytics
  );

  if (hasRestrictedAccess) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Limited Access
      </span>
    );
  }

  // Has custom permissions but not restricted
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      Custom ({customPermissions.length} accounts)
    </span>
  );
};
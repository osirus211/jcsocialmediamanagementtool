/**
 * Workspace Metrics Configuration
 * 
 * Prometheus metrics for workspace and team collaboration
 */

import { Counter, Gauge, Histogram, register } from 'prom-client';

// Workspace metrics
export const workspaceCreatedCounter = new Counter({
  name: 'workspace_created_total',
  help: 'Total number of workspaces created',
  labelNames: ['plan'],
  registers: [register],
});

export const workspaceDeletedCounter = new Counter({
  name: 'workspace_deleted_total',
  help: 'Total number of workspaces deleted',
  labelNames: ['plan'],
  registers: [register],
});

export const workspaceActiveGauge = new Gauge({
  name: 'workspace_active_total',
  help: 'Total number of active workspaces',
  labelNames: ['plan'],
  registers: [register],
});

export const workspaceMembersGauge = new Gauge({
  name: 'workspace_members_total',
  help: 'Total number of members in workspace',
  labelNames: ['workspace_id', 'plan'],
  registers: [register],
});

export const workspaceUsageGauge = new Gauge({
  name: 'workspace_usage_percentage',
  help: 'Workspace usage as percentage of limit',
  labelNames: ['workspace_id', 'resource_type'],
  registers: [register],
});

// Member metrics
export const memberInvitedCounter = new Counter({
  name: 'workspace_member_invited_total',
  help: 'Total number of members invited',
  labelNames: ['workspace_id', 'role'],
  registers: [register],
});

export const memberRemovedCounter = new Counter({
  name: 'workspace_member_removed_total',
  help: 'Total number of members removed',
  labelNames: ['workspace_id', 'role'],
  registers: [register],
});

export const memberRoleChangedCounter = new Counter({
  name: 'workspace_member_role_changed_total',
  help: 'Total number of role changes',
  labelNames: ['workspace_id', 'from_role', 'to_role'],
  registers: [register],
});

// Approval workflow metrics
export const postSubmittedForApprovalCounter = new Counter({
  name: 'post_submitted_for_approval_total',
  help: 'Total number of posts submitted for approval',
  labelNames: ['workspace_id', 'platform'],
  registers: [register],
});

export const postApprovedCounter = new Counter({
  name: 'post_approved_total',
  help: 'Total number of posts approved',
  labelNames: ['workspace_id', 'platform'],
  registers: [register],
});

export const postRejectedCounter = new Counter({
  name: 'post_rejected_total',
  help: 'Total number of posts rejected',
  labelNames: ['workspace_id', 'platform'],
  registers: [register],
});

export const approvalQueueSizeGauge = new Gauge({
  name: 'approval_queue_size',
  help: 'Number of posts pending approval',
  labelNames: ['workspace_id'],
  registers: [register],
});

export const approvalTimeHistogram = new Histogram({
  name: 'post_approval_time_seconds',
  help: 'Time taken to approve a post',
  labelNames: ['workspace_id', 'platform'],
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400], // 1min to 1day
  registers: [register],
});

// Activity log metrics
export const activityLogCounter = new Counter({
  name: 'workspace_activity_log_total',
  help: 'Total number of activity log entries',
  labelNames: ['workspace_id', 'action'],
  registers: [register],
});

// Permission check metrics
export const permissionCheckCounter = new Counter({
  name: 'workspace_permission_check_total',
  help: 'Total number of permission checks',
  labelNames: ['workspace_id', 'permission', 'result'],
  registers: [register],
});

// Workspace operation metrics
export const workspaceOperationDuration = new Histogram({
  name: 'workspace_operation_duration_seconds',
  help: 'Duration of workspace operations',
  labelNames: ['operation', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Limit check metrics
export const limitCheckCounter = new Counter({
  name: 'workspace_limit_check_total',
  help: 'Total number of limit checks',
  labelNames: ['workspace_id', 'resource_type', 'result'],
  registers: [register],
});

export const limitExceededCounter = new Counter({
  name: 'workspace_limit_exceeded_total',
  help: 'Total number of times limits were exceeded',
  labelNames: ['workspace_id', 'resource_type'],
  registers: [register],
});

/**
 * Helper functions to record metrics
 */

export function recordWorkspaceCreated(plan: string): void {
  workspaceCreatedCounter.inc({ plan });
}

export function recordWorkspaceDeleted(plan: string): void {
  workspaceDeletedCounter.inc({ plan });
}

export function recordMemberInvited(workspaceId: string, role: string): void {
  memberInvitedCounter.inc({ workspace_id: workspaceId, role });
}

export function recordMemberRemoved(workspaceId: string, role: string): void {
  memberRemovedCounter.inc({ workspace_id: workspaceId, role });
}

export function recordMemberRoleChanged(workspaceId: string, fromRole: string, toRole: string): void {
  memberRoleChangedCounter.inc({ workspace_id: workspaceId, from_role: fromRole, to_role: toRole });
}

export function recordPostSubmittedForApproval(workspaceId: string, platform: string): void {
  postSubmittedForApprovalCounter.inc({ workspace_id: workspaceId, platform });
}

export function recordPostApproved(workspaceId: string, platform: string, approvalTimeSeconds: number): void {
  postApprovedCounter.inc({ workspace_id: workspaceId, platform });
  approvalTimeHistogram.observe({ workspace_id: workspaceId, platform }, approvalTimeSeconds);
}

export function recordPostRejected(workspaceId: string, platform: string): void {
  postRejectedCounter.inc({ workspace_id: workspaceId, platform });
}

export function updateApprovalQueueSize(workspaceId: string, size: number): void {
  approvalQueueSizeGauge.set({ workspace_id: workspaceId }, size);
}

export function recordActivityLog(workspaceId: string, action: string): void {
  activityLogCounter.inc({ workspace_id: workspaceId, action });
}

export function recordPermissionCheck(workspaceId: string, permission: string, allowed: boolean): void {
  permissionCheckCounter.inc({
    workspace_id: workspaceId,
    permission,
    result: allowed ? 'allowed' : 'denied',
  });
}

export function recordWorkspaceOperation(operation: string, durationSeconds: number, success: boolean): void {
  workspaceOperationDuration.observe(
    { operation, status: success ? 'success' : 'error' },
    durationSeconds
  );
}

export function recordLimitCheck(workspaceId: string, resourceType: string, allowed: boolean): void {
  limitCheckCounter.inc({
    workspace_id: workspaceId,
    resource_type: resourceType,
    result: allowed ? 'allowed' : 'exceeded',
  });

  if (!allowed) {
    limitExceededCounter.inc({ workspace_id: workspaceId, resource_type: resourceType });
  }
}

export function updateWorkspaceUsage(workspaceId: string, resourceType: string, percentage: number): void {
  workspaceUsageGauge.set({ workspace_id: workspaceId, resource_type: resourceType }, percentage);
}

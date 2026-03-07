/**
 * UI Endpoint Metrics
 * 
 * Prometheus metrics for UI-focused API endpoints
 */

import { Counter, Histogram } from 'prom-client';
import { metricsRegistry } from './metrics';

/**
 * UI Endpoint Metrics
 */
export const uiEndpointRequestsTotal = new Counter({
  name: 'ui_endpoint_requests_total',
  help: 'Total number of UI endpoint requests',
  labelNames: ['endpoint', 'method', 'status'],
  registers: [metricsRegistry],
});

export const uiEndpointDuration = new Histogram({
  name: 'ui_endpoint_duration_ms',
  help: 'UI endpoint request duration in milliseconds',
  labelNames: ['endpoint', 'method'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

export const calendarRequestsTotal = new Counter({
  name: 'calendar_requests_total',
  help: 'Total number of calendar view requests',
  labelNames: ['workspace_id'],
  registers: [metricsRegistry],
});

export const historyRequestsTotal = new Counter({
  name: 'history_requests_total',
  help: 'Total number of history requests',
  labelNames: ['workspace_id', 'status_filter', 'platform_filter'],
  registers: [metricsRegistry],
});

export const mediaLibraryRequestsTotal = new Counter({
  name: 'media_library_requests_total',
  help: 'Total number of media library requests',
  labelNames: ['workspace_id', 'has_search'],
  registers: [metricsRegistry],
});

export const platformCapabilitiesRequestsTotal = new Counter({
  name: 'platform_capabilities_requests_total',
  help: 'Total number of platform capabilities requests',
  labelNames: ['platform'],
  registers: [metricsRegistry],
});

export const accountHealthRequestsTotal = new Counter({
  name: 'account_health_requests_total',
  help: 'Total number of account health requests',
  labelNames: ['workspace_id'],
  registers: [metricsRegistry],
});

/**
 * Helper Functions
 */

/**
 * Record UI endpoint request
 */
export function recordUIEndpointRequest(
  endpoint: string,
  method: string,
  status: number,
  durationMs: number
): void {
  uiEndpointRequestsTotal.inc({ endpoint, method, status: status.toString() });
  uiEndpointDuration.observe({ endpoint, method }, durationMs);
}

/**
 * Record calendar request
 */
export function recordCalendarRequest(workspaceId: string): void {
  calendarRequestsTotal.inc({ workspace_id: workspaceId });
}

/**
 * Record history request
 */
export function recordHistoryRequest(
  workspaceId: string,
  statusFilter?: string,
  platformFilter?: string
): void {
  historyRequestsTotal.inc({
    workspace_id: workspaceId,
    status_filter: statusFilter || 'none',
    platform_filter: platformFilter || 'none',
  });
}

/**
 * Record media library request
 */
export function recordMediaLibraryRequest(workspaceId: string, hasSearch: boolean): void {
  mediaLibraryRequestsTotal.inc({
    workspace_id: workspaceId,
    has_search: hasSearch.toString(),
  });
}

/**
 * Record platform capabilities request
 */
export function recordPlatformCapabilitiesRequest(platform?: string): void {
  platformCapabilitiesRequestsTotal.inc({ platform: platform || 'all' });
}

/**
 * Record account health request
 */
export function recordAccountHealthRequest(workspaceId: string): void {
  accountHealthRequestsTotal.inc({ workspace_id: workspaceId });
}

/**
 * OAuth Connection Metrics
 */
export const oauthConnectionStartedTotal = new Counter({
  name: 'oauth_connection_started_total',
  help: 'Total number of OAuth connection attempts started',
  labelNames: ['platform', 'workspace_id'],
  registers: [metricsRegistry],
});

export const oauthConnectionSuccessTotal = new Counter({
  name: 'oauth_connection_success_total',
  help: 'Total number of successful OAuth connections',
  labelNames: ['platform', 'workspace_id'],
  registers: [metricsRegistry],
});

export const oauthConnectionFailedTotal = new Counter({
  name: 'oauth_connection_failed_total',
  help: 'Total number of failed OAuth connections',
  labelNames: ['platform', 'workspace_id', 'error_code'],
  registers: [metricsRegistry],
});

/**
 * Record OAuth connection started
 */
export function recordOAuthConnectionStarted(platform: string, workspaceId: string): void {
  oauthConnectionStartedTotal.inc({ platform, workspace_id: workspaceId });
}

/**
 * Record OAuth connection success
 */
export function recordOAuthConnectionSuccess(platform: string, workspaceId: string): void {
  oauthConnectionSuccessTotal.inc({ platform, workspace_id: workspaceId });
}

/**
 * Record OAuth connection failure
 */
export function recordOAuthConnectionFailed(
  platform: string,
  workspaceId: string,
  errorCode: string
): void {
  oauthConnectionFailedTotal.inc({ platform, workspace_id: workspaceId, error_code: errorCode });
}

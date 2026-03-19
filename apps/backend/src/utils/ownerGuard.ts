/**
 * Owner Guard Utility
 * 
 * Centralized OWNER role check logic to prevent duplication
 * and ensure consistent security across the application.
 */

import { MemberRole } from '../models/WorkspaceMember';

/**
 * Check if a user is the workspace owner
 * 
 * @param role - The user's role in the workspace
 * @returns true if the user is the owner, false otherwise
 */
export function isOwner(role: MemberRole): boolean {
  return role === MemberRole.OWNER;
}

/**
 * Check if a user is admin or owner (for admin-level operations)
 * 
 * @param role - The user's role in the workspace
 * @returns true if the user is admin or owner, false otherwise
 */
export function isAdminOrOwner(role: MemberRole): boolean {
  return role === MemberRole.OWNER || role === MemberRole.ADMIN;
}

/**
 * Guard function that throws an error if user is not owner
 * 
 * @param role - The user's role in the workspace
 * @param message - Optional custom error message
 * @throws Error if user is not owner
 */
export function requireOwner(role: MemberRole, message?: string): void {
  if (!isOwner(role)) {
    throw new Error(message || 'Only workspace owners can perform this action');
  }
}

/**
 * Guard function that throws an error if user is not admin or owner
 * 
 * @param role - The user's role in the workspace
 * @param message - Optional custom error message
 * @throws Error if user is not admin or owner
 */
export function requireAdminOrOwner(role: MemberRole, message?: string): void {
  if (!isAdminOrOwner(role)) {
    throw new Error(message || 'Only admins and owners can perform this action');
  }
}

import { z } from 'zod';
import { WorkspaceRole } from '../models/WorkspaceMember';

/**
 * Create workspace validation schema
 */
export const createWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Workspace name is required')
      .max(100, 'Workspace name cannot exceed 100 characters')
      .trim(),
    slug: z
      .string()
      .min(3, 'Workspace slug must be at least 3 characters')
      .max(50, 'Workspace slug cannot exceed 50 characters')
      .regex(
        /^[a-z0-9-]+$/,
        'Workspace slug can only contain lowercase letters, numbers, and hyphens'
      )
      .trim(),
    description: z
      .string()
      .max(500, 'Description cannot exceed 500 characters')
      .trim()
      .optional(),
    timezone: z
      .string()
      .optional()
      .default('UTC'),
    industry: z
      .enum(['marketing-agency', 'e-commerce', 'saas', 'media', 'non-profit', 'education', 'healthcare', 'real-estate', 'other'])
      .optional(),
  }),
});

/**
 * Update workspace validation schema
 */
export const updateWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Workspace name is required')
      .max(100, 'Workspace name cannot exceed 100 characters')
      .trim()
      .optional(),
    slug: z
      .string()
      .min(3, 'Workspace slug must be at least 3 characters')
      .max(50, 'Workspace slug cannot exceed 50 characters')
      .regex(
        /^[a-z0-9-]+$/,
        'Workspace slug can only contain lowercase letters, numbers, and hyphens'
      )
      .trim()
      .optional(),
    description: z
      .string()
      .max(500, 'Description cannot exceed 500 characters')
      .trim()
      .optional(),
    settings: z.object({
      requireApproval: z.boolean().optional(),
      allowedDomains: z.array(z.string()).optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      industry: z
        .enum(['marketing-agency', 'e-commerce', 'saas', 'media', 'non-profit', 'education', 'healthcare', 'real-estate', 'other'])
        .optional(),
    }).optional(),
  }),
});

/**
 * Invite member validation schema
 */
export const inviteMemberSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    role: z
      .enum([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER])
      .default(WorkspaceRole.MEMBER),
  }),
});

/**
 * Update member role validation schema
 */
export const updateMemberRoleSchema = z.object({
  body: z.object({
    role: z.enum([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER]),
  }),
});

/**
 * Transfer ownership validation schema
 */
export const transferOwnershipSchema = z.object({
  body: z.object({
    newOwnerId: z.string().min(1, 'New owner ID is required'),
  }),
});

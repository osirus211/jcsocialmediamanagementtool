/**
 * Workspace Initialization Service
 * 
 * Handles workspace setup including pre-built template seeding
 */

import { PrebuiltTemplateSeeder } from './PrebuiltTemplateSeeder';
import { logger } from '../utils/logger';

export class WorkspaceInitializationService {
  /**
   * Initialize a new workspace with default content
   */
  static async initializeWorkspace(workspaceId: string, createdBy: string): Promise<void> {
    try {
      logger.info('Initializing workspace', { workspaceId });

      // Seed pre-built templates
      await PrebuiltTemplateSeeder.seedTemplates(workspaceId, createdBy);

      logger.info('Workspace initialization completed', { workspaceId });
    } catch (error: any) {
      logger.error('Failed to initialize workspace', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }
}
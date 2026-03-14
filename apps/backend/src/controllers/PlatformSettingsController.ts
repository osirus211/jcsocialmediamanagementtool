import { Request, Response } from 'express';
import { platformSettingsService } from '../services/PlatformSettingsService';
import { SocialPlatform } from '../models/PlatformSettings';
import { logger } from '../utils/logger';

export class PlatformSettingsController {
  /**
   * GET /api/v1/platform-settings
   * Get all platform settings for the workspace
   */
  async getAllSettings(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId?.toString();
      if (!workspaceId) {
        res.status(400).json({ success: false, message: 'Workspace ID required' });
        return;
      }

      const settings = await platformSettingsService.getWorkspaceSettings(workspaceId);
      
      res.json({
        success: true,
        settings,
        count: settings.length
      });
    } catch (error) {
      logger.error('Error getting all platform settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get platform settings'
      });
    }
  }

  /**
   * GET /api/v1/platform-settings/:platform
   * Get settings for a specific platform
   */
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const { platform } = req.params;
      const { accountId } = req.query;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!workspaceId) {
        res.status(400).json({ success: false, message: 'Workspace ID required' });
        return;
      }

      if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
        res.status(400).json({ success: false, message: 'Invalid platform' });
        return;
      }

      const settings = await platformSettingsService.getSettings(
        workspaceId,
        platform as SocialPlatform,
        accountId as string
      );

      if (!settings) {
        // Return default template if no settings found
        const defaultTemplate = platformSettingsService.getDefaultSettingsTemplate(platform as SocialPlatform);
        res.json({
          success: true,
          settings: {
            ...defaultTemplate,
            workspaceId,
            platform,
            ...(accountId && { accountId })
          },
          isDefault: true
        });
        return;
      }

      res.json({
        success: true,
        settings,
        isDefault: false
      });
    } catch (error) {
      logger.error('Error getting platform settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get platform settings'
      });
    }
  }

  /**
   * PUT /api/v1/platform-settings/:platform
   * Update settings for a specific platform
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { platform } = req.params;
      const { accountId } = req.query;
      const workspaceId = req.workspace?.workspaceId?.toString();
      const settingsData = req.body;

      if (!workspaceId) {
        res.status(400).json({ success: false, message: 'Workspace ID required' });
        return;
      }

      if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
        res.status(400).json({ success: false, message: 'Invalid platform' });
        return;
      }

      const updatedSettings = await platformSettingsService.updateSettings(
        workspaceId,
        platform as SocialPlatform,
        settingsData,
        accountId as string
      );

      res.json({
        success: true,
        settings: updatedSettings,
        message: 'Platform settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating platform settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update platform settings'
      });
    }
  }

  /**
   * DELETE /api/v1/platform-settings/:platform
   * Reset settings for a specific platform to defaults
   */
  async resetSettings(req: Request, res: Response): Promise<void> {
    try {
      const { platform } = req.params;
      const { accountId } = req.query;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!workspaceId) {
        res.status(400).json({ success: false, message: 'Workspace ID required' });
        return;
      }

      if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
        res.status(400).json({ success: false, message: 'Invalid platform' });
        return;
      }

      await platformSettingsService.resetSettings(
        workspaceId,
        platform as SocialPlatform,
        accountId as string
      );

      res.json({
        success: true,
        message: 'Platform settings reset to defaults'
      });
    } catch (error) {
      logger.error('Error resetting platform settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset platform settings'
      });
    }
  }

  /**
   * POST /api/v1/platform-settings/apply-defaults
   * Apply platform defaults to a post
   */
  async applyDefaults(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId?.toString();
      const { platform, accountId, post } = req.body;

      if (!workspaceId) {
        res.status(400).json({ success: false, message: 'Workspace ID required' });
        return;
      }

      if (!platform || !post) {
        res.status(400).json({ 
          success: false, 
          message: 'Platform and post data required' 
        });
        return;
      }

      if (!Object.values(SocialPlatform).includes(platform)) {
        res.status(400).json({ success: false, message: 'Invalid platform' });
        return;
      }

      const postWithDefaults = await platformSettingsService.applyDefaults({
        workspaceId,
        platform,
        accountId,
        post
      });

      res.json({
        success: true,
        post: postWithDefaults,
        message: 'Defaults applied successfully'
      });
    } catch (error) {
      logger.error('Error applying platform defaults:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to apply platform defaults'
      });
    }
  }

  /**
   * GET /api/v1/platform-settings/:platform/template
   * Get default settings template for a platform
   */
  async getDefaultTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { platform } = req.params;

      if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
        res.status(400).json({ success: false, message: 'Invalid platform' });
        return;
      }

      const template = platformSettingsService.getDefaultSettingsTemplate(platform as SocialPlatform);

      res.json({
        success: true,
        template,
        platform
      });
    } catch (error) {
      logger.error('Error getting default template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get default template'
      });
    }
  }
}

export const platformSettingsController = new PlatformSettingsController();
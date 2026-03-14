/**
 * Facebook Groups Service
 * 
 * Manages Facebook Groups publishing and management
 * Requires 'publish_to_groups' permission
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { ISocialAccount } from '../models/SocialAccount';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v21.0';

export interface FacebookGroup {
  id: string;
  name: string;
  description?: string;
  privacy: 'OPEN' | 'CLOSED' | 'SECRET';
  memberCount?: number;
  canPost: boolean;
  adminPermissions: string[];
}

export interface GroupPostOptions {
  content: string;
  mediaIds?: string[];
  link?: string;
  scheduledPublishTime?: number;
}

export class FacebookGroupsService {
  /**
   * Get user's manageable groups
   */
  async getUserGroups(account: ISocialAccount): Promise<FacebookGroup[]> {
    const accessToken = account.accessToken;

    try {
      const response = await axios.get(`${FACEBOOK_API_BASE}/me/groups`, {
        params: {
          fields: 'id,name,description,privacy,member_count,administrator,permissions',
          access_token: accessToken,
        },
      });

      const groups = response.data.data || [];
      
      const processedGroups: FacebookGroup[] = groups
        .filter((group: any) => group.administrator) // Only admin groups
        .map((group: any) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          privacy: group.privacy,
          memberCount: group.member_count,
          canPost: group.permissions?.includes('CREATE_CONTENT') || group.administrator,
          adminPermissions: group.permissions || [],
        }));

      logger.info('Facebook groups fetched', {
        totalGroups: groups.length,
        adminGroups: processedGroups.length,
        accountId: account._id.toString(),
      });

      return processedGroups;
    } catch (error: any) {
      logger.error('Facebook groups fetch failed', {
        accountId: account._id.toString(),
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch Facebook groups: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Publish post to Facebook group
   */
  async publishToGroup(
    account: ISocialAccount,
    groupId: string,
    options: GroupPostOptions
  ): Promise<{ postId: string; url: string }> {
    const { content, mediaIds = [], link, scheduledPublishTime } = options;
    const accessToken = account.accessToken;

    try {
      const payload: any = {
        message: content,
        access_token: accessToken,
      };

      // Add media if present
      if (mediaIds.length > 0) {
        payload.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
      }

      // Add link if present
      if (link) {
        payload.link = link;
      }

      // Handle scheduling
      if (scheduledPublishTime) {
        payload.scheduled_publish_time = scheduledPublishTime;
        payload.published = false;
      }

      const response = await axios.post(
        `${FACEBOOK_API_BASE}/${groupId}/feed`,
        payload
      );

      const postId = response.data.id;

      logger.info('Facebook group post published', {
        postId,
        groupId,
        scheduled: !!scheduledPublishTime,
        accountId: account._id.toString(),
      });

      return {
        postId,
        url: `https://facebook.com/groups/${groupId}/posts/${postId}`,
      };
    } catch (error: any) {
      logger.error('Facebook group post failed', {
        groupId,
        accountId: account._id.toString(),
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to publish to Facebook group: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get group posting permissions
   */
  async getGroupPermissions(
    account: ISocialAccount,
    groupId: string
  ): Promise<{ canPost: boolean; permissions: string[] }> {
    const accessToken = account.accessToken;

    try {
      const response = await axios.get(`${FACEBOOK_API_BASE}/${groupId}`, {
        params: {
          fields: 'permissions',
          access_token: accessToken,
        },
      });

      const permissions = response.data.permissions || [];
      const canPost = permissions.includes('CREATE_CONTENT');

      logger.info('Facebook group permissions fetched', {
        groupId,
        canPost,
        permissionsCount: permissions.length,
      });

      return {
        canPost,
        permissions,
      };
    } catch (error: any) {
      logger.error('Facebook group permissions fetch failed', {
        groupId,
        error: error.response?.data || error.message,
      });
      throw new Error(`Failed to fetch group permissions: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Upload media to group (for later attachment)
   */
  async uploadGroupMedia(
    account: ISocialAccount,
    groupId: string,
    mediaUrls: string[]
  ): Promise<string[]> {
    const accessToken = account.accessToken;
    const mediaIds: string[] = [];

    for (const url of mediaUrls) {
      try {
        const response = await axios.post(
          `${FACEBOOK_API_BASE}/${groupId}/photos`,
          {
            url,
            published: false, // Upload as unpublished for later attachment
            access_token: accessToken,
          }
        );

        const mediaId = response.data.id;
        mediaIds.push(mediaId);

        logger.info('Media uploaded to Facebook group', {
          mediaId,
          groupId,
          url,
        });
      } catch (error: any) {
        logger.error('Facebook group media upload failed', {
          groupId,
          url,
          error: error.response?.data || error.message,
        });
        throw new Error(`Failed to upload media to group: ${error.response?.data?.error?.message || error.message}`);
      }
    }

    return mediaIds;
  }
}
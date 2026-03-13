/**
 * User Profile Service
 * 
 * Handles API calls for user profile management
 */

import { apiClient } from '@/lib/api-client';
import {
  UpdateProfileData,
  UpdateProfileResponse,
  UploadAvatarResponse,
  UserSession,
  GetSessionsResponse,
  UpdateNotificationPreferencesData,
  UpdateNotificationPreferencesResponse,
  DeleteAccountData,
  DeleteAccountResponse,
} from '@/types/auth.types';

export class UserProfileService {
  /**
   * Update user profile
   */
  static async updateProfile(data: UpdateProfileData): Promise<UpdateProfileResponse> {
    return apiClient.patch('/auth/profile', data);
  }

  /**
   * Upload avatar
   */
  static async uploadAvatar(file: File): Promise<UploadAvatarResponse> {
    const formData = new FormData();
    formData.append('avatar', file);

    return apiClient.post('/auth/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Get active sessions
   */
  static async getSessions(): Promise<UserSession[]> {
    const response = await apiClient.get<GetSessionsResponse>('/auth/sessions');
    return response.sessions;
  }

  /**
   * Revoke specific session
   */
  static async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/auth/sessions/${sessionId}`);
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(
    data: UpdateNotificationPreferencesData
  ): Promise<UpdateNotificationPreferencesResponse> {
    return apiClient.patch('/auth/notifications', data);
  }

  /**
   * Delete account
   */
  static async deleteAccount(data: DeleteAccountData): Promise<DeleteAccountResponse> {
    return apiClient.delete('/auth/account', { data });
  }
}
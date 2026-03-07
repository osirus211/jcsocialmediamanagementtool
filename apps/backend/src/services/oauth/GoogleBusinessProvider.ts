/**
 * Google Business Profile OAuth Provider
 * 
 * Implements OAuth 2.0 for Google Business Profile API
 * 
 * Documentation: https://developers.google.com/my-business/content/overview
 * 
 * Required Scopes:
 * - https://www.googleapis.com/auth/business.manage: Manage business information
 * 
 * Features:
 * - OAuth 2.0 authentication with offline access
 * - Token refresh support
 * - Business location fetching with pagination
 * - Google account profile retrieval
 */

import axios from 'axios';
import {
  OAuthProvider,
  OAuthTokens,
  OAuthUserProfile,
  OAuthAuthorizationUrl,
  OAuthCallbackParams,
  OAuthRefreshParams,
} from './OAuthProvider';
import { logger } from '../../utils/logger';

export interface BusinessLocation {
  locationId: string;
  accountId: string;
  name: string;
  address: {
    addressLines: string[];
    locality: string;
    administrativeArea: string;
    postalCode: string;
    regionCode: string;
  };
  primaryPhone?: string;
  websiteUrl?: string;
  locationState: 'VERIFIED' | 'UNVERIFIED' | 'SUSPENDED';
}

export class GoogleBusinessProvider extends OAuthProvider {
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
  private readonly userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];
    super(clientId, clientSecret, redirectUri, scopes);
  }

  getPlatformName(): string {
    return 'google-business';
  }

  async getAuthorizationUrl(): Promise<OAuthAuthorizationUrl> {
    try {
      const state = this.generateState();

      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: this.scopes.join(' '),
        state,
        access_type: 'offline', // Request refresh token
        prompt: 'consent', // Force consent to ensure refresh token
      });

      const url = `${this.authUrl}?${params.toString()}`;

      logger.info('Generated Google Business Profile OAuth URL', {
        state: state.substring(0, 10) + '...',
        provider: 'GoogleBusinessProvider',
      });

      return { url, state };
    } catch (error: any) {
      logger.error('Google Business Profile OAuth URL generation failed', {
        error: error.message,
        provider: 'GoogleBusinessProvider',
      });
      throw new Error(`Failed to generate Google Business Profile OAuth URL: ${error.message}`);
    }
  }

  async exchangeCodeForToken(params: OAuthCallbackParams): Promise<OAuthTokens> {
    try {
      logger.debug('Exchanging code for Google Business Profile token', {
        step: 'token-exchange',
        provider: 'GoogleBusinessProvider',
      });

      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          code: params.code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;
      const expiresIn = response.data.expires_in || 3600;

      if (!accessToken) {
        throw new Error('No access token received from Google API');
      }

      if (!refreshToken) {
        logger.warn('No refresh token received - user may need to re-consent', {
          provider: 'GoogleBusinessProvider',
        });
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('Google Business Profile token obtained', {
        hasRefreshToken: !!refreshToken,
        expiresIn,
        expiresAt: expiresAt.toISOString(),
        provider: 'GoogleBusinessProvider',
      });

      return {
        accessToken,
        refreshToken,
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Google Business Profile token exchange failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'GoogleBusinessProvider',
      });

      const errorMessage =
        error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message;
      throw new Error(`Google Business Profile token exchange failed: ${errorMessage}`);
    }
  }

  async refreshAccessToken(params: OAuthRefreshParams): Promise<OAuthTokens> {
    try {
      logger.debug('Refreshing Google Business Profile token', {
        step: 'token-refresh',
        provider: 'GoogleBusinessProvider',
      });

      if (!params.refreshToken) {
        throw new Error('Refresh token is required');
      }

      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          refresh_token: params.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const newAccessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;

      if (!newAccessToken) {
        throw new Error('No access token received from Google API');
      }

      const expiresAt = this.calculateExpiresAt(expiresIn);

      logger.info('Google Business Profile token refreshed', {
        expiresIn,
        expiresAt: expiresAt.toISOString(),
        provider: 'GoogleBusinessProvider',
      });

      return {
        accessToken: newAccessToken,
        refreshToken: params.refreshToken, // Keep existing refresh token
        expiresIn,
        expiresAt,
        tokenType: 'bearer',
      };
    } catch (error: any) {
      logger.error('Google Business Profile token refresh failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'GoogleBusinessProvider',
      });

      const errorMessage =
        error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message;
      throw new Error(`Google Business Profile token refresh failed: ${errorMessage}`);
    }
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      logger.debug('Fetching Google account info', {
        step: 'profile-fetch',
        provider: 'GoogleBusinessProvider',
      });

      const response = await axios.get(this.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const user = response.data;

      if (!user.id) {
        throw new Error('No user ID found in Google account info');
      }

      logger.info('Google account info fetched', {
        userId: user.id,
        email: user.email,
        provider: 'GoogleBusinessProvider',
      });

      return {
        id: user.id,
        username: user.email || user.id,
        displayName: user.name || user.email,
        email: user.email,
        profileUrl: user.link,
        avatarUrl: user.picture,
        metadata: {
          platform: 'google-business',
          locale: user.locale,
          verifiedEmail: user.verified_email,
        },
      };
    } catch (error: any) {
      logger.error('Google account info fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        provider: 'GoogleBusinessProvider',
      });

      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        error.message;
      throw new Error(`Failed to fetch Google account info: ${errorMessage}`);
    }
  }

  /**
   * Fetch all business locations for a Google Business Profile account
   * Handles pagination automatically (100 locations per page)
   * 
   * @param accessToken - OAuth access token
   * @param accountId - Google Business Profile account ID (format: accounts/{accountId})
   * @returns Array of business locations
   */
  async getBusinessLocations(accessToken: string, accountId: string): Promise<BusinessLocation[]> {
    try {
      logger.debug('Fetching business locations', {
        accountId,
        provider: 'GoogleBusinessProvider',
      });

      const allLocations: BusinessLocation[] = [];
      let pageToken: string | undefined;
      let pageCount = 0;

      do {
        const params: any = {
          readMask: 'name,title,storefrontAddress,phoneNumbers,websiteUri,locationState',
          pageSize: 100,
        };

        if (pageToken) {
          params.pageToken = pageToken;
        }

        const response = await axios.get(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
          {
            params,
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const locations = response.data.locations || [];
        pageCount++;

        logger.debug('Fetched locations page', {
          page: pageCount,
          count: locations.length,
          hasNextPage: !!response.data.nextPageToken,
          provider: 'GoogleBusinessProvider',
        });

        // Parse and transform locations
        for (const location of locations) {
          const parsedLocation = this.parseLocation(location, accountId);
          if (parsedLocation) {
            allLocations.push(parsedLocation);
          }
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      logger.info('All business locations fetched', {
        totalLocations: allLocations.length,
        pages: pageCount,
        accountId,
        provider: 'GoogleBusinessProvider',
      });

      return allLocations;
    } catch (error: any) {
      logger.error('Business locations fetch failed', {
        error: error.response?.data || error.message,
        statusCode: error.response?.status,
        accountId,
        provider: 'GoogleBusinessProvider',
      });

      // Handle specific error cases
      if (error.response?.status === 403) {
        throw new Error('Insufficient permissions to access business locations. Please reconnect your account.');
      }

      if (error.response?.status === 404) {
        throw new Error('Business account not found. Please verify your account ID.');
      }

      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        error.message;
      throw new Error(`Failed to fetch business locations: ${errorMessage}`);
    }
  }

  /**
   * Parse a location from Google API response into our BusinessLocation format
   */
  private parseLocation(location: any, accountId: string): BusinessLocation | null {
    try {
      // Extract location ID from resource name (format: accounts/{accountId}/locations/{locationId})
      const locationId = location.name;
      
      if (!locationId) {
        logger.warn('Location missing name field', { location });
        return null;
      }

      const address = location.storefrontAddress || {};
      const phoneNumbers = location.phoneNumbers || [];
      const primaryPhone = phoneNumbers.find((p: any) => p.primaryPhone)?.phoneNumber || 
                          phoneNumbers[0]?.phoneNumber;

      return {
        locationId,
        accountId,
        name: location.title || 'Unnamed Location',
        address: {
          addressLines: address.addressLines || [],
          locality: address.locality || '',
          administrativeArea: address.administrativeArea || '',
          postalCode: address.postalCode || '',
          regionCode: address.regionCode || '',
        },
        primaryPhone,
        websiteUrl: location.websiteUri,
        locationState: location.locationState || 'UNVERIFIED',
      };
    } catch (error: any) {
      logger.warn('Failed to parse location', {
        error: error.message,
        location,
        provider: 'GoogleBusinessProvider',
      });
      return null;
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await axios.post(
        'https://oauth2.googleapis.com/revoke',
        new URLSearchParams({
          token: accessToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info('Google Business Profile token revoked', {
        provider: 'GoogleBusinessProvider',
      });
    } catch (error: any) {
      logger.error('Google Business Profile token revocation failed', {
        error: error.response?.data || error.message,
        provider: 'GoogleBusinessProvider',
      });
    }
  }
}

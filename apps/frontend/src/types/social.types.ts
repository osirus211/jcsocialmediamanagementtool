// Social Account Types

export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  THREADS = 'threads',
  BLUESKY = 'bluesky',
  MASTODON = 'mastodon',
  GOOGLE_BUSINESS = 'google-business',
  PINTEREST = 'pinterest',
}

export enum AccountStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export interface SocialAccount {
  _id: string;
  workspaceId: string;
  platform: SocialPlatform;
  accountName: string;
  accountId: string;
  tokenExpiresAt?: string;
  scopes: string[];
  status: AccountStatus;
  metadata: {
    profileUrl?: string;
    avatarUrl?: string;
    followerCount?: number;
    [key: string]: any;
  };
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectAccountInput {
  platform: SocialPlatform;
  accountName: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  scopes: string[];
  metadata?: any;
}

// API Response types
export interface SocialAccountsResponse {
  success: boolean;
  accounts: SocialAccount[];
  count: number;
}

export interface SocialAccountResponse {
  success: boolean;
  account: SocialAccount;
  message?: string;
}

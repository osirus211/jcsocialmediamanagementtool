/**
 * OAuth Session Type
 * 
 * Represents a temporary OAuth session stored in Redis during the OAuth flow.
 * Sessions have a 10-minute TTL and are used to track OAuth state and enable
 * session recovery for interrupted flows.
 */

export type OAuthSessionStatus = 'pending' | 'completed' | 'failed' | 'expired';

export interface OAuthSession {
  /**
   * Unique session identifier (UUID)
   */
  sessionId: string;

  /**
   * Platform being connected (twitter, facebook, instagram, etc.)
   */
  platform: string;

  /**
   * Workspace ID initiating the connection
   */
  workspaceId: string;

  /**
   * User ID initiating the connection
   */
  userId: string;

  /**
   * OAuth redirect URI
   */
  redirectUri: string;

  /**
   * PKCE code verifier (Twitter only)
   */
  codeVerifier?: string;

  /**
   * OAuth scopes requested
   */
  scopes: string[];

  /**
   * Session creation timestamp
   */
  initiatedAt: Date;

  /**
   * Session expiration timestamp (10 minutes from creation)
   */
  expiresAt: Date;

  /**
   * Current session status
   */
  status: OAuthSessionStatus;

  /**
   * Error reason if status is 'failed'
   */
  errorReason?: string;

  /**
   * OAuth state parameter (for CSRF protection)
   */
  state?: string;

  /**
   * IP address that initiated the session (for IP binding)
   */
  ipAddress?: string;
}

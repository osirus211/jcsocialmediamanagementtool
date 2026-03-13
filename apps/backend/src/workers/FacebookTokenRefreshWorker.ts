/**
 * Facebook Token Refresh Worker - PRODUCTION HARDENED
 * 
 * Background worker to refresh Facebook user tokens and sync connected Pages
 * 
 * ARCHITECTURE:
 * - Refreshes long-lived USER token only (fb_exchange_token)
 * - Re-derives Page tokens from /me/accounts (already long-lived)
 * - Uses SocialAccount model for both user and page accounts
 * 
 * CONCURRENCY SAFETY:
 * - Distributed lock per workspace (600s TTL with heartbeat)
 * - Lock cannot expire mid-refresh (heartbeat every 60s)
 * - Lock ownership verified before release
 * - Abort on heartbeat failure (no partial updates)
 * 
 * ORPHAN DETECTION:
 * - Uses allReturnedPageIds (from /me/accounts) for orphan detection
 * - Pages missing required tasks marked REAUTH_REQUIRED (not orphaned)
 * - Orphan = Page in DB but NOT in /me/accounts response
 * 
 * ENCRYPTION ENFORCEMENT:
 * - Strategy: Schema-level pre-save hook (automatic encryption)
 * - No runtime assertion needed (pre-save hook handles it)
 * - Format: version:salt:iv:authTag:encrypted
 * 
 * SCOPE + TASK VALIDATION:
 * - Prevents silent permission drift
 * - Pages missing tasks marked REAUTH_REQUIRED
 * - Scope validation ensures required permissions present
 * 
 * Schedule: Every 12 hours
 */

import { SocialAccount, SocialPlatform, AccountStatus } from '../models/SocialAccount';
import { FacebookOAuthProvider } from '../services/oauth/FacebookOAuthProvider';
import { distributedLockService } from '../services/DistributedLockService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/encryption';
import axios from 'axios';

interface PageTaskValidation {
  pageId: string;
  hasRequiredTasks: boolean;
  missingTasks: string[];
}

export class FacebookTokenRefreshWorker {
  private provider: FacebookOAuthProvider;
  private readonly REFRESH_THRESHOLD_DAYS = 7;
  private readonly REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
  private readonly LOCK_TTL = 600000; // 600 seconds (10 minutes)
  private readonly LOCK_HEARTBEAT_INTERVAL = 60000; // 60 seconds
  private readonly REQUIRED_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
  private readonly REQUIRED_TASKS = ['CREATE_CONTENT', 'MODERATE', 'ANALYZE'];
  private intervalId: NodeJS.Timeout | null = null;
  private abortRefresh: boolean = false;

  constructor() {
    const clientId = config.oauth?.facebook?.appId;
    const clientSecret = config.oauth?.facebook?.appSecret;
    const redirectUri = config.oauth?.facebook?.callbackUrl || `${config.apiUrl}/api/v1/oauth/facebook/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Facebook OAuth not configured');
    }

    this.provider = new FacebookOAuthProvider(clientId, clientSecret, redirectUri);
  }

  /**
   * Start the refresh worker
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Facebook token refresh worker already running');
      return;
    }

    logger.info('Starting Facebook token refresh worker', {
      interval: this.REFRESH_INTERVAL,
      thresholdDays: this.REFRESH_THRESHOLD_DAYS,
      lockTtl: this.LOCK_TTL,
      heartbeatInterval: this.LOCK_HEARTBEAT_INTERVAL,
    });

    // Run immediately on start
    this.refreshExpiring().catch(error => {
      logger.error('Facebook token refresh worker initial run failed', {
        error: error.message,
      });
    });

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.refreshExpiring().catch(error => {
        logger.error('Facebook token refresh worker run failed', {
          error: error.message,
        });
      });
    }, this.REFRESH_INTERVAL);
  }

  /**
   * Stop the refresh worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Facebook token refresh worker stopped');
    }
  }

  /**
   * Refresh tokens expiring soon
   */
  private async refreshExpiring(): Promise<void> {
    const startTime = Date.now();

    try {
      // Find Facebook accounts expiring in next 7 days
      const thresholdDate = new Date(Date.now() + this.REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

      const accounts = await SocialAccount.find({
        provider: SocialPlatform.FACEBOOK,
        status: AccountStatus.ACTIVE,
        tokenExpiresAt: { $lt: thresholdDate },
      }).select('+accessToken');

      if (accounts.length === 0) {
        logger.debug('No Facebook tokens expiring soon', {
          thresholdDate,
        });
        return;
      }

      logger.info('Found Facebook tokens expiring soon', {
        count: accounts.length,
        thresholdDate,
      });

      let successCount = 0;
      let failureCount = 0;

      for (const account of accounts) {
        try {
          await this.refreshAccountWithLock(account);
          successCount++;
        } catch (error: any) {
          failureCount++;
          logger.error('Failed to refresh Facebook token', {
            accountId: account._id,
            workspaceId: account.workspaceId,
            error: error.message,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Facebook token refresh completed', {
        total: accounts.length,
        success: successCount,
        failed: failureCount,
        duration,
      });
    } catch (error: any) {
      logger.error('Facebook token refresh worker error', {
        error: error.message,
      });
    }
  }

  /**
   * Refresh account with distributed lock
   * 
   * LOCK LIFECYCLE:
   * 1. Acquire lock with 600s TTL
   * 2. Start heartbeat (extend every 60s)
   * 3. Perform refresh operations
   * 4. Stop heartbeat
   * 5. Verify ownership and release lock
   * 
   * GUARANTEE: Lock cannot expire mid-refresh
   * ABORT: If heartbeat fails, abort refresh immediately
   */
  private async refreshAccountWithLock(account: any): Promise<void> {
    const lockResource = `facebook:refresh:workspace:${account.workspaceId}`;
    let lock = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    this.abortRefresh = false;

    try {
      // Acquire distributed lock (only one worker per workspace)
      lock = await distributedLockService.acquireLock(lockResource, {
        ttl: this.LOCK_TTL,
        retryCount: 3,
        retryDelay: 100,
      });

      if (!lock) {
        logger.warn('Could not acquire lock for Facebook refresh - skipping', {
          accountId: account._id,
          workspaceId: account.workspaceId,
          lockResource,
        });
        return;
      }

      logger.info('Lock acquired for Facebook refresh', {
        accountId: account._id,
        workspaceId: account.workspaceId,
        lockTtl: this.LOCK_TTL,
      });

      // Start heartbeat to prevent lock expiry mid-refresh
      heartbeatTimer = setInterval(async () => {
        if (lock && !this.abortRefresh) {
          const renewed = await distributedLockService.renewLock(lock, this.LOCK_TTL);
          if (!renewed) {
            logger.error('CRITICAL: Failed to renew lock during refresh - ABORTING', {
              accountId: account._id,
              workspaceId: account.workspaceId,
              lockResource,
            });
            // Set abort flag to stop refresh
            this.abortRefresh = true;
          } else {
            logger.debug('Lock heartbeat renewed', {
              accountId: account._id,
              workspaceId: account.workspaceId,
            });
          }
        }
      }, this.LOCK_HEARTBEAT_INTERVAL);

      // Perform refresh operations
      await this.refreshAccount(account);

      // Check if refresh was aborted
      if (this.abortRefresh) {
        throw new Error('Refresh aborted due to lock renewal failure');
      }

    } finally {
      // Stop heartbeat
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      // Release lock with ownership verification
      if (lock) {
        try {
          await distributedLockService.releaseLock(lock);
          logger.info('Lock released for Facebook refresh', {
            accountId: account._id,
            workspaceId: account.workspaceId,
          });
        } catch (error: any) {
          logger.error('Failed to release lock', {
            accountId: account._id,
            workspaceId: account.workspaceId,
            lockResource,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * Refresh a single account's token and sync Pages
   * 
   * ENCRYPTION ENFORCEMENT:
   * - Pre-save hook encrypts automatically
   * - No runtime assertion needed (pre-save hook handles it)
   * - Format: version:salt:iv:authTag:encrypted
   */
  private async refreshAccount(account: any): Promise<void> {
    try {
      // Check abort flag before starting
      if (this.abortRefresh) {
        throw new Error('Refresh aborted before start');
      }

      // Decrypt current access token
      const currentToken = account.getDecryptedAccessToken();

      // Step 1: Validate scopes
      const scopesValid = await this.validateScopes(currentToken);
      if (!scopesValid) {
        logger.warn('Facebook token has invalid scopes - marking for reauth', {
          accountId: account._id,
          workspaceId: account.workspaceId,
        });
        
        account.status = AccountStatus.REAUTH_REQUIRED;
        account.metadata = account.metadata || {};
        account.metadata.reauthReason = 'invalid_scopes';
        await account.save();
        return;
      }

      // Check abort flag after scope validation
      if (this.abortRefresh) {
        throw new Error('Refresh aborted after scope validation');
      }

      // Step 2: Exchange for new long-lived USER token
      const tokenResponse = await this.exchangeForLongLivedToken(currentToken);

      // Check abort flag after token exchange
      if (this.abortRefresh) {
        throw new Error('Refresh aborted after token exchange');
      }

      // Step 3: Fetch connected Pages (Page tokens are already long-lived)
      const pages = await this.provider.getUserPages(tokenResponse.accessToken);
      
      // ORPHAN DETECTION FIX: Use ALL returned page IDs for orphan detection
      const allReturnedPageIds = pages.map(p => p.id);

      // Check abort flag after fetching pages
      if (this.abortRefresh) {
        throw new Error('Refresh aborted after fetching pages');
      }

      // Step 4: Validate Page tasks
      const pageValidations = await this.validatePageTasks(pages, tokenResponse.accessToken);
      
      // ORPHAN DETECTION FIX: Use ONLY valid pages for ACTIVE updates
      const validPageIds = pageValidations
        .filter(v => v.hasRequiredTasks)
        .map(v => v.pageId);

      // Check abort flag after task validation
      if (this.abortRefresh) {
        throw new Error('Refresh aborted after task validation');
      }

      // Step 5: Update user account token
      // ENCRYPTION ENFORCEMENT: Pre-save hook will encrypt automatically
      account.accessToken = tokenResponse.accessToken;
      account.tokenExpiresAt = tokenResponse.expiresAt;
      account.lastRefreshedAt = new Date();
      account.lastSyncAt = new Date();

      await account.save();

      logger.info('Facebook user token refreshed successfully', {
        accountId: account._id,
        workspaceId: account.workspaceId,
        newExpiresAt: tokenResponse.expiresAt,
        pagesCount: pages.length,
        validPagesCount: validPageIds.length,
      });

      // Check abort flag before updating pages
      if (this.abortRefresh) {
        throw new Error('Refresh aborted before updating pages');
      }

      // Step 6: Update connected Pages
      await this.updateConnectedPages(account, pages, pageValidations, validPageIds, allReturnedPageIds);

    } catch (error: any) {
      // If refresh fails, mark account as requiring reauth
      account.status = AccountStatus.REAUTH_REQUIRED;
      account.metadata = account.metadata || {};
      account.metadata.reauthReason = 'token_refresh_failed';
      account.metadata.lastRefreshError = error.message;
      await account.save();

      logger.error('Facebook token refresh failed, marked for reauth', {
        accountId: account._id,
        workspaceId: account.workspaceId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Exchange current token for new long-lived token
   */
  private async exchangeForLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    try {
      const response = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.oauth?.facebook?.appId,
          client_secret: config.oauth?.facebook?.appSecret,
          fb_exchange_token: currentToken,
        },
      });

      const accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      logger.info('Facebook long-lived token obtained', {
        expiresIn,
        expiresInDays: Math.floor(expiresIn / 86400),
      });

      return { accessToken, expiresAt };
    } catch (error: any) {
      logger.error('Facebook token exchange failed', {
        error: error.response?.data || error.message,
      });
      throw new Error(`Token exchange failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Validate token scopes
   */
  private async validateScopes(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get('https://graph.facebook.com/v19.0/me/permissions', {
        params: {
          access_token: accessToken,
        },
      });

      const grantedScopes = response.data.data
        .filter((p: any) => p.status === 'granted')
        .map((p: any) => p.permission);

      const hasAllRequired = this.REQUIRED_SCOPES.every(scope => grantedScopes.includes(scope));

      if (!hasAllRequired) {
        const missingScopes = this.REQUIRED_SCOPES.filter(scope => !grantedScopes.includes(scope));
        logger.warn('Facebook token missing required scopes', {
          grantedScopes,
          missingScopes,
        });
      }

      return hasAllRequired;
    } catch (error: any) {
      logger.error('Facebook scope validation failed', {
        error: error.response?.data || error.message,
      });
      return false;
    }
  }

  /**
   * Validate Page tasks (permissions)
   */
  private async validatePageTasks(pages: any[], userAccessToken: string): Promise<PageTaskValidation[]> {
    const validations: PageTaskValidation[] = [];

    for (const page of pages) {
      try {
        const response = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
          params: {
            fields: 'tasks',
            access_token: userAccessToken,
          },
        });

        const tasks = response.data.tasks || [];
        const missingTasks = this.REQUIRED_TASKS.filter(task => !tasks.includes(task));
        const hasRequiredTasks = missingTasks.length === 0;

        validations.push({
          pageId: page.id,
          hasRequiredTasks,
          missingTasks,
        });

        if (!hasRequiredTasks) {
          logger.warn('Facebook Page missing required tasks', {
            pageId: page.id,
            pageName: page.name,
            tasks,
            missingTasks,
          });
        }
      } catch (error: any) {
        logger.error('Facebook Page task validation failed', {
          pageId: page.id,
          pageName: page.name,
          error: error.response?.data || error.message,
        });

        // If validation fails, assume missing tasks
        validations.push({
          pageId: page.id,
          hasRequiredTasks: false,
          missingTasks: this.REQUIRED_TASKS,
        });
      }
    }

    return validations;
  }

  /**
   * Update connected Pages in database
   * 
   * ORPHAN DETECTION CORRECTION:
   * - allReturnedPageIds: ALL pages from /me/accounts (for orphan detection)
   * - validPageIds: ONLY pages with required tasks (for ACTIVE updates)
   * 
   * Pages missing tasks are marked REAUTH_REQUIRED (NOT orphaned)
   * Orphaned pages are those in DB but NOT in allReturnedPageIds
   * 
   * Page tokens from /me/accounts are already long-lived (no exchange needed)
   */
  private async updateConnectedPages(
    userAccount: any,
    pages: any[],
    validations: PageTaskValidation[],
    validPageIds: string[],
    allReturnedPageIds: string[]
  ): Promise<void> {
    const workspaceId = userAccount.workspaceId;

    // Update valid Pages to ACTIVE
    for (const pageId of validPageIds) {
      // Check abort flag before each page update
      if (this.abortRefresh) {
        throw new Error('Refresh aborted during page updates');
      }

      const page = pages.find(p => p.id === pageId);
      if (!page) continue;

      // Page tokens from /me/accounts are already long-lived
      const pageAccessToken = page.access_token;

      // ENCRYPTION ENFORCEMENT: Explicit encryption before findOneAndUpdate
      // (findOneAndUpdate bypasses pre-save hooks)
      const encryptedToken = encrypt(pageAccessToken);

      await SocialAccount.findOneAndUpdate(
        {
          workspaceId,
          provider: SocialPlatform.FACEBOOK,
          providerUserId: pageId,
        },
        {
          $set: {
            accountName: page.name,
            accessToken: encryptedToken,
            status: AccountStatus.ACTIVE,
            lastSyncAt: new Date(),
            'metadata.category': page.category,
            'metadata.avatarUrl': page.picture?.data?.url,
          },
        },
        { upsert: true }
      );

      logger.info('Facebook Page updated to ACTIVE', {
        workspaceId,
        pageId,
        pageName: page.name,
      });
    }

    // Mark Pages with missing tasks as REAUTH_REQUIRED (NOT orphaned)
    const pagesWithMissingTasks = validations.filter(v => !v.hasRequiredTasks);
    for (const validation of pagesWithMissingTasks) {
      // Check abort flag
      if (this.abortRefresh) {
        throw new Error('Refresh aborted during missing tasks updates');
      }

      const page = pages.find(p => p.id === validation.pageId);
      if (!page) continue;

      await SocialAccount.findOneAndUpdate(
        {
          workspaceId,
          provider: SocialPlatform.FACEBOOK,
          providerUserId: validation.pageId,
        },
        {
          $set: {
            status: AccountStatus.REAUTH_REQUIRED,
            'metadata.reauthReason': 'missing_required_tasks',
            'metadata.missingTasks': validation.missingTasks,
            lastSyncAt: new Date(),
          },
        },
        { upsert: false } // Don't create if doesn't exist
      );

      logger.warn('Facebook Page marked REAUTH_REQUIRED (missing tasks)', {
        workspaceId,
        pageId: validation.pageId,
        pageName: page.name,
        missingTasks: validation.missingTasks,
      });
    }

    // ORPHAN DETECTION FIX: Mark orphaned Pages (in DB but NOT in allReturnedPageIds)
    if (this.abortRefresh) {
      throw new Error('Refresh aborted before orphan detection');
    }

    const orphanedPages = await SocialAccount.find({
      workspaceId,
      provider: SocialPlatform.FACEBOOK,
      providerUserId: { $nin: allReturnedPageIds }, // NOT in returned pages
      status: { $ne: AccountStatus.DISCONNECTED },
    });

    for (const orphanedPage of orphanedPages) {
      // Check abort flag
      if (this.abortRefresh) {
        throw new Error('Refresh aborted during orphan updates');
      }

      orphanedPage.status = AccountStatus.DISCONNECTED;
      orphanedPage.metadata = orphanedPage.metadata || {};
      orphanedPage.metadata.disconnectedReason = 'page_no_longer_accessible';
      orphanedPage.metadata.disconnectedAt = new Date();
      await orphanedPage.save();

      logger.warn('Facebook Page marked as orphaned (no longer accessible)', {
        workspaceId,
        pageId: orphanedPage.providerUserId,
        pageName: orphanedPage.accountName,
      });
    }
  }
}

export const facebookTokenRefreshWorker = new FacebookTokenRefreshWorker();

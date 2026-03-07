/**
 * Duplicate Account Prevention Utility
 * 
 * Prevents duplicate Instagram accounts from being connected to the same workspace.
 * 
 * Rules:
 * - Check if workspace already has account with same provider + providerUserId
 * - Throw 409 Conflict if duplicate found
 * - Provide clear error message
 */

import { SocialAccount, ISocialAccount, SocialPlatform } from '../models/SocialAccount';
import { logger } from './logger';
import mongoose from 'mongoose';

export class DuplicateAccountError extends Error {
  public readonly statusCode: number = 409;
  public readonly provider: string;
  public readonly providerUserId: string;
  public readonly existingAccountId: string;

  constructor(provider: string, providerUserId: string, existingAccountId: string) {
    super(
      `This ${provider} account is already connected to this workspace. ` +
      `Please disconnect the existing account before connecting again.`
    );
    this.name = 'DuplicateAccountError';
    this.provider = provider;
    this.providerUserId = providerUserId;
    this.existingAccountId = existingAccountId;
  }
}

/**
 * Check if account already exists in workspace
 * 
 * @throws DuplicateAccountError if duplicate found
 */
export async function assertNoDuplicateAccount(
  workspaceId: mongoose.Types.ObjectId | string,
  provider: SocialPlatform,
  providerUserId: string
): Promise<void> {
  const existingAccount = await SocialAccount.findOne({
    workspaceId,
    provider,
    providerUserId,
  });

  if (existingAccount) {
    logger.warn('Duplicate account connection attempt', {
      workspaceId: workspaceId.toString(),
      provider,
      providerUserId,
      existingAccountId: existingAccount._id.toString(),
      existingAccountName: existingAccount.accountName,
    });

    // BLOCKER #4: Structured logging for duplicate account attempt
    logger.warn('[Security] DUPLICATE_ACCOUNT_ATTEMPT detected', {
      event: 'DUPLICATE_ACCOUNT_ATTEMPT',
      workspaceId: workspaceId.toString(),
      provider,
      providerUserId,
      existingAccountId: existingAccount._id.toString(),
      existingAccountName: existingAccount.accountName,
    });

    throw new DuplicateAccountError(
      provider,
      providerUserId,
      existingAccount._id.toString()
    );
  }

  logger.debug('No duplicate account found', {
    workspaceId: workspaceId.toString(),
    provider,
    providerUserId,
  });
}

/**
 * Check if account exists (non-throwing version)
 */
export async function isDuplicateAccount(
  workspaceId: mongoose.Types.ObjectId | string,
  provider: SocialPlatform,
  providerUserId: string
): Promise<boolean> {
  const existingAccount = await SocialAccount.findOne({
    workspaceId,
    provider,
    providerUserId,
  });

  return !!existingAccount;
}

/**
 * Get existing account if it exists
 */
export async function getExistingAccount(
  workspaceId: mongoose.Types.ObjectId | string,
  provider: SocialPlatform,
  providerUserId: string
): Promise<ISocialAccount | null> {
  return await SocialAccount.findOne({
    workspaceId,
    provider,
    providerUserId,
  });
}

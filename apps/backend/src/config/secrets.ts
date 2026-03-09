/**
 * Secrets Manager
 * 
 * Loads secrets from AWS Secrets Manager in production
 * Falls back to process.env in development
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export class SecretsManager {
  private static instance: SecretsManager;
  private client: SecretsManagerClient | null = null;

  private constructor() {
    // Initialize AWS Secrets Manager client only in production
    if (process.env.NODE_ENV === 'production' && process.env.AWS_REGION) {
      this.client = new SecretsManagerClient({
        region: process.env.AWS_REGION,
      });
    }
  }

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Load secrets from AWS Secrets Manager
   * Merges loaded secrets into process.env
   */
  async loadSecrets(): Promise<void> {
    // Skip in development or if no secret name configured
    if (process.env.NODE_ENV !== 'production' || !process.env.AWS_SECRET_NAME) {
      console.log('[Secrets] Using environment variables (development mode)');
      return;
    }

    if (!this.client) {
      console.warn('[Secrets] AWS Secrets Manager client not initialized');
      return;
    }

    try {
      console.log('[Secrets] Loading secrets from AWS Secrets Manager...');
      
      const command = new GetSecretValueCommand({
        SecretId: process.env.AWS_SECRET_NAME,
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        console.warn('[Secrets] No secret string found in response');
        return;
      }

      // Parse secrets JSON
      const secrets = JSON.parse(response.SecretString);

      // Merge secrets into process.env (only if not already set)
      let mergedCount = 0;
      for (const [key, value] of Object.entries(secrets)) {
        if (!process.env[key] && typeof value === 'string') {
          process.env[key] = value;
          mergedCount++;
        }
      }

      console.log(`[Secrets] ✅ Loaded ${mergedCount} secrets from AWS Secrets Manager`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Secrets] ❌ Failed to load secrets from AWS Secrets Manager:', errorMessage);
      
      // In production, fail fast if secrets can't be loaded
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Failed to load secrets: ${errorMessage}`);
      }
    }
  }
}

/**
 * Load secrets before application starts
 * Call this as the first thing in server.ts
 */
export async function loadSecrets(): Promise<void> {
  const secretsManager = SecretsManager.getInstance();
  await secretsManager.loadSecrets();
}

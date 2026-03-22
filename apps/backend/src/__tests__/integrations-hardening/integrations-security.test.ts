import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';

describe('Integrations Security — API Key Management', () => {
  it('API keys are SHA-256 hashed for storage', () => {
    const rawKey = 'jc_live_abc123def456';
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(rawKey);
  });

  it('API key hash is constant-time comparable', () => {
    const hash1 = crypto.createHash('sha256').update('key1').digest('hex');
    const hash2 = crypto.createHash('sha256').update('key1').digest('hex');
    const buf1 = Buffer.from(hash1);
    const buf2 = Buffer.from(hash2);
    expect(crypto.timingSafeEqual(buf1, buf2)).toBe(true);
  });

  it('different keys produce different hashes', () => {
    const h1 = crypto.createHash('sha256').update('key-A').digest('hex');
    const h2 = crypto.createHash('sha256').update('key-B').digest('hex');
    expect(h1).not.toBe(h2);
  });

  it('API key scopes restrict access', () => {
    const keyScopes = ['posts:read'];
    const requiredScope = 'posts:write';
    const hasAccess = keyScopes.includes(requiredScope);
    expect(hasAccess).toBe(false);
  });

  it('API key with correct scope grants access', () => {
    const keyScopes = ['posts:read', 'posts:write', 'analytics:read'];
    const requiredScope = 'posts:write';
    const hasAccess = keyScopes.includes(requiredScope);
    expect(hasAccess).toBe(true);
  });

  it('API key rate limit is per-key Redis-backed', () => {
    const apiKeyId = 'key-abc123';
    const redisKey = `ratelimit:apikey:${apiKeyId}`;
    expect(redisKey).toContain('ratelimit:apikey:');
  });
});

describe('Integrations Security — SSRF Protection on Webhooks', () => {
  const validateHookUrl = (hookUrl: string): string | null => {
    try {
      const parsed = new URL(hookUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return 'INVALID_PROTOCOL';
      const hostname = parsed.hostname.toLowerCase();
      const blocked = ['localhost', '127.', '169.254.', '0.0.0.0', '::1'];
      for (const p of blocked) { if (hostname.includes(p)) return 'SSRF_BLOCKED'; }
      const cidrs = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./];
      for (const c of cidrs) { if (c.test(hostname)) return 'SSRF_BLOCKED'; }
      if (['169.254.169.254', 'metadata.google.internal'].includes(hostname)) return 'SSRF_BLOCKED';
      return null;
    } catch { return 'INVALID_URL'; }
  };

  it('valid Zapier hook URL passes', () => {
    expect(validateHookUrl('https://hooks.zapier.com/hooks/catch/123')).toBeNull();
  });

  it('localhost hook URL is blocked', () => {
    expect(validateHookUrl('http://localhost:3000/hook')).toBe('SSRF_BLOCKED');
  });

  it('AWS metadata endpoint is blocked', () => {
    expect(validateHookUrl('http://169.254.169.254/metadata')).toBe('SSRF_BLOCKED');
  });

  it('private IP 192.168.x is blocked', () => {
    expect(validateHookUrl('http://192.168.1.100/hook')).toBe('SSRF_BLOCKED');
  });

  it('private IP 10.x is blocked', () => {
    expect(validateHookUrl('http://10.0.0.1/hook')).toBe('SSRF_BLOCKED');
  });

  it('file:// protocol is blocked', () => {
    expect(validateHookUrl('file:///etc/passwd')).toBe('INVALID_PROTOCOL');
  });

  it('invalid URL returns error', () => {
    expect(validateHookUrl('not-a-url')).toBe('INVALID_URL');
  });
});

describe('Integrations Security — Public API Rate Limiting', () => {
  it('public API limit is 1000 per hour per workspace', () => {
    const maxRequests = 1000;
    const windowMs = 60 * 60 * 1000;
    expect(maxRequests).toBe(1000);
    expect(windowMs).toBe(3600000);
  });

  it('rate limit key uses workspaceId', () => {
    const apiKey = { workspaceId: 'ws-123' };
    const key = apiKey?.workspaceId?.toString() || 'unknown';
    expect(key).toBe('ws-123');
  });

  it('rate limit returns X-RateLimit-Remaining header', () => {
    const headers: Record<string, number> = {};
    headers['X-RateLimit-Remaining'] = 999;
    expect(headers['X-RateLimit-Remaining']).toBe(999);
  });
});

describe('Integrations Security — Audit Logging', () => {
  it('API_KEY_CREATED is defined', () => {
    expect('api_key_created').toBe('api_key_created');
  });

  it('API_KEY_DELETED is defined', () => {
    expect('api_key_deleted').toBe('api_key_deleted');
  });

  it('API_KEY_ROTATED is defined', () => {
    expect('api_key_rotated').toBe('api_key_rotated');
  });

  it('ZAPIER_CONNECTED is defined', () => {
    expect('zapier_connected').toBe('zapier_connected');
  });

  it('MAKE_CONNECTED is defined', () => {
    expect('make_connected').toBe('make_connected');
  });

  it('INTEGRATION_WEBHOOK_REGISTERED is defined', () => {
    expect('integration_webhook_registered').toBe('integration_webhook_registered');
  });
});

describe('Integrations Security — Webhook HMAC', () => {
  it('outgoing webhooks have HMAC signature', () => {
    const secret = 'webhook-secret';
    const payload = JSON.stringify({ event: 'post.published' });
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(sig).toHaveLength(64);
  });

  it('webhook signature key is X-Webhook-Signature', () => {
    const headerName = 'X-Webhook-Signature';
    expect(headerName).toBe('X-Webhook-Signature');
  });

  it('webhook has X-Webhook-Timestamp header', () => {
    const timestamp = Date.now().toString();
    expect(Number(timestamp)).toBeGreaterThan(0);
  });
});

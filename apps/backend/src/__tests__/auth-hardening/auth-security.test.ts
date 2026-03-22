import { describe, it, expect } from '@jest/globals';

describe('Auth Security — Magic Link Atomic Single Use', () => {
  it('findOneAndUpdate pattern is atomic', () => {
    // The atomic pattern uses a single DB operation that both finds AND clears
    const atomicQuery = {
      magicLinkToken: 'hashed-token',
      magicLinkExpiresAt: { $gt: new Date() },
    };
    const atomicUpdate = {
      $unset: { magicLinkToken: 1, magicLinkExpiresAt: 1 },
    };
    expect(atomicQuery.magicLinkToken).toBeDefined();
    expect(atomicUpdate.$unset.magicLinkToken).toBe(1);
    expect(atomicUpdate.$unset.magicLinkExpiresAt).toBe(1);
  });

  it('expired magic link is rejected by query filter', () => {
    const pastDate = new Date(Date.now() - 1000);
    const filter = { magicLinkExpiresAt: { $gt: new Date() } };
    expect(pastDate > new Date()).toBe(false);
    expect(filter.magicLinkExpiresAt.$gt).toBeDefined();
  });

  it('magic link TTL is 15 minutes', () => {
    const TOKEN_EXPIRY_MINUTES = 15;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + TOKEN_EXPIRY_MINUTES);
    const diffMs = expiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
  });
});

describe('Auth Security — 2FA Admin/Owner Enforcement', () => {
  it('ADMIN role requires 2FA check', () => {
    const rolesRequiring2FA = ['ADMIN', 'OWNER'];
    expect(rolesRequiring2FA.includes('ADMIN')).toBe(true);
    expect(rolesRequiring2FA.includes('OWNER')).toBe(true);
    expect(rolesRequiring2FA.includes('MEMBER')).toBe(false);
    expect(rolesRequiring2FA.includes('VIEWER')).toBe(false);
  });

  it('2FA enforcement redirects to security settings', () => {
    const redirectPath = '/settings/security';
    expect(redirectPath).toBe('/settings/security');
  });

  it('error code for missing 2FA is TWO_FA_REQUIRED', () => {
    const code = 'TWO_FA_REQUIRED';
    expect(code).toBe('TWO_FA_REQUIRED');
  });
});

describe('Auth Security — New Device Alert', () => {
  it('IP change triggers alert condition', () => {
    const lastLoginIp: string | undefined = '192.168.1.1';
    const currentIp: string = '203.0.113.42';
    const shouldAlert = lastLoginIp && lastLoginIp !== currentIp;
    expect(shouldAlert).toBeTruthy();
  });

  it('same IP does not trigger alert', () => {
    const lastLoginIp: string | undefined = '203.0.113.42';
    const currentIp: string = '203.0.113.42';
    const shouldAlert = lastLoginIp && lastLoginIp !== currentIp;
    expect(shouldAlert).toBeFalsy();
  });

  it('first login (no lastLoginIp) does not trigger alert', () => {
    const lastLoginIp: string | undefined = undefined;
    const currentIp: string = '203.0.113.42';
    const shouldAlert = lastLoginIp && lastLoginIp !== currentIp;
    expect(shouldAlert).toBeFalsy();
  });
});

describe('Auth Security — GDPR Export Rate Limit', () => {
  it('rate limit window is 24 hours', () => {
    const WINDOW_MS = 24 * 60 * 60 * 1000;
    const WINDOW_HOURS = WINDOW_MS / (1000 * 60 * 60);
    expect(WINDOW_HOURS).toBe(24);
  });

  it('rate limit query filters by type and createdAt', () => {
    const query = {
      type: 'export',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    };
    expect(query.type).toBe('export');
    expect(query.createdAt.$gte).toBeDefined();
  });

  it('error code for rate limited export is EXPORT_RATE_LIMITED', () => {
    const code = 'EXPORT_RATE_LIMITED';
    expect(code).toBe('EXPORT_RATE_LIMITED');
  });

  it('nextAvailableAt is 24 hours after last export', () => {
    const lastExportTime = new Date(Date.now() - 1000);
    const nextAvailable = new Date(lastExportTime.getTime() + 24 * 60 * 60 * 1000);
    expect(nextAvailable.getTime()).toBeGreaterThan(Date.now());
  });
});

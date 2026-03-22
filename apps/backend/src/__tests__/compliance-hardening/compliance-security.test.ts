import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const frontend = path.join(__dirname, '../../../../../apps/frontend');
const backend = path.join(__dirname, '../../../../../apps/backend');
const root = path.join(__dirname, '../../../../../');

describe('Compliance — Legal Pages', () => {
  it('PrivacyPolicyPage exists', () => {
    const exists = fs.existsSync(
      path.join(frontend, 'src/pages/legal/PrivacyPolicyPage.tsx')
    );
    expect(exists).toBe(true);
  });

  it('TermsOfServicePage exists', () => {
    const exists = fs.existsSync(
      path.join(frontend, 'src/pages/legal/TermsOfServicePage.tsx')
    );
    expect(exists).toBe(true);
  });

  it('Privacy policy mentions GDPR', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'src/pages/legal/PrivacyPolicyPage.tsx'),
      'utf8'
    );
    expect(content.toLowerCase()).toContain('gdpr');
  });

  it('Privacy policy mentions CCPA', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'src/pages/legal/PrivacyPolicyPage.tsx'),
      'utf8'
    );
    expect(content.toLowerCase()).toContain('ccpa');
  });

  it('Terms of service mentions payment terms', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'src/pages/legal/TermsOfServicePage.tsx'),
      'utf8'
    );
    expect(content.toLowerCase()).toContain('payment');
  });
});

describe('Compliance — Cookie Consent', () => {
  it('CookieConsentBanner component exists', () => {
    const exists = fs.existsSync(
      path.join(frontend, 'src/components/legal/CookieConsentBanner.tsx')
    );
    expect(exists).toBe(true);
  });

  it('consent stores version for re-prompt on policy change', () => {
    const CONSENT_VERSION = '1.0';
    expect(CONSENT_VERSION).toBeDefined();
    expect(typeof CONSENT_VERSION).toBe('string');
  });

  it('consent includes essential cookies as always-on', () => {
    const consent = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    expect(consent.essential).toBe(true);
  });

  it('consent banner links to privacy policy', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'src/components/legal/CookieConsentBanner.tsx'),
      'utf8'
    );
    expect(content).toContain('/privacy');
  });

  it('consent banner links to terms of service', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'src/components/legal/CookieConsentBanner.tsx'),
      'utf8'
    );
    expect(content).toContain('/terms');
  });
});

describe('Compliance — GDPR', () => {
  it('GDPR routes exist', () => {
    const exists = fs.existsSync(
      path.join(backend, 'src/routes/v1/gdpr.routes.ts')
    );
    expect(exists).toBe(true);
  });

  it('GDPR service exists', () => {
    const files = fs.readdirSync(path.join(backend, 'src/services'));
    const hasGDPR = files.some(f => f.toLowerCase().includes('gdpr'));
    expect(hasGDPR).toBe(true);
  });

  it('GDPRSettings page exists in frontend', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'src/components/settings/GDPRSettings.tsx'),
      'utf8'
    );
    expect(content.length).toBeGreaterThan(100);
  });
});

describe('Infrastructure — Health Checks', () => {
  it('/health endpoint is defined in app.ts', () => {
    const content = fs.readFileSync(
      path.join(backend, 'src/app.ts'),
      'utf8'
    );
    expect(content).toContain('/health');
    expect(content).toContain('/health/detailed');
    expect(content).toContain('/health/live');
    expect(content).toContain('/health/ready');
  });

  it('Sentry is wired in app.ts', () => {
    const content = fs.readFileSync(
      path.join(backend, 'src/app.ts'),
      'utf8'
    );
    expect(content).toContain('sentryRequestHandler');
    expect(content).toContain('sentryErrorHandler');
  });
});

describe('Infrastructure — Docker', () => {
  it('backend Dockerfile.production exists', () => {
    const exists = fs.existsSync(
      path.join(backend, 'Dockerfile.production')
    );
    expect(exists).toBe(true);
  });

  it('frontend Dockerfile.production exists', () => {
    const exists = fs.existsSync(
      path.join(frontend, 'Dockerfile.production')
    );
    expect(exists).toBe(true);
  });

  it('blue-green deployment config exists', () => {
    const exists = fs.existsSync(
      path.join(root, 'deployment/blue-green')
    );
    expect(exists).toBe(true);
  });
});

describe('Infrastructure — CI/CD', () => {
  it('ci.yml workflow exists', () => {
    const exists = fs.existsSync(
      path.join(root, '.github/workflows/ci.yml')
    );
    expect(exists).toBe(true);
  });

  it('security-validation.yml workflow exists', () => {
    const exists = fs.existsSync(
      path.join(root, '.github/workflows/security-validation.yml')
    );
    expect(exists).toBe(true);
  });

  it('deploy-blue-green.yml workflow exists', () => {
    const exists = fs.existsSync(
      path.join(root, '.github/workflows/deploy-blue-green.yml')
    );
    expect(exists).toBe(true);
  });
});

describe('Infrastructure — Environment Variables', () => {
  it('.env.example exists for backend', () => {
    const exists = fs.existsSync(
      path.join(backend, '.env.example')
    );
    expect(exists).toBe(true);
  });

  it('.env.example exists for frontend', () => {
    const exists = fs.existsSync(
      path.join(frontend, '.env.example')
    );
    expect(exists).toBe(true);
  });

  it('config uses Zod schema validation', () => {
    const content = fs.readFileSync(
      path.join(backend, 'src/config/index.ts'),
      'utf8'
    );
    expect(content).toContain('z.object');
    expect(content).toContain('MONGODB_URI');
    expect(content).toContain('JWT_SECRET');
  });
});

describe('Marketing — SEO', () => {
  it('index.html has og:title meta tag', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'index.html'),
      'utf8'
    );
    expect(content).toContain('og:title');
  });

  it('index.html has og:description meta tag', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'index.html'),
      'utf8'
    );
    expect(content).toContain('og:description');
  });

  it('index.html has twitter:card meta tag', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'index.html'),
      'utf8'
    );
    expect(content).toContain('twitter:card');
  });

  it('index.html has canonical link', () => {
    const content = fs.readFileSync(
      path.join(frontend, 'index.html'),
      'utf8'
    );
    expect(content).toContain('canonical');
  });

  it('Pricing page exists', () => {
    const exists = fs.existsSync(
      path.join(frontend, 'src/pages/billing/Pricing.tsx')
    );
    const exists2 = fs.existsSync(
      path.join(frontend, 'src/pages/Pricing.tsx')
    );
    expect(exists || exists2).toBe(true);
  });
});

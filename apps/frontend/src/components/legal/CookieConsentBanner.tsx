import { useState, useEffect } from 'react';

const CONSENT_KEY = 'jc_cookie_consent';
const CONSENT_VERSION = '1.0';

interface ConsentPreferences {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  version: string;
  timestamp: string;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    analytics: false,
    marketing: false,
    functional: true,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) {
        setVisible(true);
      } else {
        const parsed = JSON.parse(stored) as ConsentPreferences;
        if (parsed.version !== CONSENT_VERSION) {
          setVisible(true);
        }
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const saveConsent = (acceptAll: boolean) => {
    const consent: ConsentPreferences = {
      essential: true,
      analytics: acceptAll || preferences.analytics,
      marketing: acceptAll || preferences.marketing,
      functional: acceptAll || preferences.functional,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="true"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--color-background-primary, #fff)',
        borderTop: '1px solid var(--color-border-tertiary, #e5e7eb)',
        padding: '1rem 1.5rem',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ fontSize: '14px', marginBottom: '0.75rem', color: 'var(--color-text-primary)' }}>
          We use cookies to improve your experience. Essential cookies are always active.
          {' '}
          <a href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Privacy Policy
          </a>
          {' · '}
          <a href="/terms" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Terms of Service
          </a>
        </p>

        {showDetails && (
          <div style={{ marginBottom: '0.75rem', fontSize: '13px' }}>
            {(['analytics', 'marketing', 'functional'] as const).map(type => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <input
                  type="checkbox"
                  checked={preferences[type]}
                  onChange={e => setPreferences(p => ({ ...p, [type]: e.target.checked }))}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)} cookies
              </label>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => saveConsent(true)}
            style={{
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 16px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Accept all
          </button>
          <button
            onClick={() => saveConsent(false)}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border-tertiary, #e5e7eb)',
              borderRadius: '6px',
              padding: '6px 16px',
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
            }}
          >
            Essential only
          </button>
          <button
            onClick={() => setShowDetails(v => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--color-text-secondary, #6b7280)',
              textDecoration: 'underline',
            }}
          >
            {showDetails ? 'Hide options' : 'Manage preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}

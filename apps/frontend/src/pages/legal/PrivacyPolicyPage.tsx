export function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '1rem' }}>
        Privacy Policy
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Last updated: {new Date().getFullYear()}
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          1. Information We Collect
        </h2>
        <p>We collect information you provide directly, including name, email address, and payment information when you register and subscribe to our service.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          2. How We Use Your Information
        </h2>
        <p>We use your information to provide and improve our social media management service, process payments, and send transactional emails.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          3. GDPR Rights (EU Users)
        </h2>
        <p>If you are located in the European Union, you have the right to access, rectify, erase, and port your personal data. Contact us at privacy@yourapp.com or use the data settings in your account.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          4. CCPA Rights (California Users)
        </h2>
        <p>California residents have the right to know what personal information we collect, the right to delete it, and the right to opt out of its sale. We do not sell personal information.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          5. Cookies
        </h2>
        <p>We use essential cookies for authentication and optional analytics cookies. You can manage your cookie preferences at any time via the cookie banner.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          6. Contact
        </h2>
        <p>For privacy inquiries: privacy@yourapp.com</p>
      </section>
    </div>
  );
}

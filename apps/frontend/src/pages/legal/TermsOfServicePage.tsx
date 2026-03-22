export function TermsOfServicePage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '1rem' }}>
        Terms of Service
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Last updated: {new Date().getFullYear()}
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          1. Acceptance of Terms
        </h2>
        <p>By accessing and using this service, you accept and agree to be bound by these Terms of Service.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          2. Service Description
        </h2>
        <p>We provide a social media scheduling and management platform that allows you to create, schedule, and publish content across multiple social media platforms.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          3. User Responsibilities
        </h2>
        <p>You are responsible for all content posted through our service. You must comply with the terms of service of each social media platform you connect.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          4. Payment Terms
        </h2>
        <p>Paid subscriptions are billed in advance. Refunds are provided in accordance with our refund policy. We reserve the right to change pricing with 30 days notice.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          5. Termination
        </h2>
        <p>Either party may terminate this agreement at any time. Upon termination, your data will be retained for 30 days before deletion per our GDPR policy.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          6. Contact
        </h2>
        <p>For legal inquiries: legal@yourapp.com</p>
      </section>
    </div>
  );
}

/**
 * PII Scrubber Tests
 */

import { scrubPii } from '../../utils/piiScrubber';

describe('PII Scrubber', () => {
  it('should scrub email addresses from text', () => {
    const result = scrubPii('contact me at test@example.com');
    expect(result).toBe('contact me at [EMAIL]');
  });

  it('should scrub phone numbers from text', () => {
    const result = scrubPii('call 555-123-4567');
    expect(result).toBe('call [PHONE]');
  });

  it('should scrub credit card numbers from text', () => {
    const result = scrubPii('card: 4111 1111 1111 1111');
    expect(result).toBe('card: [CARD]');
  });

  it('should scrub SSN from text', () => {
    const result = scrubPii('ssn: 123-45-6789');
    expect(result).toBe('ssn: [SSN]');
  });

  it('should NOT replace email in URLs', () => {
    const result = scrubPii('visit https://user@example.com/path');
    expect(result).toBe('visit https://user@example.com/path');
  });

  it('should return empty string for empty input', () => {
    const result = scrubPii('');
    expect(result).toBe('');
  });

  it('should return null for null input', () => {
    const result = scrubPii(null as any);
    expect(result).toBe(null);
  });

  it('should return text unchanged when no PII present', () => {
    const result = scrubPii('no pii here');
    expect(result).toBe('no pii here');
  });

  it('should scrub multiple emails in one text', () => {
    const result = scrubPii('Contact alice@example.com or bob@test.org');
    expect(result).toBe('Contact [EMAIL] or [EMAIL]');
  });

  it('should scrub phone numbers with different formats', () => {
    expect(scrubPii('(555) 123-4567').trim()).toBe('[PHONE]');
    expect(scrubPii('555.123.4567').trim()).toBe('[PHONE]');
    expect(scrubPii('+1 555-123-4567').trim()).toBe('[PHONE]');
  });
});

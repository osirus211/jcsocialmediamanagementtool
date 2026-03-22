/**
 * PII Scrubber Utility
 * Removes personally identifiable information from text
 */

export function scrubPii(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Email — do not match inside URLs (check for :// before @)
  let scrubbed = text.replace(/\b(?<!:\/\/)([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g, (match, p1, offset) => {
    // Check if there's :// within 10 chars before the match
    const before = text.substring(Math.max(0, offset - 10), offset);
    if (before.includes('://')) {
      return match;
    }
    return '[EMAIL]';
  });

  // Phone numbers (US + international formats) - capture surrounding space
  scrubbed = scrubbed.replace(/(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/g, ' [PHONE]');

  // Credit card numbers (13-19 digits, optionally space/dash separated)
  scrubbed = scrubbed.replace(/\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4})\b/g, '[CARD]');

  // US SSN
  scrubbed = scrubbed.replace(/\b(\d{3}[-\s]?\d{2}[-\s]?\d{4})\b/g, '[SSN]');

  return scrubbed;
}

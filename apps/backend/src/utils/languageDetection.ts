/**
 * Simple Language Detection Utility
 * 
 * Provides basic language detection for captions
 */

interface LanguagePattern {
  code: string;
  name: string;
  patterns: RegExp[];
  commonWords: string[];
}

const LANGUAGE_PATTERNS: LanguagePattern[] = [
  {
    code: 'en',
    name: 'English',
    patterns: [
      /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
      /\b(this|that|these|those|what|when|where|why|how)\b/gi,
    ],
    commonWords: ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'have', 'has', 'had']
  },
  {
    code: 'es',
    name: 'Spanish',
    patterns: [
      /\b(el|la|los|las|un|una|y|o|pero|en|con|de|por|para)\b/gi,
      /\b(que|como|cuando|donde|porque|si|no|sí)\b/gi,
    ],
    commonWords: ['el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'en', 'con', 'de', 'por', 'para', 'que', 'es', 'son', 'está', 'están']
  },
  {
    code: 'fr',
    name: 'French',
    patterns: [
      /\b(le|la|les|un|une|et|ou|mais|dans|avec|de|par|pour)\b/gi,
      /\b(que|comme|quand|où|pourquoi|si|non|oui)\b/gi,
    ],
    commonWords: ['le', 'la', 'les', 'un', 'une', 'et', 'ou', 'mais', 'dans', 'avec', 'de', 'par', 'pour', 'que', 'est', 'sont', 'c\'est']
  },
  {
    code: 'de',
    name: 'German',
    patterns: [
      /\b(der|die|das|ein|eine|und|oder|aber|in|mit|von|für)\b/gi,
      /\b(dass|wie|wenn|wo|warum|ob|nicht|ja)\b/gi,
    ],
    commonWords: ['der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'aber', 'in', 'mit', 'von', 'für', 'ist', 'sind', 'war', 'waren']
  },
  {
    code: 'pt',
    name: 'Portuguese',
    patterns: [
      /\b(o|a|os|as|um|uma|e|ou|mas|em|com|de|por|para)\b/gi,
      /\b(que|como|quando|onde|porque|se|não|sim)\b/gi,
    ],
    commonWords: ['o', 'a', 'os', 'as', 'um', 'uma', 'e', 'ou', 'mas', 'em', 'com', 'de', 'por', 'para', 'que', 'é', 'são', 'está', 'estão']
  }
];

/**
 * Detect the language of a text string
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'en'; // Default to English
  }

  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = cleanText.split(/\s+/).filter(word => word.length > 1);

  if (words.length === 0) {
    return 'en';
  }

  const scores: { [key: string]: number } = {};

  // Initialize scores
  LANGUAGE_PATTERNS.forEach(lang => {
    scores[lang.code] = 0;
  });

  // Score based on pattern matches
  LANGUAGE_PATTERNS.forEach(lang => {
    lang.patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        scores[lang.code] += matches.length * 2; // Pattern matches are weighted higher
      }
    });

    // Score based on common words
    lang.commonWords.forEach(commonWord => {
      const wordCount = words.filter(word => word === commonWord).length;
      scores[lang.code] += wordCount;
    });
  });

  // Find the language with the highest score
  let maxScore = 0;
  let detectedLanguage = 'en';

  Object.entries(scores).forEach(([langCode, score]) => {
    if (score > maxScore) {
      maxScore = score;
      detectedLanguage = langCode;
    }
  });

  // If no clear winner, default to English
  return maxScore > 0 ? detectedLanguage : 'en';
}

/**
 * Get language name from code
 */
export function getLanguageName(code: string): string {
  const lang = LANGUAGE_PATTERNS.find(l => l.code === code);
  return lang ? lang.name : 'English';
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): { code: string; name: string }[] {
  return LANGUAGE_PATTERNS.map(lang => ({
    code: lang.code,
    name: lang.name
  }));
}
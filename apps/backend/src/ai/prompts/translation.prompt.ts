/**
 * Translation Prompts
 */

export interface TranslationInput {
  content: string;
  targetLanguage: string;
  sourceLanguage?: string;
  platform?: string;
  preserveHashtags?: boolean;
  preserveEmojis?: boolean;
}

export function buildTranslationPrompt(input: TranslationInput): string {
  const hashtagNote = input.preserveHashtags
    ? 'Preserve all hashtags (#example) exactly as-is without translating them.'
    : 'Translate hashtags if they contain meaningful words.';

  const emojiNote = input.preserveEmojis
    ? 'Preserve all emojis exactly as they appear.'
    : '';

  const platformNote = input.platform
    ? `This content is for ${input.platform}. Maintain platform-appropriate tone and length constraints.`
    : '';

  const sourceLang = input.sourceLanguage
    ? `from ${input.sourceLanguage}`
    : '(auto-detect source language)';

  return `Translate the following social media content ${sourceLang} to ${input.targetLanguage}.

Requirements:
- Produce a natural, fluent translation that sounds native in ${input.targetLanguage}
- Maintain the original tone, style, and intent
- ${hashtagNote}
- ${emojiNote}
- ${platformNote}
- Return ONLY the translated text with no explanation or preamble

Content to translate:
${input.content}`;
}

/**
 * Brand Voice Analysis Prompts
 * Analyzes sample content to extract brand voice characteristics
 */

import { BrandVoiceInput } from '../types';

export function buildBrandVoicePrompt(input: BrandVoiceInput): string {
  const { sampleContent, industry, targetAudience, brandPersonality } = input;

  let prompt = `Analyze the following sample social media content to identify the brand's unique voice and writing style.

Sample Content:
${sampleContent.map((content, index) => `${index + 1}. ${content}`).join('\n')}

Please analyze and extract:
1. Overall tone (e.g., professional, casual, friendly, humorous, inspirational)
2. Writing style (e.g., conversational, formal, storytelling, direct)
3. Common vocabulary and key terms used
4. Signature phrases or expressions
5. Sentence structure patterns
6. Emoji usage patterns
7. Hashtag style preferences

Return your analysis in the following JSON format:
{
  "tone": "primary tone identified",
  "style": "writing style description", 
  "vocabulary": ["key", "terms", "frequently", "used"],
  "phrases": ["signature phrases", "common expressions"],
  "patterns": {
    "sentenceLength": "short/medium/long",
    "emojiUsage": "frequent/moderate/minimal",
    "hashtagStyle": "description of hashtag preferences"
  }
}`;

  if (industry) {
    prompt += `\n\nIndustry Context: ${industry}`;
  }

  if (targetAudience) {
    prompt += `\n\nTarget Audience: ${targetAudience}`;
  }

  if (brandPersonality && brandPersonality.length > 0) {
    prompt += `\n\nBrand Personality Traits: ${brandPersonality.join(', ')}`;
  }

  prompt += `\n\nFocus on identifying unique characteristics that make this brand's voice distinctive and memorable.`;

  return prompt;
}
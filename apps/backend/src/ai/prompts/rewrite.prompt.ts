/**
 * Content Rewrite Prompts
 */

import { RewriteInput, ContentTone, SocialPlatform } from '../types';

const TONE_DESCRIPTIONS: Record<ContentTone, string> = {
  [ContentTone.PROFESSIONAL]: 'professional, authoritative, and business-focused',
  [ContentTone.CASUAL]: 'casual, relaxed, and conversational',
  [ContentTone.FRIENDLY]: 'warm, approachable, and personable',
  [ContentTone.VIRAL]: 'attention-grabbing, shareable, and trending',
  [ContentTone.MARKETING]: 'persuasive, benefit-driven, and action-oriented',
  [ContentTone.HUMOROUS]: 'funny, witty, and entertaining',
  [ContentTone.INSPIRATIONAL]: 'motivational, uplifting, and empowering',
};

export function buildRewritePrompt(input: RewriteInput): string {
  const { content, instruction, tone, platform } = input;

  let prompt = `Rewrite the following social media content based on these instructions:

Original Content: "${content}"

Instruction: ${instruction}`;

  if (tone) {
    prompt += `\nTone: ${TONE_DESCRIPTIONS[tone]}`;
  }

  if (platform) {
    prompt += `\nPlatform: ${platform} (optimize for this platform's best practices)`;
  }

  prompt += `\n\nRequirements:
- Maintain the core message
- Improve clarity and engagement
- Keep it natural and authentic
- Avoid controversial or unsafe content
- Make it ready to post

Return ONLY the rewritten content, no explanations.`;

  return prompt;
}

export function buildImprovePrompt(content: string, platform?: SocialPlatform): string {
  let prompt = `Improve this social media post for better engagement and clarity:

Original: "${content}"

Make it:
- More engaging and compelling
- Clearer and easier to read
- More action-oriented
- Better formatted`;

  if (platform) {
    prompt += `\n- Optimized for ${platform}`;
  }

  prompt += `\n\nReturn ONLY the improved content, no explanations.`;

  return prompt;
}

export function buildShortenPrompt(content: string, maxLength: number): string {
  return `Shorten this social media post to ${maxLength} characters or less while keeping the key message:

Original: "${content}"

Requirements:
- Maximum ${maxLength} characters
- Keep the core message
- Maintain engagement
- Stay natural

Return ONLY the shortened content, no explanations.`;
}

export function buildExpandPrompt(content: string): string {
  return `Expand this social media post with more detail and context:

Original: "${content}"

Requirements:
- Add relevant details
- Maintain the tone
- Make it more informative
- Keep it engaging

Return ONLY the expanded content, no explanations.`;
}

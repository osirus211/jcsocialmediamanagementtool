/**
 * Image Caption Generation Prompts
 * Vision AI prompts for generating captions from images
 */

import { ImageCaptionInput, ContentTone, ContentLength, SocialPlatform } from '../types';

const TONE_DESCRIPTIONS: Record<ContentTone, string> = {
  [ContentTone.PROFESSIONAL]: 'professional, authoritative, and business-focused',
  [ContentTone.CASUAL]: 'casual, relaxed, and conversational',
  [ContentTone.FRIENDLY]: 'warm, approachable, and personable',
  [ContentTone.VIRAL]: 'attention-grabbing, shareable, and trending',
  [ContentTone.MARKETING]: 'persuasive, benefit-driven, and action-oriented',
  [ContentTone.HUMOROUS]: 'funny, witty, and entertaining',
  [ContentTone.INSPIRATIONAL]: 'motivational, uplifting, and empowering',
};

const LENGTH_GUIDELINES: Record<ContentLength, { min: number; max: number; description: string }> = {
  [ContentLength.SHORT]: { min: 50, max: 100, description: 'concise and punchy' },
  [ContentLength.MEDIUM]: { min: 100, max: 200, description: 'balanced and informative' },
  [ContentLength.LONG]: { min: 200, max: 280, description: 'detailed and comprehensive' },
};

const PLATFORM_GUIDELINES: Record<SocialPlatform, string> = {
  [SocialPlatform.TWITTER]: 'Twitter/X (max 280 characters, use hashtags sparingly, be concise)',
  [SocialPlatform.LINKEDIN]: 'LinkedIn (professional, value-driven, can be longer, use line breaks)',
  [SocialPlatform.FACEBOOK]: 'Facebook (conversational, engaging, can include questions)',
  [SocialPlatform.INSTAGRAM]: 'Instagram (visual-first, use emojis, hashtags at end)',
  [SocialPlatform.YOUTUBE]: 'YouTube (descriptive, engaging, can be longer for video descriptions)',
  [SocialPlatform.THREADS]: 'Threads (conversational, Twitter-like, max 500 characters)',
  [SocialPlatform.BLUESKY]: 'Bluesky (Twitter-like, max 300 characters, community-focused)',
  [SocialPlatform.GOOGLE_BUSINESS]: 'Google Business (informative, local-focused, professional)',
  [SocialPlatform.TIKTOK]: 'TikTok (trendy, engaging, use trending hashtags and sounds)',
  [SocialPlatform.PINTEREST]: 'Pinterest (descriptive, keyword-rich, inspiration-focused)',
};

export function buildImageCaptionPrompt(input: ImageCaptionInput): string {
  const { platform, tone, length, keywords, context } = input;

  const toneDesc = TONE_DESCRIPTIONS[tone];
  const lengthGuide = LENGTH_GUIDELINES[length];
  const platformGuide = PLATFORM_GUIDELINES[platform];

  let prompt = `Analyze this image and generate a ${toneDesc} social media caption for ${platformGuide}.

Requirements:
- Tone: ${toneDesc}
- Length: ${lengthGuide.description} (${lengthGuide.min}-${lengthGuide.max} characters)
- Platform: ${platform}
- Describe what you see in the image and create engaging content around it
- Include appropriate emojis where suitable
- Make it ready to post and engaging
- Avoid controversial or unsafe content`;

  if (keywords && keywords.length > 0) {
    prompt += `\n- Include these keywords naturally: ${keywords.join(', ')}`;
  }

  if (context) {
    prompt += `\n\nAdditional context about the image or brand: ${context}`;
  }

  prompt += `\n\nGenerate ONLY the caption text, no explanations or meta-commentary.`;

  return prompt;
}
/**
 * Content Suggestion Prompts
 */

import { SuggestionInput, SocialPlatform } from '../types';

export function buildSuggestionPrompt(input: SuggestionInput): string {
  const { caption, platform, type } = input;

  switch (type) {
    case 'cta':
      return buildCTAPrompt(caption, platform);
    case 'hook':
      return buildHookPrompt(caption, platform);
    case 'timing':
      return buildTimingPrompt(platform);
    case 'style':
      return buildStylePrompt(caption, platform);
    default:
      return buildGeneralSuggestionPrompt(caption, platform);
  }
}

function buildCTAPrompt(caption?: string, platform?: SocialPlatform): string {
  let prompt = `Generate 5 compelling call-to-action (CTA) suggestions for a social media post`;

  if (platform) {
    prompt += ` on ${platform}`;
  }

  if (caption) {
    prompt += `.\n\nPost content: "${caption}"`;
  }

  prompt += `\n\nRequirements:
- Action-oriented and clear
- Encourage engagement (likes, comments, shares, clicks)
- Varied approaches (questions, commands, invitations)
- Natural and not pushy

Return as a numbered list (1-5), one CTA per line.`;

  return prompt;
}

function buildHookPrompt(caption?: string, platform?: SocialPlatform): string {
  let prompt = `Generate 5 attention-grabbing opening hooks for a social media post`;

  if (platform) {
    prompt += ` on ${platform}`;
  }

  if (caption) {
    prompt += `.\n\nPost topic: "${caption}"`;
  }

  prompt += `\n\nRequirements:
- Grab attention in first 5 words
- Create curiosity or intrigue
- Relevant to the content
- Varied styles (question, statement, statistic, story)

Return as a numbered list (1-5), one hook per line.`;

  return prompt;
}

function buildTimingPrompt(platform?: SocialPlatform): string {
  let prompt = `Suggest optimal posting times`;

  if (platform) {
    prompt += ` for ${platform}`;
  }

  prompt += ` based on general best practices and audience engagement patterns.

Provide:
- Best days of the week
- Best times of day (with timezone considerations)
- Why these times work
- Any platform-specific insights

Return as a concise, actionable list.`;

  return prompt;
}

function buildStylePrompt(caption?: string, platform?: SocialPlatform): string {
  let prompt = `Analyze this social media post and suggest style improvements`;

  if (platform) {
    prompt += ` for ${platform}`;
  }

  if (caption) {
    prompt += `:\n\n"${caption}"`;
  }

  prompt += `\n\nProvide 5 specific suggestions for:
- Formatting improvements
- Emoji usage
- Tone adjustments
- Engagement tactics
- Platform optimization

Return as a numbered list (1-5), one suggestion per line.`;

  return prompt;
}

function buildGeneralSuggestionPrompt(caption?: string, platform?: SocialPlatform): string {
  let prompt = `Provide 5 actionable suggestions to improve this social media post`;

  if (platform) {
    prompt += ` on ${platform}`;
  }

  if (caption) {
    prompt += `:\n\n"${caption}"`;
  }

  prompt += `\n\nSuggestions should cover:
- Content improvements
- Engagement tactics
- Formatting tips
- Platform best practices
- Call-to-action ideas

Return as a numbered list (1-5), one suggestion per line.`;

  return prompt;
}

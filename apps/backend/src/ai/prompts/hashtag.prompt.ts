/**
 * Hashtag Generation Prompts
 */

import { HashtagGenerationInput, SocialPlatform } from '../types';

const PLATFORM_HASHTAG_GUIDELINES: Record<SocialPlatform, string> = {
  [SocialPlatform.TWITTER]: '2-3 relevant hashtags (Twitter users prefer fewer hashtags)',
  [SocialPlatform.LINKEDIN]: '3-5 professional hashtags (LinkedIn favors quality over quantity)',
  [SocialPlatform.FACEBOOK]: '2-3 hashtags (Facebook posts work well with minimal hashtags)',
  [SocialPlatform.INSTAGRAM]: '10-15 hashtags (Instagram allows and benefits from more hashtags)',
  [SocialPlatform.YOUTUBE]: '5-8 hashtags (YouTube supports hashtags in descriptions)',
  [SocialPlatform.THREADS]: '2-4 hashtags (Threads follows Twitter-like conventions)',
  [SocialPlatform.BLUESKY]: '2-3 hashtags (Bluesky prefers minimal hashtag usage)',
  [SocialPlatform.GOOGLE_BUSINESS]: '3-5 hashtags (Google Business posts benefit from local hashtags)',
  [SocialPlatform.TIKTOK]: '5-10 hashtags (TikTok thrives on trending and niche hashtags)',
  [SocialPlatform.PINTEREST]: '8-12 hashtags (Pinterest benefits from descriptive hashtags)',
};

export function buildHashtagPrompt(input: HashtagGenerationInput): string {
  const { caption, platform, niche, count } = input;

  const platformGuide = PLATFORM_HASHTAG_GUIDELINES[platform];
  const hashtagCount = count || getDefaultHashtagCount(platform);

  let prompt = `Generate ${hashtagCount} relevant hashtags for this social media post on ${platform}.

Caption: "${caption}"

Requirements:
- Platform: ${platform} (${platformGuide})
- Generate exactly ${hashtagCount} hashtags
- Mix of popular and niche-specific hashtags
- Avoid spam or overly generic hashtags
- Hashtags should be relevant to the content
- Use proper capitalization (CamelCase for readability)`;

  if (niche) {
    prompt += `\n- Niche/Industry: ${niche}`;
  }

  prompt += `\n\nReturn ONLY the hashtags separated by spaces, starting with #. No explanations.
Example format: #HashtagOne #HashtagTwo #HashtagThree`;

  return prompt;
}

function getDefaultHashtagCount(platform: SocialPlatform): number {
  switch (platform) {
    case SocialPlatform.TWITTER:
      return 3;
    case SocialPlatform.LINKEDIN:
      return 5;
    case SocialPlatform.FACEBOOK:
      return 3;
    case SocialPlatform.INSTAGRAM:
      return 12;
    case SocialPlatform.YOUTUBE:
      return 6;
    case SocialPlatform.THREADS:
      return 3;
    case SocialPlatform.BLUESKY:
      return 3;
    case SocialPlatform.GOOGLE_BUSINESS:
      return 4;
    case SocialPlatform.TIKTOK:
      return 7;
    case SocialPlatform.PINTEREST:
      return 10;
    default:
      return 5;
  }
}

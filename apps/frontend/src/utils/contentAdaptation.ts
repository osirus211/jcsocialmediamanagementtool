import { SocialPlatform, PLATFORM_LIMITS } from '@/types/composer.types';

interface ContentAdaptationOptions {
  truncateForTwitter?: boolean;
  expandForLinkedIn?: boolean;
  addHashtagsForInstagram?: boolean;
  formalizeForLinkedIn?: boolean;
}

/**
 * Auto-adapt content for different platforms
 */
export function adaptContentForPlatform(
  content: string,
  platform: SocialPlatform,
  options: ContentAdaptationOptions = {}
): string {
  const limit = PLATFORM_LIMITS[platform];
  let adaptedContent = content;

  switch (platform) {
    case 'twitter':
      if (options.truncateForTwitter && content.length > limit) {
        // Truncate and add ellipsis, leaving room for link
        adaptedContent = content.substring(0, limit - 20) + '...';
      }
      break;

    case 'linkedin':
      if (options.expandForLinkedIn) {
        // Add professional context
        if (!content.includes('professional') && !content.includes('career')) {
          adaptedContent = addProfessionalContext(content);
        }
      }
      if (options.formalizeForLinkedIn) {
        adaptedContent = formalizeTone(adaptedContent);
      }
      break;

    case 'instagram':
      if (options.addHashtagsForInstagram) {
        adaptedContent = addRelevantHashtags(content);
      }
      break;

    case 'facebook':
      // Facebook allows longer content, can be more conversational
      adaptedContent = makeConversational(content);
      break;

    case 'threads':
      // Similar to Twitter but slightly longer
      if (content.length > limit) {
        adaptedContent = content.substring(0, limit - 10) + '...';
      }
      break;

    case 'bluesky':
      // Similar to Twitter
      if (content.length > limit) {
        adaptedContent = content.substring(0, limit - 10) + '...';
      }
      break;

    case 'youtube':
      // YouTube descriptions can be much longer and more detailed
      adaptedContent = expandForYouTube(content);
      break;

    case 'pinterest':
      // Pinterest benefits from descriptive, keyword-rich content
      adaptedContent = addDescriptiveKeywords(content);
      break;

    default:
      break;
  }

  return adaptedContent;
}

function addProfessionalContext(content: string): string {
  const professionalPhrases = [
    'In my professional experience,',
    'From a business perspective,',
    'This insight could be valuable for',
    'Consider the implications for',
  ];
  
  const randomPhrase = professionalPhrases[Math.floor(Math.random() * professionalPhrases.length)];
  return `${randomPhrase} ${content}`;
}

function formalizeTone(content: string): string {
  return content
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bdon't\b/g, 'do not')
    .replace(/\bisn't\b/g, 'is not')
    .replace(/\baren't\b/g, 'are not')
    .replace(/\bawesome\b/gi, 'excellent')
    .replace(/\bgreat\b/gi, 'outstanding')
    .replace(/\bcool\b/gi, 'impressive');
}

function addRelevantHashtags(content: string): string {
  // Simple hashtag suggestions based on content keywords
  const hashtagMap: Record<string, string[]> = {
    business: ['#business', '#entrepreneur', '#startup'],
    technology: ['#tech', '#innovation', '#digital'],
    marketing: ['#marketing', '#socialmedia', '#branding'],
    design: ['#design', '#creative', '#ux'],
    development: ['#coding', '#programming', '#developer'],
    productivity: ['#productivity', '#efficiency', '#workflow'],
    leadership: ['#leadership', '#management', '#team'],
    growth: ['#growth', '#success', '#motivation'],
  };

  let hashtags: string[] = [];
  const lowerContent = content.toLowerCase();

  Object.entries(hashtagMap).forEach(([keyword, tags]) => {
    if (lowerContent.includes(keyword)) {
      hashtags.push(...tags.slice(0, 2)); // Max 2 hashtags per keyword
    }
  });

  // Remove duplicates and limit to 5 hashtags
  hashtags = [...new Set(hashtags)].slice(0, 5);

  if (hashtags.length > 0) {
    return `${content}\n\n${hashtags.join(' ')}`;
  }

  return content;
}

function makeConversational(content: string): string {
  // Add conversational elements for Facebook
  const conversationalStarters = [
    'What do you think about',
    'Have you ever experienced',
    'I\'d love to hear your thoughts on',
    'Anyone else feel like',
  ];

  // Add a question at the end to encourage engagement
  if (!content.includes('?')) {
    const starters = ['What\'s your take?', 'Thoughts?', 'Agree or disagree?', 'What do you think?'];
    const randomStarter = starters[Math.floor(Math.random() * starters.length)];
    return `${content}\n\n${randomStarter}`;
  }

  return content;
}

function expandForYouTube(content: string): string {
  // YouTube descriptions benefit from more detail
  const expansions = [
    '\n\n🎯 Key Takeaways:\n• [Add key points here]',
    '\n\n📚 Resources mentioned:\n• [Add links here]',
    '\n\n⏰ Timestamps:\n• 0:00 Introduction\n• [Add more timestamps]',
    '\n\n🔔 Don\'t forget to subscribe for more content like this!',
  ];

  // Add relevant expansions based on content
  let expandedContent = content;
  
  if (content.length < 200) {
    expandedContent += expansions[0]; // Add key takeaways
  }
  
  if (!content.includes('subscribe')) {
    expandedContent += expansions[3]; // Add subscribe reminder
  }

  return expandedContent;
}

function addDescriptiveKeywords(content: string): string {
  // Pinterest benefits from descriptive, searchable keywords
  const keywordCategories = {
    diy: ['DIY', 'handmade', 'craft', 'tutorial'],
    food: ['recipe', 'cooking', 'delicious', 'homemade'],
    fashion: ['style', 'outfit', 'fashion', 'trendy'],
    home: ['home decor', 'interior design', 'cozy', 'beautiful'],
    travel: ['travel', 'destination', 'adventure', 'explore'],
  };

  const lowerContent = content.toLowerCase();
  let keywords: string[] = [];

  Object.entries(keywordCategories).forEach(([category, categoryKeywords]) => {
    if (categoryKeywords.some(keyword => lowerContent.includes(keyword.toLowerCase()))) {
      keywords.push(...categoryKeywords.slice(0, 2));
    }
  });

  if (keywords.length > 0) {
    return `${content} | ${keywords.join(' | ')}`;
  }

  return content;
}

/**
 * Get suggested adaptations for a piece of content
 */
export function getSuggestedAdaptations(
  content: string,
  platforms: SocialPlatform[]
): Record<SocialPlatform, string> {
  const adaptations: Record<SocialPlatform, string> = {} as any;

  platforms.forEach(platform => {
    adaptations[platform] = adaptContentForPlatform(content, platform, {
      truncateForTwitter: true,
      expandForLinkedIn: true,
      addHashtagsForInstagram: true,
      formalizeForLinkedIn: true,
    });
  });

  return adaptations;
}
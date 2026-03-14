/**
 * Template Generation Prompts
 * Generates industry-specific content templates
 */

import { TemplateGenerationInput, ContentTone, SocialPlatform } from '../types';

const INDUSTRY_CONTEXTS = {
  'technology': 'tech companies, software, apps, digital products',
  'healthcare': 'medical services, wellness, fitness, mental health',
  'finance': 'banking, investing, insurance, financial services',
  'retail': 'e-commerce, fashion, consumer goods, shopping',
  'food': 'restaurants, food delivery, recipes, nutrition',
  'education': 'schools, online courses, training, learning',
  'real-estate': 'property sales, rentals, home services',
  'automotive': 'car sales, auto services, transportation',
  'beauty': 'cosmetics, skincare, hair care, wellness',
  'fitness': 'gyms, personal training, sports, health',
  'travel': 'tourism, hotels, airlines, travel services',
  'entertainment': 'movies, music, gaming, events',
  'nonprofit': 'charities, causes, community organizations',
  'consulting': 'business services, professional advice',
  'manufacturing': 'industrial, B2B, production companies',
};

const CONTENT_TYPE_DESCRIPTIONS = {
  'product': 'showcasing products, features, benefits, launches',
  'service': 'promoting services, expertise, customer success',
  'announcement': 'company news, updates, milestones, events',
  'educational': 'tips, tutorials, how-tos, industry insights',
  'promotional': 'sales, discounts, special offers, campaigns',
};

const PLATFORM_CONSIDERATIONS = {
  [SocialPlatform.INSTAGRAM]: 'visual-first, use emojis, hashtags at end, storytelling',
  [SocialPlatform.LINKEDIN]: 'professional, value-driven, thought leadership, longer form',
  [SocialPlatform.TWITTER]: 'concise, trending topics, hashtags, real-time engagement',
  [SocialPlatform.FACEBOOK]: 'conversational, community-focused, questions, engagement',
  [SocialPlatform.TIKTOK]: 'trendy, entertaining, hashtag challenges, viral content',
  [SocialPlatform.YOUTUBE]: 'descriptive, SEO-optimized, call-to-action, longer descriptions',
};

export function buildTemplatePrompt(input: TemplateGenerationInput): string {
  const { industry, platform, contentType, tone } = input;

  const industryContext = INDUSTRY_CONTEXTS[industry as keyof typeof INDUSTRY_CONTEXTS] || industry;
  const contentTypeDesc = CONTENT_TYPE_DESCRIPTIONS[contentType];
  const platformConsiderations = PLATFORM_CONSIDERATIONS[platform] || 'platform-optimized content';

  let prompt = `Generate 5 high-quality social media content templates for the ${industry} industry.

Industry: ${industry} (${industryContext})
Platform: ${platform} (${platformConsiderations})
Content Type: ${contentType} (${contentTypeDesc})
Tone: ${tone}

Each template should:
1. Be specifically tailored for ${industry} businesses
2. Be optimized for ${platform}
3. Focus on ${contentType} content
4. Use a ${tone} tone
5. Include placeholders for customization (use {placeholder} format)
6. Be engaging and conversion-focused
7. Include appropriate emoji suggestions
8. Follow platform best practices

Return the templates in the following JSON format:
{
  "templates": [
    {
      "name": "Template Name",
      "template": "The actual template content with {placeholders}",
      "placeholders": ["placeholder1", "placeholder2"],
      "description": "Brief description of when to use this template"
    }
  ]
}

Make each template unique and valuable, covering different scenarios within ${contentType} content for ${industry}.`;

  return prompt;
}
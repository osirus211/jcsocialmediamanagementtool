/**
 * Pre-built Template Seeder
 * 
 * Seeds the database with industry-specific template library
 * Beats Buffer, Hootsuite, Sprout Social, Later, and SocialBee
 */

import { PostTemplate } from '../models/PostTemplate';
import { SocialPlatform } from '../models/ScheduledPost';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

interface PrebuiltTemplate {
  name: string;
  content: string;
  category: string;
  industry: string;
  platforms: SocialPlatform[];
  tags: string[];
  description: string;
  variables: string[];
}

const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  // E-commerce Templates
  {
    name: 'Product Launch Announcement',
    content: '🚀 Introducing {{product}}! \n\n{{description}} \n\nGet yours now with {{discount}} off! \n\n{{cta}} 👉 {{website}} \n\n#{{brand_name}} #NewProduct #{{hashtag}}',
    category: 'product-launch',
    industry: 'ecommerce',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.TWITTER],
    tags: ['product', 'launch', 'announcement', 'discount'],
    description: 'Perfect for announcing new products with discount offers',
    variables: ['product', 'description', 'discount', 'cta', 'website', 'brand_name', 'hashtag'],
  },
  {
    name: 'Flash Sale Alert',
    content: '⚡ FLASH SALE ALERT! ⚡\n\n{{discount}} OFF everything for the next {{time_limit}}!\n\nDon\'t miss out on:\n✨ {{product_1}}\n✨ {{product_2}}\n✨ {{product_3}}\n\n{{cta}} before it\'s too late!\n\n#FlashSale #{{brand_name}} #Sale',
    category: 'promotion',
    industry: 'ecommerce',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.TWITTER],
    tags: ['sale', 'flash', 'discount', 'urgent'],
    description: 'Create urgency with limited-time flash sales',
    variables: ['discount', 'time_limit', 'product_1', 'product_2', 'product_3', 'cta', 'brand_name'],
  },
  {
    name: 'Customer Testimonial',
    content: '💬 "{{testimonial}}" - {{customer_name}}\n\nWe love hearing from our amazing customers! 💕\n\nReady to experience {{product}} for yourself?\n\n{{cta}} 👉 {{website}}\n\n#CustomerLove #{{brand_name}} #Testimonial',
    category: 'social-proof',
    industry: 'ecommerce',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.LINKEDIN],
    tags: ['testimonial', 'customer', 'review', 'social-proof'],
    description: 'Showcase customer testimonials to build trust',
    variables: ['testimonial', 'customer_name', 'product', 'cta', 'website', 'brand_name'],
  },

  // SaaS Templates
  {
    name: 'Feature Update Announcement',
    content: '🎉 New Feature Alert! \n\n{{feature}} is now live in {{product}}!\n\n{{benefit}}\n\nTry it out today and let us know what you think!\n\n{{cta}} 👉 {{website}}\n\n#ProductUpdate #{{brand_name}} #NewFeature',
    category: 'product-update',
    industry: 'saas',
    platforms: [SocialPlatform.TWITTER, SocialPlatform.LINKEDIN, SocialPlatform.FACEBOOK],
    tags: ['feature', 'update', 'product', 'announcement'],
    description: 'Announce new features and improvements',
    variables: ['feature', 'product', 'benefit', 'cta', 'website', 'brand_name'],
  },
  {
    name: 'Free Trial Offer',
    content: '🆓 Start your {{trial_length}} free trial of {{product}} today!\n\n✅ {{benefit_1}}\n✅ {{benefit_2}}\n✅ {{benefit_3}}\n\nNo credit card required. Cancel anytime.\n\n{{cta}} 👉 {{website}}\n\n#FreeTrial #{{brand_name}} #SaaS',
    category: 'lead-generation',
    industry: 'saas',
    platforms: [SocialPlatform.TWITTER, SocialPlatform.LINKEDIN, SocialPlatform.FACEBOOK],
    tags: ['free-trial', 'lead-generation', 'benefits'],
    description: 'Drive free trial signups with clear benefits',
    variables: ['trial_length', 'product', 'benefit_1', 'benefit_2', 'benefit_3', 'cta', 'website', 'brand_name'],
  },
  {
    name: 'Case Study Highlight',
    content: '📊 Case Study: How {{customer_name}} achieved {{result}} with {{product}}\n\n"{{testimonial}}"\n\nKey results:\n📈 {{metric_1}}\n📈 {{metric_2}}\n📈 {{metric_3}}\n\nRead the full case study 👉 {{website}}\n\n#CaseStudy #{{brand_name}} #Results',
    category: 'case-study',
    industry: 'saas',
    platforms: [SocialPlatform.LINKEDIN, SocialPlatform.TWITTER, SocialPlatform.FACEBOOK],
    tags: ['case-study', 'results', 'customer-success'],
    description: 'Showcase customer success stories with metrics',
    variables: ['customer_name', 'result', 'product', 'testimonial', 'metric_1', 'metric_2', 'metric_3', 'website', 'brand_name'],
  },

  // Agency Templates
  {
    name: 'Client Success Story',
    content: '🎯 Client Spotlight: {{client_name}}\n\nWe helped them achieve:\n📈 {{result_1}}\n📈 {{result_2}}\n📈 {{result_3}}\n\nReady to grow your business? Let\'s chat!\n\n{{cta}} 👉 {{website}}\n\n#ClientSuccess #{{brand_name}} #DigitalMarketing',
    category: 'client-spotlight',
    industry: 'agency',
    platforms: [SocialPlatform.LINKEDIN, SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM],
    tags: ['client', 'success', 'results', 'agency'],
    description: 'Highlight client achievements and results',
    variables: ['client_name', 'result_1', 'result_2', 'result_3', 'cta', 'website', 'brand_name'],
  },
  {
    name: 'Industry Tip',
    content: '💡 {{industry}} Tip: {{tip_title}}\n\n{{tip_content}}\n\nPro tip: {{pro_tip}}\n\nNeed help implementing this? We\'re here to help!\n\n{{cta}} 👉 {{website}}\n\n#{{industry}}Tips #{{brand_name}} #Marketing',
    category: 'educational',
    industry: 'agency',
    platforms: [SocialPlatform.LINKEDIN, SocialPlatform.TWITTER, SocialPlatform.FACEBOOK],
    tags: ['tip', 'education', 'industry', 'advice'],
    description: 'Share valuable industry tips and insights',
    variables: ['industry', 'tip_title', 'tip_content', 'pro_tip', 'cta', 'website', 'brand_name'],
  },

  // Healthcare Templates
  {
    name: 'Health Tip',
    content: '🏥 Health Tip: {{tip_title}}\n\n{{tip_content}}\n\nRemember: {{disclaimer}}\n\nFor more health tips, follow us!\n\n#HealthTip #{{brand_name}} #Wellness',
    category: 'educational',
    industry: 'healthcare',
    platforms: [SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM, SocialPlatform.LINKEDIN],
    tags: ['health', 'tip', 'wellness', 'education'],
    description: 'Share health tips and wellness advice',
    variables: ['tip_title', 'tip_content', 'disclaimer', 'brand_name'],
  },

  // Education Templates
  {
    name: 'Course Announcement',
    content: '📚 New Course Alert: {{course_name}}\n\n{{course_description}}\n\nWhat you\'ll learn:\n✅ {{learning_1}}\n✅ {{learning_2}}\n✅ {{learning_3}}\n\nEnroll now: {{website}}\n\n#OnlineLearning #{{brand_name}} #Education',
    category: 'course-promotion',
    industry: 'education',
    platforms: [SocialPlatform.LINKEDIN, SocialPlatform.FACEBOOK, SocialPlatform.TWITTER],
    tags: ['course', 'education', 'learning', 'announcement'],
    description: 'Promote new courses and educational content',
    variables: ['course_name', 'course_description', 'learning_1', 'learning_2', 'learning_3', 'website', 'brand_name'],
  },

  // Finance Templates
  {
    name: 'Financial Tip',
    content: '💰 Money Tip: {{tip_title}}\n\n{{tip_content}}\n\nRemember: {{disclaimer}}\n\nNeed personalized financial advice? Contact us!\n\n{{cta}} 👉 {{website}}\n\n#FinanceTip #{{brand_name}} #MoneyMatters',
    category: 'educational',
    industry: 'finance',
    platforms: [SocialPlatform.LINKEDIN, SocialPlatform.FACEBOOK, SocialPlatform.TWITTER],
    tags: ['finance', 'money', 'tip', 'advice'],
    description: 'Share financial tips and advice',
    variables: ['tip_title', 'tip_content', 'disclaimer', 'cta', 'website', 'brand_name'],
  },

  // Real Estate Templates
  {
    name: 'Property Listing',
    content: '🏠 New Listing: {{property_address}}\n\n{{property_description}}\n\n🛏️ {{bedrooms}} bed, {{bathrooms}} bath\n📐 {{square_feet}} sq ft\n💰 {{price}}\n\nSchedule a viewing today!\n\n{{cta}} 👉 {{phone}}\n\n#RealEstate #{{location}} #{{brand_name}}',
    category: 'property-listing',
    industry: 'real-estate',
    platforms: [SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM, SocialPlatform.LINKEDIN],
    tags: ['property', 'listing', 'real-estate', 'home'],
    description: 'Showcase property listings with key details',
    variables: ['property_address', 'property_description', 'bedrooms', 'bathrooms', 'square_feet', 'price', 'cta', 'phone', 'location', 'brand_name'],
  },

  // Restaurant Templates
  {
    name: 'Daily Special',
    content: '🍽️ Today\'s Special: {{dish_name}}\n\n{{dish_description}}\n\nOnly {{price}} for today only!\n\nCome hungry, leave happy! 😋\n\nReserve your table: {{phone}}\n\n#DailySpecial #{{restaurant_name}} #{{location}}',
    category: 'daily-special',
    industry: 'restaurant',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.TWITTER],
    tags: ['food', 'special', 'restaurant', 'daily'],
    description: 'Promote daily specials and menu items',
    variables: ['dish_name', 'dish_description', 'price', 'phone', 'restaurant_name', 'location'],
  },

  // Fitness Templates
  {
    name: 'Workout Tip',
    content: '💪 Workout Wednesday: {{exercise_name}}\n\n{{exercise_description}}\n\nBenefits:\n✅ {{benefit_1}}\n✅ {{benefit_2}}\n✅ {{benefit_3}}\n\nTry it out and tag us! 💪\n\n#WorkoutWednesday #{{brand_name}} #Fitness',
    category: 'workout-tip',
    industry: 'fitness',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.TWITTER],
    tags: ['workout', 'exercise', 'fitness', 'tip'],
    description: 'Share workout tips and exercise routines',
    variables: ['exercise_name', 'exercise_description', 'benefit_1', 'benefit_2', 'benefit_3', 'brand_name'],
  },

  // Beauty Templates
  {
    name: 'Beauty Tip',
    content: '✨ Beauty Tip: {{tip_title}}\n\n{{tip_content}}\n\nPro tip: {{pro_tip}}\n\nWhat\'s your favorite beauty hack? Tell us below! 👇\n\n#BeautyTip #{{brand_name}} #Skincare',
    category: 'beauty-tip',
    industry: 'beauty',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.TIKTOK],
    tags: ['beauty', 'skincare', 'tip', 'hack'],
    description: 'Share beauty tips and skincare advice',
    variables: ['tip_title', 'tip_content', 'pro_tip', 'brand_name'],
  },

  // Travel Templates
  {
    name: 'Destination Spotlight',
    content: '✈️ Destination Spotlight: {{destination}}\n\n{{destination_description}}\n\nMust-see attractions:\n🌟 {{attraction_1}}\n🌟 {{attraction_2}}\n🌟 {{attraction_3}}\n\nReady to explore? Book your trip!\n\n{{cta}} 👉 {{website}}\n\n#Travel #{{destination}} #{{brand_name}}',
    category: 'destination',
    industry: 'travel',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.TWITTER],
    tags: ['travel', 'destination', 'vacation', 'tourism'],
    description: 'Highlight travel destinations and attractions',
    variables: ['destination', 'destination_description', 'attraction_1', 'attraction_2', 'attraction_3', 'cta', 'website', 'brand_name'],
  },

  // Nonprofit Templates
  {
    name: 'Donation Appeal',
    content: '❤️ Help us make a difference!\n\n{{cause_description}}\n\nYour {{donation_amount}} can:\n🎯 {{impact_1}}\n🎯 {{impact_2}}\n🎯 {{impact_3}}\n\nEvery donation counts. Donate today!\n\n{{cta}} 👉 {{website}}\n\n#Nonprofit #{{cause}} #{{brand_name}}',
    category: 'fundraising',
    industry: 'nonprofit',
    platforms: [SocialPlatform.FACEBOOK, SocialPlatform.LINKEDIN, SocialPlatform.TWITTER],
    tags: ['donation', 'fundraising', 'nonprofit', 'cause'],
    description: 'Appeal for donations with clear impact messaging',
    variables: ['cause_description', 'donation_amount', 'impact_1', 'impact_2', 'impact_3', 'cta', 'website', 'cause', 'brand_name'],
  },

  // General Templates
  {
    name: 'Behind the Scenes',
    content: '👀 Behind the scenes at {{brand_name}}!\n\n{{behind_scenes_content}}\n\nWe love sharing our process with you! What would you like to see more of?\n\n#BehindTheScenes #{{brand_name}} #TeamWork',
    category: 'behind-scenes',
    industry: 'general',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.LINKEDIN],
    tags: ['behind-scenes', 'team', 'process', 'transparency'],
    description: 'Show behind-the-scenes content to humanize your brand',
    variables: ['brand_name', 'behind_scenes_content'],
  },
  {
    name: 'Question Post',
    content: '🤔 Question for you: {{question}}\n\n{{context}}\n\nLet us know in the comments! We love hearing from you! 👇\n\n#Question #{{brand_name}} #Community',
    category: 'engagement',
    industry: 'general',
    platforms: [SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM, SocialPlatform.LINKEDIN],
    tags: ['question', 'engagement', 'community', 'discussion'],
    description: 'Ask questions to boost engagement and community interaction',
    variables: ['question', 'context', 'brand_name'],
  },
  {
    name: 'Motivational Monday',
    content: '💪 Motivational Monday!\n\n"{{quote}}"\n\n{{motivation_content}}\n\nWhat\'s motivating you this week? Share below! 👇\n\n#MotivationalMonday #{{brand_name}} #Motivation',
    category: 'motivational',
    industry: 'general',
    platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.FACEBOOK, SocialPlatform.LINKEDIN],
    tags: ['motivation', 'monday', 'quote', 'inspiration'],
    description: 'Start the week with motivational content',
    variables: ['quote', 'motivation_content', 'brand_name'],
  },
];

export class PrebuiltTemplateSeeder {
  /**
   * Seed pre-built templates for a workspace
   */
  static async seedTemplates(workspaceId: string, createdBy: string): Promise<void> {
    try {
      logger.info('Starting pre-built template seeding', { workspaceId });

      // Check if templates already exist
      const existingCount = await PostTemplate.countDocuments({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        isPrebuilt: true,
      });

      if (existingCount > 0) {
        logger.info('Pre-built templates already exist, skipping seeding', { 
          workspaceId, 
          existingCount 
        });
        return;
      }

      // Create pre-built templates
      const templates = PREBUILT_TEMPLATES.map(template => ({
        ...template,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        createdBy: new mongoose.Types.ObjectId(createdBy),
        isPrebuilt: true,
        usageCount: 0,
        rating: 4.5, // High rating for pre-built templates
        isFavorite: false,
        isPersonal: false,
      }));

      await PostTemplate.insertMany(templates);

      logger.info('Pre-built templates seeded successfully', { 
        workspaceId, 
        count: templates.length 
      });
    } catch (error: any) {
      logger.error('Failed to seed pre-built templates', {
        workspaceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get available industries
   */
  static getAvailableIndustries(): string[] {
    return Array.from(new Set(PREBUILT_TEMPLATES.map(t => t.industry)));
  }

  /**
   * Get available categories
   */
  static getAvailableCategories(): string[] {
    return Array.from(new Set(PREBUILT_TEMPLATES.map(t => t.category)));
  }
}
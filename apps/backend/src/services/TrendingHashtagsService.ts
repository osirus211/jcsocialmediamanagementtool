export interface TrendingHashtag {
  hashtag: string;
  platform: string;
  category: string;
  region: string;
  postCount: number;
  growthRate: number; // Percentage growth in last 24h
  velocity: 'rising' | 'falling' | 'stable';
  engagementRate: number;
  trendScore: number; // 1-100 trending score
  lastUpdated: Date;
  relatedHashtags: string[];
}

export interface TrendingHashtagsResponse {
  platform: string;
  category?: string;
  region?: string;
  hashtags: TrendingHashtag[];
  lastUpdated: Date;
  nextUpdate: Date;
}

export class TrendingHashtagsService {
  // Mock trending hashtags data
  // In a real implementation, this would be updated hourly from platform APIs
  private static readonly TRENDING_HASHTAGS_DATA = new Map<string, TrendingHashtag[]>([
    ['instagram', [
      {
        hashtag: '#reels',
        platform: 'instagram',
        category: 'content',
        region: 'global',
        postCount: 850000000,
        growthRate: 15.2,
        velocity: 'rising',
        engagementRate: 4.8,
        trendScore: 95,
        lastUpdated: new Date(),
        relatedHashtags: ['#viral', '#trending', '#explore']
      },
      {
        hashtag: '#ai',
        platform: 'instagram',
        category: 'technology',
        region: 'global',
        postCount: 45000000,
        growthRate: 28.5,
        velocity: 'rising',
        engagementRate: 5.2,
        trendScore: 92,
        lastUpdated: new Date(),
        relatedHashtags: ['#artificialintelligence', '#tech', '#future']
      },
      {
        hashtag: '#sustainability',
        platform: 'instagram',
        category: 'lifestyle',
        region: 'global',
        postCount: 18000000,
        growthRate: 12.8,
        velocity: 'rising',
        engagementRate: 4.5,
        trendScore: 88,
        lastUpdated: new Date(),
        relatedHashtags: ['#ecofriendly', '#green', '#climatechange']
      },
      {
        hashtag: '#mentalhealth',
        platform: 'instagram',
        category: 'health',
        region: 'global',
        postCount: 32000000,
        growthRate: 8.3,
        velocity: 'stable',
        engagementRate: 6.1,
        trendScore: 85,
        lastUpdated: new Date(),
        relatedHashtags: ['#wellness', '#selfcare', '#mindfulness']
      },
      {
        hashtag: '#smallbusiness',
        platform: 'instagram',
        category: 'business',
        region: 'global',
        postCount: 45000000,
        growthRate: 5.7,
        velocity: 'stable',
        engagementRate: 3.9,
        trendScore: 78,
        lastUpdated: new Date(),
        relatedHashtags: ['#entrepreneur', '#startup', '#business']
      },
      {
        hashtag: '#crypto',
        platform: 'instagram',
        category: 'finance',
        region: 'global',
        postCount: 25000000,
        growthRate: -3.2,
        velocity: 'falling',
        engagementRate: 2.8,
        trendScore: 65,
        lastUpdated: new Date(),
        relatedHashtags: ['#bitcoin', '#blockchain', '#nft']
      }
    ]],
    
    ['tiktok', [
      {
        hashtag: '#fyp',
        platform: 'tiktok',
        category: 'general',
        region: 'global',
        postCount: 2500000000,
        growthRate: 2.1,
        velocity: 'stable',
        engagementRate: 8.5,
        trendScore: 98,
        lastUpdated: new Date(),
        relatedHashtags: ['#foryou', '#viral', '#trending']
      },
      {
        hashtag: '#booktok',
        platform: 'tiktok',
        category: 'entertainment',
        region: 'global',
        postCount: 85000000,
        growthRate: 22.4,
        velocity: 'rising',
        engagementRate: 9.2,
        trendScore: 94,
        lastUpdated: new Date(),
        relatedHashtags: ['#books', '#reading', '#bookish']
      },
      {
        hashtag: '#recipe',
        platform: 'tiktok',
        category: 'food',
        region: 'global',
        postCount: 125000000,
        growthRate: 18.7,
        velocity: 'rising',
        engagementRate: 7.8,
        trendScore: 91,
        lastUpdated: new Date(),
        relatedHashtags: ['#cooking', '#food', '#foodtok']
      },
      {
        hashtag: '#diy',
        platform: 'tiktok',
        category: 'lifestyle',
        region: 'global',
        postCount: 95000000,
        growthRate: 14.2,
        velocity: 'rising',
        engagementRate: 6.9,
        trendScore: 87,
        lastUpdated: new Date(),
        relatedHashtags: ['#crafts', '#handmade', '#creative']
      },
      {
        hashtag: '#workfromhome',
        platform: 'tiktok',
        category: 'business',
        region: 'global',
        postCount: 35000000,
        growthRate: -5.8,
        velocity: 'falling',
        engagementRate: 4.2,
        trendScore: 72,
        lastUpdated: new Date(),
        relatedHashtags: ['#remote', '#productivity', '#career']
      }
    ]],
    
    ['twitter', [
      {
        hashtag: '#breaking',
        platform: 'twitter',
        category: 'news',
        region: 'global',
        postCount: 15000000,
        growthRate: 45.2,
        velocity: 'rising',
        engagementRate: 12.5,
        trendScore: 96,
        lastUpdated: new Date(),
        relatedHashtags: ['#news', '#urgent', '#alert']
      },
      {
        hashtag: '#climate',
        platform: 'twitter',
        category: 'environment',
        region: 'global',
        postCount: 8000000,
        growthRate: 19.3,
        velocity: 'rising',
        engagementRate: 8.7,
        trendScore: 89,
        lastUpdated: new Date(),
        relatedHashtags: ['#climatechange', '#environment', '#sustainability']
      },
      {
        hashtag: '#tech',
        platform: 'twitter',
        category: 'technology',
        region: 'global',
        postCount: 25000000,
        growthRate: 11.8,
        velocity: 'rising',
        engagementRate: 6.2,
        trendScore: 84,
        lastUpdated: new Date(),
        relatedHashtags: ['#technology', '#innovation', '#startup']
      },
      {
        hashtag: '#sports',
        platform: 'twitter',
        category: 'sports',
        region: 'global',
        postCount: 45000000,
        growthRate: 7.4,
        velocity: 'stable',
        engagementRate: 5.8,
        trendScore: 79,
        lastUpdated: new Date(),
        relatedHashtags: ['#football', '#basketball', '#soccer']
      }
    ]],
    
    ['linkedin', [
      {
        hashtag: '#leadership',
        platform: 'linkedin',
        category: 'business',
        region: 'global',
        postCount: 12000000,
        growthRate: 16.5,
        velocity: 'rising',
        engagementRate: 7.2,
        trendScore: 88,
        lastUpdated: new Date(),
        relatedHashtags: ['#management', '#career', '#professional']
      },
      {
        hashtag: '#remotework',
        platform: 'linkedin',
        category: 'business',
        region: 'global',
        postCount: 8500000,
        growthRate: 9.8,
        velocity: 'stable',
        engagementRate: 6.5,
        trendScore: 82,
        lastUpdated: new Date(),
        relatedHashtags: ['#workfromhome', '#productivity', '#future']
      },
      {
        hashtag: '#diversity',
        platform: 'linkedin',
        category: 'business',
        region: 'global',
        postCount: 6200000,
        growthRate: 13.2,
        velocity: 'rising',
        engagementRate: 8.1,
        trendScore: 85,
        lastUpdated: new Date(),
        relatedHashtags: ['#inclusion', '#equity', '#workplace']
      }
    ]]
  ]);

  // Categories for filtering
  private static readonly CATEGORIES = [
    'general', 'technology', 'business', 'lifestyle', 'health', 'entertainment',
    'food', 'travel', 'fashion', 'sports', 'news', 'environment', 'finance'
  ];

  // Regions for filtering
  private static readonly REGIONS = [
    'global', 'north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania'
  ];

  /**
   * Get trending hashtags for a platform
   */
  static getTrendingHashtags(
    platform: string,
    category?: string,
    region?: string,
    limit: number = 20
  ): TrendingHashtagsResponse {
    let hashtags = this.TRENDING_HASHTAGS_DATA.get(platform.toLowerCase()) || [];

    // Filter by category if specified
    if (category && category !== 'all') {
      hashtags = hashtags.filter(h => h.category === category);
    }

    // Filter by region if specified
    if (region && region !== 'all') {
      hashtags = hashtags.filter(h => h.region === region || h.region === 'global');
    }

    // Sort by trend score (highest first)
    hashtags = hashtags
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);

    const now = new Date();
    const nextUpdate = new Date(now.getTime() + 60 * 60 * 1000); // Next hour

    return {
      platform,
      category,
      region,
      hashtags,
      lastUpdated: now,
      nextUpdate
    };
  }

  /**
   * Get trending hashtags across all platforms
   */
  static getAllPlatformTrends(
    category?: string,
    region?: string,
    limit: number = 50
  ): { [platform: string]: TrendingHashtagsResponse } {
    const platforms = ['instagram', 'tiktok', 'twitter', 'linkedin'];
    const results: { [platform: string]: TrendingHashtagsResponse } = {};

    platforms.forEach(platform => {
      results[platform] = this.getTrendingHashtags(platform, category, region, limit);
    });

    return results;
  }

  /**
   * Search trending hashtags by keyword
   */
  static searchTrendingHashtags(
    keyword: string,
    platform?: string,
    limit: number = 20
  ): TrendingHashtag[] {
    const normalizedKeyword = keyword.toLowerCase().trim();
    let allHashtags: TrendingHashtag[] = [];

    if (platform) {
      allHashtags = this.TRENDING_HASHTAGS_DATA.get(platform.toLowerCase()) || [];
    } else {
      // Search across all platforms
      for (const hashtags of this.TRENDING_HASHTAGS_DATA.values()) {
        allHashtags.push(...hashtags);
      }
    }

    const matchingHashtags = allHashtags.filter(hashtag =>
      hashtag.hashtag.toLowerCase().includes(normalizedKeyword) ||
      hashtag.category.toLowerCase().includes(normalizedKeyword) ||
      hashtag.relatedHashtags.some(related => 
        related.toLowerCase().includes(normalizedKeyword)
      )
    );

    return matchingHashtags
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
  }

  /**
   * Get hashtag velocity trends
   */
  static getVelocityTrends(platform: string): {
    rising: TrendingHashtag[];
    falling: TrendingHashtag[];
    stable: TrendingHashtag[];
  } {
    const hashtags = this.TRENDING_HASHTAGS_DATA.get(platform.toLowerCase()) || [];

    return {
      rising: hashtags.filter(h => h.velocity === 'rising').sort((a, b) => b.growthRate - a.growthRate),
      falling: hashtags.filter(h => h.velocity === 'falling').sort((a, b) => a.growthRate - b.growthRate),
      stable: hashtags.filter(h => h.velocity === 'stable').sort((a, b) => b.trendScore - a.trendScore)
    };
  }

  /**
   * Get trending hashtags by category
   */
  static getTrendingByCategory(platform: string): { [category: string]: TrendingHashtag[] } {
    const hashtags = this.TRENDING_HASHTAGS_DATA.get(platform.toLowerCase()) || [];
    const categorized: { [category: string]: TrendingHashtag[] } = {};

    hashtags.forEach(hashtag => {
      if (!categorized[hashtag.category]) {
        categorized[hashtag.category] = [];
      }
      categorized[hashtag.category].push(hashtag);
    });

    // Sort each category by trend score
    Object.keys(categorized).forEach(category => {
      categorized[category].sort((a, b) => b.trendScore - a.trendScore);
    });

    return categorized;
  }

  /**
   * Get hashtag recommendations based on trending data
   */
  static getHashtagRecommendations(
    userHashtags: string[],
    platform: string,
    limit: number = 10
  ): TrendingHashtag[] {
    const trendingHashtags = this.TRENDING_HASHTAGS_DATA.get(platform.toLowerCase()) || [];
    const userHashtagsLower = userHashtags.map(h => h.toLowerCase());

    // Find trending hashtags that are related to user's hashtags
    const recommendations: TrendingHashtag[] = [];

    trendingHashtags.forEach(trending => {
      // Check if any user hashtag is related to this trending hashtag
      const isRelated = userHashtagsLower.some(userHashtag => {
        return trending.relatedHashtags.some(related => 
          related.toLowerCase().includes(userHashtag.replace('#', '')) ||
          userHashtag.includes(related.replace('#', ''))
        ) || trending.hashtag.toLowerCase().includes(userHashtag.replace('#', ''));
      });

      if (isRelated && !userHashtagsLower.includes(trending.hashtag.toLowerCase())) {
        recommendations.push(trending);
      }
    });

    // If not enough related recommendations, add top trending hashtags
    if (recommendations.length < limit) {
      const topTrending = trendingHashtags
        .filter(h => !userHashtagsLower.includes(h.hashtag.toLowerCase()))
        .sort((a, b) => b.trendScore - a.trendScore);

      topTrending.forEach(trending => {
        if (recommendations.length < limit && 
            !recommendations.find(r => r.hashtag === trending.hashtag)) {
          recommendations.push(trending);
        }
      });
    }

    return recommendations
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
  }

  /**
   * Get available categories
   */
  static getCategories(): string[] {
    return [...this.CATEGORIES];
  }

  /**
   * Get available regions
   */
  static getRegions(): string[] {
    return [...this.REGIONS];
  }

  /**
   * Get trending statistics
   */
  static getTrendingStats(platform: string): {
    totalTrending: number;
    risingCount: number;
    fallingCount: number;
    stableCount: number;
    averageGrowthRate: number;
    topCategory: string;
  } {
    const hashtags = this.TRENDING_HASHTAGS_DATA.get(platform.toLowerCase()) || [];

    const risingCount = hashtags.filter(h => h.velocity === 'rising').length;
    const fallingCount = hashtags.filter(h => h.velocity === 'falling').length;
    const stableCount = hashtags.filter(h => h.velocity === 'stable').length;

    const averageGrowthRate = hashtags.reduce((sum, h) => sum + h.growthRate, 0) / hashtags.length;

    // Find most common category
    const categoryCount: { [category: string]: number } = {};
    hashtags.forEach(h => {
      categoryCount[h.category] = (categoryCount[h.category] || 0) + 1;
    });

    const topCategory = Object.keys(categoryCount).reduce((a, b) => 
      categoryCount[a] > categoryCount[b] ? a : b, 'general'
    );

    return {
      totalTrending: hashtags.length,
      risingCount,
      fallingCount,
      stableCount,
      averageGrowthRate: Math.round(averageGrowthRate * 10) / 10,
      topCategory
    };
  }

  /**
   * Simulate real-time update (in production, this would fetch from APIs)
   */
  static updateTrendingData(): void {
    // This would be called by a scheduled job every hour
    // For now, we'll just update the timestamps and slightly modify growth rates
    
    for (const [platform, hashtags] of this.TRENDING_HASHTAGS_DATA) {
      hashtags.forEach(hashtag => {
        hashtag.lastUpdated = new Date();
        
        // Simulate small changes in growth rate
        const change = (Math.random() - 0.5) * 5; // ±2.5% change
        hashtag.growthRate = Math.round((hashtag.growthRate + change) * 10) / 10;
        
        // Update velocity based on growth rate
        if (hashtag.growthRate > 10) {
          hashtag.velocity = 'rising';
        } else if (hashtag.growthRate < -5) {
          hashtag.velocity = 'falling';
        } else {
          hashtag.velocity = 'stable';
        }
        
        // Update trend score based on growth rate and engagement
        hashtag.trendScore = Math.min(100, Math.max(1, 
          50 + hashtag.growthRate + (hashtag.engagementRate * 5)
        ));
      });
    }
  }
}
export interface CompetitorHashtagData {
  hashtag: string;
  usageCount: number;
  averageEngagement: number;
  averageLikes: number;
  averageComments: number;
  averageShares: number;
  lastUsed: Date;
  postExamples: string[]; // Post IDs or URLs
  performance: 'high' | 'medium' | 'low';
}

export interface CompetitorAnalysis {
  competitorHandle: string;
  platform: string;
  totalPosts: number;
  totalHashtags: number;
  averageHashtagsPerPost: number;
  topHashtags: CompetitorHashtagData[];
  hashtagCategories: { [category: string]: CompetitorHashtagData[] };
  recommendations: string[];
  lastAnalyzed: Date;
}

export interface HashtagComparison {
  hashtag: string;
  yourUsage: number;
  competitorUsage: number;
  competitorEngagement: number;
  recommendation: 'adopt' | 'avoid' | 'optimize' | 'continue';
  reason: string;
}

export class CompetitorHashtagAnalysisService {
  // Mock competitor data - in production this would come from social media APIs
  private static readonly COMPETITOR_DATA = new Map<string, CompetitorAnalysis>([
    ['@competitor_travel', {
      competitorHandle: '@competitor_travel',
      platform: 'instagram',
      totalPosts: 450,
      totalHashtags: 125,
      averageHashtagsPerPost: 18.5,
      topHashtags: [
        {
          hashtag: '#wanderlust',
          usageCount: 89,
          averageEngagement: 4.2,
          averageLikes: 2850,
          averageComments: 145,
          averageShares: 23,
          lastUsed: new Date('2024-03-10'),
          postExamples: ['post_123', 'post_456', 'post_789'],
          performance: 'high'
        },
        {
          hashtag: '#solotravel',
          usageCount: 67,
          averageEngagement: 5.1,
          averageLikes: 3200,
          averageComments: 180,
          averageShares: 31,
          lastUsed: new Date('2024-03-12'),
          postExamples: ['post_234', 'post_567'],
          performance: 'high'
        },
        {
          hashtag: '#budgettravel',
          usageCount: 54,
          averageEngagement: 3.8,
          averageLikes: 2100,
          averageComments: 95,
          averageShares: 18,
          lastUsed: new Date('2024-03-08'),
          postExamples: ['post_345', 'post_678'],
          performance: 'medium'
        },
        {
          hashtag: '#digitalnomad',
          usageCount: 43,
          averageEngagement: 6.2,
          averageLikes: 4100,
          averageComments: 220,
          averageShares: 45,
          lastUsed: new Date('2024-03-11'),
          postExamples: ['post_456', 'post_789'],
          performance: 'high'
        },
        {
          hashtag: '#backpacking',
          usageCount: 38,
          averageEngagement: 3.5,
          averageLikes: 1950,
          averageComments: 85,
          averageShares: 15,
          lastUsed: new Date('2024-03-09'),
          postExamples: ['post_567'],
          performance: 'medium'
        }
      ],
      hashtagCategories: {
        'travel_style': [
          {
            hashtag: '#solotravel',
            usageCount: 67,
            averageEngagement: 5.1,
            averageLikes: 3200,
            averageComments: 180,
            averageShares: 31,
            lastUsed: new Date('2024-03-12'),
            postExamples: ['post_234', 'post_567'],
            performance: 'high'
          },
          {
            hashtag: '#backpacking',
            usageCount: 38,
            averageEngagement: 3.5,
            averageLikes: 1950,
            averageComments: 85,
            averageShares: 15,
            lastUsed: new Date('2024-03-09'),
            postExamples: ['post_567'],
            performance: 'medium'
          }
        ],
        'budget': [
          {
            hashtag: '#budgettravel',
            usageCount: 54,
            averageEngagement: 3.8,
            averageLikes: 2100,
            averageComments: 95,
            averageShares: 18,
            lastUsed: new Date('2024-03-08'),
            postExamples: ['post_345', 'post_678'],
            performance: 'medium'
          }
        ],
        'lifestyle': [
          {
            hashtag: '#digitalnomad',
            usageCount: 43,
            averageEngagement: 6.2,
            averageLikes: 4100,
            averageComments: 220,
            averageShares: 45,
            lastUsed: new Date('2024-03-11'),
            postExamples: ['post_456', 'post_789'],
            performance: 'high'
          }
        ]
      },
      recommendations: [
        'Focus more on #digitalnomad - it has the highest engagement rate (6.2%)',
        'Consider using #solotravel more frequently - strong performance with 5.1% engagement',
        'Reduce usage of generic hashtags like #travel in favor of niche ones',
        'Experiment with location-specific hashtags that this competitor uses'
      ],
      lastAnalyzed: new Date()
    }],
    
    ['@fitness_guru', {
      competitorHandle: '@fitness_guru',
      platform: 'instagram',
      totalPosts: 320,
      totalHashtags: 95,
      averageHashtagsPerPost: 15.2,
      topHashtags: [
        {
          hashtag: '#homeworkout',
          usageCount: 78,
          averageEngagement: 5.8,
          averageLikes: 4200,
          averageComments: 195,
          averageShares: 38,
          lastUsed: new Date('2024-03-13'),
          postExamples: ['post_111', 'post_222'],
          performance: 'high'
        },
        {
          hashtag: '#hiit',
          usageCount: 65,
          averageEngagement: 6.1,
          averageLikes: 4500,
          averageComments: 210,
          averageShares: 42,
          lastUsed: new Date('2024-03-12'),
          postExamples: ['post_333', 'post_444'],
          performance: 'high'
        },
        {
          hashtag: '#strongwomen',
          usageCount: 52,
          averageEngagement: 7.2,
          averageLikes: 5100,
          averageComments: 285,
          averageShares: 55,
          lastUsed: new Date('2024-03-11'),
          postExamples: ['post_555'],
          performance: 'high'
        }
      ],
      hashtagCategories: {
        'workout_type': [
          {
            hashtag: '#homeworkout',
            usageCount: 78,
            averageEngagement: 5.8,
            averageLikes: 4200,
            averageComments: 195,
            averageShares: 38,
            lastUsed: new Date('2024-03-13'),
            postExamples: ['post_111', 'post_222'],
            performance: 'high'
          },
          {
            hashtag: '#hiit',
            usageCount: 65,
            averageEngagement: 6.1,
            averageLikes: 4500,
            averageComments: 210,
            averageShares: 42,
            lastUsed: new Date('2024-03-12'),
            postExamples: ['post_333', 'post_444'],
            performance: 'high'
          }
        ],
        'community': [
          {
            hashtag: '#strongwomen',
            usageCount: 52,
            averageEngagement: 7.2,
            averageLikes: 5100,
            averageComments: 285,
            averageShares: 55,
            lastUsed: new Date('2024-03-11'),
            postExamples: ['post_555'],
            performance: 'high'
          }
        ]
      },
      recommendations: [
        '#strongwomen has the highest engagement rate (7.2%) - consider incorporating community-focused hashtags',
        '#hiit and #homeworkout are both performing well - focus on workout-specific hashtags',
        'This competitor uses fewer hashtags per post but with higher engagement - quality over quantity',
        'Consider adding motivational hashtags that resonate with their audience'
      ],
      lastAnalyzed: new Date()
    }]
  ]);

  /**
   * Analyze competitor's hashtag strategy
   */
  static async analyzeCompetitor(
    competitorHandle: string,
    platform: string = 'instagram'
  ): Promise<CompetitorAnalysis | null> {
    // Normalize handle
    const normalizedHandle = competitorHandle.startsWith('@') ? competitorHandle : `@${competitorHandle}`;
    
    // Check if we have cached data
    const cachedData = this.COMPETITOR_DATA.get(normalizedHandle);
    if (cachedData) {
      return cachedData;
    }

    // In production, this would make API calls to fetch real data
    // For now, return mock analysis
    return this.generateMockAnalysis(normalizedHandle, platform);
  }

  /**
   * Compare your hashtags with competitor's hashtags
   */
  static compareHashtagStrategies(
    yourHashtags: string[],
    competitorHandle: string,
    platform: string = 'instagram'
  ): HashtagComparison[] {
    const competitorData = this.COMPETITOR_DATA.get(competitorHandle);
    if (!competitorData) {
      return [];
    }

    const comparisons: HashtagComparison[] = [];
    const yourHashtagsLower = yourHashtags.map(h => h.toLowerCase());

    // Analyze competitor's top hashtags
    competitorData.topHashtags.forEach(compHashtag => {
      const yourUsage = yourHashtagsLower.filter(h => h === compHashtag.hashtag.toLowerCase()).length;
      
      let recommendation: 'adopt' | 'avoid' | 'optimize' | 'continue';
      let reason: string;

      if (yourUsage === 0) {
        if (compHashtag.performance === 'high') {
          recommendation = 'adopt';
          reason = `High-performing hashtag (${compHashtag.averageEngagement}% engagement) that you're not using`;
        } else {
          recommendation = 'avoid';
          reason = `Low-performing hashtag for this competitor`;
        }
      } else if (yourUsage > 0) {
        if (compHashtag.performance === 'high') {
          recommendation = 'continue';
          reason = `You're already using this high-performing hashtag`;
        } else {
          recommendation = 'optimize';
          reason = `Consider reducing usage - competitor sees ${compHashtag.performance} performance`;
        }
      } else {
        recommendation = 'optimize';
        reason = 'Analyze performance and adjust usage';
      }

      comparisons.push({
        hashtag: compHashtag.hashtag,
        yourUsage,
        competitorUsage: compHashtag.usageCount,
        competitorEngagement: compHashtag.averageEngagement,
        recommendation,
        reason
      });
    });

    return comparisons.sort((a, b) => b.competitorEngagement - a.competitorEngagement);
  }

  /**
   * Get hashtag recommendations based on competitor analysis
   */
  static getHashtagRecommendations(
    competitorHandle: string,
    yourHashtags: string[] = [],
    platform: string = 'instagram'
  ): {
    adopt: CompetitorHashtagData[];
    avoid: CompetitorHashtagData[];
    optimize: CompetitorHashtagData[];
    insights: string[];
  } {
    const competitorData = this.COMPETITOR_DATA.get(competitorHandle);
    if (!competitorData) {
      return { adopt: [], avoid: [], optimize: [], insights: [] };
    }

    const yourHashtagsLower = yourHashtags.map(h => h.toLowerCase());
    
    const adopt: CompetitorHashtagData[] = [];
    const avoid: CompetitorHashtagData[] = [];
    const optimize: CompetitorHashtagData[] = [];

    competitorData.topHashtags.forEach(hashtag => {
      const isUsedByYou = yourHashtagsLower.includes(hashtag.hashtag.toLowerCase());

      if (!isUsedByYou && hashtag.performance === 'high') {
        adopt.push(hashtag);
      } else if (!isUsedByYou && hashtag.performance === 'low') {
        avoid.push(hashtag);
      } else if (isUsedByYou) {
        optimize.push(hashtag);
      }
    });

    const insights = [
      `Competitor uses an average of ${competitorData.averageHashtagsPerPost} hashtags per post`,
      `Their top-performing hashtag has ${Math.max(...competitorData.topHashtags.map(h => h.averageEngagement))}% engagement`,
      `They focus heavily on ${Object.keys(competitorData.hashtagCategories)[0]} hashtags`,
      ...competitorData.recommendations.slice(0, 2)
    ];

    return {
      adopt: adopt.slice(0, 5), // Top 5 recommendations
      avoid: avoid.slice(0, 3), // Top 3 to avoid
      optimize: optimize.slice(0, 5), // Top 5 to optimize
      insights
    };
  }

  /**
   * Get competitor's hashtag performance by category
   */
  static getCompetitorHashtagsByCategory(
    competitorHandle: string,
    platform: string = 'instagram'
  ): { [category: string]: CompetitorHashtagData[] } {
    const competitorData = this.COMPETITOR_DATA.get(competitorHandle);
    return competitorData?.hashtagCategories || {};
  }

  /**
   * Generate mock analysis for unknown competitors
   */
  private static generateMockAnalysis(
    competitorHandle: string,
    platform: string
  ): CompetitorAnalysis {
    // Generate realistic mock data
    const mockHashtags: CompetitorHashtagData[] = [
      {
        hashtag: '#content',
        usageCount: Math.floor(Math.random() * 50) + 20,
        averageEngagement: Math.round((Math.random() * 3 + 2) * 10) / 10,
        averageLikes: Math.floor(Math.random() * 2000) + 1000,
        averageComments: Math.floor(Math.random() * 100) + 50,
        averageShares: Math.floor(Math.random() * 20) + 10,
        lastUsed: new Date(),
        postExamples: ['post_1', 'post_2'],
        performance: 'medium'
      },
      {
        hashtag: '#business',
        usageCount: Math.floor(Math.random() * 40) + 15,
        averageEngagement: Math.round((Math.random() * 2 + 3) * 10) / 10,
        averageLikes: Math.floor(Math.random() * 1500) + 800,
        averageComments: Math.floor(Math.random() * 80) + 40,
        averageShares: Math.floor(Math.random() * 15) + 8,
        lastUsed: new Date(),
        postExamples: ['post_3', 'post_4'],
        performance: 'high'
      }
    ];

    return {
      competitorHandle,
      platform,
      totalPosts: Math.floor(Math.random() * 200) + 100,
      totalHashtags: Math.floor(Math.random() * 50) + 30,
      averageHashtagsPerPost: Math.round((Math.random() * 10 + 10) * 10) / 10,
      topHashtags: mockHashtags,
      hashtagCategories: {
        'general': mockHashtags
      },
      recommendations: [
        'Focus on niche-specific hashtags for better engagement',
        'Consider using trending hashtags in your industry',
        'Maintain consistent hashtag strategy across posts'
      ],
      lastAnalyzed: new Date()
    };
  }

  /**
   * Get multiple competitor analysis
   */
  static async analyzeMultipleCompetitors(
    competitorHandles: string[],
    platform: string = 'instagram'
  ): Promise<CompetitorAnalysis[]> {
    const analyses = await Promise.all(
      competitorHandles.map(handle => this.analyzeCompetitor(handle, platform))
    );

    return analyses.filter(analysis => analysis !== null) as CompetitorAnalysis[];
  }

  /**
   * Get aggregated insights from multiple competitors
   */
  static getAggregatedInsights(
    competitors: CompetitorAnalysis[]
  ): {
    commonHashtags: { hashtag: string; usage: number; avgEngagement: number }[];
    topPerformingHashtags: CompetitorHashtagData[];
    averageHashtagsPerPost: number;
    recommendations: string[];
  } {
    if (competitors.length === 0) {
      return {
        commonHashtags: [],
        topPerformingHashtags: [],
        averageHashtagsPerPost: 0,
        recommendations: []
      };
    }

    // Find common hashtags across competitors
    const hashtagUsage = new Map<string, { count: number; totalEngagement: number }>();
    const allHashtags: CompetitorHashtagData[] = [];

    competitors.forEach(competitor => {
      competitor.topHashtags.forEach(hashtag => {
        allHashtags.push(hashtag);
        
        const existing = hashtagUsage.get(hashtag.hashtag) || { count: 0, totalEngagement: 0 };
        hashtagUsage.set(hashtag.hashtag, {
          count: existing.count + 1,
          totalEngagement: existing.totalEngagement + hashtag.averageEngagement
        });
      });
    });

    const commonHashtags = Array.from(hashtagUsage.entries())
      .filter(([_, data]) => data.count > 1) // Used by multiple competitors
      .map(([hashtag, data]) => ({
        hashtag,
        usage: data.count,
        avgEngagement: Math.round((data.totalEngagement / data.count) * 10) / 10
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    const topPerformingHashtags = allHashtags
      .sort((a, b) => b.averageEngagement - a.averageEngagement)
      .slice(0, 10);

    const averageHashtagsPerPost = competitors.reduce(
      (sum, comp) => sum + comp.averageHashtagsPerPost, 0
    ) / competitors.length;

    const recommendations = [
      `Industry average: ${Math.round(averageHashtagsPerPost)} hashtags per post`,
      `Most common high-performing hashtag: ${commonHashtags[0]?.hashtag || 'N/A'}`,
      `Top engagement rate in industry: ${Math.max(...allHashtags.map(h => h.averageEngagement))}%`,
      'Focus on hashtags that multiple successful competitors use consistently'
    ];

    return {
      commonHashtags,
      topPerformingHashtags,
      averageHashtagsPerPost: Math.round(averageHashtagsPerPost * 10) / 10,
      recommendations
    };
  }
}
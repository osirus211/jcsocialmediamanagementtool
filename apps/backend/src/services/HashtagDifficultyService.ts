export interface HashtagDifficultyData {
  hashtag: string;
  score: number; // 1-100 (1=easy, 100=very competitive)
  difficulty: 'easy' | 'medium' | 'hard';
  postCount: number;
  engagementRate: number;
  competition: number;
  lastUpdated: Date;
  platform: string;
}

export interface HashtagAnalysis {
  hashtag: string;
  difficulty: HashtagDifficultyData;
  recommendations: string[];
}

export class HashtagDifficultyService {
  // Mock data for hashtag difficulty scores
  // In a real implementation, this would come from API calls to Instagram/TikTok/etc.
  private static readonly HASHTAG_DIFFICULTY_DATA = new Map<string, HashtagDifficultyData>([
    // Easy hashtags (1-33)
    ['#smallbusiness', {
      hashtag: '#smallbusiness',
      score: 15,
      difficulty: 'easy',
      postCount: 45000000,
      engagementRate: 3.2,
      competition: 2.1,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#handmade', {
      hashtag: '#handmade',
      score: 22,
      difficulty: 'easy',
      postCount: 38000000,
      engagementRate: 4.1,
      competition: 1.8,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#local', {
      hashtag: '#local',
      score: 18,
      difficulty: 'easy',
      postCount: 25000000,
      engagementRate: 3.8,
      competition: 1.5,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#community', {
      hashtag: '#community',
      score: 28,
      difficulty: 'easy',
      postCount: 52000000,
      engagementRate: 3.5,
      competition: 2.3,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#sustainable', {
      hashtag: '#sustainable',
      score: 25,
      difficulty: 'easy',
      postCount: 18000000,
      engagementRate: 4.2,
      competition: 1.7,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],

    // Medium hashtags (34-66)
    ['#fitness', {
      hashtag: '#fitness',
      score: 45,
      difficulty: 'medium',
      postCount: 180000000,
      engagementRate: 2.8,
      competition: 4.2,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#travel', {
      hashtag: '#travel',
      score: 52,
      difficulty: 'medium',
      postCount: 220000000,
      engagementRate: 2.5,
      competition: 4.8,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#food', {
      hashtag: '#food',
      score: 48,
      difficulty: 'medium',
      postCount: 195000000,
      engagementRate: 2.9,
      competition: 4.5,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#photography', {
      hashtag: '#photography',
      score: 55,
      difficulty: 'medium',
      postCount: 240000000,
      engagementRate: 2.3,
      competition: 5.1,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#fashion', {
      hashtag: '#fashion',
      score: 58,
      difficulty: 'medium',
      postCount: 280000000,
      engagementRate: 2.1,
      competition: 5.5,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#art', {
      hashtag: '#art',
      score: 42,
      difficulty: 'medium',
      postCount: 165000000,
      engagementRate: 3.1,
      competition: 3.8,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#music', {
      hashtag: '#music',
      score: 50,
      difficulty: 'medium',
      postCount: 200000000,
      engagementRate: 2.7,
      competition: 4.6,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],

    // Hard hashtags (67-100)
    ['#love', {
      hashtag: '#love',
      score: 85,
      difficulty: 'hard',
      postCount: 2100000000,
      engagementRate: 1.2,
      competition: 9.8,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#instagood', {
      hashtag: '#instagood',
      score: 92,
      difficulty: 'hard',
      postCount: 1800000000,
      engagementRate: 0.9,
      competition: 9.9,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#photooftheday', {
      hashtag: '#photooftheday',
      score: 88,
      difficulty: 'hard',
      postCount: 950000000,
      engagementRate: 1.1,
      competition: 9.5,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#beautiful', {
      hashtag: '#beautiful',
      score: 82,
      difficulty: 'hard',
      postCount: 780000000,
      engagementRate: 1.3,
      competition: 9.2,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#happy', {
      hashtag: '#happy',
      score: 78,
      difficulty: 'hard',
      postCount: 650000000,
      engagementRate: 1.5,
      competition: 8.8,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#follow', {
      hashtag: '#follow',
      score: 95,
      difficulty: 'hard',
      postCount: 1200000000,
      engagementRate: 0.8,
      competition: 9.9,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#like', {
      hashtag: '#like',
      score: 98,
      difficulty: 'hard',
      postCount: 1500000000,
      engagementRate: 0.6,
      competition: 10.0,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],
    ['#instagram', {
      hashtag: '#instagram',
      score: 90,
      difficulty: 'hard',
      postCount: 1100000000,
      engagementRate: 1.0,
      competition: 9.7,
      lastUpdated: new Date(),
      platform: 'instagram'
    }],

    // TikTok specific hashtags
    ['#fyp', {
      hashtag: '#fyp',
      score: 95,
      difficulty: 'hard',
      postCount: 2500000000,
      engagementRate: 0.8,
      competition: 9.9,
      lastUpdated: new Date(),
      platform: 'tiktok'
    }],
    ['#foryou', {
      hashtag: '#foryou',
      score: 93,
      difficulty: 'hard',
      postCount: 2200000000,
      engagementRate: 0.9,
      competition: 9.8,
      lastUpdated: new Date(),
      platform: 'tiktok'
    }],
    ['#viral', {
      hashtag: '#viral',
      score: 88,
      difficulty: 'hard',
      postCount: 1800000000,
      engagementRate: 1.1,
      competition: 9.5,
      lastUpdated: new Date(),
      platform: 'tiktok'
    }],
    ['#trending', {
      hashtag: '#trending',
      score: 85,
      difficulty: 'hard',
      postCount: 1500000000,
      engagementRate: 1.2,
      competition: 9.3,
      lastUpdated: new Date(),
      platform: 'tiktok'
    }],

    // LinkedIn specific hashtags
    ['#linkedin', {
      hashtag: '#linkedin',
      score: 72,
      difficulty: 'hard',
      postCount: 45000000,
      engagementRate: 1.8,
      competition: 8.5,
      lastUpdated: new Date(),
      platform: 'linkedin'
    }],
    ['#professional', {
      hashtag: '#professional',
      score: 35,
      difficulty: 'medium',
      postCount: 12000000,
      engagementRate: 3.2,
      competition: 3.5,
      lastUpdated: new Date(),
      platform: 'linkedin'
    }],
    ['#networking', {
      hashtag: '#networking',
      score: 28,
      difficulty: 'easy',
      postCount: 8000000,
      engagementRate: 3.8,
      competition: 2.8,
      lastUpdated: new Date(),
      platform: 'linkedin'
    }],
    ['#career', {
      hashtag: '#career',
      score: 42,
      difficulty: 'medium',
      postCount: 18000000,
      engagementRate: 2.9,
      competition: 4.1,
      lastUpdated: new Date(),
      platform: 'linkedin'
    }]
  ]);

  /**
   * Get difficulty score for a single hashtag
   */
  static getHashtagDifficulty(hashtag: string, platform: string = 'instagram'): HashtagDifficultyData | null {
    const normalizedHashtag = hashtag.toLowerCase().trim();
    const hashtagWithSymbol = normalizedHashtag.startsWith('#') ? normalizedHashtag : `#${normalizedHashtag}`;
    
    // First try to find platform-specific data
    const platformSpecific = this.HASHTAG_DIFFICULTY_DATA.get(hashtagWithSymbol);
    if (platformSpecific && platformSpecific.platform === platform) {
      return platformSpecific;
    }

    // If no platform-specific data, try to find generic data
    const generic = this.HASHTAG_DIFFICULTY_DATA.get(hashtagWithSymbol);
    if (generic) {
      return { ...generic, platform };
    }

    // If no data found, estimate based on hashtag characteristics
    return this.estimateHashtagDifficulty(hashtagWithSymbol, platform);
  }

  /**
   * Get difficulty scores for multiple hashtags
   */
  static getHashtagsDifficulty(hashtags: string[], platform: string = 'instagram'): HashtagDifficultyData[] {
    return hashtags.map(hashtag => {
      const difficulty = this.getHashtagDifficulty(hashtag, platform);
      return difficulty || this.estimateHashtagDifficulty(hashtag, platform);
    });
  }

  /**
   * Estimate hashtag difficulty based on characteristics
   */
  private static estimateHashtagDifficulty(hashtag: string, platform: string): HashtagDifficultyData {
    const hashtagWithoutSymbol = hashtag.replace('#', '');
    let score = 50; // Default medium difficulty
    let postCount = 10000000; // Default 10M posts
    let engagementRate = 2.5;
    let competition = 5.0;

    // Adjust based on hashtag length
    if (hashtagWithoutSymbol.length <= 5) {
      score += 20; // Short hashtags are usually more competitive
      postCount *= 5;
      competition += 2;
      engagementRate -= 0.5;
    } else if (hashtagWithoutSymbol.length > 15) {
      score -= 15; // Long hashtags are usually less competitive
      postCount /= 3;
      competition -= 1.5;
      engagementRate += 0.8;
    }

    // Adjust based on common patterns
    if (hashtagWithoutSymbol.includes('love') || 
        hashtagWithoutSymbol.includes('like') || 
        hashtagWithoutSymbol.includes('follow')) {
      score += 25;
      postCount *= 10;
      competition += 3;
      engagementRate -= 1;
    }

    // Platform-specific adjustments
    if (platform === 'tiktok') {
      if (hashtagWithoutSymbol.includes('fyp') || 
          hashtagWithoutSymbol.includes('viral') || 
          hashtagWithoutSymbol.includes('trending')) {
        score += 30;
      }
    }

    if (platform === 'linkedin') {
      // LinkedIn hashtags are generally less competitive
      score -= 10;
      postCount /= 5;
      competition -= 1;
      engagementRate += 0.5;
    }

    // Ensure score is within bounds
    score = Math.max(1, Math.min(100, score));
    
    const difficulty: 'easy' | 'medium' | 'hard' = 
      score <= 33 ? 'easy' : score <= 66 ? 'medium' : 'hard';

    return {
      hashtag,
      score,
      difficulty,
      postCount: Math.round(postCount),
      engagementRate: Math.round(engagementRate * 10) / 10,
      competition: Math.round(competition * 10) / 10,
      lastUpdated: new Date(),
      platform
    };
  }

  /**
   * Get hashtag mix recommendations
   */
  static getHashtagMixRecommendations(hashtags: string[], platform: string = 'instagram') {
    const difficulties = this.getHashtagsDifficulty(hashtags, platform);
    
    const easy = difficulties.filter(h => h.difficulty === 'easy');
    const medium = difficulties.filter(h => h.difficulty === 'medium');
    const hard = difficulties.filter(h => h.difficulty === 'hard');

    const recommendations: string[] = [];

    // Ideal mix: 40% easy, 40% medium, 20% hard
    const totalHashtags = hashtags.length;
    const idealEasy = Math.round(totalHashtags * 0.4);
    const idealMedium = Math.round(totalHashtags * 0.4);
    const idealHard = Math.round(totalHashtags * 0.2);

    if (easy.length < idealEasy) {
      recommendations.push(`Add ${idealEasy - easy.length} more easy hashtags (1-33 difficulty) for better reach`);
    }
    if (medium.length < idealMedium) {
      recommendations.push(`Add ${idealMedium - medium.length} more medium hashtags (34-66 difficulty) for balanced growth`);
    }
    if (hard.length > idealHard) {
      recommendations.push(`Consider reducing hard hashtags (67-100 difficulty) by ${hard.length - idealHard} for better visibility`);
    }

    if (hard.length === 0 && totalHashtags > 5) {
      recommendations.push('Consider adding 1-2 competitive hashtags to potentially reach larger audiences');
    }

    if (easy.length === 0 && totalHashtags > 3) {
      recommendations.push('Add some niche/easy hashtags to ensure your content gets discovered');
    }

    return {
      current: {
        easy: easy.length,
        medium: medium.length,
        hard: hard.length
      },
      ideal: {
        easy: idealEasy,
        medium: idealMedium,
        hard: idealHard
      },
      recommendations,
      averageScore: Math.round(difficulties.reduce((sum, h) => sum + h.score, 0) / difficulties.length),
      difficulties
    };
  }

  /**
   * Get color class for difficulty score
   */
  static getDifficultyColor(score: number): string {
    if (score <= 33) return 'text-green-600 bg-green-100';
    if (score <= 66) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  }

  /**
   * Get difficulty label
   */
  static getDifficultyLabel(score: number): string {
    if (score <= 33) return 'Easy';
    if (score <= 66) return 'Medium';
    return 'Hard';
  }

  /**
   * Suggest better hashtag alternatives
   */
  static suggestAlternatives(hashtag: string, platform: string = 'instagram'): string[] {
    const difficulty = this.getHashtagDifficulty(hashtag, platform);
    
    if (!difficulty || difficulty.score <= 50) {
      return []; // Already good or no data
    }

    const hashtagWithoutSymbol = hashtag.replace('#', '').toLowerCase();
    const alternatives: string[] = [];

    // Generate more specific alternatives
    const commonSuffixes = ['tips', 'guide', 'daily', 'life', 'style', 'lover', 'addict', 'community'];
    const commonPrefixes = ['my', 'daily', 'local', 'small', 'mini', 'best'];

    // Add more specific versions
    commonSuffixes.forEach(suffix => {
      alternatives.push(`#${hashtagWithoutSymbol}${suffix}`);
    });

    commonPrefixes.forEach(prefix => {
      alternatives.push(`#${prefix}${hashtagWithoutSymbol}`);
    });

    // Add location-based alternatives if applicable
    if (platform === 'instagram') {
      alternatives.push(`#${hashtagWithoutSymbol}gram`);
      alternatives.push(`#${hashtagWithoutSymbol}daily`);
      alternatives.push(`#${hashtagWithoutSymbol}love`);
    }

    return alternatives.slice(0, 5); // Return top 5 alternatives
  }
}
export interface RelatedHashtag {
  hashtag: string;
  relevanceScore: number; // 0-100
  category: 'niche' | 'size' | 'theme' | 'trending';
  postCount: number;
  engagementRate: number;
  reason: string; // Why it's related
}

export interface RelatedHashtagsGroup {
  category: 'niche' | 'size' | 'theme' | 'trending';
  title: string;
  description: string;
  hashtags: RelatedHashtag[];
}

export interface RelatedHashtagsResponse {
  originalHashtag: string;
  groups: RelatedHashtagsGroup[];
  totalSuggestions: number;
}

export class RelatedHashtagsService {
  // Mock related hashtags database
  // In a real implementation, this would use AI/ML models and real-time data
  private static readonly RELATED_HASHTAGS_DB = new Map<string, RelatedHashtag[]>([
    ['#travel', [
      // Niche related
      { hashtag: '#backpacking', relevanceScore: 85, category: 'niche', postCount: 15000000, engagementRate: 3.2, reason: 'Travel style subcategory' },
      { hashtag: '#solotravel', relevanceScore: 82, category: 'niche', postCount: 8000000, engagementRate: 4.1, reason: 'Specific travel type' },
      { hashtag: '#budgettravel', relevanceScore: 78, category: 'niche', postCount: 12000000, engagementRate: 3.8, reason: 'Travel budget category' },
      { hashtag: '#luxurytravel', relevanceScore: 75, category: 'niche', postCount: 18000000, engagementRate: 2.9, reason: 'Premium travel segment' },
      
      // Size related (similar popularity)
      { hashtag: '#wanderlust', relevanceScore: 90, category: 'size', postCount: 180000000, engagementRate: 2.8, reason: 'Similar audience size and theme' },
      { hashtag: '#adventure', relevanceScore: 88, category: 'size', postCount: 165000000, engagementRate: 3.1, reason: 'Comparable engagement in travel niche' },
      { hashtag: '#explore', relevanceScore: 85, category: 'size', postCount: 195000000, engagementRate: 2.6, reason: 'Similar reach and travel focus' },
      
      // Theme related
      { hashtag: '#vacation', relevanceScore: 92, category: 'theme', postCount: 145000000, engagementRate: 2.7, reason: 'Core travel theme' },
      { hashtag: '#holiday', relevanceScore: 88, category: 'theme', postCount: 125000000, engagementRate: 2.9, reason: 'Travel occasion theme' },
      { hashtag: '#journey', relevanceScore: 80, category: 'theme', postCount: 85000000, engagementRate: 3.3, reason: 'Travel experience theme' },
      
      // Trending
      { hashtag: '#digitalnomad', relevanceScore: 75, category: 'trending', postCount: 25000000, engagementRate: 4.2, reason: 'Growing travel trend' },
      { hashtag: '#sustainabletravel', relevanceScore: 72, category: 'trending', postCount: 8000000, engagementRate: 4.8, reason: 'Emerging eco-travel trend' }
    ]],
    
    ['#fitness', [
      // Niche related
      { hashtag: '#homeworkout', relevanceScore: 88, category: 'niche', postCount: 45000000, engagementRate: 3.5, reason: 'Specific workout location' },
      { hashtag: '#cardio', relevanceScore: 85, category: 'niche', postCount: 35000000, engagementRate: 3.2, reason: 'Exercise type subcategory' },
      { hashtag: '#strength', relevanceScore: 82, category: 'niche', postCount: 28000000, engagementRate: 3.8, reason: 'Training method focus' },
      { hashtag: '#yoga', relevanceScore: 80, category: 'niche', postCount: 95000000, engagementRate: 3.1, reason: 'Fitness discipline' },
      
      // Size related
      { hashtag: '#workout', relevanceScore: 92, category: 'size', postCount: 175000000, engagementRate: 2.9, reason: 'Similar fitness audience' },
      { hashtag: '#gym', relevanceScore: 90, category: 'size', postCount: 155000000, engagementRate: 2.7, reason: 'Comparable fitness engagement' },
      { hashtag: '#health', relevanceScore: 85, category: 'size', postCount: 185000000, engagementRate: 2.5, reason: 'Broader wellness category' },
      
      // Theme related
      { hashtag: '#motivation', relevanceScore: 88, category: 'theme', postCount: 125000000, engagementRate: 3.0, reason: 'Fitness mindset theme' },
      { hashtag: '#transformation', relevanceScore: 85, category: 'theme', postCount: 65000000, engagementRate: 3.4, reason: 'Fitness journey theme' },
      { hashtag: '#strong', relevanceScore: 82, category: 'theme', postCount: 85000000, engagementRate: 3.2, reason: 'Fitness goal theme' },
      
      // Trending
      { hashtag: '#hiit', relevanceScore: 78, category: 'trending', postCount: 22000000, engagementRate: 4.1, reason: 'Popular workout trend' },
      { hashtag: '#mindfulness', relevanceScore: 75, category: 'trending', postCount: 18000000, engagementRate: 4.3, reason: 'Wellness trend integration' }
    ]],
    
    ['#food', [
      // Niche related
      { hashtag: '#vegan', relevanceScore: 85, category: 'niche', postCount: 85000000, engagementRate: 3.8, reason: 'Dietary preference subcategory' },
      { hashtag: '#homecooking', relevanceScore: 82, category: 'niche', postCount: 35000000, engagementRate: 4.2, reason: 'Cooking method focus' },
      { hashtag: '#baking', relevanceScore: 80, category: 'niche', postCount: 55000000, engagementRate: 3.9, reason: 'Food preparation type' },
      { hashtag: '#recipe', relevanceScore: 88, category: 'niche', postCount: 65000000, engagementRate: 3.6, reason: 'Food content type' },
      
      // Size related
      { hashtag: '#foodie', relevanceScore: 90, category: 'size', postCount: 185000000, engagementRate: 2.8, reason: 'Food enthusiast community' },
      { hashtag: '#delicious', relevanceScore: 88, category: 'size', postCount: 165000000, engagementRate: 2.6, reason: 'Food quality descriptor' },
      { hashtag: '#yummy', relevanceScore: 85, category: 'size', postCount: 145000000, engagementRate: 2.9, reason: 'Food appreciation term' },
      
      // Theme related
      { hashtag: '#cooking', relevanceScore: 92, category: 'theme', postCount: 125000000, engagementRate: 3.1, reason: 'Food preparation theme' },
      { hashtag: '#restaurant', relevanceScore: 85, category: 'theme', postCount: 95000000, engagementRate: 2.7, reason: 'Dining experience theme' },
      { hashtag: '#healthy', relevanceScore: 82, category: 'theme', postCount: 115000000, engagementRate: 3.3, reason: 'Nutrition focus theme' },
      
      // Trending
      { hashtag: '#plantbased', relevanceScore: 78, category: 'trending', postCount: 28000000, engagementRate: 4.5, reason: 'Growing dietary trend' },
      { hashtag: '#foodwaste', relevanceScore: 72, category: 'trending', postCount: 5000000, engagementRate: 5.2, reason: 'Sustainability food trend' }
    ]],
    
    ['#photography', [
      // Niche related
      { hashtag: '#portrait', relevanceScore: 88, category: 'niche', postCount: 125000000, engagementRate: 3.2, reason: 'Photography genre' },
      { hashtag: '#landscape', relevanceScore: 85, category: 'niche', postCount: 95000000, engagementRate: 3.5, reason: 'Photography style' },
      { hashtag: '#streetphotography', relevanceScore: 82, category: 'niche', postCount: 45000000, engagementRate: 4.1, reason: 'Specific photography type' },
      { hashtag: '#macro', relevanceScore: 78, category: 'niche', postCount: 25000000, engagementRate: 4.3, reason: 'Technical photography style' },
      
      // Size related
      { hashtag: '#photo', relevanceScore: 90, category: 'size', postCount: 285000000, engagementRate: 2.1, reason: 'Broader photo category' },
      { hashtag: '#camera', relevanceScore: 85, category: 'size', postCount: 85000000, engagementRate: 3.0, reason: 'Photography equipment focus' },
      { hashtag: '#photographer', relevanceScore: 88, category: 'size', postCount: 155000000, engagementRate: 2.8, reason: 'Creator community' },
      
      // Theme related
      { hashtag: '#art', relevanceScore: 85, category: 'theme', postCount: 165000000, engagementRate: 3.1, reason: 'Creative expression theme' },
      { hashtag: '#creative', relevanceScore: 82, category: 'theme', postCount: 95000000, engagementRate: 3.4, reason: 'Artistic process theme' },
      { hashtag: '#visual', relevanceScore: 80, category: 'theme', postCount: 65000000, engagementRate: 3.6, reason: 'Visual content theme' },
      
      // Trending
      { hashtag: '#mobilephotography', relevanceScore: 75, category: 'trending', postCount: 18000000, engagementRate: 4.2, reason: 'Smartphone photography trend' },
      { hashtag: '#aiart', relevanceScore: 72, category: 'trending', postCount: 12000000, engagementRate: 4.8, reason: 'AI-generated visual trend' }
    ]],
    
    ['#fashion', [
      // Niche related
      { hashtag: '#streetstyle', relevanceScore: 88, category: 'niche', postCount: 65000000, engagementRate: 3.4, reason: 'Fashion subcategory' },
      { hashtag: '#vintage', relevanceScore: 85, category: 'niche', postCount: 45000000, engagementRate: 3.8, reason: 'Fashion era style' },
      { hashtag: '#sustainable', relevanceScore: 82, category: 'niche', postCount: 18000000, engagementRate: 4.2, reason: 'Ethical fashion focus' },
      { hashtag: '#luxury', relevanceScore: 80, category: 'niche', postCount: 55000000, engagementRate: 2.9, reason: 'Premium fashion segment' },
      
      // Size related
      { hashtag: '#style', relevanceScore: 92, category: 'size', postCount: 285000000, engagementRate: 2.3, reason: 'Broader style category' },
      { hashtag: '#outfit', relevanceScore: 90, category: 'size', postCount: 195000000, engagementRate: 2.8, reason: 'Fashion coordination focus' },
      { hashtag: '#ootd', relevanceScore: 88, category: 'size', postCount: 165000000, engagementRate: 3.1, reason: 'Daily outfit sharing' },
      
      // Theme related
      { hashtag: '#beauty', relevanceScore: 85, category: 'theme', postCount: 225000000, engagementRate: 2.6, reason: 'Style and beauty connection' },
      { hashtag: '#trend', relevanceScore: 82, category: 'theme', postCount: 125000000, engagementRate: 2.9, reason: 'Fashion trend focus' },
      { hashtag: '#designer', relevanceScore: 80, category: 'theme', postCount: 85000000, engagementRate: 3.2, reason: 'High-end fashion theme' },
      
      // Trending
      { hashtag: '#genderless', relevanceScore: 75, category: 'trending', postCount: 8000000, engagementRate: 4.5, reason: 'Inclusive fashion trend' },
      { hashtag: '#thrifted', relevanceScore: 78, category: 'trending', postCount: 15000000, engagementRate: 4.1, reason: 'Sustainable shopping trend' }
    ]]
  ]);

  /**
   * Get related hashtags for a given hashtag
   */
  static getRelatedHashtags(hashtag: string, platform: string = 'instagram'): RelatedHashtagsResponse {
    const normalizedHashtag = hashtag.toLowerCase().trim();
    const hashtagWithSymbol = normalizedHashtag.startsWith('#') ? normalizedHashtag : `#${normalizedHashtag}`;
    
    // Get related hashtags from database
    let relatedHashtags = this.RELATED_HASHTAGS_DB.get(hashtagWithSymbol) || [];
    
    // If no direct match, try to find similar hashtags
    if (relatedHashtags.length === 0) {
      relatedHashtags = this.generateRelatedHashtags(hashtagWithSymbol, platform);
    }

    // Group hashtags by category
    const groups: RelatedHashtagsGroup[] = [
      {
        category: 'niche' as const,
        title: 'Niche & Specific',
        description: 'More specific hashtags in your category',
        hashtags: relatedHashtags.filter(h => h.category === 'niche')
      },
      {
        category: 'size' as const,
        title: 'Similar Size',
        description: 'Hashtags with similar audience size',
        hashtags: relatedHashtags.filter(h => h.category === 'size')
      },
      {
        category: 'theme' as const,
        title: 'Related Themes',
        description: 'Hashtags with related themes and topics',
        hashtags: relatedHashtags.filter(h => h.category === 'theme')
      },
      {
        category: 'trending' as const,
        title: 'Trending Related',
        description: 'Currently trending hashtags in your niche',
        hashtags: relatedHashtags.filter(h => h.category === 'trending')
      }
    ].filter(group => group.hashtags.length > 0);

    return {
      originalHashtag: hashtagWithSymbol,
      groups,
      totalSuggestions: relatedHashtags.length
    };
  }

  /**
   * Generate related hashtags using pattern matching and AI-like logic
   */
  private static generateRelatedHashtags(hashtag: string, platform: string): RelatedHashtag[] {
    const hashtagWithoutSymbol = hashtag.replace('#', '').toLowerCase();
    const relatedHashtags: RelatedHashtag[] = [];

    // Common word associations
    const associations = new Map<string, string[]>([
      ['business', ['entrepreneur', 'startup', 'marketing', 'success', 'growth']],
      ['art', ['creative', 'design', 'artist', 'painting', 'drawing']],
      ['music', ['song', 'artist', 'concert', 'melody', 'rhythm']],
      ['nature', ['outdoor', 'wildlife', 'landscape', 'green', 'earth']],
      ['tech', ['innovation', 'digital', 'future', 'coding', 'ai']],
      ['health', ['wellness', 'fitness', 'nutrition', 'mindful', 'healing']],
      ['love', ['romance', 'relationship', 'heart', 'couple', 'together']],
      ['life', ['lifestyle', 'daily', 'living', 'experience', 'journey']]
    ]);

    // Find associations
    for (const [key, values] of associations) {
      if (hashtagWithoutSymbol.includes(key)) {
        values.forEach((value, index) => {
          relatedHashtags.push({
            hashtag: `#${value}`,
            relevanceScore: 80 - (index * 5),
            category: 'theme',
            postCount: Math.floor(Math.random() * 50000000) + 10000000,
            engagementRate: Math.round((Math.random() * 2 + 2.5) * 10) / 10,
            reason: `Related to ${key} theme`
          });
        });
        break;
      }
    }

    // Generate niche variations
    const nicheSuffixes = ['daily', 'life', 'lover', 'addict', 'community', 'tips', 'guide'];
    nicheSuffixes.forEach((suffix, index) => {
      if (index < 3) { // Limit to 3 niche suggestions
        relatedHashtags.push({
          hashtag: `#${hashtagWithoutSymbol}${suffix}`,
          relevanceScore: 75 - (index * 5),
          category: 'niche',
          postCount: Math.floor(Math.random() * 20000000) + 5000000,
          engagementRate: Math.round((Math.random() * 1.5 + 3.5) * 10) / 10,
          reason: `More specific ${hashtagWithoutSymbol} content`
        });
      }
    });

    // Generate size-similar hashtags (generic popular ones)
    const popularHashtags = ['inspiration', 'motivation', 'amazing', 'beautiful', 'awesome'];
    popularHashtags.forEach((popular, index) => {
      if (index < 2) { // Limit to 2 size suggestions
        relatedHashtags.push({
          hashtag: `#${popular}`,
          relevanceScore: 70 - (index * 5),
          category: 'size',
          postCount: Math.floor(Math.random() * 100000000) + 50000000,
          engagementRate: Math.round((Math.random() * 1 + 2.5) * 10) / 10,
          reason: `Similar audience size and engagement`
        });
      }
    });

    // Generate trending hashtags
    const trendingPrefixes = ['new', 'trending', '2024', 'viral'];
    trendingPrefixes.forEach((prefix, index) => {
      if (index < 2) { // Limit to 2 trending suggestions
        relatedHashtags.push({
          hashtag: `#${prefix}${hashtagWithoutSymbol}`,
          relevanceScore: 65 - (index * 5),
          category: 'trending',
          postCount: Math.floor(Math.random() * 15000000) + 2000000,
          engagementRate: Math.round((Math.random() * 2 + 4) * 10) / 10,
          reason: `Trending variation of ${hashtagWithoutSymbol}`
        });
      }
    });

    return relatedHashtags.slice(0, 12); // Limit total suggestions
  }

  /**
   * Get related hashtags for multiple hashtags
   */
  static getRelatedHashtagsForMultiple(hashtags: string[], platform: string = 'instagram') {
    const results = hashtags.map(hashtag => ({
      hashtag,
      related: this.getRelatedHashtags(hashtag, platform)
    }));

    // Combine and deduplicate suggestions
    const allSuggestions = new Map<string, RelatedHashtag>();
    
    results.forEach(result => {
      result.related.groups.forEach(group => {
        group.hashtags.forEach(hashtag => {
          if (!allSuggestions.has(hashtag.hashtag)) {
            allSuggestions.set(hashtag.hashtag, hashtag);
          }
        });
      });
    });

    // Remove original hashtags from suggestions
    hashtags.forEach(hashtag => {
      const normalized = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
      allSuggestions.delete(normalized.toLowerCase());
    });

    return {
      originalHashtags: hashtags,
      individualResults: results,
      combinedSuggestions: Array.from(allSuggestions.values())
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 20) // Top 20 suggestions
    };
  }

  /**
   * Search for hashtags by keyword
   */
  static searchRelatedHashtags(keyword: string, platform: string = 'instagram', limit: number = 10): RelatedHashtag[] {
    const normalizedKeyword = keyword.toLowerCase().trim();
    const suggestions: RelatedHashtag[] = [];

    // Search through all known hashtags
    for (const [hashtag, relatedList] of this.RELATED_HASHTAGS_DB) {
      if (hashtag.includes(normalizedKeyword)) {
        suggestions.push({
          hashtag,
          relevanceScore: 90,
          category: 'theme',
          postCount: Math.floor(Math.random() * 100000000) + 10000000,
          engagementRate: Math.round((Math.random() * 2 + 2.5) * 10) / 10,
          reason: `Contains keyword "${keyword}"`
        });
      }

      // Also search in related hashtags
      relatedList.forEach(related => {
        if (related.hashtag.includes(normalizedKeyword) && 
            !suggestions.find(s => s.hashtag === related.hashtag)) {
          suggestions.push({
            ...related,
            reason: `Related hashtag containing "${keyword}"`
          });
        }
      });
    }

    // Generate additional suggestions based on keyword
    const keywordSuggestions = this.generateRelatedHashtags(`#${normalizedKeyword}`, platform);
    keywordSuggestions.forEach(suggestion => {
      if (!suggestions.find(s => s.hashtag === suggestion.hashtag)) {
        suggestions.push(suggestion);
      }
    });

    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }
}
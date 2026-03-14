export interface BannedHashtagInfo {
  hashtag: string;
  platform: string;
  reason: string;
  severity: 'warning' | 'banned' | 'shadowbanned';
  alternatives: string[];
  lastUpdated: Date;
}

export interface HashtagCheckResult {
  hashtag: string;
  isBanned: boolean;
  info?: BannedHashtagInfo;
}

export class BannedHashtagChecker {
  // Known banned/problematic hashtags for Instagram
  private static readonly INSTAGRAM_BANNED_HASHTAGS = new Map<string, BannedHashtagInfo>([
    ['#alone', {
      hashtag: '#alone',
      platform: 'instagram',
      reason: 'Associated with self-harm content',
      severity: 'banned',
      alternatives: ['#solitude', '#peaceful', '#quiet'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#depression', {
      hashtag: '#depression',
      platform: 'instagram',
      reason: 'Mental health content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#mentalhealth', '#wellness', '#selfcare'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#suicide', {
      hashtag: '#suicide',
      platform: 'instagram',
      reason: 'Self-harm content policy violation',
      severity: 'banned',
      alternatives: ['#mentalhealth', '#support', '#help'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#selfharm', {
      hashtag: '#selfharm',
      platform: 'instagram',
      reason: 'Self-harm content policy violation',
      severity: 'banned',
      alternatives: ['#recovery', '#healing', '#support'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#eatingdisorder', {
      hashtag: '#eatingdisorder',
      platform: 'instagram',
      reason: 'Eating disorder content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#bodypositive', '#healthyeating', '#wellness'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#thinspo', {
      hashtag: '#thinspo',
      platform: 'instagram',
      reason: 'Promotes unhealthy body image',
      severity: 'banned',
      alternatives: ['#bodypositive', '#healthyliving', '#fitness'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#proanorexia', {
      hashtag: '#proanorexia',
      platform: 'instagram',
      reason: 'Promotes eating disorders',
      severity: 'banned',
      alternatives: ['#recovery', '#bodypositive', '#mentalhealth'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#probulimia', {
      hashtag: '#probulimia',
      platform: 'instagram',
      reason: 'Promotes eating disorders',
      severity: 'banned',
      alternatives: ['#recovery', '#bodypositive', '#mentalhealth'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#cutting', {
      hashtag: '#cutting',
      platform: 'instagram',
      reason: 'Self-harm content',
      severity: 'banned',
      alternatives: ['#recovery', '#healing', '#mentalhealth'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#selfie', {
      hashtag: '#selfie',
      platform: 'instagram',
      reason: 'Overused and may reduce reach',
      severity: 'shadowbanned',
      alternatives: ['#portrait', '#smile', '#me'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#like4like', {
      hashtag: '#like4like',
      platform: 'instagram',
      reason: 'Engagement pod behavior',
      severity: 'shadowbanned',
      alternatives: ['#engagement', '#community', '#connect'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#follow4follow', {
      hashtag: '#follow4follow',
      platform: 'instagram',
      reason: 'Engagement pod behavior',
      severity: 'shadowbanned',
      alternatives: ['#community', '#connect', '#networking'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#followforfollow', {
      hashtag: '#followforfollow',
      platform: 'instagram',
      reason: 'Engagement pod behavior',
      severity: 'shadowbanned',
      alternatives: ['#community', '#connect', '#networking'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#likeforlike', {
      hashtag: '#likeforlike',
      platform: 'instagram',
      reason: 'Engagement pod behavior',
      severity: 'shadowbanned',
      alternatives: ['#engagement', '#community', '#connect'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#followme', {
      hashtag: '#followme',
      platform: 'instagram',
      reason: 'Overused and spammy',
      severity: 'shadowbanned',
      alternatives: ['#connect', '#community', '#follow'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#tagsforlikes', {
      hashtag: '#tagsforlikes',
      platform: 'instagram',
      reason: 'Engagement manipulation',
      severity: 'shadowbanned',
      alternatives: ['#engagement', '#community', '#hashtags'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#instagramers', {
      hashtag: '#instagramers',
      platform: 'instagram',
      reason: 'Overused generic hashtag',
      severity: 'shadowbanned',
      alternatives: ['#community', '#creators', '#instagram'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#igers', {
      hashtag: '#igers',
      platform: 'instagram',
      reason: 'Overused generic hashtag',
      severity: 'shadowbanned',
      alternatives: ['#community', '#creators', '#photography'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#boobs', {
      hashtag: '#boobs',
      platform: 'instagram',
      reason: 'Adult content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#bodypositive', '#confidence', '#selfcare'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#sex', {
      hashtag: '#sex',
      platform: 'instagram',
      reason: 'Adult content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#relationships', '#love', '#intimacy'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#nude', {
      hashtag: '#nude',
      platform: 'instagram',
      reason: 'Adult content restrictions',
      severity: 'banned',
      alternatives: ['#art', '#photography', '#artistic'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#naked', {
      hashtag: '#naked',
      platform: 'instagram',
      reason: 'Adult content restrictions',
      severity: 'banned',
      alternatives: ['#natural', '#authentic', '#raw'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#porn', {
      hashtag: '#porn',
      platform: 'instagram',
      reason: 'Adult content policy violation',
      severity: 'banned',
      alternatives: ['#art', '#photography', '#creative'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#drugs', {
      hashtag: '#drugs',
      platform: 'instagram',
      reason: 'Illegal substance content',
      severity: 'banned',
      alternatives: ['#health', '#wellness', '#recovery'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#weed', {
      hashtag: '#weed',
      platform: 'instagram',
      reason: 'Drug-related content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#nature', '#plants', '#wellness'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#marijuana', {
      hashtag: '#marijuana',
      platform: 'instagram',
      reason: 'Drug-related content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#wellness', '#natural', '#health'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#cannabis', {
      hashtag: '#cannabis',
      platform: 'instagram',
      reason: 'Drug-related content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#wellness', '#natural', '#health'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#cocaine', {
      hashtag: '#cocaine',
      platform: 'instagram',
      reason: 'Illegal drug content',
      severity: 'banned',
      alternatives: ['#recovery', '#health', '#wellness'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#heroin', {
      hashtag: '#heroin',
      platform: 'instagram',
      reason: 'Illegal drug content',
      severity: 'banned',
      alternatives: ['#recovery', '#health', '#support'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#violence', {
      hashtag: '#violence',
      platform: 'instagram',
      reason: 'Violent content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#peace', '#awareness', '#change'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#gun', {
      hashtag: '#gun',
      platform: 'instagram',
      reason: 'Weapon content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#safety', '#security', '#protection'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#weapon', {
      hashtag: '#weapon',
      platform: 'instagram',
      reason: 'Weapon content restrictions',
      severity: 'shadowbanned',
      alternatives: ['#collection', '#history', '#military'],
      lastUpdated: new Date('2024-01-01')
    }]
  ]);

  // Twitter/X banned hashtags (smaller list as they're more lenient)
  private static readonly TWITTER_BANNED_HASHTAGS = new Map<string, BannedHashtagInfo>([
    ['#suicide', {
      hashtag: '#suicide',
      platform: 'twitter',
      reason: 'Self-harm content policy violation',
      severity: 'banned',
      alternatives: ['#mentalhealth', '#support', '#help'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#selfharm', {
      hashtag: '#selfharm',
      platform: 'twitter',
      reason: 'Self-harm content policy violation',
      severity: 'banned',
      alternatives: ['#recovery', '#healing', '#support'],
      lastUpdated: new Date('2024-01-01')
    }]
  ]);

  // TikTok banned hashtags
  private static readonly TIKTOK_BANNED_HASHTAGS = new Map<string, BannedHashtagInfo>([
    ['#suicide', {
      hashtag: '#suicide',
      platform: 'tiktok',
      reason: 'Self-harm content policy violation',
      severity: 'banned',
      alternatives: ['#mentalhealth', '#support', '#help'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#selfharm', {
      hashtag: '#selfharm',
      platform: 'tiktok',
      reason: 'Self-harm content policy violation',
      severity: 'banned',
      alternatives: ['#recovery', '#healing', '#support'],
      lastUpdated: new Date('2024-01-01')
    }],
    ['#leggings', {
      hashtag: '#leggings',
      platform: 'tiktok',
      reason: 'Temporarily restricted due to inappropriate content',
      severity: 'shadowbanned',
      alternatives: ['#fashion', '#outfit', '#style'],
      lastUpdated: new Date('2024-01-01')
    }]
  ]);

  /**
   * Check if a hashtag is banned or problematic for a specific platform
   */
  static checkHashtag(hashtag: string, platform: string): HashtagCheckResult {
    const normalizedHashtag = hashtag.toLowerCase().trim();
    
    // Ensure hashtag starts with #
    const hashtagWithSymbol = normalizedHashtag.startsWith('#') ? normalizedHashtag : `#${normalizedHashtag}`;

    let bannedHashtags: Map<string, BannedHashtagInfo>;
    
    switch (platform.toLowerCase()) {
      case 'instagram':
        bannedHashtags = this.INSTAGRAM_BANNED_HASHTAGS;
        break;
      case 'twitter':
      case 'x':
        bannedHashtags = this.TWITTER_BANNED_HASHTAGS;
        break;
      case 'tiktok':
        bannedHashtags = this.TIKTOK_BANNED_HASHTAGS;
        break;
      default:
        // For other platforms, check Instagram list as it's most comprehensive
        bannedHashtags = this.INSTAGRAM_BANNED_HASHTAGS;
    }

    const bannedInfo = bannedHashtags.get(hashtagWithSymbol);
    
    return {
      hashtag: hashtagWithSymbol,
      isBanned: !!bannedInfo,
      info: bannedInfo
    };
  }

  /**
   * Check multiple hashtags at once
   */
  static checkHashtags(hashtags: string[], platform: string): HashtagCheckResult[] {
    return hashtags.map(hashtag => this.checkHashtag(hashtag, platform));
  }

  /**
   * Get all banned hashtags for a platform
   */
  static getBannedHashtagsForPlatform(platform: string): BannedHashtagInfo[] {
    let bannedHashtags: Map<string, BannedHashtagInfo>;
    
    switch (platform.toLowerCase()) {
      case 'instagram':
        bannedHashtags = this.INSTAGRAM_BANNED_HASHTAGS;
        break;
      case 'twitter':
      case 'x':
        bannedHashtags = this.TWITTER_BANNED_HASHTAGS;
        break;
      case 'tiktok':
        bannedHashtags = this.TIKTOK_BANNED_HASHTAGS;
        break;
      default:
        return [];
    }

    return Array.from(bannedHashtags.values());
  }

  /**
   * Get safe alternative hashtags for a banned hashtag
   */
  static getAlternatives(hashtag: string, platform: string): string[] {
    const result = this.checkHashtag(hashtag, platform);
    return result.info?.alternatives || [];
  }

  /**
   * Filter out banned hashtags from a list
   */
  static filterSafeHashtags(hashtags: string[], platform: string): string[] {
    return hashtags.filter(hashtag => {
      const result = this.checkHashtag(hashtag, platform);
      return !result.isBanned;
    });
  }

  /**
   * Get hashtag safety report
   */
  static getHashtagSafetyReport(hashtags: string[], platform: string) {
    const results = this.checkHashtags(hashtags, platform);
    const banned = results.filter(r => r.isBanned && r.info?.severity === 'banned');
    const shadowbanned = results.filter(r => r.isBanned && r.info?.severity === 'shadowbanned');
    const warnings = results.filter(r => r.isBanned && r.info?.severity === 'warning');
    const safe = results.filter(r => !r.isBanned);

    return {
      total: hashtags.length,
      safe: safe.length,
      banned: banned.length,
      shadowbanned: shadowbanned.length,
      warnings: warnings.length,
      results,
      recommendations: {
        banned: banned.map(r => ({
          hashtag: r.hashtag,
          reason: r.info!.reason,
          alternatives: r.info!.alternatives
        })),
        shadowbanned: shadowbanned.map(r => ({
          hashtag: r.hashtag,
          reason: r.info!.reason,
          alternatives: r.info!.alternatives
        }))
      }
    };
  }
}
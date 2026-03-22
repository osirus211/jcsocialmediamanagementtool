export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  twitter: 280,
  threads: 500,
  bluesky: 300,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  reddit: 40000,
  mastodon: 500,
  google_business: 1500,
};

export const PLATFORM_SIZE_LIMITS: Record<string, number> = {
  instagram: 8 * 1024 * 1024,
  instagram_video: 100 * 1024 * 1024,
  twitter: 5 * 1024 * 1024,
  twitter_video: 512 * 1024 * 1024,
  facebook: 10 * 1024 * 1024,
  linkedin: 10 * 1024 * 1024,
  tiktok_video: 287 * 1024 * 1024,
  default: 20 * 1024 * 1024,
};

export const PLATFORM_MEDIA_LIMITS: Record<string, number> = {
  twitter: 4,
  instagram: 10,
  facebook: 10,
  linkedin: 9,
  pinterest: 1,
  tiktok: 1,
  threads: 10,
  default: 10,
};

export const PLATFORM_ASPECT_RATIOS: Record<string, { min: number; max: number; label: string }> = {
  instagram_feed: { min: 0.8, max: 1.91, label: '4:5 to 1.91:1' },
  instagram_story: { min: 0.5625, max: 0.5625, label: '9:16' },
  twitter: { min: 1.0, max: 3.0, label: '1:1 to 3:1' },
  pinterest: { min: 0.5, max: 1.0, label: '2:3 recommended' },
  linkedin: { min: 1.0, max: 2.4, label: '1.91:1 to 1:1' },
};

export const SSRF_BLOCKED_PATTERNS = [
  'localhost',
  '127.',
  '0.0.0.0',
  '169.254.',
  '::1',
  '.internal',
  '.local',
];

export const SSRF_BLOCKED_CIDRS = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
];

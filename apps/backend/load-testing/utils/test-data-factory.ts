/**
 * Test Data Factory
 * 
 * Generates fake data for load testing
 */

import { faker } from '@faker-js/faker';

export interface TestWorkspace {
  name: string;
  ownerId: string;
  plan: string;
}

export interface TestUser {
  email: string;
  name: string;
  password: string;
}

export interface TestSocialAccount {
  provider: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  workspaceId: string;
  status: string;
}

export interface TestPost {
  content: string;
  workspaceId: string;
  socialAccountIds: string[];
  scheduledAt: Date;
  status: string;
  mediaUrls?: string[];
  metadata: any;
}

export class TestDataFactory {
  /**
   * Generate test workspace
   */
  static generateWorkspace(ownerId: string): TestWorkspace {
    return {
      name: faker.company.name(),
      ownerId,
      plan: 'pro',
    };
  }

  /**
   * Generate test user
   */
  static generateUser(): TestUser {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      name: `${firstName} ${lastName}`,
      password: 'test-password-123',
    };
  }

  /**
   * Generate test social account
   */
  static generateSocialAccount(
    workspaceId: string,
    platform: string
  ): TestSocialAccount {
    return {
      provider: platform,
      username: faker.internet.userName(),
      accessToken: `test_access_${faker.string.alphanumeric(32)}`,
      refreshToken: `test_refresh_${faker.string.alphanumeric(32)}`,
      workspaceId,
      status: 'active',
    };
  }

  /**
   * Generate test post
   */
  static generatePost(
    workspaceId: string,
    socialAccountIds: string[],
    scheduledAt: Date,
    includeMedia: boolean = false
  ): TestPost {
    const post: TestPost = {
      content: faker.lorem.paragraph(),
      workspaceId,
      socialAccountIds,
      scheduledAt,
      status: 'scheduled',
      metadata: {
        testPost: true,
        generatedAt: new Date(),
      },
    };

    if (includeMedia && Math.random() > 0.5) {
      post.mediaUrls = [
        faker.image.url(),
        ...(Math.random() > 0.7 ? [faker.image.url()] : []),
      ];
    }

    return post;
  }

  /**
   * Generate random scheduled time within next N minutes
   */
  static generateScheduledTime(maxMinutes: number = 60): Date {
    const now = new Date();
    const randomMinutes = Math.floor(Math.random() * maxMinutes);
    return new Date(now.getTime() + randomMinutes * 60 * 1000);
  }

  /**
   * Generate burst scheduled time (all at same minute)
   */
  static generateBurstTime(minutesFromNow: number = 1): Date {
    const now = new Date();
    return new Date(now.getTime() + minutesFromNow * 60 * 1000);
  }

  /**
   * Select random platforms
   */
  static selectRandomPlatforms(
    availablePlatforms: string[],
    min: number = 1,
    max?: number
  ): string[] {
    const count = max
      ? Math.floor(Math.random() * (max - min + 1)) + min
      : min;
    
    const shuffled = [...availablePlatforms].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, availablePlatforms.length));
  }
}

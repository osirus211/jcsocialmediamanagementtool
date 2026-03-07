/**
 * Multi-Account Handling Tests
 * 
 * Tests that Business provider handles multiple accounts
 * and Basic provider handles single account only
 */

import { InstagramBusinessProvider } from '../InstagramBusinessProvider';
import { InstagramBasicDisplayProvider } from '../InstagramBasicDisplayProvider';

describe('Multi-Account Handling', () => {
  describe('Instagram Business Provider', () => {
    let provider: InstagramBusinessProvider;

    beforeEach(() => {
      provider = new InstagramBusinessProvider(
        'test_client_id',
        'test_client_secret',
        'https://example.com/callback'
      );
    });

    it('should have getInstagramAccounts method', () => {
      expect(provider.getInstagramAccounts).toBeDefined();
      expect(typeof provider.getInstagramAccounts).toBe('function');
    });

    it('should return array from getInstagramAccounts', async () => {
      // Mock axios to return multiple accounts
      const axios = require('axios');
      jest.spyOn(axios, 'get').mockImplementation((url: string) => {
        if (url.includes('/me/accounts')) {
          // Facebook Pages response
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'page1',
                  name: 'Page 1',
                  access_token: 'page1_token',
                },
                {
                  id: 'page2',
                  name: 'Page 2',
                  access_token: 'page2_token',
                },
              ],
            },
          });
        } else if (url.includes('/page1')) {
          // Page 1 has Instagram account
          return Promise.resolve({
            data: {
              instagram_business_account: {
                id: 'ig1',
                username: 'instagram1',
                name: 'Instagram 1',
              },
            },
          });
        } else if (url.includes('/page2')) {
          // Page 2 has Instagram account
          return Promise.resolve({
            data: {
              instagram_business_account: {
                id: 'ig2',
                username: 'instagram2',
                name: 'Instagram 2',
              },
            },
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const accounts = await provider.getInstagramAccounts('test_token');

      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBe(2);
      expect(accounts[0].instagramAccount.id).toBe('ig1');
      expect(accounts[1].instagramAccount.id).toBe('ig2');
    });

    it('should handle pages without Instagram accounts', async () => {
      const axios = require('axios');
      jest.spyOn(axios, 'get').mockImplementation((url: string) => {
        if (url.includes('/me/accounts')) {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'page1',
                  name: 'Page 1',
                  access_token: 'page1_token',
                },
                {
                  id: 'page2',
                  name: 'Page 2',
                  access_token: 'page2_token',
                },
              ],
            },
          });
        } else if (url.includes('/page1')) {
          // Page 1 has Instagram account
          return Promise.resolve({
            data: {
              instagram_business_account: {
                id: 'ig1',
                username: 'instagram1',
              },
            },
          });
        } else if (url.includes('/page2')) {
          // Page 2 has no Instagram account
          return Promise.resolve({
            data: {},
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const accounts = await provider.getInstagramAccounts('test_token');

      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBe(1);
      expect(accounts[0].instagramAccount.id).toBe('ig1');
    });
  });

  describe('Instagram Basic Display Provider', () => {
    let provider: InstagramBasicDisplayProvider;

    beforeEach(() => {
      provider = new InstagramBasicDisplayProvider(
        'test_app_id',
        'test_app_secret',
        'https://example.com/callback'
      );
    });

    it('should NOT have getInstagramAccounts method', () => {
      expect((provider as any).getInstagramAccounts).toBeUndefined();
    });

    it('should return single profile from getUserProfile', async () => {
      const axios = require('axios');
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          id: 'basic123',
          username: 'basicuser',
          account_type: 'PERSONAL',
        },
      });

      const profile = await provider.getUserProfile('test_token');

      expect(profile).toBeDefined();
      expect(profile.id).toBe('basic123');
      expect(profile.username).toBe('basicuser');
      expect(profile.metadata?.accountType).toBe('PERSONAL');
    });

    it('should return single account (not array)', async () => {
      const axios = require('axios');
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          id: 'basic123',
          username: 'basicuser',
          account_type: 'PERSONAL',
        },
      });

      const profile = await provider.getUserProfile('test_token');

      // Should be object, not array
      expect(Array.isArray(profile)).toBe(false);
      expect(typeof profile).toBe('object');
    });
  });

  describe('Provider Comparison', () => {
    it('Business provider supports multi-account, Basic does not', () => {
      const businessProvider = new InstagramBusinessProvider(
        'test_client_id',
        'test_client_secret',
        'https://example.com/callback'
      );

      const basicProvider = new InstagramBasicDisplayProvider(
        'test_app_id',
        'test_app_secret',
        'https://example.com/callback'
      );

      // Business has multi-account method
      expect(businessProvider.getInstagramAccounts).toBeDefined();

      // Basic does not
      expect((basicProvider as any).getInstagramAccounts).toBeUndefined();
    });
  });
});

/**
 * Bitly Service
 * 
 * Official Bitly API integration for URL shortening
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export interface BitlyConfig {
  accessToken: string;
  apiUrl?: string;
}

export interface Bitlink {
  id: string;
  link: string;
  long_url: string;
  title?: string;
  created_at: string;
  custom_bitlinks?: string[];
  tags?: string[];
}

export interface BitlyAnalytics {
  link_clicks: number;
  units: number;
  unit_reference: string;
  clicks: Array<{
    date: string;
    clicks: number;
  }>;
  countries?: Array<{
    country: string;
    clicks: number;
  }>;
  referrers?: Array<{
    referrer: string;
    clicks: number;
  }>;
}

export class BitlyService {
  private client: AxiosInstance;
  private accessToken: string;

  constructor(config: BitlyConfig) {
    this.accessToken = config.accessToken;
    this.client = axios.create({
      baseURL: config.apiUrl || 'https://api-ssl.bitly.com/v4',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Shorten URL with Bitly
   */
  async shortenWithBitly(longUrl: string, domain?: string, title?: string): Promise<string> {
    try {
      const response = await this.client.post('/shorten', {
        long_url: longUrl,
        domain: domain || 'bit.ly',
        title,
      });

      logger.info('URL shortened with Bitly', {
        longUrl,
        shortUrl: response.data.link,
        bitlinkId: response.data.id,
      });

      return response.data.link;
    } catch (error: any) {
      logger.error('Failed to shorten URL with Bitly', {
        longUrl,
        error: error.response?.data || error.message,
      });

      if (error.response?.status === 401) {
        throw new UnauthorizedError('Invalid Bitly access token');
      }
      if (error.response?.status === 400) {
        throw new BadRequestError('Invalid URL or Bitly configuration');
      }

      throw new Error('Failed to shorten URL with Bitly');
    }
  }

  /**
   * Create Bitlink with full options
   */
  async createBitlink(longUrl: string, domain?: string, title?: string, tags?: string[]): Promise<Bitlink> {
    try {
      const response = await this.client.post('/bitlinks', {
        long_url: longUrl,
        domain: domain || 'bit.ly',
        title,
        tags,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to create Bitlink', {
        longUrl,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Get Bitly analytics for a link
   */
  async getBitlyAnalytics(bitlinkId: string, unit: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<BitlyAnalytics> {
    try {
      const [clicksResponse, countriesResponse, referrersResponse] = await Promise.all([
        this.client.get(`/bitlinks/${bitlinkId}/clicks`, { params: { unit } }),
        this.client.get(`/bitlinks/${bitlinkId}/countries`, { params: { unit } }).catch(() => ({ data: { countries: [] } })),
        this.client.get(`/bitlinks/${bitlinkId}/referrers`, { params: { unit } }).catch(() => ({ data: { referrers: [] } })),
      ]);

      return {
        link_clicks: clicksResponse.data.link_clicks,
        units: clicksResponse.data.units,
        unit_reference: clicksResponse.data.unit_reference,
        clicks: clicksResponse.data.clicks || [],
        countries: countriesResponse.data.countries || [],
        referrers: referrersResponse.data.referrers || [],
      };
    } catch (error: any) {
      logger.error('Failed to get Bitly analytics', {
        bitlinkId,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Validate Bitly access token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.client.get('/user');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's custom domains
   */
  async getCustomDomains(): Promise<string[]> {
    try {
      const response = await this.client.get('/groups');
      const domains: string[] = [];
      
      for (const group of response.data.groups) {
        const domainsResponse = await this.client.get(`/groups/${group.guid}/domains`);
        domains.push(...domainsResponse.data.domains.map((d: any) => d.domain));
      }
      
      return domains;
    } catch (error) {
      logger.error('Failed to get custom domains', error);
      return [];
    }
  }
}
/**
 * LinkPreviewService Tests
 */

import { LinkPreviewService } from '../../services/LinkPreviewService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;

  beforeEach(() => {
    service = LinkPreviewService.getInstance();
    service.clearCache(); // Clear cache between tests
    jest.clearAllMocks();
  });

  describe('fetchPreview', () => {
    it('should fetch and parse Open Graph data', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="Test Article" />
            <meta property="og:description" content="This is a test article" />
            <meta property="og:image" content="https://example.com/image.jpg" />
            <meta property="og:site_name" content="Test Site" />
            <title>Fallback Title</title>
          </head>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
      });

      const result = await service.fetchPreview('https://example.com/article');

      expect(result).toEqual({
        url: 'https://example.com/article',
        title: 'Test Article',
        description: 'This is a test article',
        image: 'https://example.com/image.jpg',
        siteName: 'Test Site',
        type: undefined,
        favicon: 'https://example.com/favicon.ico',
      });
    });

    it('should fall back to Twitter Card data when Open Graph is missing', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta name="twitter:title" content="Twitter Title" />
            <meta name="twitter:description" content="Twitter description" />
            <meta name="twitter:image" content="https://example.com/twitter.jpg" />
            <title>Page Title</title>
          </head>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
      });

      const result = await service.fetchPreview('https://example.com/article');

      expect(result.title).toBe('Twitter Title');
      expect(result.description).toBe('Twitter description');
      expect(result.image).toBe('https://example.com/twitter.jpg');
    });

    it('should fall back to basic HTML elements when meta tags are missing', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Basic Title</title>
            <meta name="description" content="Basic description" />
          </head>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
      });

      const result = await service.fetchPreview('https://example.com/article');

      expect(result.title).toBe('Basic Title');
      expect(result.description).toBe('Basic description');
      expect(result.siteName).toBe('example.com');
    });

    it('should handle relative image URLs', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:image" content="/relative/image.jpg" />
            <title>Test</title>
          </head>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
      });

      const result = await service.fetchPreview('https://example.com/article');

      expect(result.image).toBe('https://example.com/relative/image.jpg');
    });

    it('should return fallback data on fetch error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.fetchPreview('https://example.com/article');

      expect(result).toEqual({
        url: 'https://example.com/article',
        title: 'example.com',
        description: 'Unable to fetch preview',
        siteName: 'example.com',
      });
    });

    it('should throw error for invalid URL', async () => {
      await expect(service.fetchPreview('invalid-url')).rejects.toThrow('Invalid URL format');
    });

    it('should cache results', async () => {
      const mockHtml = '<html><head><title>Test</title></head></html>';
      
      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
      });

      // First call
      await service.fetchPreview('https://example.com/article');
      
      // Second call should use cache
      const result = await service.fetchPreview('https://example.com/article');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(result.title).toBe('Test');
    });
  });

  describe('fetchMultiplePreviews', () => {
    it('should fetch previews for multiple URLs', async () => {
      const mockHtml1 = '<html><head><title>Title 1</title></head></html>';
      const mockHtml2 = '<html><head><title>Title 2</title></head></html>';

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockHtml1 })
        .mockResolvedValueOnce({ data: mockHtml2 });

      const results = await service.fetchMultiplePreviews([
        'https://example1.com',
        'https://example2.com',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Title 1');
      expect(results[1].title).toBe('Title 2');
    });
  });

  describe('extractUrls', () => {
    it('should extract URLs from text content', () => {
      const content = 'Check out https://example.com and http://test.org for more info';
      const urls = service.extractUrls(content);

      expect(urls).toEqual(['https://example.com', 'http://test.org']);
    });

    it('should return empty array when no URLs found', () => {
      const content = 'This text has no URLs';
      const urls = service.extractUrls(content);

      expect(urls).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear specific URL from cache', async () => {
      const mockHtml = '<html><head><title>Test</title></head></html>';
      
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      // Cache a result
      await service.fetchPreview('https://example.com');
      
      // Clear specific URL
      service.clearCache('https://example.com');
      
      // Should fetch again
      await service.fetchPreview('https://example.com');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      const mockHtml = '<html><head><title>Test</title></head></html>';
      
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      // Cache multiple results
      await service.fetchPreview('https://example1.com');
      await service.fetchPreview('https://example2.com');
      
      // Clear all cache
      service.clearCache();
      
      // Should fetch again
      await service.fetchPreview('https://example1.com');

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });
});
import { GiphyService } from '../../services/GiphyService';
import { HttpClientService } from '../../services/HttpClientService';

// Mock HttpClientService
jest.mock('../../services/HttpClientService');
const MockedHttpClientService = HttpClientService as jest.MockedClass<typeof HttpClientService>;

describe('GiphyService', () => {
  let giphyService: GiphyService;
  let mockHttpClient: jest.Mocked<HttpClientService>;

  beforeEach(() => {
    // Set up environment variable
    process.env.GIPHY_API_KEY = 'test-api-key';
    
    // Create mock instance
    mockHttpClient = new MockedHttpClientService() as jest.Mocked<HttpClientService>;
    
    // Create service instance
    giphyService = new GiphyService();
    
    // Replace the internal http client with our mock
    (giphyService as any).httpClient = mockHttpClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GIPHY_API_KEY;
  });

  describe('searchGifs', () => {
    it('should search for GIFs successfully', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'test-gif-1',
              title: 'Test GIF',
              url: 'https://giphy.com/gifs/test-gif-1',
              images: {
                original: {
                  url: 'https://media.giphy.com/test-gif-1.gif',
                  width: '480',
                  height: '270',
                  size: '1024000'
                },
                fixed_height: {
                  url: 'https://media.giphy.com/test-gif-1-fixed.gif',
                  width: '356',
                  height: '200'
                },
                fixed_width: {
                  url: 'https://media.giphy.com/test-gif-1-fixed-width.gif',
                  width: '200',
                  height: '113'
                },
                preview_gif: {
                  url: 'https://media.giphy.com/test-gif-1-preview.gif',
                  width: '150',
                  height: '84'
                }
              },
              rating: 'g'
            }
          ],
          pagination: {
            total_count: 100,
            count: 1,
            offset: 0
          }
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await giphyService.searchGifs('funny cats', 20, 0);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/gifs/search?')
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('gif');
      expect(result.data[0].id).toBe('test-gif-1');
      expect(result.pagination.total_count).toBe(100);
    });

    it('should throw error when API key is not configured', async () => {
      delete process.env.GIPHY_API_KEY;
      const serviceWithoutKey = new GiphyService();

      await expect(serviceWithoutKey.searchGifs('test')).rejects.toThrow(
        'Giphy API key not configured'
      );
    });
  });

  describe('getTrending', () => {
    it('should get trending GIFs successfully', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'trending-gif-1',
              title: 'Trending GIF',
              url: 'https://giphy.com/gifs/trending-gif-1',
              images: {
                original: {
                  url: 'https://media.giphy.com/trending-gif-1.gif',
                  width: '480',
                  height: '270',
                  size: '2048000'
                },
                fixed_height: {
                  url: 'https://media.giphy.com/trending-gif-1-fixed.gif',
                  width: '356',
                  height: '200'
                },
                fixed_width: {
                  url: 'https://media.giphy.com/trending-gif-1-fixed-width.gif',
                  width: '200',
                  height: '113'
                },
                preview_gif: {
                  url: 'https://media.giphy.com/trending-gif-1-preview.gif',
                  width: '150',
                  height: '84'
                }
              },
              rating: 'g'
            }
          ],
          pagination: {
            total_count: 50,
            count: 1,
            offset: 0
          }
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await giphyService.getTrending(20);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/gifs/trending?')
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('gif');
      expect(result.data[0].id).toBe('trending-gif-1');
    });
  });

  describe('searchStickers', () => {
    it('should search for stickers successfully', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'test-sticker-1',
              title: 'Test Sticker',
              url: 'https://giphy.com/stickers/test-sticker-1',
              images: {
                original: {
                  url: 'https://media.giphy.com/test-sticker-1.gif',
                  width: '480',
                  height: '480',
                  size: '512000'
                },
                fixed_height: {
                  url: 'https://media.giphy.com/test-sticker-1-fixed.gif',
                  width: '200',
                  height: '200'
                },
                fixed_width: {
                  url: 'https://media.giphy.com/test-sticker-1-fixed-width.gif',
                  width: '200',
                  height: '200'
                },
                preview_gif: {
                  url: 'https://media.giphy.com/test-sticker-1-preview.gif',
                  width: '150',
                  height: '150'
                }
              },
              rating: 'g'
            }
          ],
          pagination: {
            total_count: 25,
            count: 1,
            offset: 0
          }
        }
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await giphyService.searchStickers('happy', 20, 0);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/stickers/search?')
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('sticker');
      expect(result.data[0].id).toBe('test-sticker-1');
    });
  });

  describe('downloadGif', () => {
    it('should download GIF as buffer', async () => {
      const mockBuffer = Buffer.from('fake-gif-data');
      mockHttpClient.get.mockResolvedValue({ data: mockBuffer });

      const result = await giphyService.downloadGif('https://media.giphy.com/test.gif');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://media.giphy.com/test.gif',
        { responseType: 'arraybuffer' }
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
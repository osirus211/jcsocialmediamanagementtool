import { VideoValidator } from '../VideoValidator';

describe('VideoValidator', () => {
  let validator: VideoValidator;

  beforeEach(() => {
    validator = new VideoValidator();
  });

  describe('validateFormat', () => {
    it('should accept MP4 format', () => {
      const error = validator.validateFormat('video/mp4');
      expect(error).toBeNull();
    });

    it('should accept WebM format', () => {
      const error = validator.validateFormat('video/webm');
      expect(error).toBeNull();
    });

    it('should accept case-insensitive format', () => {
      const error = validator.validateFormat('VIDEO/MP4');
      expect(error).toBeNull();
    });

    it('should reject AVI format', () => {
      const error = validator.validateFormat('video/avi');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('format');
      expect(error?.message).toContain('video/avi');
      expect(error?.message).toContain('MP4 and WebM');
    });

    it('should reject MOV format', () => {
      const error = validator.validateFormat('video/quicktime');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('format');
    });
  });

  describe('validateSize', () => {
    const MAX_SIZE = 301989888; // 287 MB

    it('should accept file at exactly max size', () => {
      const error = validator.validateSize(MAX_SIZE);
      expect(error).toBeNull();
    });

    it('should accept file below max size', () => {
      const error = validator.validateSize(MAX_SIZE - 1);
      expect(error).toBeNull();
    });

    it('should accept small file', () => {
      const error = validator.validateSize(1024 * 1024); // 1 MB
      expect(error).toBeNull();
    });

    it('should reject file exceeding max size', () => {
      const error = validator.validateSize(MAX_SIZE + 1);
      expect(error).not.toBeNull();
      expect(error?.field).toBe('size');
      expect(error?.message).toContain('287 MB');
    });

    it('should reject very large file', () => {
      const error = validator.validateSize(500 * 1024 * 1024); // 500 MB
      expect(error).not.toBeNull();
      expect(error?.field).toBe('size');
    });
  });

  describe('validateDuration', () => {
    it('should accept duration at minimum (3 seconds)', () => {
      const error = validator.validateDuration(3);
      expect(error).toBeNull();
    });

    it('should accept duration at maximum (60 seconds)', () => {
      const error = validator.validateDuration(60);
      expect(error).toBeNull();
    });

    it('should accept duration in middle range', () => {
      const error = validator.validateDuration(30);
      expect(error).toBeNull();
    });

    it('should reject duration below minimum', () => {
      const error = validator.validateDuration(2.9);
      expect(error).not.toBeNull();
      expect(error?.field).toBe('duration');
      expect(error?.message).toContain('too short');
      expect(error?.message).toContain('3 seconds');
    });

    it('should reject duration above maximum', () => {
      const error = validator.validateDuration(60.1);
      expect(error).not.toBeNull();
      expect(error?.field).toBe('duration');
      expect(error?.message).toContain('too long');
      expect(error?.message).toContain('60 seconds');
    });

    it('should reject very short duration', () => {
      const error = validator.validateDuration(0.5);
      expect(error).not.toBeNull();
      expect(error?.field).toBe('duration');
    });
  });

  describe('validateResolution', () => {
    it('should accept minimum resolution (720x1280)', () => {
      const error = validator.validateResolution(720, 1280);
      expect(error).toBeNull();
    });

    it('should accept higher resolution', () => {
      const error = validator.validateResolution(1080, 1920);
      expect(error).toBeNull();
    });

    it('should accept 4K resolution', () => {
      const error = validator.validateResolution(2160, 3840);
      expect(error).toBeNull();
    });

    it('should reject width below minimum', () => {
      const error = validator.validateResolution(719, 1280);
      expect(error).not.toBeNull();
      expect(error?.field).toBe('resolution');
      expect(error?.message).toContain('720x1280');
    });

    it('should reject height below minimum', () => {
      const error = validator.validateResolution(720, 1279);
      expect(error).not.toBeNull();
      expect(error?.field).toBe('resolution');
      expect(error?.message).toContain('720x1280');
    });

    it('should reject both dimensions below minimum', () => {
      const error = validator.validateResolution(640, 480);
      expect(error).not.toBeNull();
      expect(error?.field).toBe('resolution');
    });
  });

  describe('validateAspectRatio', () => {
    describe('9:16 vertical ratio', () => {
      it('should accept exact 9:16 ratio (720x1280)', () => {
        const error = validator.validateAspectRatio(720, 1280);
        expect(error).toBeNull();
      });

      it('should accept exact 9:16 ratio (1080x1920)', () => {
        const error = validator.validateAspectRatio(1080, 1920);
        expect(error).toBeNull();
      });

      it('should accept 9:16 ratio within +5% tolerance', () => {
        // 9:16 = 0.5625, +5% = 0.590625
        const error = validator.validateAspectRatio(590, 1000);
        expect(error).toBeNull();
      });

      it('should accept 9:16 ratio within -5% tolerance', () => {
        // 9:16 = 0.5625, -5% = 0.534375
        const error = validator.validateAspectRatio(535, 1000);
        expect(error).toBeNull();
      });
    });

    describe('1:1 square ratio', () => {
      it('should accept exact 1:1 ratio', () => {
        const error = validator.validateAspectRatio(1080, 1080);
        expect(error).toBeNull();
      });

      it('should accept 1:1 ratio within +5% tolerance', () => {
        // 1:1 = 1.0, +5% = 1.05
        const error = validator.validateAspectRatio(1050, 1000);
        expect(error).toBeNull();
      });

      it('should accept 1:1 ratio within -5% tolerance', () => {
        // 1:1 = 1.0, -5% = 0.95
        const error = validator.validateAspectRatio(950, 1000);
        expect(error).toBeNull();
      });
    });

    describe('invalid ratios', () => {
      it('should reject 16:9 horizontal ratio', () => {
        const error = validator.validateAspectRatio(1920, 1080);
        expect(error).not.toBeNull();
        expect(error?.field).toBe('aspectRatio');
        expect(error?.message).toContain('9:16');
        expect(error?.message).toContain('1:1');
      });

      it('should reject 4:3 ratio', () => {
        const error = validator.validateAspectRatio(1024, 768);
        expect(error).not.toBeNull();
        expect(error?.field).toBe('aspectRatio');
      });

      it('should reject ratio outside 9:16 tolerance', () => {
        // 9:16 = 0.5625, +6% = 0.59625 (outside tolerance)
        const error = validator.validateAspectRatio(597, 1000);
        expect(error).not.toBeNull();
        expect(error?.field).toBe('aspectRatio');
      });

      it('should reject ratio outside 1:1 tolerance', () => {
        // 1:1 = 1.0, +6% = 1.06 (outside tolerance)
        const error = validator.validateAspectRatio(1060, 1000);
        expect(error).not.toBeNull();
        expect(error?.field).toBe('aspectRatio');
      });
    });
  });

  describe('validateVideo - integration', () => {
    it('should return valid for correct format and size', async () => {
      // Mock a small buffer with correct format
      const mockBuffer = Buffer.alloc(1024 * 1024); // 1 MB
      
      // This will fail on metadata extraction since we don't have a real video
      // but we can test format and size validation
      const result = await validator.validateVideo(mockBuffer, 'video/mp4');
      
      // Should have format and size pass, but metadata extraction will fail
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('video');
      expect(result.errors[0].message).toContain('metadata');
    });

    it('should return invalid for wrong format', async () => {
      const mockBuffer = Buffer.alloc(1024);
      const result = await validator.validateVideo(mockBuffer, 'video/avi');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('format');
    });

    it('should return invalid for oversized file', async () => {
      const mockBuffer = Buffer.alloc(400 * 1024 * 1024); // 400 MB
      const result = await validator.validateVideo(mockBuffer, 'video/mp4');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('size');
    });

    it('should return multiple errors for multiple violations', async () => {
      const mockBuffer = Buffer.alloc(400 * 1024 * 1024); // 400 MB
      const result = await validator.validateVideo(mockBuffer, 'video/avi');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors.some(e => e.field === 'format')).toBe(true);
      expect(result.errors.some(e => e.field === 'size')).toBe(true);
    });
  });
});

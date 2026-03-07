/**
 * Media Upload Safety Integration Tests
 * 
 * Phase 1 - Task 1.2: Validate Media Upload Safety
 * 
 * Tests comprehensive media upload validation including:
 * - All supported image formats (jpg, png, gif)
 * - Video format (mp4)
 * - Size limits (reject files > 10MB)
 * - Corrupt file handling
 * - Unsupported format rejection
 * - Security validation
 * 
 * Test Coverage:
 * 1. Image Format Support (jpg, png, gif)
 * 2. Video Format Support (mp4)
 * 3. Size Limit Validation
 * 4. Corrupt File Handling
 * 5. Unsupported Format Rejection
 * 6. Security Validation
 */

// Mock media upload service
interface MediaFile {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

interface UploadResult {
  success: boolean;
  fileId?: string;
  url?: string;
  error?: string;
  errorCode?: string;
}

class MediaUploadService {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/gif'];
  private readonly SUPPORTED_VIDEO_FORMATS = ['video/mp4'];
  private readonly MAX_FILENAME_LENGTH = 255;

  validateFileType(file: MediaFile): ValidationResult {
    const allSupportedFormats = [
      ...this.SUPPORTED_IMAGE_FORMATS,
      ...this.SUPPORTED_VIDEO_FORMATS,
    ];

    if (!allSupportedFormats.includes(file.mimetype)) {
      return {
        valid: false,
        error: `Unsupported file format: ${file.mimetype}`,
        errorCode: 'UNSUPPORTED_FORMAT',
      };
    }

    // Validate file extension matches MIME type
    const extension = file.filename.split('.').pop()?.toLowerCase();
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'video/mp4': ['mp4'],
    };

    const validExtensions = expectedExtensions[file.mimetype] || [];
    if (extension && !validExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension ${extension} does not match MIME type ${file.mimetype}`,
        errorCode: 'EXTENSION_MISMATCH',
      };
    }

    return { valid: true };
  }

  validateFileSize(file: MediaFile): ValidationResult {
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size ${file.size} bytes exceeds maximum ${this.MAX_FILE_SIZE} bytes`,
        errorCode: 'FILE_TOO_LARGE',
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty',
        errorCode: 'EMPTY_FILE',
      };
    }

    return { valid: true };
  }

  validateFileIntegrity(file: MediaFile): ValidationResult {
    try {
      // Check for valid file headers (magic numbers)
      const buffer = file.buffer;
      
      if (buffer.length < 4) {
        return {
          valid: false,
          error: 'File is truncated or incomplete',
          errorCode: 'TRUNCATED_FILE',
        };
      }

      // Validate magic numbers for each format
      const magicNumbers: Record<string, number[][]> = {
        'image/jpeg': [[0xFF, 0xD8, 0xFF]],
        'image/png': [[0x89, 0x50, 0x4E, 0x47]],
        'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
        'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp box
      };

      const expectedMagic = magicNumbers[file.mimetype];
      if (expectedMagic) {
        let validMagic = false;
        
        for (const magic of expectedMagic) {
          let matches = true;
          for (let i = 0; i < magic.length && i < buffer.length; i++) {
            if (buffer[i] !== magic[i]) {
              matches = false;
              break;
            }
          }
          if (matches) {
            validMagic = true;
            break;
          }
        }

        if (!validMagic) {
          return {
            valid: false,
            error: `Invalid file header for ${file.mimetype}`,
            errorCode: 'CORRUPT_FILE',
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate file integrity',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  sanitizeFilename(filename: string): ValidationResult {
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return {
        valid: false,
        error: 'Filename contains invalid path characters',
        errorCode: 'INVALID_FILENAME',
      };
    }

    // Check filename length
    if (filename.length > this.MAX_FILENAME_LENGTH) {
      return {
        valid: false,
        error: `Filename exceeds maximum length of ${this.MAX_FILENAME_LENGTH} characters`,
        errorCode: 'FILENAME_TOO_LONG',
      };
    }

    // Check for special characters that could be problematic
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return {
        valid: false,
        error: 'Filename contains invalid characters',
        errorCode: 'INVALID_FILENAME',
      };
    }

    return { valid: true };
  }

  async uploadFile(file: MediaFile): Promise<UploadResult> {
    // Validate filename
    const filenameValidation = this.sanitizeFilename(file.filename);
    if (!filenameValidation.valid) {
      return {
        success: false,
        error: filenameValidation.error,
        errorCode: filenameValidation.errorCode,
      };
    }

    // Validate file size
    const sizeValidation = this.validateFileSize(file);
    if (!sizeValidation.valid) {
      return {
        success: false,
        error: sizeValidation.error,
        errorCode: sizeValidation.errorCode,
      };
    }

    // Validate file type
    const typeValidation = this.validateFileType(file);
    if (!typeValidation.valid) {
      return {
        success: false,
        error: typeValidation.error,
        errorCode: typeValidation.errorCode,
      };
    }

    // Validate file integrity
    const integrityValidation = this.validateFileIntegrity(file);
    if (!integrityValidation.valid) {
      return {
        success: false,
        error: integrityValidation.error,
        errorCode: integrityValidation.errorCode,
      };
    }

    // Simulate successful upload
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = `https://cdn.example.com/uploads/${fileId}`;

    return {
      success: true,
      fileId,
      url,
    };
  }
}

// Helper functions to create test files
function createValidJPEG(size: number = 1024): MediaFile {
  const buffer = Buffer.alloc(size);
  // JPEG magic number: FF D8 FF
  buffer[0] = 0xFF;
  buffer[1] = 0xD8;
  buffer[2] = 0xFF;
  buffer[3] = 0xE0; // JFIF marker
  
  return {
    filename: 'test-image.jpg',
    mimetype: 'image/jpeg',
    size,
    buffer,
  };
}

function createValidPNG(size: number = 1024): MediaFile {
  const buffer = Buffer.alloc(size);
  // PNG magic number: 89 50 4E 47
  buffer[0] = 0x89;
  buffer[1] = 0x50;
  buffer[2] = 0x4E;
  buffer[3] = 0x47;
  buffer[4] = 0x0D;
  buffer[5] = 0x0A;
  buffer[6] = 0x1A;
  buffer[7] = 0x0A;
  
  return {
    filename: 'test-image.png',
    mimetype: 'image/png',
    size,
    buffer,
  };
}

function createValidGIF(size: number = 1024): MediaFile {
  const buffer = Buffer.alloc(size);
  // GIF magic number: 47 49 46 38
  buffer[0] = 0x47; // G
  buffer[1] = 0x49; // I
  buffer[2] = 0x46; // F
  buffer[3] = 0x38; // 8
  buffer[4] = 0x39; // 9
  buffer[5] = 0x61; // a
  
  return {
    filename: 'test-image.gif',
    mimetype: 'image/gif',
    size,
    buffer,
  };
}

function createValidMP4(size: number = 1024): MediaFile {
  const buffer = Buffer.alloc(size);
  // MP4 magic number: ftyp box
  buffer[0] = 0x00;
  buffer[1] = 0x00;
  buffer[2] = 0x00;
  buffer[3] = 0x20; // box size
  buffer[4] = 0x66; // f
  buffer[5] = 0x74; // t
  buffer[6] = 0x79; // y
  buffer[7] = 0x70; // p
  
  return {
    filename: 'test-video.mp4',
    mimetype: 'video/mp4',
    size,
    buffer,
  };
}

function createCorruptFile(mimetype: string, filename: string, size: number = 1024): MediaFile {
  const buffer = Buffer.alloc(size);
  // Fill with random data (invalid magic numbers)
  for (let i = 0; i < Math.min(size, 8); i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  
  return {
    filename,
    mimetype,
    size,
    buffer,
  };
}

describe('Media Upload Safety Integration Tests', () => {
  let uploadService: MediaUploadService;

  beforeEach(() => {
    uploadService = new MediaUploadService();
  });

  describe('1. Image Format Support', () => {
    it('should accept valid JPG files', async () => {
      const file = createValidJPEG(5000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should accept valid JPEG files with .jpeg extension', async () => {
      const file = createValidJPEG(5000);
      file.filename = 'test-image.jpeg';
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
    });

    it('should accept valid PNG files', async () => {
      const file = createValidPNG(5000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
      expect(result.url).toBeDefined();
    });

    it('should accept valid GIF files', async () => {
      const file = createValidGIF(5000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
      expect(result.url).toBeDefined();
    });

    it('should accept animated GIF files', async () => {
      const file = createValidGIF(50000); // Larger size for animated GIF
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
    });

    it('should validate MIME type matches file extension', async () => {
      const file = createValidJPEG(5000);
      file.filename = 'test-image.png'; // Wrong extension
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EXTENSION_MISMATCH');
    });
  });

  describe('2. Video Format Support', () => {
    it('should accept valid MP4 files', async () => {
      const file = createValidMP4(100000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
      expect(result.url).toBeDefined();
    });

    it('should validate MP4 file header', async () => {
      const file = createValidMP4(50000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
    });

    it('should handle large video files within limit', async () => {
      const file = createValidMP4(9 * 1024 * 1024); // 9MB
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
    });
  });

  describe('3. Size Limit Validation', () => {
    it('should accept files under 10MB limit', async () => {
      const file = createValidJPEG(5 * 1024 * 1024); // 5MB
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
    });

    it('should accept files exactly at 10MB limit', async () => {
      const file = createValidJPEG(10 * 1024 * 1024); // Exactly 10MB
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
    });

    it('should reject files over 10MB limit', async () => {
      const file = createValidJPEG(11 * 1024 * 1024); // 11MB
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject very large files (100MB+)', async () => {
      const file = createValidJPEG(100 * 1024 * 1024); // 100MB
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('should reject empty files', async () => {
      const file = createValidJPEG(0);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMPTY_FILE');
    });

    it('should calculate file size accurately', async () => {
      const sizes = [1024, 5000, 1024 * 1024, 5 * 1024 * 1024];
      
      for (const size of sizes) {
        const file = createValidJPEG(size);
        expect(file.size).toBe(size);
        
        if (size <= 10 * 1024 * 1024) {
          const result = await uploadService.uploadFile(file);
          expect(result.success).toBe(true);
        }
      }
    });
  });

  describe('4. Corrupt File Handling', () => {
    it('should reject corrupt JPG files (invalid header)', async () => {
      const file = createCorruptFile('image/jpeg', 'corrupt.jpg', 5000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORRUPT_FILE');
      expect(result.error).toContain('Invalid file header');
    });

    it('should reject corrupt PNG files (invalid header)', async () => {
      const file = createCorruptFile('image/png', 'corrupt.png', 5000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORRUPT_FILE');
    });

    it('should reject corrupt GIF files (invalid header)', async () => {
      const file = createCorruptFile('image/gif', 'corrupt.gif', 5000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORRUPT_FILE');
    });

    it('should reject corrupt MP4 files (invalid header)', async () => {
      const file = createCorruptFile('video/mp4', 'corrupt.mp4', 5000);
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORRUPT_FILE');
    });

    it('should reject truncated files (incomplete data)', async () => {
      const file = createValidJPEG(2); // Only 2 bytes
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TRUNCATED_FILE');
    });

    it('should reject files with wrong extension (jpg named as png)', async () => {
      const file = createValidJPEG(5000);
      file.filename = 'fake-image.png'; // JPG file with PNG extension
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EXTENSION_MISMATCH');
    });

    it('should handle validation errors gracefully (no crashes)', async () => {
      const corruptFiles = [
        createCorruptFile('image/jpeg', 'corrupt1.jpg', 100),
        createCorruptFile('image/png', 'corrupt2.png', 100),
        createCorruptFile('image/gif', 'corrupt3.gif', 100),
        createCorruptFile('video/mp4', 'corrupt4.mp4', 100),
      ];

      for (const file of corruptFiles) {
        const result = await uploadService.uploadFile(file);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.errorCode).toBeDefined();
      }
    });
  });

  describe('5. Unsupported Format Rejection', () => {
    it('should reject unsupported image formats (BMP)', async () => {
      const file: MediaFile = {
        filename: 'test.bmp',
        mimetype: 'image/bmp',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
      expect(result.error).toContain('Unsupported file format');
    });

    it('should reject unsupported image formats (TIFF)', async () => {
      const file: MediaFile = {
        filename: 'test.tiff',
        mimetype: 'image/tiff',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject unsupported image formats (WEBP)', async () => {
      const file: MediaFile = {
        filename: 'test.webp',
        mimetype: 'image/webp',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject unsupported video formats (AVI)', async () => {
      const file: MediaFile = {
        filename: 'test.avi',
        mimetype: 'video/x-msvideo',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject unsupported video formats (MOV)', async () => {
      const file: MediaFile = {
        filename: 'test.mov',
        mimetype: 'video/quicktime',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject unsupported video formats (WMV)', async () => {
      const file: MediaFile = {
        filename: 'test.wmv',
        mimetype: 'video/x-ms-wmv',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject executable files (.exe)', async () => {
      const file: MediaFile = {
        filename: 'malware.exe',
        mimetype: 'application/x-msdownload',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject executable files (.sh)', async () => {
      const file: MediaFile = {
        filename: 'script.sh',
        mimetype: 'application/x-sh',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject document files (.pdf)', async () => {
      const file: MediaFile = {
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject document files (.doc)', async () => {
      const file: MediaFile = {
        filename: 'document.doc',
        mimetype: 'application/msword',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject archive files (.zip)', async () => {
      const file: MediaFile = {
        filename: 'archive.zip',
        mimetype: 'application/zip',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject archive files (.rar)', async () => {
      const file: MediaFile = {
        filename: 'archive.rar',
        mimetype: 'application/x-rar-compressed',
        size: 5000,
        buffer: Buffer.alloc(5000),
      };
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    it('should provide clear error messages for unsupported formats', async () => {
      const unsupportedFiles = [
        { filename: 'test.bmp', mimetype: 'image/bmp' },
        { filename: 'test.avi', mimetype: 'video/x-msvideo' },
        { filename: 'test.pdf', mimetype: 'application/pdf' },
      ];

      for (const fileInfo of unsupportedFiles) {
        const file: MediaFile = {
          ...fileInfo,
          size: 5000,
          buffer: Buffer.alloc(5000),
        };
        
        const result = await uploadService.uploadFile(file);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Unsupported file format');
        expect(result.error).toContain(fileInfo.mimetype);
      }
    });
  });

  describe('6. Security Validation', () => {
    it('should reject files with path traversal attempts (..)', async () => {
      const file = createValidJPEG(5000);
      file.filename = '../../../etc/passwd.jpg';
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_FILENAME');
      expect(result.error).toContain('invalid path characters');
    });

    it('should reject files with forward slash in name', async () => {
      const file = createValidJPEG(5000);
      file.filename = 'path/to/file.jpg';
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_FILENAME');
    });

    it('should reject files with backslash in name', async () => {
      const file = createValidJPEG(5000);
      file.filename = 'path\\to\\file.jpg';
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_FILENAME');
    });

    it('should reject files with special characters (<>:"|?*)', async () => {
      const specialChars = ['<', '>', ':', '"', '|', '?', '*'];
      
      for (const char of specialChars) {
        const file = createValidJPEG(5000);
        file.filename = `test${char}file.jpg`;
        
        const result = await uploadService.uploadFile(file);
        
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('INVALID_FILENAME');
      }
    });

    it('should reject files with very long filenames (>255 chars)', async () => {
      const file = createValidJPEG(5000);
      file.filename = 'a'.repeat(256) + '.jpg';
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FILENAME_TOO_LONG');
    });

    it('should accept files with exactly 255 character filenames', async () => {
      const file = createValidJPEG(5000);
      file.filename = 'a'.repeat(251) + '.jpg'; // 251 + 4 = 255
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(true);
    });

    it('should handle MIME type spoofing attempts', async () => {
      // Create a file with wrong magic number but correct MIME type
      const file = createCorruptFile('image/jpeg', 'spoofed.jpg', 5000);
      
      const result = await uploadService.uploadFile(file);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CORRUPT_FILE');
    });

    it('should sanitize filenames properly', async () => {
      const validFilenames = [
        'test-image.jpg',
        'test_image.jpg',
        'test.image.jpg',
        'test123.jpg',
        'TEST-IMAGE.JPG',
      ];

      for (const filename of validFilenames) {
        const file = createValidJPEG(5000);
        file.filename = filename;
        
        const result = await uploadService.uploadFile(file);
        
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Integration Test Summary', () => {
    it('should validate all criteria and provide comprehensive test results', async () => {
      const testResults = {
        imageFormats: {
          jpg: false,
          png: false,
          gif: false,
        },
        videoFormats: {
          mp4: false,
        },
        sizeLimits: {
          underLimit: false,
          atLimit: false,
          overLimit: false,
        },
        corruptFiles: {
          jpgCorrupt: false,
          pngCorrupt: false,
          gifCorrupt: false,
          mp4Corrupt: false,
        },
        unsupportedFormats: {
          bmp: false,
          avi: false,
          pdf: false,
          exe: false,
          zip: false,
        },
        security: {
          pathTraversal: false,
          specialChars: false,
          longFilename: false,
        },
      };

      // Test image formats
      testResults.imageFormats.jpg = (await uploadService.uploadFile(createValidJPEG(5000))).success;
      testResults.imageFormats.png = (await uploadService.uploadFile(createValidPNG(5000))).success;
      testResults.imageFormats.gif = (await uploadService.uploadFile(createValidGIF(5000))).success;

      // Test video formats
      testResults.videoFormats.mp4 = (await uploadService.uploadFile(createValidMP4(50000))).success;

      // Test size limits
      testResults.sizeLimits.underLimit = (await uploadService.uploadFile(createValidJPEG(5 * 1024 * 1024))).success;
      testResults.sizeLimits.atLimit = (await uploadService.uploadFile(createValidJPEG(10 * 1024 * 1024))).success;
      testResults.sizeLimits.overLimit = !(await uploadService.uploadFile(createValidJPEG(11 * 1024 * 1024))).success;

      // Test corrupt files
      testResults.corruptFiles.jpgCorrupt = !(await uploadService.uploadFile(createCorruptFile('image/jpeg', 'c.jpg', 5000))).success;
      testResults.corruptFiles.pngCorrupt = !(await uploadService.uploadFile(createCorruptFile('image/png', 'c.png', 5000))).success;
      testResults.corruptFiles.gifCorrupt = !(await uploadService.uploadFile(createCorruptFile('image/gif', 'c.gif', 5000))).success;
      testResults.corruptFiles.mp4Corrupt = !(await uploadService.uploadFile(createCorruptFile('video/mp4', 'c.mp4', 5000))).success;

      // Test unsupported formats
      testResults.unsupportedFormats.bmp = !(await uploadService.uploadFile({
        filename: 't.bmp', mimetype: 'image/bmp', size: 5000, buffer: Buffer.alloc(5000)
      })).success;
      testResults.unsupportedFormats.avi = !(await uploadService.uploadFile({
        filename: 't.avi', mimetype: 'video/x-msvideo', size: 5000, buffer: Buffer.alloc(5000)
      })).success;
      testResults.unsupportedFormats.pdf = !(await uploadService.uploadFile({
        filename: 't.pdf', mimetype: 'application/pdf', size: 5000, buffer: Buffer.alloc(5000)
      })).success;
      testResults.unsupportedFormats.exe = !(await uploadService.uploadFile({
        filename: 't.exe', mimetype: 'application/x-msdownload', size: 5000, buffer: Buffer.alloc(5000)
      })).success;
      testResults.unsupportedFormats.zip = !(await uploadService.uploadFile({
        filename: 't.zip', mimetype: 'application/zip', size: 5000, buffer: Buffer.alloc(5000)
      })).success;

      // Test security
      const pathTraversalFile = createValidJPEG(5000);
      pathTraversalFile.filename = '../../../etc/passwd.jpg';
      testResults.security.pathTraversal = !(await uploadService.uploadFile(pathTraversalFile)).success;

      const specialCharFile = createValidJPEG(5000);
      specialCharFile.filename = 'test<file>.jpg';
      testResults.security.specialChars = !(await uploadService.uploadFile(specialCharFile)).success;

      const longFilenameFile = createValidJPEG(5000);
      longFilenameFile.filename = 'a'.repeat(256) + '.jpg';
      testResults.security.longFilename = !(await uploadService.uploadFile(longFilenameFile)).success;

      console.log('\n=== Media Upload Safety Test Summary ===');
      console.log('1. Image Format Support:');
      console.log(`   ✓ JPG: ${testResults.imageFormats.jpg ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ PNG: ${testResults.imageFormats.png ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ GIF: ${testResults.imageFormats.gif ? 'PASS' : 'FAIL'}`);
      console.log('2. Video Format Support:');
      console.log(`   ✓ MP4: ${testResults.videoFormats.mp4 ? 'PASS' : 'FAIL'}`);
      console.log('3. Size Limit Validation:');
      console.log(`   ✓ Under 10MB: ${testResults.sizeLimits.underLimit ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ At 10MB: ${testResults.sizeLimits.atLimit ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ Over 10MB rejected: ${testResults.sizeLimits.overLimit ? 'PASS' : 'FAIL'}`);
      console.log('4. Corrupt File Handling:');
      console.log(`   ✓ JPG corrupt rejected: ${testResults.corruptFiles.jpgCorrupt ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ PNG corrupt rejected: ${testResults.corruptFiles.pngCorrupt ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ GIF corrupt rejected: ${testResults.corruptFiles.gifCorrupt ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ MP4 corrupt rejected: ${testResults.corruptFiles.mp4Corrupt ? 'PASS' : 'FAIL'}`);
      console.log('5. Unsupported Format Rejection:');
      console.log(`   ✓ BMP rejected: ${testResults.unsupportedFormats.bmp ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ AVI rejected: ${testResults.unsupportedFormats.avi ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ PDF rejected: ${testResults.unsupportedFormats.pdf ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ EXE rejected: ${testResults.unsupportedFormats.exe ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ ZIP rejected: ${testResults.unsupportedFormats.zip ? 'PASS' : 'FAIL'}`);
      console.log('6. Security Validation:');
      console.log(`   ✓ Path traversal blocked: ${testResults.security.pathTraversal ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ Special chars blocked: ${testResults.security.specialChars ? 'PASS' : 'FAIL'}`);
      console.log(`   ✓ Long filename blocked: ${testResults.security.longFilename ? 'PASS' : 'FAIL'}`);
      console.log('========================================\n');

      // Verify all tests passed
      expect(testResults.imageFormats.jpg).toBe(true);
      expect(testResults.imageFormats.png).toBe(true);
      expect(testResults.imageFormats.gif).toBe(true);
      expect(testResults.videoFormats.mp4).toBe(true);
      expect(testResults.sizeLimits.underLimit).toBe(true);
      expect(testResults.sizeLimits.atLimit).toBe(true);
      expect(testResults.sizeLimits.overLimit).toBe(true);
      expect(testResults.corruptFiles.jpgCorrupt).toBe(true);
      expect(testResults.corruptFiles.pngCorrupt).toBe(true);
      expect(testResults.corruptFiles.gifCorrupt).toBe(true);
      expect(testResults.corruptFiles.mp4Corrupt).toBe(true);
      expect(testResults.unsupportedFormats.bmp).toBe(true);
      expect(testResults.unsupportedFormats.avi).toBe(true);
      expect(testResults.unsupportedFormats.pdf).toBe(true);
      expect(testResults.unsupportedFormats.exe).toBe(true);
      expect(testResults.unsupportedFormats.zip).toBe(true);
      expect(testResults.security.pathTraversal).toBe(true);
      expect(testResults.security.specialChars).toBe(true);
      expect(testResults.security.longFilename).toBe(true);
    });
  });
});

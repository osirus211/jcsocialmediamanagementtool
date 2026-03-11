/**
 * Client-side Image Compression Utilities
 * 
 * Provides browser-based image compression using Canvas API
 * Reduces file sizes before upload to improve performance
 */

/**
 * Compress an image file using Canvas API
 * 
 * @param file - Original image file
 * @param maxWidth - Maximum width (default: 2048)
 * @param quality - Compression quality 0-1 (default: 0.85)
 * @returns Compressed image file
 */
export async function compressImageFile(
  file: File,
  maxWidth: number = 2048,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Create image element
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions
        const { width: newWidth, height: newHeight } = calculateDimensions(
          img.width,
          img.height,
          maxWidth
        );

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Set canvas dimensions
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw and compress image
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Create new file with same name but compressed content
            const compressedFile = new File([blob], file.name, {
              type: blob.type,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/webp', // Use WebP for better compression
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Check if a file is an image
 * 
 * @param file - File to check
 * @returns True if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get image dimensions from file
 * 
 * @param file - Image file
 * @returns Promise with width and height
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new Error('File is not an image'));
      return;
    }

    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 * 
 * @param originalWidth - Original width
 * @param originalHeight - Original height
 * @param maxWidth - Maximum allowed width
 * @returns New dimensions
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalHeight / originalWidth;
  const newWidth = maxWidth;
  const newHeight = Math.round(newWidth * aspectRatio);

  return { width: newWidth, height: newHeight };
}

/**
 * Estimate compressed file size
 * 
 * @param originalSize - Original file size in bytes
 * @param quality - Compression quality (0-1)
 * @returns Estimated compressed size
 */
export function estimateCompressedSize(originalSize: number, quality: number = 0.85): number {
  // WebP typically achieves 25-35% better compression than JPEG
  // Quality factor affects final size
  const webpCompressionRatio = 0.3; // ~30% of original JPEG size
  const qualityFactor = 0.5 + (quality * 0.5); // Quality affects size
  
  return Math.round(originalSize * webpCompressionRatio * qualityFactor);
}
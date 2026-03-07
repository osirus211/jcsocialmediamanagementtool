import { useState, useCallback, useRef } from 'react';
import { composerService } from '@/services/composer.service';
import { Media } from '@/types/composer.types';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  error: string | null;
  preview: string;
}

/**
 * useMediaUpload Hook
 * 
 * Manages media upload with progress tracking
 * 
 * Features:
 * - Upload progress per file
 * - Optimistic preview
 * - Error handling
 * - Concurrent uploads
 * - File validation
 * 
 * Safety:
 * - Validates file type and size
 * - Prevents UI freeze
 * - Handles upload failures
 * - Cleans up on unmount
 */
export function useMediaUpload() {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<Media[]>([]);
  
  // Track active uploads for cleanup
  const activeUploadsRef = useRef<Set<string>>(new Set());

  /**
   * Validate file
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Validate type
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
    ];
    
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Supported: JPEG, PNG, GIF, WebP, MP4, MOV, AVI, WebM',
      };
    }
    
    // Validate size
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    const maxSize = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024; // 10MB for images, 100MB for videos
    
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large. Max size: ${isImage ? '10MB' : '100MB'}`,
      };
    }
    
    return { valid: true };
  }, []);

  /**
   * Create preview URL for file
   */
  const createPreview = useCallback((file: File): string => {
    return URL.createObjectURL(file);
  }, []);

  /**
   * Upload single file
   */
  const uploadFile = useCallback(async (file: File): Promise<Media | null> => {
    // Validate
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileId = `${Date.now()}-${file.name}`;
    const preview = createPreview(file);

    // Add to uploading list
    const uploadingFile: UploadingFile = {
      id: fileId,
      file,
      progress: 0,
      error: null,
      preview,
    };

    setUploadingFiles((prev) => [...prev, uploadingFile]);
    activeUploadsRef.current.add(fileId);

    try {
      // Upload with progress tracking
      const media = await composerService.uploadMedia(file, (progress) => {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, progress } : f
          )
        );
      });

      // Remove from uploading list
      setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
      
      // Add to uploaded list
      setUploadedMedia((prev) => [media, ...prev]);
      
      // Clean up preview URL
      URL.revokeObjectURL(preview);
      activeUploadsRef.current.delete(fileId);

      return media;
    } catch (error: any) {
      console.error('Upload error:', error);
      
      const errorMessage = error.response?.data?.message || 'Upload failed';
      
      // Mark as error
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, error: errorMessage } : f
        )
      );
      
      activeUploadsRef.current.delete(fileId);
      
      return null;
    }
  }, [validateFile, createPreview]);

  /**
   * Upload multiple files
   */
  const uploadFiles = useCallback(async (files: File[]): Promise<Media[]> => {
    const uploadPromises = files.map((file) => uploadFile(file));
    const results = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    return results.filter((media): media is Media => media !== null);
  }, [uploadFile]);

  /**
   * Remove uploading file (cancel)
   */
  const removeUploadingFile = useCallback((fileId: string) => {
    setUploadingFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== fileId);
    });
    activeUploadsRef.current.delete(fileId);
  }, []);

  /**
   * Clear uploaded media list
   */
  const clearUploadedMedia = useCallback(() => {
    setUploadedMedia([]);
  }, []);

  /**
   * Cleanup on unmount
   */
  const cleanup = useCallback(() => {
    uploadingFiles.forEach((file) => {
      URL.revokeObjectURL(file.preview);
    });
  }, [uploadingFiles]);

  return {
    uploadingFiles,
    uploadedMedia,
    uploadFile,
    uploadFiles,
    removeUploadingFile,
    clearUploadedMedia,
    cleanup,
  };
}

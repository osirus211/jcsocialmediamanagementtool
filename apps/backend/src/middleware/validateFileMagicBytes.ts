import { Request, Response, NextFunction } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../utils/errors';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'application/pdf'
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'pdf'];

export const validateFileMagicBytes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    for (const file of files) {
      if (!file) continue;

      const buffer = file.buffer;
      if (!buffer) {
        throw new AppError(400, 'File buffer is missing');
      }

      const fileType = await fileTypeFromBuffer(buffer);
      
      if (!fileType) {
        throw new AppError(400, 'Unable to determine file type from content', {
          fileName: file.originalname
        });
      }

      if (!ALLOWED_MIME_TYPES.includes(fileType.mime)) {
        throw new AppError(400, `File type ${fileType.mime} is not allowed`, {
          fileName: file.originalname,
          detectedMimeType: fileType.mime,
          allowedTypes: ALLOWED_MIME_TYPES
        });
      }

      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        throw new AppError(400, `File extension .${fileExtension} is not allowed`, {
          fileName: file.originalname,
          detectedExtension: fileExtension,
          allowedExtensions: ALLOWED_EXTENSIONS
        });
      }

      const extensionMimeMap: Record<string, string[]> = {
        'jpg': ['image/jpeg'],
        'jpeg': ['image/jpeg'],
        'png': ['image/png'],
        'gif': ['image/gif'],
        'webp': ['image/webp'],
        'mp4': ['video/mp4'],
        'mov': ['video/quicktime'],
        'avi': ['video/x-msvideo'],
        'pdf': ['application/pdf']
      };

      const expectedMimes = extensionMimeMap[fileExtension];
      if (!expectedMimes || !expectedMimes.includes(fileType.mime)) {
        throw new AppError(400, 'File extension does not match file content', {
          fileName: file.originalname,
          extension: fileExtension,
          detectedMimeType: fileType.mime,
          expectedMimeTypes: expectedMimes
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

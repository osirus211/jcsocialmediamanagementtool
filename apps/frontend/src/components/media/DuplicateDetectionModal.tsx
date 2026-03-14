import { useState } from 'react';
import { AlertTriangle, X, Check, Upload } from 'lucide-react';
import { Media } from '@/types/composer.types';

interface DuplicateDetectionModalProps {
  duplicateFile: File;
  existingMedia: Media;
  usedInPosts: Array<{
    id: string;
    content: string;
    platform: string;
    scheduledAt?: Date;
  }>;
  onUseExisting: () => void;
  onUploadAnyway: () => void;
  onCancel: () => void;
}

export function DuplicateDetectionModal({
  duplicateFile,
  existingMedia,
  usedInPosts,
  onUseExisting,
  onUploadAnyway,
  onCancel,
}: DuplicateDetectionModalProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Duplicate File Detected
            </h2>
            <button
              onClick={onCancel}
              className="ml-auto p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            A file with identical content already exists in your media library.
          </p>

          {/* File Comparison */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* New File */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">New File</h3>
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                <img
                  src={URL.createObjectURL(duplicateFile)}
                  alt={duplicateFile.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-medium truncate">{duplicateFile.name}</div>
                <div className="text-gray-500">{formatFileSize(duplicateFile.size)}</div>
                <div className="text-gray-500">{duplicateFile.type}</div>
              </div>
            </div>

            {/* Existing File */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Existing File</h3>
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                <img
                  src={existingMedia.thumbnails?.medium || existingMedia.thumbnailUrl || existingMedia.url}
                  alt={existingMedia.filename}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-medium truncate">{existingMedia.filename}</div>
                <div className="text-gray-500">{formatFileSize(existingMedia.size)}</div>
                <div className="text-gray-500">{existingMedia.mimeType}</div>
                <div className="text-gray-500">Uploaded {formatDate(existingMedia.createdAt)}</div>
              </div>
            </div>
          </div>
          {/* Used in Posts */}
          {usedInPosts.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">
                This file is used in {usedInPosts.length} post(s):
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {usedInPosts.map((post) => (
                  <div key={post.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="text-sm text-gray-900 mb-1">
                      {post.content.substring(0, 80)}
                      {post.content.length > 80 && '...'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{post.platform}</span>
                      {post.scheduledAt && (
                        <>
                          <span>•</span>
                          <span>{formatDate(post.scheduledAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onUseExisting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Use Existing File
            </button>
            
            <button
              onClick={onUploadAnyway}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Anyway
            </button>
          </div>

          <div className="mt-3 text-center">
            <button
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
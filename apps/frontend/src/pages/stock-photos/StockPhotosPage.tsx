/**
 * StockPhotosPage Component
 * 
 * Full-page stock photo browser
 */

import { useState } from 'react';
import { StockPhotoSearch } from '@/components/media/StockPhotoSearch';
import { useComposerStore } from '@/store/composer.store';

export function StockPhotosPage() {
  const { addMedia } = useComposerStore();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleImport = async (file: File) => {
    try {
      // Add to media library via composer store
      await addMedia([file]);
      
      setNotification({
        type: 'success',
        message: 'Photo imported successfully!',
      });

      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Failed to import photo:', error);
      setNotification({
        type: 'error',
        message: 'Failed to import photo',
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleError = (error: string) => {
    setNotification({
      type: 'error',
      message: error,
    });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Photos</h1>
            <p className="text-gray-600 mt-1">
              Browse and import photos from Unsplash and Pexels
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mx-6 mt-4 p-4 rounded-lg ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {notification.message}
          </div>
        </div>
      )}

      {/* Stock Photo Search */}
      <div className="flex-1 bg-white">
        <StockPhotoSearch
          onImport={handleImport}
          onError={handleError}
          columns={4}
        />
      </div>
    </div>
  );
}
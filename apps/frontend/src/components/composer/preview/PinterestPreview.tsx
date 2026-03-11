/**
 * Pinterest Preview Component
 * Shows how the post will appear as a Pinterest Pin
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';

interface PinterestPreviewProps {
  content: string;
  media: MediaFile[];
  accountName?: string;
  accountAvatar?: string;
}

const PinterestPreview = memo(function PinterestPreview({ 
  content, 
  media, 
  accountName, 
  accountAvatar 
}: PinterestPreviewProps) {
  const imageMedia = useMemo(() => 
    media.find(m => m.type === 'image'), 
    [media]
  );

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Pin Image */}
      <div className="relative">
        {imageMedia ? (
          <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
            <img 
              src={imageMedia.url} 
              alt="Pin"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            />
          </div>
        ) : (
          <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="w-12 h-12 mx-auto mb-2 bg-red-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <p className="text-sm font-medium">Add Image</p>
              <p className="text-xs">Pinterest works best with images</p>
            </div>
          </div>
        )}
        
        {/* Save Button Overlay */}
        <div className="absolute top-3 right-3 opacity-0 hover:opacity-100 transition-opacity">
          <button className="bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-red-700">
            Save
          </button>
        </div>
      </div>

      {/* Pin Details */}
      <div className="p-4">
        {/* Pin Title/Description */}
        <div className="mb-3">
          <p className="text-sm text-gray-900 line-clamp-3">
            {content || 'Add a description to help people understand what your Pin is about.'}
          </p>
        </div>

        {/* Pinner Info */}
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
            {accountAvatar ? (
              <img src={accountAvatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-red-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {accountName ? accountName[0].toUpperCase() : 'P'}
                </span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-600 font-medium">
            {accountName || 'Your Pinterest'}
          </span>
        </div>

        {/* Pin Stats */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>0 saves</span>
            <span>0 comments</span>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 hover:bg-gray-100 rounded-full">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-full">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export { PinterestPreview };
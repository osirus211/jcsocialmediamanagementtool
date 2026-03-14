/**
 * Google Business Profile Preview Component
 * Renders a Google Business post card with business info and engagement
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';
import { ThumbsUp, MessageCircle, Share2, MapPin, Star, MoreHorizontal } from 'lucide-react';
import { PreviewMediaGrid } from './PreviewMediaGrid';

interface GoogleBusinessPreviewProps {
  content: string;
  media: MediaFile[];
  businessName?: string;
  businessAvatar?: string;
  businessAddress?: string;
  businessRating?: number;
}

const GOOGLE_BUSINESS_LIMIT = 1500;

const GoogleBusinessPreview = memo(function GoogleBusinessPreview({
  content,
  media,
  businessName = 'Your Business',
  businessAvatar,
  businessAddress = '123 Main St, City, State',
  businessRating = 4.5,
}: GoogleBusinessPreviewProps) {
  const isOverLimit = content.length > GOOGLE_BUSINESS_LIMIT;
  const completedMedia = useMemo(() => 
    media.filter((m) => m.uploadStatus === 'completed'), 
    [media]
  );

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />
      );
    }

    if (hasHalfStar) {
      stars.push(
        <Star key="half" className="h-3 w-3 text-yellow-400 fill-yellow-400/50" />
      );
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300" />
      );
    }

    return stars;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden w-full max-w-[400px] mx-auto shadow-sm">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            {/* Business Avatar */}
            {businessAvatar ? (
              <img
                src={businessAvatar}
                alt={businessName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {businessName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Business Info */}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-base">{businessName}</h3>
              
              {/* Rating */}
              <div className="flex items-center gap-1 mb-1">
                <div className="flex items-center">
                  {renderStars(businessRating)}
                </div>
                <span className="text-sm text-gray-600 ml-1">{businessRating}</span>
              </div>

              {/* Address */}
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{businessAddress}</span>
              </div>

              {/* Post Time */}
              <div className="text-xs text-gray-500 mt-1">
                Posted just now
              </div>
            </div>
          </div>

          <button className="p-1 hover:bg-gray-100 rounded-full">
            <MoreHorizontal className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Post Content */}
        <div className={`text-sm whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
          {content || 'Your Google Business post will appear here...'}
        </div>
      </div>

      {/* Media */}
      {completedMedia.length > 0 && (
        <div className="w-full">
          <PreviewMediaGrid media={media} maxItems={4} />
        </div>
      )}

      {/* Action Bar */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
              <ThumbsUp className="h-5 w-5" />
              <span className="text-sm">Helpful</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">Comment</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
              <Share2 className="h-5 w-5" />
              <span className="text-sm">Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Character Count */}
      <div className="px-4 pb-3">
        <div className={`text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {content.length} / {GOOGLE_BUSINESS_LIMIT}
          {isOverLimit && <span className="ml-2">Over limit!</span>}
        </div>
      </div>
    </div>
  );
});

export { GoogleBusinessPreview };
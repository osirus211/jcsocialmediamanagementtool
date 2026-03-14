import { Media } from '@/types/composer.types';
import { Clock, Play } from 'lucide-react';

interface RecentlyUsedMediaProps {
  media: Media[];
  onMediaSelect: (media: Media) => void;
}

export function RecentlyUsedMedia({ media, onMediaSelect }: RecentlyUsedMediaProps) {
  if (media.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-900">Recently Used</h3>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2">
        {media.slice(0, 8).map((item) => (
          <div
            key={item._id}
            onClick={() => onMediaSelect(item)}
            className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
          >
            <div className="relative w-full h-full">
              <img
                src={item.thumbnails?.small || item.thumbnailUrl || item.url}
                alt={item.filename}
                className="w-full h-full object-cover"
              />
              
              {item.type === 'VIDEO' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <Play className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
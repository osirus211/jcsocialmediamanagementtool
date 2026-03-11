/**
 * Preview Media Grid
 * Shared component for rendering media in platform-appropriate layouts
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';

interface PreviewMediaGridProps {
  media: MediaFile[];
  maxItems?: number;
}

const PreviewMediaGrid = memo(function PreviewMediaGrid({ media, maxItems = 4 }: PreviewMediaGridProps) {
  const completedMedia = useMemo(() => 
    media
      .filter((m) => m.uploadStatus === 'completed')
      .slice(0, maxItems),
    [media, maxItems]
  );

  if (completedMedia.length === 0) {
    return null;
  }

  // Single image: full width
  if (completedMedia.length === 1) {
    return (
      <div className="mt-3">
        <img
          src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
          alt=""
          className="rounded-lg w-full max-h-96 object-cover"
        />
      </div>
    );
  }

  // Two images: side by side
  if (completedMedia.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1">
        {completedMedia.map((item) => (
          <img
            key={item.id}
            src={item.thumbnailUrl || item.url}
            alt=""
            className="rounded-lg w-full h-48 object-cover"
          />
        ))}
      </div>
    );
  }

  // Three images: one large left, two stacked right
  if (completedMedia.length === 3) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1">
        <img
          src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
          alt=""
          className="rounded-lg w-full h-full object-cover row-span-2"
        />
        <div className="grid grid-rows-2 gap-1">
          <img
            src={completedMedia[1].thumbnailUrl || completedMedia[1].url}
            alt=""
            className="rounded-lg w-full h-full object-cover"
          />
          <img
            src={completedMedia[2].thumbnailUrl || completedMedia[2].url}
            alt=""
            className="rounded-lg w-full h-full object-cover"
          />
        </div>
      </div>
    );
  }

  // Four images: 2x2 grid
  return (
    <div className="mt-3 grid grid-cols-2 gap-1">
      {completedMedia.map((item) => (
        <img
          key={item.id}
          src={item.thumbnailUrl || item.url}
          alt=""
          className="rounded-lg w-full h-48 object-cover"
        />
      ))}
    </div>
  );
});

export { PreviewMediaGrid };

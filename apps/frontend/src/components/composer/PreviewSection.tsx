import { useState } from 'react';
import { SocialPlatform, MediaFile } from '@/types/composer.types';
import { PlatformPreview } from './PlatformPreview';

interface PreviewSectionProps {
  platforms: SocialPlatform[];
  mainContent: string;
  platformContent: Record<SocialPlatform, string>;
  media: MediaFile[];
}

const platformNames: Record<SocialPlatform, string> = {
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  threads: 'Threads',
  bluesky: 'Bluesky',
  'google-business': 'Google Business',
  pinterest: 'Pinterest',
};

export function PreviewSection({
  platforms,
  mainContent,
  platformContent,
  media,
}: PreviewSectionProps) {
  const [activePreview, setActivePreview] = useState<SocialPlatform | null>(
    platforms.length > 0 ? platforms[0] : null
  );

  if (platforms.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 border rounded-lg bg-gray-50">
        <p>Select accounts to see preview</p>
      </div>
    );
  }

  // Get content for the active preview platform
  const getPreviewContent = (platform: SocialPlatform) => {
    return platformContent[platform] || mainContent;
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Preview
      </label>

      {/* Preview Tabs */}
      {platforms.length > 1 && (
        <div className="border-b border-gray-200">
          <div className="flex gap-2 overflow-x-auto">
            {platforms.map((platform) => {
              const isActive = activePreview === platform;

              return (
                <button
                  key={platform}
                  onClick={() => setActivePreview(platform)}
                  className={`
                    px-4 py-2 border-b-2 transition-colors font-medium text-sm
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  {platformNames[platform]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview Content */}
      <div className="flex justify-center overflow-x-auto">
        <div className="w-full max-w-md">
          {activePreview && (
            <PlatformPreview
              platform={activePreview}
              content={getPreviewContent(activePreview)}
              media={media}
            />
          )}
        </div>
      </div>
    </div>
  );
}

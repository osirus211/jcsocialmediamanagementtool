import { useState } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { SocialPlatform } from '@/types/composer.types';

interface PlatformOverridePanelProps {
  onClose?: () => void;
}

const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  threads: 500,
  bluesky: 300,
  'google-business': 1500,
};

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  twitter: 'Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
  bluesky: 'Bluesky',
  'google-business': 'Google Business',
};

export function PlatformOverridePanel({ onClose }: PlatformOverridePanelProps) {
  const mainContent = useComposerStore(state => state.mainContent);
  const platformContent = useComposerStore(state => state.platformContent);
  const selectedAccounts = useComposerStore(state => state.selectedAccounts);
  const copyFromBaseContent = useComposerStore(state => state.copyFromBaseContent);
  const resetPlatformContent = useComposerStore(state => state.resetPlatformContent);
  const setContent = useComposerStore(state => state.setContent);

  const [activeTab, setActiveTab] = useState<SocialPlatform | null>(null);
  const [platformOverrides, setPlatformOverrides] = useState<Record<string, boolean>>({});

  // Get unique platforms from selected accounts
  // Mock getting platforms - in real implementation, get from accounts
  const selectedPlatforms: SocialPlatform[] = ['twitter', 'instagram', 'facebook', 'linkedin'];

  // Set first platform as active if none selected
  if (!activeTab && selectedPlatforms.length > 0) {
    setActiveTab(selectedPlatforms[0]);
  }

  const handleToggleOverride = (platform: SocialPlatform, enabled: boolean) => {
    setPlatformOverrides(prev => ({ ...prev, [platform]: enabled }));
    if (enabled) {
      copyFromBaseContent(platform);
    } else {
      resetPlatformContent(platform);
    }
  };

  const handleContentChange = (platform: SocialPlatform, content: string) => {
    setContent(platform, content);
  };

  const getCharacterCountColor = (count: number, limit: number): string => {
    const percentage = (count / limit) * 100;
    if (percentage >= 95) return 'text-red-600';
    if (percentage >= 80) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      data-testid="platform-override-panel"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Customize Content Per Platform</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg min-w-[44px] min-h-[44px]"
            aria-label="Close platform override panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex overflow-x-auto border-b bg-gray-50">
          {selectedPlatforms.map((platform) => (
            <button
              key={platform}
              onClick={() => setActiveTab(platform)}
              className={`px-4 py-3 min-w-[120px] font-medium transition-colors min-h-[44px] ${
                activeTab === platform
                  ? 'bg-white border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              data-testid={`platform-override-tab-${platform}`}
            >
              {PLATFORM_NAMES[platform]}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab && (
            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor={`override-toggle-${activeTab}`} className="text-sm font-medium">
                  Customize content for {PLATFORM_NAMES[activeTab]}
                </label>
                <button
                  id={`override-toggle-${activeTab}`}
                  role="switch"
                  aria-checked={platformOverrides[activeTab] || false}
                  onClick={() => handleToggleOverride(activeTab, !platformOverrides[activeTab])}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors min-w-[44px] min-h-[44px] ${
                    platformOverrides[activeTab] ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  data-testid={`platform-override-toggle-${activeTab}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      platformOverrides[activeTab] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Editor */}
              {platformOverrides[activeTab] ? (
                <div className="space-y-2">
                  <textarea
                    value={platformContent[activeTab] || ''}
                    onChange={(e) => handleContentChange(activeTab, e.target.value)}
                    placeholder={`Write custom content for ${PLATFORM_NAMES[activeTab]}...`}
                    className="w-full min-h-[200px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    data-testid={`platform-override-editor-${activeTab}`}
                  />
                  
                  {/* Character Count */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">
                      Custom content for {PLATFORM_NAMES[activeTab]}
                    </span>
                    <span
                      className={`font-medium ${getCharacterCountColor(
                        (platformContent[activeTab] || '').length,
                        PLATFORM_LIMITS[activeTab]
                      )}`}
                    >
                      {(platformContent[activeTab] || '').length} / {PLATFORM_LIMITS[activeTab]}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Using global content:
                  </p>
                  <div className="bg-white p-3 rounded border">
                    <p className="text-sm whitespace-pre-wrap">{mainContent || 'No content yet...'}</p>
                  </div>
                  <div className="mt-2 text-sm">
                    <span
                      className={`font-medium ${getCharacterCountColor(
                        mainContent.length,
                        PLATFORM_LIMITS[activeTab]
                      )}`}
                    >
                      {mainContent.length} / {PLATFORM_LIMITS[activeTab]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

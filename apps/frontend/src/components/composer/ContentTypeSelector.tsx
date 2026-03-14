import { useComposerStore } from '@/store/composer.store';
import { useSocialAccountStore } from '@/store/social.store';

type ContentType = 'post' | 'story' | 'reel' | 'thread';

interface ContentTypeOption {
  type: ContentType;
  label: string;
  icon: string;
  constraints?: string;
  platforms?: string[];
}

const contentTypes: ContentTypeOption[] = [
  {
    type: 'post',
    label: 'Post',
    icon: '📝',
  },
  {
    type: 'thread',
    label: 'Thread',
    icon: '🧵',
    constraints: 'Multi-tweet story · Auto-numbering · Drag & drop',
    platforms: ['twitter', 'bluesky', 'mastodon', 'threads'],
  },
  {
    type: 'story',
    label: 'Story',
    icon: '⭕',
    constraints: 'Vertical video or image · Disappears in 24h',
    platforms: ['instagram'],
  },
  {
    type: 'reel',
    label: 'Reel',
    icon: '🎬',
    constraints: 'Vertical video only · 15–90 seconds',
    platforms: ['instagram'],
  },
];

export function ContentTypeSelector() {
  const { contentType, setContentType, selectedAccounts } = useComposerStore();
  const { accounts } = useSocialAccountStore();

  // Get selected platforms
  const selectedPlatforms = accounts
    .filter((acc) => selectedAccounts.includes(acc._id))
    .map((acc) => acc.platform.toLowerCase());

  // Filter content types based on selected platforms
  const availableTypes = contentTypes.filter((contentType) => {
    if (contentType.type === 'post') return true; // Post is always available
    
    if (!contentType.platforms) return false;
    
    // Check if any selected platform supports this content type
    return contentType.platforms.some(platform => selectedPlatforms.includes(platform));
  });

  if (availableTypes.length === 1) {
    return null; // Don't show selector if only one option
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Content Type</h3>
      
      <div className="flex gap-2">
        {availableTypes.map((option) => (
          <button
            key={option.type}
            onClick={() => setContentType(option.type)}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
              contentType === option.type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">{option.icon}</span>
              <span
                className={`text-sm font-medium ${
                  contentType === option.type ? 'text-blue-700' : 'text-gray-700'
                }`}
              >
                {option.label}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Show constraints for selected type */}
      {contentType !== 'post' && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            {contentTypes.find((t) => t.type === contentType)?.constraints}
          </p>
        </div>
      )}
    </div>
  );
}

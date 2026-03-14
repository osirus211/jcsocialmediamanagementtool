import { SocialPlatform } from '@/types/composer.types';
import { useComposerStore } from '@/store/composer.store';
import { useState } from 'react';
import { 
  MessageCircle, 
  Users, 
  Lock, 
  Globe, 
  Hash, 
  MapPin, 
  Image, 
  Video,
  Settings,
  Eye,
  EyeOff,
  Heart,
  Share,
  MessageSquare,
  Baby,
  AlertTriangle
} from 'lucide-react';

interface PlatformSpecificSettingsProps {
  platform: SocialPlatform;
}

// YouTube categories
const YOUTUBE_CATEGORIES = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' },
  { id: '29', name: 'Nonprofits & Activism' },
];

export function PlatformSpecificSettings({ platform }: PlatformSpecificSettingsProps) {
  const platformSettings = useComposerStore(state => state.platformSettings);
  const setPlatformSettings = useComposerStore(state => state.setPlatformSettings);
  
  // Get current settings for this platform
  const currentSettings = platformSettings[platform] || {};
  
  // Update settings helper
  const updateSettings = (newSettings: any) => {
    setPlatformSettings(platform, { ...currentSettings, ...newSettings });
  };

  const renderTwitterSettings = () => {
    const settings = {
      enableThread: false,
      replySettings: 'everyone',
      enablePoll: false,
      pollOptions: ['', ''],
      pollDuration: 24,
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Twitter/X Settings
        </h4>
        
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.enableThread}
              onChange={(e) => updateSettings({ enableThread: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Split into thread if over character limit</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Who can reply
            </label>
            <select
              value={settings.replySettings}
              onChange={(e) => updateSettings({ replySettings: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="everyone">Everyone</option>
              <option value="followers">People you follow</option>
              <option value="mentioned">Only people you mention</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.enablePoll}
              onChange={(e) => updateSettings({ enablePoll: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Add poll</span>
          </label>

          {settings.enablePoll && (
            <div className="ml-6 space-y-2">
              <input
                type="text"
                placeholder="Poll option 1"
                value={settings.pollOptions[0]}
                onChange={(e) => updateSettings({
                  pollOptions: [e.target.value, settings.pollOptions[1]]
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Poll option 2"
                value={settings.pollOptions[1]}
                onChange={(e) => updateSettings({
                  pollOptions: [settings.pollOptions[0], e.target.value]
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Poll duration (hours)
                </label>
                <select
                  value={settings.pollDuration}
                  onChange={(e) => updateSettings({ pollDuration: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={24}>1 day</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderInstagramSettings = () => {
    const settings = {
      enableFirstComment: false,
      firstComment: '',
      aspectRatio: 'original',
      altText: '',
      location: '',
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Image className="w-4 h-4" />
          Instagram Settings
        </h4>
        
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.enableFirstComment}
              onChange={(e) => updateSettings({ enableFirstComment: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Add first comment</span>
          </label>

          {settings.enableFirstComment && (
            <textarea
              placeholder="First comment (hashtags, mentions, etc.)"
              value={settings.firstComment}
              onChange={(e) => updateSettings({ firstComment: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aspect ratio
            </label>
            <select
              value={settings.aspectRatio}
              onChange={(e) => updateSettings({ aspectRatio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="original">Original</option>
              <option value="1:1">Square (1:1)</option>
              <option value="4:5">Portrait (4:5)</option>
              <option value="9:16">Story (9:16)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alt text for accessibility
            </label>
            <input
              type="text"
              placeholder="Describe your image for screen readers"
              value={settings.altText}
              onChange={(e) => updateSettings({ altText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Location
            </label>
            <input
              type="text"
              placeholder="Add location"
              value={settings.location}
              onChange={(e) => updateSettings({ location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderLinkedInSettings = () => {
    const settings = {
      contentType: 'post',
      visibility: 'anyone',
      allowComments: true,
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4" />
          LinkedIn Settings
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content type
            </label>
            <select
              value={settings.contentType}
              onChange={(e) => updateSettings({ contentType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="post">Post</option>
              <option value="article">Article</option>
              <option value="document">Document</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Who can see this
            </label>
            <select
              value={settings.visibility}
              onChange={(e) => updateSettings({ visibility: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="anyone">Anyone</option>
              <option value="connections">Connections only</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.allowComments}
              onChange={(e) => updateSettings({ allowComments: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Allow comments</span>
          </label>
        </div>
      </div>
    );
  };

  const renderTikTokSettings = () => {
    const settings = {
      privacy: 'public',
      allowDuet: true,
      allowStitch: true,
      allowComments: true,
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Video className="w-4 h-4" />
          TikTok Settings
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Privacy
            </label>
            <select
              value={settings.privacy}
              onChange={(e) => updateSettings({ privacy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="private">Private</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.allowDuet}
              onChange={(e) => updateSettings({ allowDuet: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Allow duet</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.allowStitch}
              onChange={(e) => updateSettings({ allowStitch: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Allow stitch</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.allowComments}
              onChange={(e) => updateSettings({ allowComments: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Allow comments</span>
          </label>
        </div>
      </div>
    );
  };

  const renderYouTubeSettings = () => {
    const settings = {
      category: '22',
      privacy: 'public',
      madeForKids: false,
      tags: '',
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Video className="w-4 h-4" />
          YouTube Settings
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={settings.category}
              onChange={(e) => updateSettings({ category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {YOUTUBE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Privacy
            </label>
            <select
              value={settings.privacy}
              onChange={(e) => updateSettings({ privacy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.madeForKids}
              onChange={(e) => updateSettings({ madeForKids: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 flex items-center gap-1">
              <Baby className="w-4 h-4" />
              Made for kids
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Hash className="w-4 h-4" />
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="gaming, tutorial, howto"
              value={settings.tags}
              onChange={(e) => updateSettings({ tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderPinterestSettings = () => {
    const settings = {
      board: '',
      destinationUrl: '',
      altText: '',
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Image className="w-4 h-4" />
          Pinterest Settings
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Board
            </label>
            <select
              value={settings.board}
              onChange={(e) => updateSettings({ board: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a board</option>
              <option value="inspiration">Inspiration</option>
              <option value="recipes">Recipes</option>
              <option value="home-decor">Home Decor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination URL
            </label>
            <input
              type="url"
              placeholder="https://example.com"
              value={settings.destinationUrl}
              onChange={(e) => updateSettings({ destinationUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alt text
            </label>
            <input
              type="text"
              placeholder="Describe your image"
              value={settings.altText}
              onChange={(e) => updateSettings({ altText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderRedditSettings = () => {
    const settings = {
      subreddit: '',
      postType: 'text',
      nsfw: false,
      spoiler: false,
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Reddit Settings
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subreddit
            </label>
            <input
              type="text"
              placeholder="r/programming"
              value={settings.subreddit}
              onChange={(e) => updateSettings({ subreddit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post type
            </label>
            <select
              value={settings.postType}
              onChange={(e) => updateSettings({ postType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="text">Text</option>
              <option value="link">Link</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.nsfw}
              onChange={(e) => updateSettings({ nsfw: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              NSFW
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.spoiler}
              onChange={(e) => updateSettings({ spoiler: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Spoiler</span>
          </label>
        </div>
      </div>
    );
  };

  const renderBlueskySettings = () => {
    const settings = {
      language: 'en',
      contentWarning: false,
      contentWarningText: '',
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Bluesky Settings
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.contentWarning}
              onChange={(e) => updateSettings({ contentWarning: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Content warning</span>
          </label>

          {settings.contentWarning && (
            <input
              type="text"
              placeholder="Warning text"
              value={settings.contentWarningText}
              onChange={(e) => updateSettings({ contentWarningText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          )}
        </div>
      </div>
    );
  };

  const renderMastodonSettings = () => {
    const settings = {
      visibility: 'public',
      contentWarning: false,
      contentWarningText: '',
      language: 'en',
      ...currentSettings
    };

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Mastodon Settings
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visibility
            </label>
            <select
              value={settings.visibility}
              onChange={(e) => updateSettings({ visibility: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="followers">Followers only</option>
              <option value="direct">Direct</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.contentWarning}
              onChange={(e) => updateSettings({ contentWarning: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Content warning</span>
          </label>

          {settings.contentWarning && (
            <input
              type="text"
              placeholder="Warning text"
              value={settings.contentWarningText}
              onChange={(e) => updateSettings({ contentWarningText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    switch (platform) {
      case 'twitter':
        return renderTwitterSettings();
      case 'instagram':
        return renderInstagramSettings();
      case 'linkedin':
        return renderLinkedInSettings();
      case 'tiktok':
        return renderTikTokSettings();
      case 'youtube':
        return renderYouTubeSettings();
      case 'pinterest':
        return renderPinterestSettings();
      case 'facebook':
        return renderInstagramSettings(); // Similar settings to Instagram
      case 'threads':
        return renderTwitterSettings(); // Similar settings to Twitter
      case 'bluesky':
        return renderBlueskySettings();
      case 'google-business':
        return null; // No specific settings for Google Business
      default:
        return null;
    }
  };

  const settings = renderSettings();
  
  if (!settings) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border">
      {settings}
    </div>
  );
}
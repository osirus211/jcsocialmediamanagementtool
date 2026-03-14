import { useState } from 'react';
import { SocialPlatform } from '@/types/social.types';
import { apiClient } from '@/lib/api-client';
import { InstagramConnectModal } from './InstagramConnectModal';
import { BlueskyConnectModal } from './BlueskyConnectModal';
import { MastodonConnectModal } from './MastodonConnectModal';

interface ConnectButtonProps {
  platform: SocialPlatform;
  onSuccess?: () => void;
}

const platformLabels: Record<SocialPlatform, string> = {
  [SocialPlatform.TWITTER]: 'Twitter / X',
  [SocialPlatform.LINKEDIN]: 'LinkedIn',
  [SocialPlatform.FACEBOOK]: 'Facebook',
  [SocialPlatform.INSTAGRAM]: 'Instagram',
  [SocialPlatform.YOUTUBE]: 'YouTube',
  [SocialPlatform.THREADS]: 'Threads',
  [SocialPlatform.BLUESKY]: 'Bluesky',
  [SocialPlatform.MASTODON]: 'Mastodon',
  [SocialPlatform.GOOGLE_BUSINESS]: 'Google Business Profile',
  [SocialPlatform.PINTEREST]: 'Pinterest',
};

export function ConnectButton({ platform, onSuccess }: ConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [showBlueskyModal, setShowBlueskyModal] = useState(false);
  const [showMastodonModal, setShowMastodonModal] = useState(false);

  const handleConnect = async () => {
    // Special handling for Instagram - show options modal
    if (platform === SocialPlatform.INSTAGRAM) {
      setShowInstagramModal(true);
      return;
    }

    // Special handling for Bluesky - show credentials modal
    if (platform === SocialPlatform.BLUESKY) {
      setShowBlueskyModal(true);
      return;
    }

    // Special handling for Mastodon - show instance selection modal
    if (platform === SocialPlatform.MASTODON) {
      setShowMastodonModal(true);
      return;
    }

    try {
      setIsConnecting(true);

      // Call V2 OAuth authorize endpoint
      const response = await apiClient.post(`/oauth/${platform}/authorize`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Redirect to OAuth provider
      if (response.authorizationUrl) {
        window.location.href = response.authorizationUrl;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error: any) {
      console.error('Failed to initiate OAuth:', error);
      alert(error.response?.data?.message || 'Failed to connect account');
      setIsConnecting(false);
    }
  };

  const handleInstagramSuccess = () => {
    setShowInstagramModal(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleBlueskySuccess = () => {
    setShowBlueskyModal(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleMastodonSuccess = () => {
    setShowMastodonModal(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <>
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? 'Connecting...' : `Connect ${platformLabels[platform]}`}
      </button>

      {/* Instagram Connect Modal */}
      {platform === SocialPlatform.INSTAGRAM && (
        <InstagramConnectModal
          isOpen={showInstagramModal}
          onClose={() => setShowInstagramModal(false)}
          onSuccess={handleInstagramSuccess}
        />
      )}

      {/* Bluesky Connect Modal */}
      {platform === SocialPlatform.BLUESKY && (
        <BlueskyConnectModal
          isOpen={showBlueskyModal}
          onClose={() => setShowBlueskyModal(false)}
          onSuccess={handleBlueskySuccess}
        />
      )}

      {/* Mastodon Connect Modal */}
      {platform === SocialPlatform.MASTODON && (
        <MastodonConnectModal
          isOpen={showMastodonModal}
          onClose={() => setShowMastodonModal(false)}
          onSuccess={handleMastodonSuccess}
        />
      )}
    </>
  );
}

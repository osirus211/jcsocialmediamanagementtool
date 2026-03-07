import { useState } from 'react';
import { SocialPlatform } from '@/types/social.types';
import { apiClient } from '@/lib/api-client';
import { InstagramConnectModal } from './InstagramConnectModal';

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
  [SocialPlatform.GOOGLE_BUSINESS]: 'Google Business Profile',
};

export function ConnectButton({ platform, onSuccess }: ConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);

  const handleConnect = async () => {
    // Special handling for Instagram - show options modal
    if (platform === SocialPlatform.INSTAGRAM) {
      setShowInstagramModal(true);
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
    </>
  );
}

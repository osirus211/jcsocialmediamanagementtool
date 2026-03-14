import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ReconnectModal } from '../reconnect/ReconnectModal';
import { apiClient } from '@/lib/api-client';

interface AccountCardProps {
  account: {
    id: string;
    platform: string;
    accountName: string;
    username?: string;
    status: 'active' | 'expired' | 'revoked' | 'disconnected' | 'token_expiring' | 'reauth_required';
    profileImageUrl?: string;
    followerCount?: number;
    lastSuccessfulConnection?: string;
    disconnectedAt?: string;
    disconnectionReason?: string;
    tokenExpiresAt?: string;
    daysUntilExpiry?: number;
  };
  onReconnectSuccess?: () => void;
}

const STATUS_CONFIG = {
  active: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badge: 'Connected',
    badgeVariant: 'default' as const
  },
  token_expiring: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    badge: 'Expiring Soon',
    badgeVariant: 'secondary' as const
  },
  expired: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    badge: 'Expired',
    badgeVariant: 'destructive' as const
  },
  revoked: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    badge: 'Reconnect Required',
    badgeVariant: 'destructive' as const
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    badge: 'Disconnected',
    badgeVariant: 'secondary' as const
  },
  reauth_required: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    badge: 'Reauth Required',
    badgeVariant: 'destructive' as const
  }
};

const PLATFORM_COLORS = {
  facebook: 'bg-blue-600',
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  twitter: 'bg-blue-400',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-600',
  tiktok: 'bg-black',
  pinterest: 'bg-red-500',
  threads: 'bg-black'
};

export function EnhancedAccountCard({ account, onReconnectSuccess }: AccountCardProps) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  
  const statusConfig = STATUS_CONFIG[account.status] || STATUS_CONFIG.disconnected;
  const StatusIcon = statusConfig.icon;
  const needsReconnection = ['expired', 'revoked', 'disconnected', 'reauth_required'].includes(account.status);
  const isDisconnected = account.status !== 'active';

  const handleQuickReconnect = async () => {
    setIsReconnecting(true);
    try {
      const response = await apiClient.post(`/api/v1/accounts/${account.id}/reconnect`);
      const { oauthUrl } = response.data;
      
      // Open OAuth in popup
      const popup = window.open(
        oauthUrl,
        'reconnect-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Listen for popup completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setIsReconnecting(false);
          onReconnectSuccess?.();
        }
      }, 1000);

    } catch (error: any) {
      console.error('Failed to initiate reconnect:', error);
      setIsReconnecting(false);
      // Fallback to modal for complex cases
      setShowReconnectModal(true);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatFollowerCount = (count?: number) => {
    if (!count) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <>
      <Card className={`transition-all duration-200 ${
        isDisconnected 
          ? `${statusConfig.bgColor} ${statusConfig.borderColor} border-2 opacity-75` 
          : 'hover:shadow-md'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Account Info */}
            <div className="flex items-center space-x-3">
              {/* Platform Avatar */}
              <div className="relative">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                  PLATFORM_COLORS[account.platform as keyof typeof PLATFORM_COLORS] || 'bg-gray-500'
                }`}>
                  {account.profileImageUrl ? (
                    <img 
                      src={account.profileImageUrl} 
                      alt={account.accountName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    account.platform.charAt(0).toUpperCase()
                  )}
                </div>
                
                {/* Status indicator */}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  account.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  <StatusIcon className="w-2 h-2 text-white m-0.5" />
                </div>
              </div>

              {/* Account Details */}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className={`font-semibold ${isDisconnected ? 'text-gray-600' : 'text-gray-900'}`}>
                    {account.accountName}
                  </h3>
                  <Badge variant={statusConfig.badgeVariant} className="text-xs">
                    {statusConfig.badge}
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span className="capitalize">{account.platform}</span>
                  {account.username && account.username !== account.accountName && (
                    <span>@{account.username}</span>
                  )}
                  {account.followerCount && (
                    <span>{formatFollowerCount(account.followerCount)} followers</span>
                  )}
                </div>

                {/* Status-specific information */}
                {account.status === 'token_expiring' && account.daysUntilExpiry && (
                  <p className="text-xs text-yellow-600 mt-1">
                    Token expires in {account.daysUntilExpiry} day{account.daysUntilExpiry !== 1 ? 's' : ''}
                  </p>
                )}
                
                {isDisconnected && account.disconnectedAt && (
                  <p className="text-xs text-red-600 mt-1">
                    Disconnected: {formatDate(account.disconnectedAt)}
                  </p>
                )}
                
                {account.lastSuccessfulConnection && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last connected: {formatDate(account.lastSuccessfulConnection)}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {needsReconnection && (
                <>
                  <Button
                    size="sm"
                    onClick={handleQuickReconnect}
                    disabled={isReconnecting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isReconnecting ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Reconnect
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReconnectModal(true)}
                  >
                    Details
                  </Button>
                </>
              )}
              
              {account.status === 'token_expiring' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleQuickReconnect}
                  disabled={isReconnecting}
                >
                  {isReconnecting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Refresh Token
                </Button>
              )}
              
              {account.status === 'active' && (
                <div className="flex items-center space-x-1 text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span className="text-xs font-medium">Connected</span>
                </div>
              )}
            </div>
          </div>

          {/* Disconnection reason */}
          {isDisconnected && account.disconnectionReason && (
            <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-700">
              <strong>Reason:</strong> {account.disconnectionReason}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconnect Modal */}
      {showReconnectModal && (
        <ReconnectModal
          isOpen={showReconnectModal}
          onClose={() => setShowReconnectModal(false)}
          account={{
            id: account.id,
            platform: account.platform,
            accountName: account.accountName,
            reason: account.disconnectionReason || 'reconnection_required',
            disconnectedAt: account.disconnectedAt || '',
            lastSuccessfulConnection: account.lastSuccessfulConnection
          }}
          onReconnectSuccess={() => {
            setShowReconnectModal(false);
            onReconnectSuccess?.();
          }}
        />
      )}
    </>
  );
}
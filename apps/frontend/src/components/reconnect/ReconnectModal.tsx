import React, { useState } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';

interface ReconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: {
    id: string;
    platform: string;
    accountName: string;
    reason: string;
    disconnectedAt: string;
    lastSuccessfulConnection?: string;
  };
  onReconnectSuccess?: () => void;
}

const PLATFORM_LOGOS = {
  facebook: '📘',
  instagram: '📷',
  twitter: '🐦',
  linkedin: '💼',
  youtube: '📺',
  tiktok: '🎵',
  pinterest: '📌',
  threads: '🧵'
};

const REASON_EXPLANATIONS = {
  token_expired: {
    title: 'Token Expired',
    description: 'Your access token has expired and needs to be refreshed.',
    steps: ['Click "Reconnect Now"', 'Log in to your account', 'Authorize our app']
  },
  connection_lost: {
    title: 'Connection Lost',
    description: 'The connection to your account was interrupted.',
    steps: ['Click "Reconnect Now"', 'Verify your account access', 'Reauthorize the connection']
  },
  permissions_changed: {
    title: 'Permissions Changed',
    description: 'Your account permissions have been modified.',
    steps: ['Click "Reconnect Now"', 'Review new permissions', 'Grant necessary access']
  },
  account_disconnected: {
    title: 'Account Disconnected',
    description: 'Your account was manually disconnected or access was revoked.',
    steps: ['Click "Reconnect Now"', 'Log in to your account', 'Reauthorize our application']
  }
};

export function ReconnectModal({ isOpen, onClose, account, onReconnectSuccess }: ReconnectModalProps) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectStep, setReconnectStep] = useState<'idle' | 'oauth' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reasonInfo = REASON_EXPLANATIONS[account.reason as keyof typeof REASON_EXPLANATIONS] || {
    title: 'Reconnection Required',
    description: 'Your account needs to be reconnected.',
    steps: ['Click "Reconnect Now"', 'Follow the authentication steps', 'Complete the process']
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectStep('oauth');
    setErrorMessage(null);

    try {
      // Initiate OAuth reconnect flow
      const response = await apiClient.post(`/api/v1/accounts/${account.id}/reconnect`);
      const { oauthUrl } = response.data;
      
      // Open OAuth in popup
      const popup = window.open(
        oauthUrl,
        'reconnect-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes,centerscreen=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups and try again.');
      }

      // Listen for popup completion
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          
          // Check if reconnection was successful
          setTimeout(async () => {
            try {
              const statusResponse = await apiClient.get(`/api/v1/accounts/${account.id}`);
              const accountData = statusResponse.data.account;
              
              if (accountData.status === 'active') {
                setReconnectStep('success');
                setTimeout(() => {
                  onReconnectSuccess?.();
                  onClose();
                }, 2000);
              } else {
                setReconnectStep('error');
                setErrorMessage('Reconnection was not completed. Please try again.');
              }
            } catch (error) {
              setReconnectStep('error');
              setErrorMessage('Failed to verify reconnection status.');
            } finally {
              setIsReconnecting(false);
            }
          }, 1000);
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
          clearInterval(checkClosed);
          setReconnectStep('error');
          setErrorMessage('Reconnection timed out. Please try again.');
          setIsReconnecting(false);
        }
      }, 300000);

    } catch (error: any) {
      console.error('Failed to initiate reconnect:', error);
      setReconnectStep('error');
      setErrorMessage(error.message || 'Failed to start reconnection process.');
      setIsReconnecting(false);
    }
  };

  const handleRemindLater = async () => {
    try {
      await apiClient.post(`/api/v1/accounts/${account.id}/snooze`);
      onClose();
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <span className="text-2xl">
              {PLATFORM_LOGOS[account.platform as keyof typeof PLATFORM_LOGOS] || '🔗'}
            </span>
            <div>
              <div className="font-semibold">Reconnect {account.platform}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {account.accountName}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reason and explanation */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-medium">{reasonInfo.title}</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {reasonInfo.description}
            </p>

            {account.disconnectedAt && (
              <p className="text-xs text-muted-foreground">
                Disconnected: {formatDate(account.disconnectedAt)}
              </p>
            )}

            {account.lastSuccessfulConnection && (
              <p className="text-xs text-muted-foreground">
                Last connected: {formatDate(account.lastSuccessfulConnection)}
              </p>
            )}
          </div>

          {/* Steps to reconnect */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Steps to reconnect:</h4>
            <ol className="space-y-2">
              {reasonInfo.steps.map((step, index) => (
                <li key={index} className="flex items-start space-x-3 text-sm">
                  <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <span className={reconnectStep === 'oauth' && index === 0 ? 'font-medium' : ''}>
                    {step}
                  </span>
                  {reconnectStep === 'oauth' && index === 0 && (
                    <ExternalLink className="w-4 h-4 text-blue-500" />
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Status messages */}
          {reconnectStep === 'oauth' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-800">
                  Opening {account.platform} login window...
                </span>
              </div>
            </div>
          )}

          {reconnectStep === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Successfully reconnected! Closing...
                </span>
              </div>
            </div>
          )}

          {reconnectStep === 'error' && errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <div className="font-medium">Reconnection failed</div>
                  <div className="mt-1">{errorMessage}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-3">
            <Button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="flex-1"
            >
              {isReconnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconnect Now
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleRemindLater}
              disabled={isReconnecting}
            >
              Remind Later
            </Button>
            
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isReconnecting}
              className="px-3"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Help text */}
          <p className="text-xs text-muted-foreground text-center">
            Having trouble? The reconnection process will open a new window where you'll log in to {account.platform} and authorize our app.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
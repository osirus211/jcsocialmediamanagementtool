import React, { useState, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface DisconnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  reason: 'token_expired' | 'connection_lost' | 'permissions_changed' | 'account_disconnected';
  severity: 'warning' | 'error';
  disconnectedAt: string;
}

interface ReconnectBannerProps {
  onReconnect?: (accountId: string) => void;
}

const REASON_MESSAGES = {
  token_expired: 'Token expired',
  connection_lost: 'Connection lost', 
  permissions_changed: 'Permissions changed',
  account_disconnected: 'Account disconnected'
};

const SEVERITY_STYLES = {
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  error: 'bg-red-50 border-red-200 text-red-800'
};

export function ReconnectBanner({ onReconnect }: ReconnectBannerProps) {
  const [disconnectedAccounts, setDisconnectedAccounts] = useState<DisconnectedAccount[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [reconnecting, setReconnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchDisconnectedAccounts();
    
    // Check for dismissed state in localStorage
    const dismissed = localStorage.getItem('reconnect-banner-dismissed');
    if (dismissed) {
      const dismissedTime = new Date(dismissed);
      const now = new Date();
      const hoursSinceDismissed = (now.getTime() - dismissedTime.getTime()) / (1000 * 60 * 60);
      
      // Auto-show after 24 hours
      if (hoursSinceDismissed < 24) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem('reconnect-banner-dismissed');
      }
    }
  }, []);

  const fetchDisconnectedAccounts = async () => {
    try {
      const response = await apiClient.get('/api/v1/accounts/disconnected');
      setDisconnectedAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Failed to fetch disconnected accounts:', error);
    }
  };

  const handleReconnect = async (accountId: string, platform: string) => {
    setReconnecting(accountId);
    try {
      // Initiate OAuth reconnect flow
      const response = await apiClient.post(`/api/v1/accounts/${accountId}/reconnect`);
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
          setReconnecting(null);
          // Refresh accounts list
          fetchDisconnectedAccounts();
          onReconnect?.(accountId);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Failed to initiate reconnect:', error);
      setReconnecting(null);
      alert(`Failed to reconnect ${platform} account. Please try again.`);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('reconnect-banner-dismissed', new Date().toISOString());
  };

  const handleSnooze = async (accountId: string) => {
    try {
      await apiClient.post(`/api/v1/accounts/${accountId}/snooze`);
      // Remove from current list
      setDisconnectedAccounts(prev => prev.filter(acc => acc.id !== accountId));
    } catch (error) {
      console.error('Failed to snooze account:', error);
    }
  };

  // Don't show if dismissed or no disconnected accounts
  if (isDismissed || disconnectedAccounts.length === 0) {
    return null;
  }

  const primaryAccount = disconnectedAccounts[0];
  const hasMultiple = disconnectedAccounts.length > 1;
  const severity = disconnectedAccounts.some(acc => acc.severity === 'error') ? 'error' : 'warning';

  return (
    <div className={`border-l-4 p-4 mb-6 ${SEVERITY_STYLES[severity]} ${
      severity === 'error' ? 'border-l-red-500' : 'border-l-yellow-500'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <AlertTriangle className={`w-5 h-5 mt-0.5 ${
            severity === 'error' ? 'text-red-600' : 'text-yellow-600'
          }`} />
          
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="font-medium">
                {hasMultiple 
                  ? `${disconnectedAccounts.length} accounts need reconnection`
                  : `${primaryAccount.platform} account needs reconnection`
                }
              </span>
              {hasMultiple && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 h-auto"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              )}
            </div>

            {/* Primary account or single account */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="capitalize">
                    {primaryAccount.platform}
                  </Badge>
                  <span className="font-medium">{primaryAccount.accountName}</span>
                  <span className="text-sm opacity-75">
                    • {REASON_MESSAGES[primaryAccount.reason]}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={() => handleReconnect(primaryAccount.id, primaryAccount.platform)}
                  disabled={reconnecting === primaryAccount.id}
                  className={severity === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
                >
                  {reconnecting === primaryAccount.id ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Reconnect Now
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSnooze(primaryAccount.id)}
                  className="text-xs"
                >
                  Remind Later
                </Button>
              </div>
            </div>

            {/* Expanded view for multiple accounts */}
            {hasMultiple && isExpanded && (
              <div className="mt-3 space-y-2 pl-4 border-l-2 border-current opacity-75">
                {disconnectedAccounts.slice(1).map((account) => (
                  <div key={account.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="capitalize text-xs">
                        {account.platform}
                      </Badge>
                      <span className="text-sm">{account.accountName}</span>
                      <span className="text-xs opacity-75">
                        • {REASON_MESSAGES[account.reason]}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReconnect(account.id, account.platform)}
                        disabled={reconnecting === account.id}
                        className="text-xs h-7"
                      >
                        {reconnecting === account.id ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Reconnect
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSnooze(account.id)}
                        className="text-xs h-7"
                      >
                        Snooze
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="p-1 h-auto ml-2"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
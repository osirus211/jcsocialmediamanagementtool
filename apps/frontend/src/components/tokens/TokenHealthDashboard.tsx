import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { TokenHealthBadge, TokenState } from './TokenHealthBadge';
import { apiClient } from '@/lib/api-client';

interface TokenHealth {
  accountId: string;
  provider: string;
  accountName: string;
  state: TokenState;
  expiresAt?: string;
  daysUntilExpiry?: number;
  reconnectRequired: boolean;
  lastRefreshedAt?: string;
  refreshFailureCount: number;
  lastRefreshError?: string;
}

interface TokenHealthSummary {
  total: number;
  healthy: number;
  expiringSoon: number;
  expired: number;
  revoked: number;
}

interface TokenHealthData {
  summary: TokenHealthSummary;
  accounts: TokenHealth[];
}

export const TokenHealthDashboard: React.FC = () => {
  const [healthData, setHealthData] = useState<TokenHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);

  const fetchHealthData = async () => {
    try {
      const response = await apiClient.get('/tokens/health');
      setHealthData(response.data);
    } catch (error) {
      console.error('Failed to fetch token health:', error);
      // Simple alert instead of toast
      alert('Failed to load token health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleRefreshToken = async (accountId: string, accountName: string) => {
    setRefreshing(accountId);
    try {
      await apiClient.post(`/tokens/refresh/${accountId}`);
      alert(`Token refreshed for ${accountName}`);
      await fetchHealthData(); // Refresh the data
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to refresh token';
      alert(`Failed to refresh token for ${accountName}: ${errorMessage}`);
      
      if (error.response?.data?.requiresReconnect) {
        alert('Please reconnect your account manually');
      }
    } finally {
      setRefreshing(null);
    }
  };

  const handleBulkRefresh = async () => {
    setBulkRefreshing(true);
    try {
      const response = await apiClient.post('/tokens/refresh-all');
      const { summary } = response.data;
      
      alert(`Refreshed ${summary.successful}/${summary.total} tokens`);
      
      if (summary.failed > 0) {
        alert(`${summary.failed} tokens failed to refresh`);
      }
      
      await fetchHealthData(); // Refresh the data
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to refresh tokens';
      alert(errorMessage);
    } finally {
      setBulkRefreshing(false);
    }
  };

  const getSummaryIcon = (type: string) => {
    switch (type) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'expiring': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'expired': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'revoked': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const formatLastRefreshed = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Health</CardTitle>
          <p className="text-sm text-gray-600">Loading token health data...</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!healthData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Health</CardTitle>
          <p className="text-sm text-gray-600">Failed to load token health data</p>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchHealthData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { summary, accounts } = healthData;
  const hasIssues = summary.expiringSoon > 0 || summary.expired > 0 || summary.revoked > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">{summary.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold text-green-600">{summary.healthy}</p>
              </div>
              {getSummaryIcon('healthy')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.expiringSoon}</p>
              </div>
              {getSummaryIcon('expiring')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Need Attention</p>
                <p className="text-2xl font-bold text-red-600">{summary.expired + summary.revoked}</p>
              </div>
              {getSummaryIcon('expired')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for Issues */}
      {hasIssues && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800">
                You have {summary.expiringSoon + summary.expired + summary.revoked} account(s) that need attention.
                {summary.expiringSoon > 0 && ` ${summary.expiringSoon} expiring soon.`}
                {summary.expired > 0 && ` ${summary.expired} expired.`}
                {summary.revoked > 0 && ` ${summary.revoked} require reconnection.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Account Token Status</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Monitor and manage OAuth token health for all connected accounts
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={fetchHealthData} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {(summary.expiringSoon > 0 || summary.expired > 0) && (
                <Button 
                  onClick={handleBulkRefresh}
                  size="sm"
                  disabled={bulkRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${bulkRefreshing ? 'animate-spin' : ''}`} />
                  Refresh All Expiring
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accounts.map((account, index) => (
              <div key={account.accountId}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {account.provider.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">{account.accountName}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {account.provider.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <TokenHealthBadge 
                        state={account.state}
                        daysUntilExpiry={account.daysUntilExpiry}
                        isRefreshing={refreshing === account.accountId}
                      />
                      {account.lastRefreshedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last refreshed: {formatLastRefreshed(account.lastRefreshedAt)}
                        </p>
                      )}
                      {account.refreshFailureCount > 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          {account.refreshFailureCount} failed attempt{account.refreshFailureCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {account.state === 'expiring_soon' || account.state === 'expired' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRefreshToken(account.accountId, account.accountName)}
                          disabled={refreshing === account.accountId}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing === account.accountId ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      ) : account.state === 'revoked' ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            // Navigate to reconnect flow
                            window.location.href = `/accounts?reconnect=${account.accountId}`;
                          }}
                        >
                          Reconnect
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
                {index < accounts.length - 1 && <div className="border-t border-gray-200 my-4"></div>}
              </div>
            ))}

            {accounts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No connected accounts found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TokenHealthDashboard;
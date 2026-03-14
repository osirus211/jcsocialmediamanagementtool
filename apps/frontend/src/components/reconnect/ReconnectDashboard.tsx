import React, { useState, useEffect } from 'react';
import { ReconnectBanner } from './ReconnectBanner';
import { ReconnectNotifications } from './ReconnectNotifications';
import { EnhancedAccountCard } from '../accounts/EnhancedAccountCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ReconnectStatus {
  urgent: any[];
  warning: any[];
  info: any[];
}

interface AccountData {
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
}

export function ReconnectDashboard() {
  const [reconnectStatus, setReconnectStatus] = useState<ReconnectStatus | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statusResponse, accountsResponse] = await Promise.all([
        apiClient.get('/api/v1/accounts/reconnect-status'),
        apiClient.get('/api/v1/social/accounts')
      ]);

      setReconnectStatus(statusResponse.data);
      setAccounts(accountsResponse.data.accounts || []);
    } catch (error) {
      console.error('Failed to fetch reconnect data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleReconnectSuccess = () => {
    // Refresh data after successful reconnection
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading reconnect dashboard...</span>
        </div>
      </div>
    );
  }

  const urgentAccounts = accounts.filter(acc => 
    ['expired', 'revoked', 'disconnected', 'reauth_required'].includes(acc.status)
  );
  
  const warningAccounts = accounts.filter(acc => 
    acc.status === 'token_expiring' || (acc.daysUntilExpiry && acc.daysUntilExpiry <= 7)
  );

  return (
    <div className="space-y-6">
      {/* Reconnect Banner */}
      <ReconnectBanner onReconnect={handleReconnectSuccess} />

      {/* Header with Notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Account Health</h1>
          <p className="text-muted-foreground">
            Monitor and manage your social media account connections
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <ReconnectNotifications onReconnect={handleReconnectSuccess} />
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Summary Cards */}
      {reconnectStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Accounts</p>
                  <p className="text-2xl font-bold">{reconnectStatus.urgent.length + reconnectStatus.warning.length + reconnectStatus.info.length}</p>
                </div>
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">
                    {reconnectStatus.urgent.length + reconnectStatus.warning.length + reconnectStatus.info.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Connected</p>
                  <p className="text-2xl font-bold text-green-600">{reconnectStatus.info.length}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Need Attention</p>
                  <p className="text-2xl font-bold text-yellow-600">{reconnectStatus.warning.length}</p>
                </div>
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Urgent</p>
                  <p className="text-2xl font-bold text-red-600">{reconnectStatus.urgent.length}</p>
                </div>
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Urgent Accounts Section */}
      {urgentAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Urgent - Immediate Action Required</span>
              <Badge variant="destructive">{urgentAccounts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {urgentAccounts.map((account) => (
                <EnhancedAccountCard
                  key={account.id}
                  account={account}
                  onReconnectSuccess={handleReconnectSuccess}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning Accounts Section */}
      {warningAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span>Warning - Attention Needed</span>
              <Badge variant="secondary">{warningAccounts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {warningAccounts.map((account) => (
                <EnhancedAccountCard
                  key={account.id}
                  account={account}
                  onReconnectSuccess={handleReconnectSuccess}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Accounts Section */}
      <Card>
        <CardHeader>
          <CardTitle>All Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No connected accounts found. Connect your first social media account to get started.
              </div>
            ) : (
              accounts.map((account) => (
                <EnhancedAccountCard
                  key={account.id}
                  account={account}
                  onReconnectSuccess={handleReconnectSuccess}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface HealthMetrics {
  tokenRefreshSuccessRate: number;
  webhookActivityScore: number;
  errorFrequencyScore: number;
  lastInteractionScore: number;
  responseTimeScore: number;
}

interface AccountHealth {
  accountId: string;
  provider: string;
  accountName: string;
  healthScore: number;
  healthGrade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown';
  metrics: HealthMetrics | null;
  lastCalculated: string | null;
}

interface HealthSummary {
  total: number;
  excellent: number;
  good: number;
  fair: number;
  poor: number;
  critical: number;
  averageScore: number;
}

interface ConnectionHealthData {
  workspaceId: string;
  accounts: AccountHealth[];
  summary: HealthSummary;
}

export const ConnectionHealthDashboard: React.FC = () => {
  const [healthData, setHealthData] = useState<ConnectionHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      const response = await apiClient.get('/connection-health/scores');
      setHealthData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch connection health:', error);
      alert('Failed to load connection health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleRecalculate = async (accountId: string, accountName: string) => {
    setRefreshing(accountId);
    try {
      await apiClient.post(`/connection-health/recalculate/${accountId}`);
      alert(`Health score recalculated for ${accountName}`);
      await fetchHealthData();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to recalculate health score';
      alert(`Failed to recalculate for ${accountName}: ${errorMessage}`);
    } finally {
      setRefreshing(null);
    }
  };

  const getHealthColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (grade: string) => {
    switch (grade) {
      case 'excellent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'good': return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'fair': return <Activity className="h-4 w-4 text-yellow-600" />;
      case 'poor': return <TrendingDown className="h-4 w-4 text-orange-600" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatLastCalculated = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connection Health</CardTitle>
          <p className="text-sm text-gray-600">Loading connection health data...</p>
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
          <CardTitle>Connection Health</CardTitle>
          <p className="text-sm text-gray-600">Failed to load connection health data</p>
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{Math.round(summary.averageScore)}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Excellent</p>
                <p className="text-2xl font-bold text-green-600">{summary.excellent}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Good</p>
                <p className="text-2xl font-bold text-blue-600">{summary.good}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Need Attention</p>
                <p className="text-2xl font-bold text-orange-600">{summary.poor + summary.critical}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-semibold">{summary.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Health Scores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection Health Scores</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive health monitoring for all connected social accounts
              </p>
            </div>
            <Button 
              onClick={fetchHealthData} 
              variant="outline" 
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {accounts.map((account) => (
              <div key={account.accountId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {account.provider.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium">{account.accountName}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {account.provider.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-2xl font-bold">{account.healthScore}</span>
                        <Badge className={getHealthColor(account.healthGrade)}>
                          {getHealthIcon(account.healthGrade)}
                          <span className="ml-1 capitalize">{account.healthGrade}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Updated: {formatLastCalculated(account.lastCalculated)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRecalculate(account.accountId, account.accountName)}
                      disabled={refreshing === account.accountId}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${refreshing === account.accountId ? 'animate-spin' : ''}`} />
                      Recalculate
                    </Button>
                  </div>
                </div>

                {/* Health Score Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Health Score</span>
                    <span className="text-sm text-muted-foreground">{account.healthScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${account.healthScore}%` }}
                    ></div>
                  </div>
                </div>

                {/* Detailed Metrics */}
                {account.metrics && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="font-medium">Token Refresh</p>
                        <p className="text-muted-foreground">{account.metrics.tokenRefreshSuccessRate}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="font-medium">Webhook Activity</p>
                        <p className="text-muted-foreground">{account.metrics.webhookActivityScore}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="font-medium">Error Rate</p>
                        <p className="text-muted-foreground">{account.metrics.errorFrequencyScore}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-purple-500" />
                      <div>
                        <p className="font-medium">Last Interaction</p>
                        <p className="text-muted-foreground">{account.metrics.lastInteractionScore}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="font-medium">Response Time</p>
                        <p className="text-muted-foreground">{account.metrics.responseTimeScore}%</p>
                      </div>
                    </div>
                  </div>
                )}
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

export default ConnectionHealthDashboard;
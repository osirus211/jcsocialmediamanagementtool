import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';

export type TokenState = 'active' | 'expiring_soon' | 'expired' | 'revoked';

interface TokenHealthBadgeProps {
  state: TokenState;
  daysUntilExpiry?: number;
  isRefreshing?: boolean;
  className?: string;
}

export const TokenHealthBadge: React.FC<TokenHealthBadgeProps> = ({
  state,
  daysUntilExpiry,
  isRefreshing = false,
  className = '',
}) => {
  const getStateConfig = () => {
    if (isRefreshing) {
      return {
        variant: 'secondary' as const,
        icon: RefreshCw,
        text: 'Refreshing...',
        tooltip: 'Token is being refreshed',
        className: 'animate-pulse',
      };
    }

    switch (state) {
      case 'active':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          text: 'Healthy',
          tooltip: 'Token is active and valid',
          className: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'expiring_soon':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          text: daysUntilExpiry !== undefined 
            ? `${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} left`
            : 'Expiring Soon',
          tooltip: `Token expires in ${daysUntilExpiry || 'a few'} day${daysUntilExpiry !== 1 ? 's' : ''}`,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      case 'expired':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          text: 'Expired',
          tooltip: 'Token has expired and needs to be refreshed',
          className: 'bg-red-100 text-red-800 border-red-200',
        };
      case 'revoked':
        return {
          variant: 'destructive' as const,
          icon: AlertCircle,
          text: 'Reconnect Required',
          tooltip: 'Token has been revoked. Please reconnect your account.',
          className: 'bg-red-100 text-red-800 border-red-200',
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: AlertCircle,
          text: 'Unknown',
          tooltip: 'Token status unknown',
          className: 'bg-gray-100 text-gray-800 border-gray-200',
        };
    }
  };

  const config = getStateConfig();
  const Icon = config.icon;

  return (
    <div className="relative group">
      <Badge 
        variant={config.variant}
        className={`${config.className} ${className} flex items-center gap-1 text-xs cursor-help`}
      >
        <Icon className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        {config.text}
      </Badge>
      
      {/* Simple tooltip using CSS */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {config.tooltip}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

export default TokenHealthBadge;
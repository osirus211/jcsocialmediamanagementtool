import { AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TokenExpiredAlertProps {
  platform?: string;
  accountName?: string;
  onReconnect?: () => void;
}

/**
 * TokenExpiredAlert Component
 * 
 * Shows token expired message with reconnect CTA
 */
export function TokenExpiredAlert({
  platform,
  accountName,
  onReconnect,
}: TokenExpiredAlertProps) {
  const navigate = useNavigate();

  const handleReconnect = () => {
    if (onReconnect) {
      onReconnect();
    } else {
      // Navigate to channels page
      navigate('/social/accounts');
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900 mb-1">
            Channel connection expired
          </h3>
          
          <p className="text-sm text-yellow-800 mb-3">
            {accountName && platform
              ? `Your ${platform} channel "${accountName}" needs to be reconnected.`
              : 'One or more of your channels need to be reconnected.'}
          </p>
          
          <button
            onClick={handleReconnect}
            className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reconnect Channel
          </button>
        </div>
      </div>
    </div>
  );
}

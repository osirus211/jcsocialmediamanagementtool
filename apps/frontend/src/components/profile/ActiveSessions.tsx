/**
 * Active Sessions Component
 * 
 * Displays and manages user's active sessions
 */

import { useState } from 'react';
import { Smartphone, Monitor, Tablet, X, AlertTriangle } from 'lucide-react';
import type { UserSession } from '@/types/auth.types';

interface ActiveSessionsProps {
  sessions: UserSession[];
  onRevoke: (sessionId: string) => Promise<void>;
}

export function ActiveSessions({ sessions, onRevoke }: ActiveSessionsProps) {
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes('mobile') || device.toLowerCase().includes('phone')) {
      return Smartphone;
    }
    if (device.toLowerCase().includes('tablet') || device.toLowerCase().includes('ipad')) {
      return Tablet;
    }
    return Monitor;
  };

  const handleRevoke = async (sessionId: string) => {
    if (revokingSession) return;
    
    try {
      setRevokingSession(sessionId);
      await onRevoke(sessionId);
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setRevokingSession(null);
    }
  };

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Sessions</h3>
        <p className="text-gray-600">
          You don't have any active sessions at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          You have {sessions.length} active session{sessions.length === 1 ? '' : 's'}
        </p>
        
        {sessions.length > 1 && (
          <div className="flex items-center gap-1 text-sm text-yellow-600">
            <AlertTriangle className="w-4 h-4" />
            <span>Review and revoke unused sessions</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {sessions.map((session) => {
          const DeviceIcon = getDeviceIcon(session.device);
          const isRevoking = revokingSession === session.id;
          
          return (
            <div
              key={session.id}
              className={`flex items-center justify-between p-4 border rounded-lg ${
                session.current 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  session.current ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <DeviceIcon className={`w-5 h-5 ${
                    session.current ? 'text-green-600' : 'text-gray-600'
                  }`} />
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {session.device}
                    </h4>
                    {session.current && (
                      <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Location: {session.location}</p>
                    <p>Last active: {formatLastActive(session.lastActive)}</p>
                    <p className="text-xs text-gray-500">
                      Session ID: {session.id}
                    </p>
                  </div>
                </div>
              </div>

              {!session.current && (
                <button
                  onClick={() => handleRevoke(session.id)}
                  disabled={isRevoking}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRevoking ? (
                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  {isRevoking ? 'Revoking...' : 'Revoke'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Security Notice */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Security Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Regularly review your active sessions</li>
          <li>• Revoke sessions from devices you no longer use</li>
          <li>• If you see suspicious activity, revoke all sessions and change your password</li>
          <li>• Always log out from shared or public computers</li>
        </ul>
      </div>
    </div>
  );
}
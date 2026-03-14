import React from 'react';
import { Linkedin, Building2, User, Users, ExternalLink, Trash2 } from 'lucide-react';

interface LinkedInAccountCardProps {
  account: {
    _id: string;
    accountName: string;
    username?: string;
    platform: string;
    connectedAt: string;
    metadata?: {
      accountType?: 'personal' | 'organization';
      avatarUrl?: string;
      logoUrl?: string;
      profileUrl?: string;
      websiteUrl?: string;
      followerCount?: number;
      vanityName?: string;
      email?: string;
    };
  };
  onDisconnect: (accountId: string) => void;
}

export function LinkedInAccountCard({ account, onDisconnect }: LinkedInAccountCardProps) {
  const isOrganization = account.metadata?.accountType === 'organization';
  const avatarUrl = account.metadata?.avatarUrl || account.metadata?.logoUrl;
  const profileUrl = account.metadata?.profileUrl;
  const followerCount = account.metadata?.followerCount;
  const vanityName = account.metadata?.vanityName;
  const websiteUrl = account.metadata?.websiteUrl;

  const handleDisconnect = () => {
    const accountType = isOrganization ? 'company page' : 'personal profile';
    if (confirm(`Are you sure you want to disconnect this LinkedIn ${accountType}?`)) {
      onDisconnect(account._id);
    }
  };

  const handleViewProfile = () => {
    if (profileUrl) {
      window.open(profileUrl, '_blank');
    } else if (vanityName) {
      window.open(`https://linkedin.com/company/${vanityName}`, '_blank');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Platform Icon */}
          <div className="p-3 rounded-lg bg-blue-600 text-white flex-shrink-0">
            <Linkedin className="w-6 h-6" />
          </div>

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 truncate">
                {account.accountName}
              </h3>
              
              {/* Account Type Badge */}
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                isOrganization 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {isOrganization ? (
                  <>
                    <Building2 className="w-3 h-3" />
                    Company Page
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3" />
                    Personal Profile
                  </>
                )}
              </div>
            </div>

            {/* Username/Vanity Name */}
            {(account.username || vanityName) && (
              <p className="text-sm text-gray-600 mb-1">
                @{account.username || vanityName}
              </p>
            )}

            {/* Email (for personal profiles) */}
            {!isOrganization && account.metadata?.email && (
              <p className="text-sm text-gray-500 mb-1">
                {account.metadata.email}
              </p>
            )}

            {/* Website (for organizations) */}
            {isOrganization && websiteUrl && (
              <p className="text-sm text-gray-500 mb-1">
                <a 
                  href={websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors"
                >
                  {websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}

            {/* Follower/Connection Count */}
            {followerCount !== undefined && (
              <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                <Users className="w-4 h-4" />
                <span>
                  {followerCount.toLocaleString()} {isOrganization ? 'followers' : 'connections'}
                </span>
              </div>
            )}

            {/* Connected Date */}
            <p className="text-xs text-gray-400">
              Connected {new Date(account.connectedAt).toLocaleDateString()}
            </p>
          </div>

          {/* Avatar/Logo */}
          {avatarUrl && (
            <div className="flex-shrink-0">
              <img
                src={avatarUrl}
                alt={`${account.accountName} ${isOrganization ? 'logo' : 'avatar'}`}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  // Hide image if it fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* View Profile Button */}
          {(profileUrl || vanityName) && (
            <button
              onClick={handleViewProfile}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="View LinkedIn profile"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Disconnect account"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Additional Organization Info */}
      {isOrganization && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Organization Account</span>
            <span className="text-gray-700 font-medium">
              Can post as company
            </span>
          </div>
        </div>
      )}

      {/* Personal Profile Info */}
      {!isOrganization && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Personal Profile</span>
            <span className="text-gray-700 font-medium">
              Can post as individual
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
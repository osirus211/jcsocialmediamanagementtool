import React from 'react';
import { Edit, Trash2, Calendar, Target } from 'lucide-react';
import { Campaign, CampaignStatus } from '../../services/campaigns.service';

interface CampaignCardProps {
  campaign: Campaign;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onClick?: (campaign: Campaign) => void;
  stats?: {
    totalPosts: number;
    published: number;
    scheduled: number;
    draft: number;
    platforms: string[];
  };
}

const statusConfig = {
  [CampaignStatus.DRAFT]: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-800',
  },
  [CampaignStatus.ACTIVE]: {
    label: 'Active',
    color: 'bg-green-100 text-green-800',
  },
  [CampaignStatus.PAUSED]: {
    label: 'Paused',
    color: 'bg-yellow-100 text-yellow-800',
  },
  [CampaignStatus.COMPLETED]: {
    label: 'Completed',
    color: 'bg-blue-100 text-blue-800',
  },
};

const platformIcons: Record<string, string> = {
  twitter: '𝕏',
  facebook: '📘',
  instagram: '📷',
  linkedin: '💼',
  youtube: '▶️',
  threads: '@',
  tiktok: '🎵',
};

export default function CampaignCard({ 
  campaign, 
  onEdit, 
  onDelete, 
  onClick,
  stats 
}: CampaignCardProps) {
  const statusInfo = statusConfig[campaign.status];
  
  const getProgressPercentage = () => {
    if (!campaign.startDate || !campaign.endDate) return 0;
    
    const start = new Date(campaign.startDate);
    const end = new Date(campaign.endDate);
    const now = new Date();
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    return Math.round((elapsed / total) * 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const progressPercentage = getProgressPercentage();

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={() => onClick?.(campaign)}
    >
      {/* Color stripe */}
      <div 
        className="w-1 h-16 absolute left-0 top-4 rounded-r"
        style={{ backgroundColor: campaign.color }}
      />
      
      <div className="ml-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {campaign.name}
            </h3>
            {campaign.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {campaign.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(campaign);
                  }}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(campaign);
                  }}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date range */}
        {(campaign.startDate || campaign.endDate) && (
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              {campaign.startDate && formatDate(campaign.startDate)}
              {campaign.startDate && campaign.endDate && ' - '}
              {campaign.endDate && formatDate(campaign.endDate)}
            </span>
          </div>
        )}

        {/* Goals */}
        {campaign.goals && (
          <div className="flex items-start gap-2 mb-3 text-sm text-gray-600">
            <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{campaign.goals}</span>
          </div>
        )}

        {/* Progress bar */}
        {campaign.startDate && campaign.endDate && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{stats?.totalPosts || campaign.postCount}</span> posts
          </div>
          
          {/* Platform icons */}
          {stats?.platforms && stats.platforms.length > 0 && (
            <div className="flex items-center gap-1">
              {stats.platforms.slice(0, 4).map((platform) => (
                <span
                  key={platform}
                  className="text-sm"
                  title={platform}
                >
                  {platformIcons[platform] || '📱'}
                </span>
              ))}
              {stats.platforms.length > 4 && (
                <span className="text-xs text-gray-400 ml-1">
                  +{stats.platforms.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { Campaign, CampaignStatus, campaignsService } from '../../services/campaigns.service';

interface CampaignPickerProps {
  selectedCampaignId?: string;
  onSelect: (campaignId: string | undefined) => void;
  placeholder?: string;
  statusFilter?: CampaignStatus;
  className?: string;
}

export default function CampaignPicker({
  selectedCampaignId,
  onSelect,
  placeholder = 'Select campaign',
  statusFilter = CampaignStatus.ACTIVE,
  className = '',
}: CampaignPickerProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selectedCampaign = campaigns.find(c => c._id === selectedCampaignId);

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter]);

  const loadCampaigns = async () => {
    try {
      setIsLoading(true);
      const data = await campaignsService.getCampaigns({ status: statusFilter });
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (campaignId: string | undefined) => {
    onSelect(campaignId);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    // TODO: Open create campaign modal
    console.log('Create new campaign');
    setIsOpen(false);
  };

  const getStatusBadgeColor = (status: CampaignStatus) => {
    switch (status) {
      case CampaignStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case CampaignStatus.DRAFT:
        return 'bg-gray-100 text-gray-800';
      case CampaignStatus.PAUSED:
        return 'bg-yellow-100 text-yellow-800';
      case CampaignStatus.COMPLETED:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedCampaign ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedCampaign.color }}
              />
              <span className="truncate">{selectedCampaign.name}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(selectedCampaign.status)}`}>
                {selectedCampaign.status}
              </span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedCampaign && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(undefined);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-gray-500">Loading...</div>
          ) : (
            <>
              {campaigns.length === 0 ? (
                <div className="px-3 py-2 text-gray-500">No campaigns found</div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelect(undefined)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-500"
                  >
                    No campaign
                  </button>
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign._id}
                      type="button"
                      onClick={() => handleSelect(campaign._id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: campaign.color }}
                      />
                      <span className="flex-1">{campaign.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(campaign.status)}`}>
                        {campaign.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {campaign.postCount} posts
                      </span>
                    </button>
                  ))}
                </>
              )}
              <div className="border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create new campaign</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
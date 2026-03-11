import React, { useState, useEffect } from 'react';
import { Plus, Target } from 'lucide-react';
import { Campaign, CampaignStatus, campaignsService } from '../../services/campaigns.service';
import CampaignCard from '../../components/campaigns/CampaignCard';

const statusTabs = [
  { id: 'all', label: 'All', status: undefined },
  { id: 'active', label: 'Active', status: CampaignStatus.ACTIVE },
  { id: 'draft', label: 'Draft', status: CampaignStatus.DRAFT },
  { id: 'paused', label: 'Paused', status: CampaignStatus.PAUSED },
  { id: 'completed', label: 'Completed', status: CampaignStatus.COMPLETED },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDetailSlideOver, setShowDetailSlideOver] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, [activeTab]);

  const loadCampaigns = async () => {
    try {
      setIsLoading(true);
      const activeTabData = statusTabs.find(tab => tab.id === activeTab);
      const filters = activeTabData?.status ? { status: activeTabData.status } : undefined;
      const data = await campaignsService.getCampaigns(filters);
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    // TODO: Open create campaign modal
    console.log('Create new campaign');
  };

  const handleEditCampaign = (campaign: Campaign) => {
    // TODO: Open edit campaign modal
    console.log('Edit campaign:', campaign);
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
    if (window.confirm(`Are you sure you want to delete "${campaign.name}"? This will remove the campaign from all posts.`)) {
      try {
        await campaignsService.deleteCampaign(campaign._id);
        await loadCampaigns();
      } catch (error) {
        console.error('Failed to delete campaign:', error);
      }
    }
  };

  const handleCampaignClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowDetailSlideOver(true);
  };

  const getCampaignCounts = () => {
    return {
      all: campaigns.length,
      active: campaigns.filter(c => c.status === CampaignStatus.ACTIVE).length,
      draft: campaigns.filter(c => c.status === CampaignStatus.DRAFT).length,
      paused: campaigns.filter(c => c.status === CampaignStatus.PAUSED).length,
      completed: campaigns.filter(c => c.status === CampaignStatus.COMPLETED).length,
    };
  };

  const counts = getCampaignCounts();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600 mt-2">
            Organize your content with marketing campaigns
          </p>
        </div>
        <button
          onClick={handleCreateCampaign}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {counts[tab.id as keyof typeof counts] > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs">
                  {counts[tab.id as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12">
          <Target className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No campaigns yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first campaign to organize your content.
          </p>
          <div className="mt-6">
            <button
              onClick={handleCreateCampaign}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign._id}
              campaign={campaign}
              onEdit={handleEditCampaign}
              onDelete={handleDeleteCampaign}
              onClick={handleCampaignClick}
            />
          ))}
        </div>
      )}

      {/* Campaign Detail Slide-over */}
      {showDetailSlideOver && selectedCampaign && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowDetailSlideOver(false)}
            />
            <section className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
              <div className="flex flex-col h-full">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">
                      {selectedCampaign.name}
                    </h2>
                    <button
                      onClick={() => setShowDetailSlideOver(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 px-6 py-4 overflow-y-auto">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Description</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {selectedCampaign.description || 'No description provided'}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Status</h3>
                      <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {selectedCampaign.status}
                      </span>
                    </div>

                    {selectedCampaign.goals && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Goals</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {selectedCampaign.goals}
                        </p>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Posts</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {selectedCampaign.postCount} posts in this campaign
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
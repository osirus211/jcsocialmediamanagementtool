import React, { useState, useEffect } from 'react';
import { Plus, Settings, Users, Eye, CheckCircle, XCircle, MessageCircle, Calendar, ExternalLink, Copy, Send, MoreVertical, Trash2, Edit, BarChart3 } from 'lucide-react';
import { clientPortalService, ClientPortal, PortalsResponse } from '@/services/client-portal.service';
import { CreatePortalModal } from '@/components/client-portal/CreatePortalModal';
import { PortalCard } from '@/components/client-portal/PortalCard';
import { BrandingSettings } from '@/components/client-portal/BrandingSettings';

type TabType = 'portals' | 'settings';

/**
 * ClientPortalPage Component
 * 
 * Main page for managing client approval portals and portal branding
 */
export const ClientPortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('portals');
  const [portals, setPortals] = useState<ClientPortal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  useEffect(() => {
    if (activeTab === 'portals') {
      loadPortals();
    }
  }, [activeTab, statusFilter, pagination.page]);

  const loadPortals = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params: any = {
        page: pagination.page,
        limit: 12,
      };
      
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response: PortalsResponse = await clientPortalService.listPortals(params);
      setPortals(response.portals);
      setPagination({
        page: response.page,
        totalPages: response.totalPages,
        total: response.total,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load portals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadPortals();
  };

  const handleDeletePortal = () => {
    loadPortals();
  };

  const getStatusStats = () => {
    const stats = {
      total: pagination.total,
      active: portals.filter(p => p.status === 'active').length,
      inactive: portals.filter(p => p.status === 'inactive').length,
      expired: portals.filter(p => p.status === 'expired').length,
      pendingReview: portals.reduce((acc, p) => {
        const pending = p.postApprovals.filter(a => a.status === 'pending').length;
        return acc + pending;
      }, 0),
      approvedThisWeek: portals.reduce((acc, p) => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const approved = p.postApprovals.filter(a => 
          a.status === 'approved' && 
          a.approvedAt && 
          new Date(a.approvedAt) > weekAgo
        ).length;
        return acc + approved;
      }, 0),
    };
    return stats;
  };

  const stats = getStatusStats();

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-gray-600 mt-1">
              Create branded approval portals for your clients to review and approve content
            </p>
          </div>
          
          {activeTab === 'portals' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Portal
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('portals')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'portals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Client Portals
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Branding & Settings
            </button>
          </nav>
        </div>

        {/* Portals Tab */}
        {activeTab === 'portals' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Portals</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.active}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Eye className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Pending Review</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.pendingReview}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Approved This Week</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.approvedThisWeek}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Expired</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.expired}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Filter by status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Portals</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            {/* Portals Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Portals</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadPortals}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : portals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Portals Yet</h3>
                <p className="text-gray-600 mb-4">
                  Create your first client portal to get started with branded approval workflows.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Portal
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {portals.map((portal) => (
                    <PortalCard
                      key={portal._id}
                      portal={portal}
                      onDelete={handleDeletePortal}
                      onUpdate={loadPortals}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center mt-8 space-x-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <span className="px-4 py-2 text-sm text-gray-600">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <BrandingSettings onSave={() => {
            // Could add success notification here
          }} />
        )}

        {/* Create Portal Modal */}
        <CreatePortalModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      </div>
    </div>
  );
};
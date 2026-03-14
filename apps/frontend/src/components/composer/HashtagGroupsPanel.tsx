import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Hash, Copy, Search } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';

interface HashtagGroup {
  _id: string;
  name: string;
  hashtags: string[];
  platform: 'instagram' | 'twitter' | 'tiktok' | 'linkedin' | 'facebook' | 'all';
  createdBy: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface HashtagGroupsPanelProps {
  onHashtagsInsert: (hashtags: string[]) => void;
  selectedPlatform?: string;
}

const HashtagGroupsPanel: React.FC<HashtagGroupsPanelProps> = ({
  onHashtagsInsert,
  selectedPlatform = 'all'
}) => {
  const { workspace } = useWorkspace();
  const [groups, setGroups] = useState<HashtagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<HashtagGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    hashtags: '',
    platform: selectedPlatform as HashtagGroup['platform']
  });

  useEffect(() => {
    if (workspace) {
      fetchGroups();
    }
  }, [workspace, selectedPlatform, searchTerm]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedPlatform && selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/v1/hashtag-groups?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspace!._id
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch hashtag groups');
      }

      const data = await response.json();
      setGroups(data.data || []);
    } catch (error) {
      console.error('Error fetching hashtag groups:', error);
      setError('Failed to load hashtag groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    try {
      const hashtags = formData.hashtags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      if (!formData.name || hashtags.length === 0) {
        setError('Name and hashtags are required');
        return;
      }

      const response = await fetch('/api/v1/hashtag-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspace!._id
        },
        body: JSON.stringify({
          name: formData.name,
          hashtags,
          platform: formData.platform
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create hashtag group');
      }

      setShowCreateModal(false);
      setFormData({ name: '', hashtags: '', platform: selectedPlatform as HashtagGroup['platform'] });
      fetchGroups();
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;

    try {
      const hashtags = formData.hashtags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const response = await fetch(`/api/v1/hashtag-groups/${editingGroup._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspace!._id
        },
        body: JSON.stringify({
          name: formData.name,
          hashtags,
          platform: formData.platform
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update hashtag group');
      }

      setEditingGroup(null);
      setFormData({ name: '', hashtags: '', platform: selectedPlatform as HashtagGroup['platform'] });
      fetchGroups();
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this hashtag group?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/hashtag-groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspace!._id
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete hashtag group');
      }

      fetchGroups();
    } catch (error) {
      setError('Failed to delete hashtag group');
    }
  };

  const handleInsertHashtags = (hashtags: string[]) => {
    onHashtagsInsert(hashtags);
  };

  const openEditModal = (group: HashtagGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      hashtags: group.hashtags.join(', '),
      platform: group.platform
    });
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingGroup(null);
    setFormData({ name: '', hashtags: '', platform: selectedPlatform as HashtagGroup['platform'] });
    setError(null);
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      instagram: 'bg-pink-100 text-pink-800',
      twitter: 'bg-blue-100 text-blue-800',
      tiktok: 'bg-gray-100 text-gray-800',
      linkedin: 'bg-blue-100 text-blue-800',
      facebook: 'bg-blue-100 text-blue-800',
      all: 'bg-gray-100 text-gray-800'
    };
    return colors[platform as keyof typeof colors] || colors.all;
  };

  return (
    <div className="hashtag-groups-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Hashtag Groups</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Group
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search hashtag groups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Groups List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading hashtag groups...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No groups found matching your search' : 'No hashtag groups yet'}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{group.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${getPlatformColor(group.platform)}`}>
                      {group.platform}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {group.hashtags.length} hashtag{group.hashtags.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleInsertHashtags(group.hashtags)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Insert all hashtags"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => openEditModal(group)}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Edit group"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete group"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {/* Hashtags Preview */}
              <div className="flex flex-wrap gap-1 mt-2">
                {group.hashtags.slice(0, 5).map((hashtag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    <Hash size={10} />
                    {hashtag.replace('#', '')}
                  </span>
                ))}
                {group.hashtags.length > 5 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                    +{group.hashtags.length - 5} more
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingGroup ? 'Edit Hashtag Group' : 'Create Hashtag Group'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Travel Hashtags"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Platform
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as HashtagGroup['platform'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Platforms</option>
                  <option value="instagram">Instagram</option>
                  <option value="twitter">Twitter</option>
                  <option value="tiktok">TikTok</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hashtags (comma-separated)
                </label>
                <textarea
                  value={formData.hashtags}
                  onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="travel, vacation, wanderlust, explore"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter hashtags separated by commas. # symbols will be added automatically.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingGroup ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HashtagGroupsPanel;
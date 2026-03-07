import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostStore } from '@/store/post.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useSocialAccountStore } from '@/store/social.store';
import { PostCard } from '@/components/posts/PostCard';
import { PostStatus, PostFilters } from '@/types/post.types';

export const PostListPage = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { posts, isLoading, postsLoaded, stats, fetchPosts, fetchStats } = usePostStore();
  const { accounts, fetchAccounts } = useSocialAccountStore();

  const [filters, setFilters] = useState<PostFilters>({});

  useEffect(() => {
    if (currentWorkspace) {
      fetchPosts(filters);
      fetchStats();
      fetchAccounts();
    }
  }, [currentWorkspace, filters]);

  const handleFilterChange = (key: keyof PostFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Please select a workspace first
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Posts</h1>
            <p className="text-gray-600 mt-1">
              Manage your social media posts for {currentWorkspace.name}
            </p>
          </div>
          <button
            onClick={() => navigate('/posts/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Post
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          {Object.entries(stats).map(([status, count]) => (
            <div
              key={status}
              className="bg-white border rounded-lg p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleFilterChange('status', status === filters.status ? undefined : status)}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-gray-600 capitalize mt-1">{status}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Statuses</option>
                {Object.values(PostStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                value={filters.socialAccountId || ''}
                onChange={(e) => handleFilterChange('socialAccountId', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.accountName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search content..."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Posts List */}
        {isLoading && !postsLoaded ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading posts...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <div className="text-gray-500 mb-4">No posts found</div>
            <button
              onClick={() => navigate('/posts/create')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Your First Post
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

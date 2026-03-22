import { useEffect, useState } from 'react';
import { useInboxStore, CreateRuleInput } from '@/store/inbox.store';
import { useWorkspaceStore } from '@/store/workspace.store';

export default function ListeningPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspace?._id);
  const {
    listeningRules,
    isLoadingRules,
    fetchListeningRules,
    createListeningRule,
    deleteListeningRule,
  } = useInboxStore();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateRuleInput>({
    platform: 'twitter',
    type: 'keyword',
    value: '',
  });

  useEffect(() => {
    if (workspaceId) {
      fetchListeningRules(workspaceId);
    }
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workspaceId && formData.value.trim()) {
      try {
        await createListeningRule(workspaceId, formData);
        setFormData({ platform: 'twitter', type: 'keyword', value: '' });
        setShowForm(false);
      } catch (error) {
        console.error('Failed to create rule:', error);
      }
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (workspaceId && confirm('Delete this listening rule?')) {
      try {
        await deleteListeningRule(workspaceId, ruleId);
      } catch (error) {
        console.error('Failed to delete rule:', error);
      }
    }
  };

  const canAddMore = listeningRules.length < 20;

  if (isLoadingRules) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Social Listening</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={!canAddMore}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {showForm ? 'Cancel' : 'Add Rule'}
          </button>
        </div>

        {!canAddMore && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            Maximum 20 rules per workspace reached
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="p-4 bg-gray-50 rounded space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="twitter">Twitter</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="keyword">Keyword</option>
                <option value="hashtag">Hashtag</option>
                <option value="competitor">Competitor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Value</label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Enter keyword, hashtag, or competitor handle"
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Rule
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Platform</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Value</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Last Collected</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listeningRules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No listening rules yet. Add one to start monitoring social media.
                </td>
              </tr>
            ) : (
              listeningRules.map((rule) => (
                <tr key={rule._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{rule.platform}</td>
                  <td className="px-4 py-3 text-sm">{rule.type}</td>
                  <td className="px-4 py-3 text-sm font-medium">{rule.value}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        rule.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {rule.lastCollectedAt
                      ? new Date(rule.lastCollectedAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      onClick={() => handleDelete(rule._id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>Rules: {listeningRules.length} / 20</p>
        <p className="mt-2">
          Listening rules monitor social media for keywords, hashtags, and competitor mentions.
          Results appear in your Inbox.
        </p>
      </div>
    </div>
  );
}

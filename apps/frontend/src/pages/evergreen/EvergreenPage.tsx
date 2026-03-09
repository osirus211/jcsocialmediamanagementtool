import { useState, useEffect } from 'react';
import { Repeat2, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { evergreenService, EvergreenRule } from '@/services/evergreen.service';
import { EvergreenRuleModal } from '@/components/evergreen/EvergreenRuleModal';
import { logger } from '@/lib/logger';

export function EvergreenPage() {
  const [rules, setRules] = useState<EvergreenRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRule, setSelectedRule] = useState<EvergreenRule | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadRules = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await evergreenService.listRules({ page, limit: 20 });
      setRules(response.rules);
      setTotalPages(Math.ceil(response.total / response.limit));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load evergreen rules';
      logger.error('Failed to load evergreen rules', { error: errorMessage });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [page]);

  const handleToggleEnabled = async (rule: EvergreenRule) => {
    try {
      await evergreenService.updateRule(rule._id, { enabled: !rule.enabled });
      logger.info('Evergreen rule toggled', { ruleId: rule._id, enabled: !rule.enabled });
      loadRules();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle rule';
      logger.error('Failed to toggle evergreen rule', { error: errorMessage });
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await evergreenService.deleteRule(ruleId);
      logger.info('Evergreen rule deleted', { ruleId });
      setDeleteConfirm(null);
      loadRules();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete rule';
      logger.error('Failed to delete evergreen rule', { error: errorMessage });
    }
  };

  const handleEdit = (rule: EvergreenRule) => {
    setSelectedRule(rule);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedRule(null);
  };

  const handleModalSuccess = () => {
    loadRules();
  };

  if (isLoading && rules.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading evergreen rules</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Repeat2 className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">Evergreen Posts</h1>
          </div>
          <p className="text-gray-600">
            Automatically republish your best content on a recurring schedule
          </p>
        </div>

        {/* Empty State */}
        {rules.length === 0 && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Repeat2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No evergreen rules yet</h3>
            <p className="text-gray-600 mb-6">
              Open any published post and click "Make Evergreen" to start automatically reposting your best content
            </p>
          </div>
        )}

        {/* Rules Table */}
        {rules.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Post ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interval
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reposts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Reposted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rules.map((rule) => (
                    <tr key={rule._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-mono">{rule.postId.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Every {rule.repostInterval} {rule.repostInterval === 1 ? 'day' : 'days'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rule.repostCount} / {rule.maxReposts === -1 ? '∞' : rule.maxReposts}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {rule.lastRepostedAt
                            ? new Date(rule.lastRepostedAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleEnabled(rule)}
                          className="flex items-center gap-2"
                        >
                          <div className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={() => {}}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                          </div>
                          <span className={`text-sm ${rule.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(rule)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                            title="Edit rule"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {deleteConfirm === rule._id ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDelete(rule._id)}
                                className="text-red-600 hover:text-red-900 text-xs font-medium"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-gray-600 hover:text-gray-900 text-xs font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(rule._id)}
                              className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"
                              title="Delete rule"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedRule && (
        <EvergreenRuleModal
          postId={selectedRule.postId}
          existingRule={selectedRule}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

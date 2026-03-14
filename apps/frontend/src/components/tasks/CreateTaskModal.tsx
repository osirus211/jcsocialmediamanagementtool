import React, { useState, useEffect } from 'react';
import { TaskType, TaskPriority, CreateTaskRequest } from '@/services/tasks.service';
import { useWorkspaceStore } from '@/store/workspace.store';

interface CreateTaskModalProps {
  onClose: () => void;
  onSubmit: (taskData: CreateTaskRequest) => Promise<void>;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateTaskRequest>({
    title: '',
    description: '',
    type: TaskType.CUSTOM,
    priority: TaskPriority.MEDIUM,
    assignedTo: [],
    labels: [],
  });
  const [loading, setLoading] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  
  const { members, fetchMembers, currentWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    if (currentWorkspaceId) {
      fetchMembers(currentWorkspaceId);
    }
  }, [fetchMembers, currentWorkspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        dueDate: formData.dueDate || undefined,
      });
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssigneeToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo?.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...(prev.assignedTo || []), userId]
    }));
  };

  const handleAddLabel = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault();
      if (!formData.labels?.includes(labelInput.trim())) {
        setFormData(prev => ({
          ...prev,
          labels: [...(prev.labels || []), labelInput.trim()]
        }));
      }
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels?.filter(l => l !== label) || []
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task title..."
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task description..."
              />
            </div>

            {/* Type and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as TaskType }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={TaskType.POST_CREATION}>Post Creation</option>
                  <option value={TaskType.POST_REVIEW}>Post Review</option>
                  <option value={TaskType.POST_APPROVAL}>Post Approval</option>
                  <option value={TaskType.CONTENT_RESEARCH}>Content Research</option>
                  <option value={TaskType.ACCOUNT_MANAGEMENT}>Account Management</option>
                  <option value={TaskType.CUSTOM}>Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={TaskPriority.LOW}>Low</option>
                  <option value={TaskPriority.MEDIUM}>Medium</option>
                  <option value={TaskPriority.HIGH}>High</option>
                  <option value={TaskPriority.URGENT}>Urgent</option>
                </select>
              </div>
            </div>

            {/* Due Date and Estimated Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.dueDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.estimatedMinutes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="60"
                />
              </div>
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign To
              </label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                {members.length === 0 ? (
                  <p className="text-gray-500 text-sm">No team members found</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const user = member.userId as any;
                      const isSelected = formData.assignedTo?.includes(user._id);
                      
                      return (
                        <label key={user._id} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleAssigneeToggle(user._id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={`${user.firstName} ${user.lastName}`}
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <span className="text-xs font-medium text-gray-600">
                                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-gray-900">
                              {user.firstName} {user.lastName}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Labels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Labels
              </label>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={handleAddLabel}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Type a label and press Enter..."
              />
              {formData.labels && formData.labels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.labels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(label)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
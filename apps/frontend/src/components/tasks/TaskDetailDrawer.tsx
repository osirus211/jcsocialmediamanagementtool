import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, tasksService } from '@/services/tasks.service';
import { toast } from '@/lib/notifications';
import { useWorkspaceStore } from '@/store/workspace.store';

interface TaskDetailDrawerProps {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({ task, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showAssignMenu, setShowAssignMenu] = useState(false);

  const { members } = useWorkspaceStore();

  const handleStatusChange = async (status: TaskStatus) => {
    try {
      setLoading(true);
      await tasksService.updateTaskStatus(task._id, status);
      onUpdate();
      toast.success('Task status updated');
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    try {
      setLoading(true);
      await tasksService.updateTaskPriority(task._id, priority);
      onUpdate();
      toast.success('Task priority updated');
    } catch (error) {
      toast.error('Failed to update priority');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async (userId: string) => {
    try {
      setLoading(true);
      await tasksService.assignTask(task._id, [userId]);
      onUpdate();
      toast.success('User assigned');
      setShowAssignMenu(false);
    } catch (error) {
      toast.error('Failed to assign user');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignUser = async (userId: string) => {
    try {
      setLoading(true);
      await tasksService.unassignTask(task._id, userId);
      onUpdate();
      toast.success('User unassigned');
    } catch (error) {
      toast.error('Failed to unassign user');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setLoading(true);
      await tasksService.addComment(task._id, newComment);
      setNewComment('');
      onUpdate();
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;

    try {
      setLoading(true);
      await tasksService.addChecklistItem(task._id, newChecklistItem);
      setNewChecklistItem('');
      onUpdate();
      toast.success('Checklist item added');
    } catch (error) {
      toast.error('Failed to add checklist item');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    try {
      await tasksService.toggleChecklistItem(task._id, itemId);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update checklist item');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isOverdue = () => {
    if (!task.dueDate || task.status === TaskStatus.DONE) return false;
    return new Date(task.dueDate) < new Date();
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT: return 'bg-red-100 text-red-800 border-red-200';
      case TaskPriority.HIGH: return 'bg-orange-100 text-orange-800 border-orange-200';
      case TaskPriority.MEDIUM: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case TaskPriority.LOW: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO: return 'bg-gray-100 text-gray-800';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-800';
      case TaskStatus.IN_REVIEW: return 'bg-yellow-100 text-yellow-800';
      case TaskStatus.DONE: return 'bg-green-100 text-green-800';
      case TaskStatus.CANCELLED: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-2xl shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Task Details</h2>
          <button
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
          {/* Title and Description */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h3>
            {task.description && (
              <p className="text-gray-600">{task.description}</p>
            )}
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={TaskStatus.TODO}>To Do</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.IN_REVIEW}>In Review</option>
                <option value={TaskStatus.DONE}>Done</option>
                <option value={TaskStatus.CANCELLED}>Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={task.priority}
                onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={TaskPriority.LOW}>Low</option>
                <option value={TaskPriority.MEDIUM}>Medium</option>
                <option value={TaskPriority.HIGH}>High</option>
                <option value={TaskPriority.URGENT}>Urgent</option>
              </select>
            </div>
          </div>

          {/* Assignees */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Assigned To</h4>
              <div className="relative">
                <button
                  onClick={() => setShowAssignMenu(!showAssignMenu)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  aria-label="Assign user"
                >
                  Assign
                </button>
                {showAssignMenu && members && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    {(members as any[])
                      .filter((member: any) => {
                        const memberId = member.userId?._id || member.userId || member._id;
                        return !task.assignedTo.some(a => a._id === memberId);
                      })
                      .map((member: any) => {
                        const user = member.userId?._id ? member.userId : member;
                        const memberId = member.userId?._id || member.userId || member._id;
                        
                        return (
                          <button
                            key={memberId}
                            onClick={() => handleAssignUser(memberId)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                          >
                            {user.firstName} {user.lastName}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {task.assignedTo.map((assignee) => (
                <div key={assignee._id} className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    {assignee.avatar ? (
                      <img
                        src={assignee.avatar}
                        alt={`${assignee.firstName} ${assignee.lastName}`}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-600">
                        {assignee.firstName.charAt(0)}{assignee.lastName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-900">
                    {assignee.firstName} {assignee.lastName}
                  </span>
                  <button
                    onClick={() => handleUnassignUser(assignee._id)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`Remove ${assignee.firstName} ${assignee.lastName}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Labels */}
          {task.labels.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Labels</h4>
              <div className="flex flex-wrap gap-2">
                {task.labels.map((label, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Due Date */}
          {task.dueDate && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Due Date</h4>
              <div className="flex items-center space-x-2">
                <p className="text-gray-900">{formatDate(task.dueDate)}</p>
                {isOverdue() && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                    Overdue
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Checklist</h4>
            
            {/* Add new item */}
            <form onSubmit={handleAddChecklistItem} className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add checklist item..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={loading || !newChecklistItem.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Checklist items */}
            <div className="space-y-2">
              {task.checklist.map((item) => (
                <label key={item._id} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggleChecklistItem(item._id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`flex-1 ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Comments</h4>
            
            {/* Add new comment */}
            <form onSubmit={handleAddComment} className="mb-4">
              <div className="space-y-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={loading || !newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Comment
                </button>
              </div>
            </form>

            {/* Comments list */}
            <div className="space-y-4">
              {task.comments.map((comment) => (
                <div key={comment._id} className="flex space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    {comment.userId.avatar ? (
                      <img
                        src={comment.userId.avatar}
                        alt={`${comment.userId.firstName} ${comment.userId.lastName}`}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-600">
                        {comment.userId.firstName.charAt(0)}{comment.userId.lastName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {comment.userId.firstName} {comment.userId.lastName}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-gray-700">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="border-t border-gray-200 pt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Created:</span>
                <p className="text-gray-900">{formatDate(task.createdAt)}</p>
              </div>
              <div>
                <span className="text-gray-500">Updated:</span>
                <p className="text-gray-900">{formatDate(task.updatedAt)}</p>
              </div>
              {task.completedAt && (
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <p className="text-gray-900">{formatDate(task.completedAt)}</p>
                </div>
              )}
              {task.estimatedMinutes && (
                <div>
                  <span className="text-gray-500">Estimated:</span>
                  <p className="text-gray-900">{task.estimatedMinutes} minutes</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
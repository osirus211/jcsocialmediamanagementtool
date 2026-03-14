import React from 'react';
import { Task, TaskStatus, TaskPriority } from '@/services/tasks.service';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onStatusChange }) => {
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT: return 'bg-red-100 text-red-800 border-red-200';
      case TaskPriority.HIGH: return 'bg-orange-100 text-orange-800 border-orange-200';
      case TaskPriority.MEDIUM: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case TaskPriority.LOW: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case TaskPriority.HIGH:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) {
      return { text: `${Math.abs(diffInDays)}d overdue`, color: 'text-red-600' };
    } else if (diffInDays === 0) {
      return { text: 'Due today', color: 'text-orange-600' };
    } else if (diffInDays === 1) {
      return { text: 'Due tomorrow', color: 'text-yellow-600' };
    } else if (diffInDays <= 7) {
      return { text: `Due in ${diffInDays}d`, color: 'text-gray-600' };
    } else {
      return { text: date.toLocaleDateString(), color: 'text-gray-600' };
    }
  };

  const getChecklistProgress = () => {
    if (task.checklist.length === 0) return null;
    const completed = task.checklist.filter(item => item.completed).length;
    const total = task.checklist.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  };

  const checklistProgress = getChecklistProgress();

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
          {task.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        
        {/* Priority Badge */}
        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
          {getPriorityIcon(task.priority)}
          <span className="capitalize">{task.priority}</span>
        </div>
      </div>

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.labels.slice(0, 3).map((label, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Checklist Progress */}
      {checklistProgress && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Checklist</span>
            <span>{checklistProgress.completed}/{checklistProgress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${checklistProgress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Due Date */}
      {task.dueDate && (
        <div className="mb-3">
          <div className={`flex items-center space-x-1 text-sm ${formatDueDate(task.dueDate).color}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDueDate(task.dueDate).text}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Assignees */}
        <div className="flex -space-x-2">
          {task.assignedTo.slice(0, 3).map((assignee) => (
            <div
              key={assignee._id}
              className="w-6 h-6 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center"
              title={`${assignee.firstName} ${assignee.lastName}`}
            >
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
          ))}
          {task.assignedTo.length > 3 && (
            <div className="w-6 h-6 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">
                +{task.assignedTo.length - 3}
              </span>
            </div>
          )}
        </div>

        {/* Comments Count */}
        {task.comments.length > 0 && (
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{task.comments.length}</span>
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, tasksService } from '@/services/tasks.service';
import { toast } from '@/lib/notifications';

export const MyTasksWidget: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'me'>('all');
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'none'>('all');

  useEffect(() => {
    loadMyTasks();
  }, []);

  const loadMyTasks = async () => {
    try {
      setLoading(true);
      const data = await tasksService.getMyTasks();
      setTasks(data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await tasksService.updateStatus(taskId, status);
      await loadMyTasks();
      toast.success('Task status updated');
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) {
      return { text: `${Math.abs(diffInDays)}d overdue`, color: 'text-red-600', urgent: true };
    } else if (diffInDays === 0) {
      return { text: 'Due today', color: 'text-orange-600', urgent: true };
    } else if (diffInDays === 1) {
      return { text: 'Due tomorrow', color: 'text-yellow-600', urgent: false };
    } else {
      return { text: `Due in ${diffInDays}d`, color: 'text-gray-600', urgent: false };
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT: return 'text-red-600';
      case TaskPriority.HIGH: return 'text-orange-600';
      case TaskPriority.MEDIUM: return 'text-yellow-600';
      case TaskPriority.LOW: return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const activeTasks = tasks.filter(task => 
    task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED
  );

  // Apply filters
  const filteredTasks = activeTasks.filter(task => {
    // Status filter
    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }
    
    // Assignee filter (me filter assumes current user)
    if (assigneeFilter === 'me') {
      // This would need actual user ID comparison in real implementation
      // For now, we'll show all tasks
    }
    
    // Due date filter
    if (dueDateFilter !== 'all') {
      if (dueDateFilter === 'none' && task.dueDate) {
        return false;
      }
      if (dueDateFilter === 'none' && !task.dueDate) {
        return true;
      }
      if (!task.dueDate && dueDateFilter !== 'none') {
        return false;
      }
      
      if (task.dueDate) {
        const date = new Date(task.dueDate);
        const now = new Date();
        const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dueDateFilter === 'overdue' && diffInDays >= 0) {
          return false;
        }
        if (dueDateFilter === 'today' && diffInDays !== 0) {
          return false;
        }
        if (dueDateFilter === 'week' && (diffInDays < 0 || diffInDays > 7)) {
          return false;
        }
      }
    }
    
    return true;
  });

  const urgentTasks = filteredTasks.filter(task => {
    if (task.priority === TaskPriority.URGENT) return true;
    if (task.dueDate) {
      const dueInfo = formatDueDate(task.dueDate);
      return dueInfo.urgent;
    }
    return false;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">My Tasks</h3>
        <div className="flex items-center space-x-2">
          {urgentTasks.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {urgentTasks.length} urgent
            </span>
          )}
          <span className="text-sm text-gray-500">
            {filteredTasks.length} active
          </span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Status Filter */}
        <div>
          <label htmlFor="status-filter" className="block text-xs font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            aria-label="Filter tasks by status"
          >
            <option value="all">All Statuses</option>
            <option value={TaskStatus.TODO}>To Do</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.IN_REVIEW}>In Review</option>
            <option value={TaskStatus.DONE}>Done</option>
          </select>
        </div>

        {/* Assignee Filter */}
        <div>
          <label htmlFor="assignee-filter" className="block text-xs font-medium text-gray-700 mb-1">
            Assignee
          </label>
          <select
            id="assignee-filter"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value as any)}
            className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            aria-label="Filter tasks by assignee"
          >
            <option value="all">All Assignees</option>
            <option value="me">Assigned to Me</option>
          </select>
        </div>

        {/* Due Date Filter */}
        <div>
          <label htmlFor="duedate-filter" className="block text-xs font-medium text-gray-700 mb-1">
            Due Date
          </label>
          <select
            id="duedate-filter"
            value={dueDateFilter}
            onChange={(e) => setDueDateFilter(e.target.value as any)}
            className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            aria-label="Filter tasks by due date"
          >
            <option value="all">All Dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="week">Due This Week</option>
            <option value="none">No Due Date</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No active tasks</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {filteredTasks.slice(0, 10).map((task) => {
            const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
            
            return (
              <div
                key={task._id}
                className={`p-3 rounded-lg border transition-colors ${
                  dueInfo?.urgent ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs font-medium capitalize ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {dueInfo && (
                        <span className={`text-xs ${dueInfo.color}`}>
                          {dueInfo.text}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Quick Status Update */}
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task._id, e.target.value as TaskStatus)}
                    className="ml-2 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.IN_REVIEW}>In Review</option>
                    <option value={TaskStatus.DONE}>Done</option>
                  </select>
                </div>

                {/* Progress Bar for Checklist */}
                {task.checklist.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Checklist</span>
                      <span>
                        {task.checklist.filter(item => item.completed).length}/{task.checklist.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full transition-all"
                        style={{
                          width: `${(task.checklist.filter(item => item.completed).length / task.checklist.length) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredTasks.length > 10 && (
            <div className="text-center pt-2">
              <button className="text-sm text-blue-600 hover:text-blue-700">
                View all {filteredTasks.length} tasks
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
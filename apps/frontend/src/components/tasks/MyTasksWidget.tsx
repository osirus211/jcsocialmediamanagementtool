import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, tasksService } from '@/services/tasks.service';
import { toast } from '@/lib/notifications';

export const MyTasksWidget: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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

  const urgentTasks = activeTasks.filter(task => {
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
            {activeTasks.length} active
          </span>
        </div>
      </div>

      {/* Tasks List */}
      {activeTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No active tasks</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {activeTasks.slice(0, 10).map((task) => {
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

          {activeTasks.length > 10 && (
            <div className="text-center pt-2">
              <button className="text-sm text-blue-600 hover:text-blue-700">
                View all {activeTasks.length} tasks
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, TaskType, tasksService, TaskFilters } from '@/services/tasks.service';
import { TaskCard } from './TaskCard';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { toast } from '@/lib/notifications';

const statusColumns = [
  { status: TaskStatus.TODO, title: 'To Do', color: 'bg-gray-100' },
  { status: TaskStatus.IN_PROGRESS, title: 'In Progress', color: 'bg-blue-100' },
  { status: TaskStatus.IN_REVIEW, title: 'In Review', color: 'bg-yellow-100' },
  { status: TaskStatus.DONE, title: 'Done', color: 'bg-green-100' },
];

export const TaskAssignmentPanel: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTasks();
  }, [filters]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await tasksService.getTasks({
        ...filters,
        search: searchQuery || undefined,
      });
      setTasks(response.data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    try {
      await tasksService.createTask(taskData);
      setShowCreateModal(false);
      await loadTasks();
      toast.success('Task created successfully');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksService.updateStatus(taskId, newStatus);
      await loadTasks();
      toast.success('Task status updated');
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const handleTaskUpdate = async () => {
    await loadTasks();
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchQuery });
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-gray-600">Organize and track your team's work</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Task
        </button>
      </div>

      {/* Filters */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </form>

          {/* Priority Filter */}
          <select
            value={filters.priority?.[0] || ''}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value ? [e.target.value as TaskPriority] : undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Priorities</option>
            <option value={TaskPriority.URGENT}>Urgent</option>
            <option value={TaskPriority.HIGH}>High</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.LOW}>Low</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type?.[0] || ''}
            onChange={(e) => setFilters({ ...filters, type: e.target.value ? [e.target.value as TaskType] : undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value={TaskType.POST_CREATION}>Post Creation</option>
            <option value={TaskType.POST_REVIEW}>Post Review</option>
            <option value={TaskType.POST_APPROVAL}>Post Approval</option>
            <option value={TaskType.CONTENT_RESEARCH}>Content Research</option>
            <option value={TaskType.ACCOUNT_MANAGEMENT}>Account Management</option>
            <option value={TaskType.CUSTOM}>Custom</option>
          </select>

          {/* Clear Filters */}
          {(Object.keys(filters).length > 0 || searchQuery) && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 p-6 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex space-x-6 h-full min-w-max">
            {statusColumns.map((column) => (
              <div key={column.status} className="flex-shrink-0 w-80">
                <div className={`${column.color} rounded-lg p-4 mb-4`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{column.title}</h3>
                    <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-600">
                      {getTasksByStatus(column.status).length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 max-h-full overflow-y-auto">
                  {getTasksByStatus(column.status).map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}

                  {getTasksByStatus(column.status).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTask}
        />
      )}

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
};
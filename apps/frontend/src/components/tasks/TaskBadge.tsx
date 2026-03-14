import React, { useState, useEffect } from 'react';
import { Task, tasksService } from '@/services/tasks.service';

interface TaskBadgeProps {
  postId: string;
  onClick?: () => void;
}

export const TaskBadge: React.FC<TaskBadgeProps> = ({ postId, onClick }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [postId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const postTasks = await tasksService.getTasksByPost(postId);
      setTasks(postTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || tasks.length === 0) {
    return null;
  }

  const activeTasks = tasks.filter(task => 
    task.status !== 'done' && task.status !== 'cancelled'
  );

  const urgentTasks = tasks.filter(task => 
    task.priority === 'urgent' || 
    (task.dueDate && new Date(task.dueDate) < new Date())
  );

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
        urgentTasks.length > 0
          ? 'bg-red-100 text-red-800 hover:bg-red-200'
          : activeTasks.length > 0
          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
          : 'bg-green-100 text-green-800 hover:bg-green-200'
      }`}
      title={`${tasks.length} tasks (${activeTasks.length} active)`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <span>{tasks.length}</span>
      {urgentTasks.length > 0 && (
        <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};
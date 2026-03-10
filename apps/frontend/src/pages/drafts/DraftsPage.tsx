/**
 * Drafts Page
 * 
 * Main page for managing collaborative drafts
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftsList } from '../../components/drafts/DraftsList';

export const DraftsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Drafts
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage your collaborative draft posts
          </p>
        </div>
        <button
          onClick={() => navigate('/posts/create')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <span className="mr-2">+</span>
          New Draft
        </button>
      </div>

      {/* Drafts List */}
      <DraftsList />
    </div>
  );
};
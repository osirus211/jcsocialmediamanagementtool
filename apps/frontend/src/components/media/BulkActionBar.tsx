import { useState, useCallback } from 'react';
import { Trash2, Tag, FolderOpen, Download, X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkTag: () => void;
  onBulkMove: () => void;
  onBulkDownload: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkTag,
  onBulkMove,
  onBulkDownload,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-gray-300" />

        <div className="flex items-center gap-2">
          <button
            onClick={onBulkTag}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
          >
            <Tag className="w-4 h-4" />
            Add Tags
          </button>

          <button
            onClick={onBulkMove}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Move to Folder
          </button>

          <button
            onClick={onBulkDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>

          <button
            onClick={onBulkDelete}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
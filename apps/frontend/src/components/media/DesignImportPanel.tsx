/**
 * DesignImportPanel Component
 * 
 * Tab panel containing Canva and Figma pickers for design imports
 */

import { useState } from 'react';
import { CanvaPicker } from './CanvaPicker';
import { FigmaPicker } from './FigmaPicker';

interface DesignImportPanelProps {
  onImport: (file: File) => void;
  onClose: () => void;
}

type TabType = 'canva' | 'figma';

export function DesignImportPanel({ onImport, onClose }: DesignImportPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('canva');
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (file: File) => {
    try {
      setError(null);
      onImport(file);
      
      // Show success message (you might want to use a toast system here)
      console.log('Design imported successfully');
      
      // Close panel after successful import
      onClose();
    } catch (error) {
      console.error('Failed to import design:', error);
      setError('Failed to import design');
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Import Design</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex items-center justify-between">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('canva')}
            className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'canva'
                ? 'border-purple-500 text-purple-600 bg-purple-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.5 7.5h9v9h-9z"/>
                </svg>
              </div>
              Canva
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('figma')}
            className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'figma'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              Figma
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'canva' ? (
            <CanvaPicker onImport={handleImport} onError={handleError} />
          ) : (
            <FigmaPicker onImport={handleImport} onError={handleError} />
          )}
        </div>
      </div>
    </div>
  );
}
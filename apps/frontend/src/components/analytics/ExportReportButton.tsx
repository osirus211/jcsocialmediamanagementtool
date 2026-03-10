import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';

interface ExportReportButtonProps {
  className?: string;
}

export function ExportReportButton({ className = '' }: ExportReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf'>('csv');
  const [selectedReportType, setSelectedReportType] = useState<'overview' | 'posts' | 'hashtags' | 'followers' | 'full'>('overview');
  const [selectedDateRange, setSelectedDateRange] = useState<7 | 30 | 90>(30);

  const handleExport = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedDateRange);

      await analyticsService.downloadReport(
        selectedReportType,
        selectedFormat,
        startDate.toISOString(),
        endDate.toISOString()
      );

      setIsOpen(false);
    } catch (error) {
      console.error('Failed to export report:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        disabled={isLoading}
      >
        <Download className="h-4 w-4" />
        <span>Export Report</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Analytics Report</h3>

              {/* Format Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedFormat('csv')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedFormat === 'csv'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => setSelectedFormat('pdf')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedFormat === 'pdf'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    PDF
                  </button>
                </div>
              </div>

              {/* Report Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type
                </label>
                <select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="overview">Overview</option>
                  <option value="posts">Posts Performance</option>
                  <option value="hashtags">Hashtag Analytics</option>
                  <option value="followers">Follower Growth</option>
                  <option value="full">Full Report</option>
                </select>
              </div>

              {/* Date Range Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 7, label: 'Last 7 days' },
                    { value: 30, label: 'Last 30 days' },
                    { value: 90, label: 'Last 90 days' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedDateRange(option.value as any)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedDateRange === option.value
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download {selectedFormat.toUpperCase()}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
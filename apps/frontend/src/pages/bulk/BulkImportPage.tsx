import { useState, useEffect } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { CSVTemplateDownload } from '@/components/bulk/CSVTemplateDownload';
import { CSVUploader } from '@/components/bulk/CSVUploader';
import { BulkJobStatus } from '@/components/bulk/BulkJobStatus';
import { BulkImportFeatures } from '@/components/bulk/BulkImportFeatures';
import { bulkUploadService, BulkUploadJob } from '@/services/bulkUpload.service';
import { logger } from '@/lib/logger';

export function BulkImportPage() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<BulkUploadJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  useEffect(() => {
    loadRecentJobs();
  }, []);

  const loadRecentJobs = async () => {
    try {
      setIsLoadingJobs(true);
      setError(null);
      const jobs = await bulkUploadService.listJobs(1, 20);
      setRecentJobs(jobs);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load recent imports';
      logger.error('Failed to load recent jobs', { error: errorMessage });
      setError(errorMessage);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleUploadSuccess = (jobId: string) => {
    setCurrentJobId(jobId);
    loadRecentJobs();
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2.5 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'completed':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Completed</span>;
      case 'failed':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Failed</span>;
      case 'processing':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Processing</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Pending</span>;
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Upload className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Bulk Import Posts</h1>
          </div>
          <p className="text-gray-600">
            Upload a CSV file to schedule up to 500 posts at once. Supports timezone-aware scheduling, media attachments, and duplicate detection.
          </p>
        </div>

        {/* Features Overview */}
        <BulkImportFeatures />

        {/* Section 1: Download Template */}
        <div className="mb-8">
          <CSVTemplateDownload />
        </div>

        {/* Section 2: Upload CSV */}
        <div className="mb-8">
          <CSVUploader onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Current Job Status */}
        {currentJobId && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Upload</h2>
            <BulkJobStatus jobId={currentJobId} />
          </div>
        )}

        {/* Section 3: Recent Imports */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Imports</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error loading recent imports</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {isLoadingJobs ? (
            <div className="flex items-center justify-center p-12 bg-white border border-gray-200 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Upload className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No imports yet</h3>
              <p className="text-gray-600">
                Upload your first CSV file to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div key={job.id} className="bg-white border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{job.filename}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-gray-600">
                        <p>{job.successCount} successful</p>
                        <p>{job.failureCount} failed</p>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>
                  </button>

                  {expandedJobId === job.id && (
                    <div className="border-t p-4">
                      <BulkJobStatus jobId={job.id} initialJob={job} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

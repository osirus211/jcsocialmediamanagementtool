import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { bulkUploadService, BulkUploadJob } from '@/services/bulkUpload.service';
import { logger } from '@/lib/logger';

interface BulkJobStatusProps {
  jobId: string;
  initialJob?: BulkUploadJob;
}

export function BulkJobStatus({ jobId, initialJob }: BulkJobStatusProps) {
  const [job, setJob] = useState<BulkUploadJob | null>(initialJob || null);
  const [isLoading, setIsLoading] = useState(!initialJob);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchJob = async () => {
      try {
        const fetchedJob = await bulkUploadService.getJobStatus(jobId);
        setJob(fetchedJob);
        setIsLoading(false);

        // Stop polling if job is completed or failed
        if (fetchedJob.status === 'completed' || fetchedJob.status === 'failed') {
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job status';
        logger.error('Failed to fetch job status', { error: errorMessage, jobId });
        setError(errorMessage);
        setIsLoading(false);
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    };

    // Initial fetch
    if (!initialJob) {
      fetchJob();
    }

    // Poll every 3 seconds if job is pending or processing
    if (!job || job.status === 'pending' || job.status === 'processing') {
      intervalId = setInterval(fetchJob, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, initialJob, job?.status]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Error loading job status</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  const progressPercentage = job.totalRows > 0 ? (job.processedRows / job.totalRows) * 100 : 0;

  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Loader2 className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    const baseClasses = 'px-2.5 py-1 rounded-full text-xs font-medium';
    switch (job.status) {
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
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{job.filename}</h3>
            <p className="text-sm text-gray-500">
              {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{job.processedRows} / {job.totalRows} rows</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              job.status === 'completed' ? 'bg-green-600' :
              job.status === 'failed' ? 'bg-red-600' :
              'bg-blue-600'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Total Rows</p>
          <p className="text-2xl font-bold text-gray-900">{job.totalRows}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-green-600 mb-1">Successful</p>
          <p className="text-2xl font-bold text-green-700">{job.successCount}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs text-red-600 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-700">{job.failureCount}</p>
        </div>
      </div>

      {/* Errors Section */}
      {job.errors && job.errors.length > 0 && (
        <div className="border-t pt-4">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm font-medium text-gray-900">
              Errors ({job.errors.length})
            </span>
            {showErrors ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {showErrors && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {job.errors.map((err, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-gray-900">{err.row}</td>
                      <td className="px-4 py-2 text-sm text-red-600">{err.error}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                        {err.data ? JSON.stringify(err.data) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

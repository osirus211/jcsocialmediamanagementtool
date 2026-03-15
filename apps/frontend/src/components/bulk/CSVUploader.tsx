import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { bulkUploadService } from '@/services/bulkUpload.service';
import { logger } from '@/lib/logger';

interface CSVRow {
  text: string;
  platform: string;
  scheduled_time: string;
  media_url?: string;
  timezone?: string;
}

interface CSVUploaderProps {
  onUploadSuccess: (jobId: string) => void;
}

export function CSVUploader({ onUploadSuccess }: CSVUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const validateColumns = (headers: string[]): string | null => {
    const required = ['text', 'platform', 'scheduled_time'];
    const missing = required.filter(col => !headers.includes(col));
    
    if (missing.length > 0) {
      return `Missing required columns: ${missing.join(', ')}`;
    }
    
    return null;
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError(null);
    setPreview([]);
    setValidationWarnings([]);

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);

    // Parse and preview
    Papa.parse<CSVRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      preview: 5,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }

        const headers = results.meta.fields || [];
        const validationError = validateColumns(headers);
        
        if (validationError) {
          setError(validationError);
          return;
        }

        // Check for potential issues and show warnings
        const warnings: string[] = [];
        const data = results.data;
        
        if (data.length > 100) {
          warnings.push(`Large file detected: ${data.length} rows. Processing may take a few minutes.`);
        }

        // Check for common timezone issues
        const hasTimezones = data.some(row => row.timezone);
        if (!hasTimezones) {
          warnings.push('No timezone specified. All posts will be scheduled in UTC.');
        }

        // Check for media URLs
        const hasMedia = data.some(row => row.media_url);
        if (hasMedia) {
          warnings.push('Media URLs detected. Ensure all URLs are publicly accessible.');
        }

        setValidationWarnings(warnings);
        setPreview(results.data);
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const job = await bulkUploadService.uploadCSV(file);
      logger.info('CSV uploaded successfully', { jobId: job.id });
      onUploadSuccess(job.id);
      
      // Reset form
      setFile(null);
      setPreview([]);
      setValidationWarnings([]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload CSV';
      logger.error('CSV upload failed', { error: errorMessage });
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV File</h3>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        
        {!file ? (
          <>
            <p className="text-gray-700 mb-2">Drag and drop your CSV file here</p>
            <p className="text-sm text-gray-500 mb-4">or</p>
            <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
              <span>Browse Files</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 mt-4">Maximum file size: 5MB</p>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-6 w-6 text-green-600" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setPreview([]);
                setError(null);
                setValidationWarnings([]);
              }}
              className="ml-4 text-sm text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Validation Warnings</p>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                {validationWarnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Upload Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {preview.length > 0 && !error && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h4 className="text-sm font-semibold text-gray-900">Preview (first 5 rows)</h4>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scheduled Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Media URLs</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timezone</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">{row.text}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{row.platform}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{row.scheduled_time}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{row.media_url || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{row.timezone || 'UTC'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {file && !error && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Upload & Schedule</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

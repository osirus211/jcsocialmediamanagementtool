import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { WorkspaceRole } from '@/types/workspace.types';

interface BulkImportModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Bulk Member Import Modal
 * 
 * Features:
 * - CSV file upload
 * - Template download
 * - Validation and preview
 * - Batch processing
 */
export const BulkImportModal = ({
  workspaceId,
  isOpen,
  onClose,
}: BulkImportModalProps) => {
  const { inviteMember } = useWorkspaceStore();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: Array<{ email: string; error: string }>;
  } | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
        setError('File size must be less than 5MB');
        return;
      }
      setFile(selectedFile);
      setError('');
      setResults(null);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'email,role\nexample@company.com,member\nadmin@company.com,admin\nviewer@company.com,viewer';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Array<{ email: string; role: WorkspaceRole }> => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    const emailIndex = headers.indexOf('email');
    const roleIndex = headers.indexOf('role');
    
    if (emailIndex === -1) {
      throw new Error('CSV must contain an "email" column');
    }
    
    const members: Array<{ email: string; role: WorkspaceRole }> = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const email = values[emailIndex];
      const role = values[roleIndex] || 'member';
      
      if (email && email.includes('@')) {
        let validRole: WorkspaceRole;
        switch (role.toLowerCase()) {
          case 'admin':
            validRole = WorkspaceRole.ADMIN;
            break;
          case 'viewer':
            validRole = WorkspaceRole.VIEWER;
            break;
          default:
            validRole = WorkspaceRole.MEMBER;
        }
        members.push({ email, role: validRole });
      }
    }
    
    return members;
  };

  const handleImport = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const text = await file.text();
      const members = parseCSV(text);
      
      if (members.length === 0) {
        throw new Error('No valid members found in CSV');
      }
      
      if (members.length > 500) {
        throw new Error('Maximum 500 members allowed per import');
      }
      
      const results = {
        success: 0,
        failed: [] as Array<{ email: string; error: string }>
      };
      
      // Process members in batches of 10 to avoid overwhelming the server
      const batchSize = 10;
      for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (member) => {
            try {
              await inviteMember(workspaceId, {
                email: member.email,
                role: member.role,
              });
              results.success++;
            } catch (error: any) {
              results.failed.push({
                email: member.email,
                error: error.response?.data?.message || error.message || 'Failed to invite'
              });
            }
          })
        );
        
        // Small delay between batches
        if (i + batchSize < members.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setResults(results);
    } catch (error: any) {
      setError(error.message || 'Failed to process CSV file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    setError('');
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Bulk Import Members
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={isProcessing}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {!results ? (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  How to bulk import members:
                </h4>
                <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Download the CSV template below</li>
                  <li>Fill in member emails and roles (admin, member, viewer)</li>
                  <li>Upload your completed CSV file</li>
                  <li>Review and confirm the import</li>
                </ol>
              </div>

              {/* Template Download */}
              <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    CSV Template
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Download the template to get started
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Download Template
                </button>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                    disabled={isProcessing}
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {file ? file.name : 'Click to select CSV file or drag and drop'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Maximum 500 members, 5MB file size limit
                    </span>
                  </label>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Import Complete
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {results.success} members imported successfully
                  {results.failed.length > 0 && `, ${results.failed.length} failed`}
                </p>
              </div>

              {results.failed.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Failed Imports:
                  </h5>
                  <div className="max-h-32 overflow-y-auto">
                    {results.failed.map((failure, index) => (
                      <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                        <strong>{failure.email}:</strong> {failure.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            {results ? 'Close' : 'Cancel'}
          </button>

          {!results && file && (
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                'Import Members'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
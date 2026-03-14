/**
 * PDF Carousel Composer for LinkedIn
 * 
 * Allows users to upload PDF documents that LinkedIn will automatically
 * convert to image carousels showing each page as a slide.
 */

import React, { useState, useCallback } from 'react';
import { FileText, Upload, X, Eye, AlertCircle, CheckCircle } from 'lucide-react';

interface PDFCarouselComposerProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  pdfFile: File | null;
  onPDFChange: (file: File | null) => void;
  title: string;
  onTitleChange: (title: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  selectedPlatforms: string[];
}

export const PDFCarouselComposer: React.FC<PDFCarouselComposerProps> = ({
  isEnabled,
  onToggle,
  pdfFile,
  onPDFChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  selectedPlatforms,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const isLinkedInSelected = selectedPlatforms.includes('linkedin');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      handlePDFUpload(pdfFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      handlePDFUpload(file);
    }
  }, []);

  const handlePDFUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    onPDFChange(file);
    
    // Auto-generate title from filename if empty
    if (!title) {
      const fileName = file.name.replace(/\.pdf$/i, '');
      onTitleChange(fileName);
    }

    try {
      // TODO: Implement PDF preview generation
      // This would typically involve:
      // 1. Converting PDF pages to images using PDF.js or similar
      // 2. Generating thumbnails for preview
      // For now, we'll simulate this
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate generated page previews
      const mockPages = Array.from({ length: Math.min(10, Math.floor(Math.random() * 15) + 1) }, 
        (_, i) => `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280"><rect width="200" height="280" fill="%23f3f4f6"/><text x="100" y="140" text-anchor="middle" font-family="Arial" font-size="14" fill="%23374151">Page ${i + 1}</text></svg>`
      );
      
      setPreviewPages(mockPages);
    } catch (error) {
      console.error('Error processing PDF:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [title, onPDFChange, onTitleChange]);

  const removePDF = useCallback(() => {
    onPDFChange(null);
    setPreviewPages([]);
    onTitleChange('');
    onDescriptionChange('');
  }, [onPDFChange, onTitleChange, onDescriptionChange]);

  if (!isLinkedInSelected) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">PDF carousels are only available for LinkedIn</span>
        </div>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-gray-600">
            <FileText className="h-6 w-6" />
            <span className="font-medium">LinkedIn PDF Carousel</span>
          </div>
          <p className="text-sm text-gray-500 max-w-md">
            Upload a PDF document and LinkedIn will automatically convert each page 
            into a carousel slide. Perfect for presentations, reports, and guides.
          </p>
          <button
            onClick={() => onToggle(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Upload PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-gray-900">PDF Carousel</span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            LinkedIn Only
          </span>
        </div>
        <button
          onClick={() => onToggle(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Upload Area */}
      {!pdfFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
          `}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            
            {isProcessing ? (
              <div className="space-y-2">
                <p className="text-blue-600 font-medium">Processing PDF...</p>
                <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                <p className="text-gray-700 font-medium mb-1">
                  Drop PDF here or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  LinkedIn will convert each page to a carousel slide
                </p>
              </>
            )}

            <div className="text-xs text-gray-400">
              Supported: PDF files up to 100MB
            </div>
          </label>
        </div>
      )}

      {/* PDF Info & Preview */}
      {pdfFile && (
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-start gap-4">
            {/* PDF Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
            </div>

            {/* PDF Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-gray-900 truncate">{pdfFile.name}</h4>
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <span>{(pdfFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                {previewPages.length > 0 && (
                  <span>{previewPages.length} pages</span>
                )}
              </div>

              {/* Title Input */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Enter a title for your document..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  placeholder="Add a description for your document..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Remove Button */}
            <button
              onClick={removePDF}
              className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="Remove PDF"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Page Previews */}
          {previewPages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Page Preview ({previewPages.length} pages)
                </span>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                {previewPages.slice(0, 10).map((pageUrl, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 w-16 h-20 border border-gray-200 rounded overflow-hidden bg-gray-50"
                  >
                    <img
                      src={pageUrl}
                      alt={`Page ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                
                {previewPages.length > 10 && (
                  <div className="flex-shrink-0 w-16 h-20 border border-gray-200 rounded flex items-center justify-center bg-gray-100">
                    <span className="text-xs text-gray-500">
                      +{previewPages.length - 10}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LinkedIn Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How LinkedIn PDF Carousels Work:</p>
                <ul className="text-xs space-y-1 text-blue-700">
                  <li>• Each PDF page becomes a carousel slide</li>
                  <li>• Users can swipe through pages like images</li>
                  <li>• Great for presentations, reports, and guides</li>
                  <li>• Maintains document formatting and quality</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
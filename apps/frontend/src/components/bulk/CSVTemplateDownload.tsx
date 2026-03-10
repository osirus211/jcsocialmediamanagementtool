import { Download } from 'lucide-react';

export function CSVTemplateDownload() {
  const handleDownload = () => {
    // CSV template with headers and example rows
    const csvContent = [
      'content,platforms,scheduledAt,socialAccountIds',
      '"Check out our new product launch! 🚀","twitter,linkedin","2024-12-25 10:00","account-id-1,account-id-2"',
      '"Happy holidays from our team! 🎄","facebook,instagram","2024-12-25 14:30","account-id-3"',
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk-posts-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Download className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Download CSV Template</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download a sample CSV file with the correct format. Fill in your posts and upload below.
          </p>
          <div className="bg-white rounded border border-blue-200 p-3 mb-4">
            <p className="text-xs font-mono text-gray-700 mb-2">Required columns:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li><span className="font-semibold">content</span> - Post text content</li>
              <li><span className="font-semibold">platforms</span> - Comma-separated (twitter, facebook, linkedin, instagram)</li>
              <li><span className="font-semibold">scheduledAt</span> - ISO format or YYYY-MM-DD HH:mm</li>
              <li><span className="font-semibold">socialAccountIds</span> - Comma-separated account IDs (optional)</li>
            </ul>
          </div>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span>Download Template</span>
          </button>
        </div>
      </div>
    </div>
  );
}

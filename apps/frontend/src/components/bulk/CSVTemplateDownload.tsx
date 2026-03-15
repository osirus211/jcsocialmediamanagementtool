import { Download } from 'lucide-react';

export function CSVTemplateDownload() {
  const handleDownload = () => {
    // CSV template with headers and example rows - matching backend expectations
    const csvContent = [
      'text,platform,scheduled_time,media_url,timezone',
      '"Check out our new product launch! 🚀","twitter,linkedin","2024-12-25 10:00","https://example.com/image1.jpg","America/New_York"',
      '"Happy holidays from our team! 🎄","facebook,instagram","2024-12-25 14:30","https://example.com/image2.jpg,https://example.com/image3.jpg","Europe/London"',
      '"Simple text post without media","twitter","2024-12-26 09:00","","UTC"',
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
              <li><span className="font-semibold">text</span> - Post content (required)</li>
              <li><span className="font-semibold">platform</span> - Comma-separated (twitter, facebook, linkedin, instagram)</li>
              <li><span className="font-semibold">scheduled_time</span> - YYYY-MM-DD HH:mm format (required)</li>
              <li><span className="font-semibold">media_url</span> - Comma-separated image/video URLs (optional)</li>
              <li><span className="font-semibold">timezone</span> - Timezone (e.g., America/New_York, UTC) (optional, defaults to UTC)</li>
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

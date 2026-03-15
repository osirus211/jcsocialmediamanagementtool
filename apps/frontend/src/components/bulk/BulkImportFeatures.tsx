import { CheckCircle, Clock, Globe, Shield, Zap, FileText } from 'lucide-react';

export function BulkImportFeatures() {
  const features = [
    {
      icon: <Zap className="h-5 w-5 text-blue-600" />,
      title: 'Up to 500 Posts',
      description: 'Schedule up to 500 posts in a single upload - more than Buffer (100) and matching Hootsuite (350)',
    },
    {
      icon: <Globe className="h-5 w-5 text-green-600" />,
      title: 'Timezone Support',
      description: 'Set individual timezones per post (America/New_York, Europe/London, etc.)',
    },
    {
      icon: <Shield className="h-5 w-5 text-purple-600" />,
      title: 'Duplicate Detection',
      description: 'Automatically detects and prevents duplicate posts based on content, platforms, and time',
    },
    {
      icon: <FileText className="h-5 w-5 text-orange-600" />,
      title: 'Media Attachments',
      description: 'Include image and video URLs in your CSV for automatic media attachment',
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-teal-600" />,
      title: 'Real-time Validation',
      description: 'Preview and validate your posts before scheduling with detailed error reporting',
    },
    {
      icon: <Clock className="h-5 w-5 text-indigo-600" />,
      title: 'Progress Tracking',
      description: 'Monitor upload progress with detailed success/failure reports per row',
    },
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">✨ Premium Bulk Import Features</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {feature.icon}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">{feature.title}</h4>
              <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
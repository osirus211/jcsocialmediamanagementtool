/**
 * API Documentation Page
 * 
 * In-app API documentation with embedded Swagger UI
 */

import React from 'react';
import { ExternalLink, Key, Code, BookOpen } from 'lucide-react';

const ApiDocsPage: React.FC = () => {
  const apiBaseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://api.socialmediascheduler.com'
    : 'http://localhost:3001';

  const curlExample = `curl -X GET "${apiBaseUrl}/api/v2/posts" \\
  -H "x-api-key: sk_live_your_api_key_here" \\
  -H "Content-Type: application/json"`;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-600" />
              Public API Documentation
            </h1>
            <p className="mt-2 text-gray-600">
              Integrate with our platform using the RESTful API v2
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`${apiBaseUrl}/api/v2/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Full Documentation
            </a>
            <a
              href="/settings/api-keys"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Key className="h-4 w-4" />
              Manage API Keys
            </a>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Code className="h-5 w-5" />
          Quick Start
        </h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">1. Get your API key</h3>
            <p className="text-gray-600 mb-2">
              Create an API key in your{' '}
              <a href="/settings/api-keys" className="text-blue-600 hover:underline">
                API Keys settings
              </a>
              {' '}with the required scopes.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">2. Make your first request</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
                <code>{curlExample}</code>
              </pre>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">3. Handle the response</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
                <code>{`{
  "data": [
    {
      "_id": "post_id_here",
      "content": "Your post content",
      "platform": "twitter",
      "status": "scheduled",
      "scheduledAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "cursor": "next_page_cursor",
    "hasMore": true,
    "total": 150
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* API Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Authentication</h3>
          <p className="text-gray-600 mb-3">
            All requests require an API key in the <code className="bg-gray-100 px-2 py-1 rounded">x-api-key</code> header.
          </p>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <code>x-api-key: sk_live_your_api_key_here</code>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Rate Limits</h3>
          <p className="text-gray-600 mb-3">
            API keys have configurable rate limits. Check response headers:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li><code className="bg-gray-100 px-1 rounded">X-RateLimit-Limit</code> - Requests per hour</li>
            <li><code className="bg-gray-100 px-1 rounded">X-RateLimit-Remaining</code> - Remaining requests</li>
            <li><code className="bg-gray-100 px-1 rounded">X-RateLimit-Reset</code> - Reset timestamp</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Scopes</h3>
          <p className="text-gray-600 mb-3">
            API keys require specific scopes for different operations:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li><code className="bg-gray-100 px-1 rounded">posts:read</code> - Read posts</li>
            <li><code className="bg-gray-100 px-1 rounded">posts:write</code> - Create/update posts</li>
            <li><code className="bg-gray-100 px-1 rounded">analytics:read</code> - Access analytics</li>
            <li><code className="bg-gray-100 px-1 rounded">media:write</code> - Upload media</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Pagination</h3>
          <p className="text-gray-600 mb-3">
            List endpoints use cursor-based pagination for better performance.
          </p>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <code>?limit=20&cursor=next_page_cursor</code>
          </div>
        </div>
      </div>

      {/* Embedded Documentation */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-xl font-semibold text-gray-900">Interactive API Explorer</h2>
          <p className="text-gray-600 mt-1">
            Try out API endpoints directly in your browser
          </p>
        </div>
        
        <div className="h-screen">
          <iframe
            src={`${apiBaseUrl}/api/v2/docs`}
            className="w-full h-full border-0"
            title="API Documentation"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      </div>
    </div>
  );
};

export default ApiDocsPage;
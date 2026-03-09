import { useState, useEffect } from 'react';
import { linkService, ShortLink } from '@/services/link.service';
import { Link as LinkIcon, Copy, Trash2, ExternalLink } from 'lucide-react';
import { logger } from '@/lib/logger';

export function LinksDashboard() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, [page]);

  const loadLinks = async () => {
    try {
      setIsLoading(true);
      const response = await linkService.getLinks(page, 20);
      setLinks(response.links);
      setTotalPages(response.totalPages);
    } catch (error) {
      logger.error('Failed to load links', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (shortUrl: string, shortCode: string) => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopiedCode(shortCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      logger.error('Failed to copy link', error);
    }
  };

  const handleDelete = async (shortCode: string) => {
    if (!confirm('Delete this shortened link? This cannot be undone.')) return;

    try {
      await linkService.deleteLink(shortCode);
      await loadLinks();
    } catch (error) {
      logger.error('Failed to delete link', error);
      alert('Failed to delete link');
    }
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  if (isLoading && links.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="text-center py-12">
        <LinkIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          No shortened links yet
        </h3>
        <p className="text-gray-600">
          Enable "Auto-shorten links" in the composer to start tracking your links
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Shortened Links</h2>
        <p className="text-sm text-gray-600 mt-1">
          Track and manage your shortened URLs
        </p>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Short URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clicks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {links.map((link) => (
                <tr key={link.shortCode} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      title={link.originalUrl}
                    >
                      {truncateUrl(link.originalUrl)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {link.shortUrl}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {link.clicks}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {link.platform ? (
                      <span className="text-sm text-gray-600 capitalize">{link.platform}</span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(link.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleCopy(link.shortUrl, link.shortCode)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Copy short URL"
                      >
                        {copiedCode === link.shortCode ? (
                          <span className="text-xs text-green-600 font-medium">Copied!</span>
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(link.shortCode)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

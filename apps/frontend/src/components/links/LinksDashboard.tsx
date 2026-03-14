import { useState, useEffect } from 'react';
import { linkService, ShortLink } from '@/services/link.service';
import { 
  Link as LinkIcon, 
  Copy, 
  Trash2, 
  ExternalLink, 
  QrCode, 
  Edit, 
  Eye, 
  EyeOff, 
  Search, 
  Filter, 
  Download,
  Plus,
  BarChart3,
  Calendar,
  Tag
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface Filters {
  search: string;
  platform: string;
  status: 'all' | 'active' | 'inactive' | 'expired';
  dateFrom: string;
  dateTo: string;
}

export function LinksDashboard() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showQRModal, setShowQRModal] = useState<{ link: ShortLink; qrCode: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState<ShortLink | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    platform: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    loadLinks();
  }, [page, filters]);

  const loadLinks = async () => {
    try {
      setIsLoading(true);
      const filterParams = {
        search: filters.search || undefined,
        platform: filters.platform || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      };
      
      const response = await linkService.getLinks(page, 20, filterParams);
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

  const handleBulkDelete = async () => {
    if (selectedLinks.size === 0) return;
    if (!confirm(`Delete ${selectedLinks.size} selected links? This cannot be undone.`)) return;

    try {
      await Promise.all(Array.from(selectedLinks).map(code => linkService.deleteLink(code)));
      setSelectedLinks(new Set());
      await loadLinks();
    } catch (error) {
      logger.error('Failed to bulk delete links', error);
      alert('Failed to delete some links');
    }
  };

  const handleToggleStatus = async (shortCode: string) => {
    try {
      await linkService.toggleLink(shortCode);
      await loadLinks();
    } catch (error) {
      logger.error('Failed to toggle link status', error);
      alert('Failed to update link status');
    }
  };

  const handleShowQR = async (link: ShortLink) => {
    try {
      const qrData = await linkService.getQRCode(link.shortCode, 'png', 256);
      setShowQRModal({ link, qrCode: qrData.qrCode });
    } catch (error) {
      logger.error('Failed to generate QR code', error);
      alert('Failed to generate QR code');
    }
  };

  const handleSelectAll = () => {
    if (selectedLinks.size === links.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(links.map(link => link.shortCode)));
    }
  };

  const handleSelectLink = (shortCode: string) => {
    const newSelected = new Set(selectedLinks);
    if (newSelected.has(shortCode)) {
      newSelected.delete(shortCode);
    } else {
      newSelected.add(shortCode);
    }
    setSelectedLinks(newSelected);
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const getStatusBadge = (link: ShortLink) => {
    if (!link.isActive) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Disabled</span>;
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Expired</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>;
  };

  if (isLoading && links.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shortened Links</h2>
          <p className="text-sm text-gray-600 mt-1">
            Track and manage your shortened URLs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Bulk Shorten
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search links..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 pr-4 py-2 border rounded-lg w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
            <select
              value={filters.platform}
              onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value }))}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">All Platforms</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              className="border rounded-lg px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="border rounded-lg px-3 py-2"
              placeholder="From Date"
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="border rounded-lg px-3 py-2"
              placeholder="To Date"
            />
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedLinks.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-blue-800 font-medium">
            {selectedLinks.size} link{selectedLinks.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Links Table */}
      {links.length === 0 ? (
        <div className="text-center py-12">
          <LinkIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No shortened links yet
          </h3>
          <p className="text-gray-600">
            Enable "Auto-shorten links" in the composer to start tracking your links
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedLinks.size === links.length && links.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
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
                    Status
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
                      <input
                        type="checkbox"
                        checked={selectedLinks.has(link.shortCode)}
                        onChange={() => handleSelectLink(link.shortCode)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
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
                        {link.title && (
                          <p className="text-sm text-gray-600 mt-1">{link.title}</p>
                        )}
                        {link.tags && link.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {link.tags.map((tag, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                <Tag className="h-3 w-3 mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {link.shortUrl}
                        </code>
                        {link.useBitly && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                            Bitly
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {link.clicks}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(link)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(link.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCopy(link.shortUrl, link.shortCode)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Copy short URL"
                        >
                          {copiedCode === link.shortCode ? (
                            <span className="text-xs text-green-600 font-medium">✓</span>
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleShowQR(link)}
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          title="Show QR code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/links/${link.shortCode}/analytics`, '_blank')}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View analytics"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowEditModal(link)}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Edit link"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(link.shortCode)}
                          className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                          title={link.isActive ? 'Disable link' : 'Enable link'}
                        >
                          {link.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
      )}

      {/* Pagination */}
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

      {/* QR Code Modal */}
      {showQRModal && (
        <QRCodeModal
          link={showQRModal.link}
          qrCode={showQRModal.qrCode}
          onClose={() => setShowQRModal(null)}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditLinkModal
          link={showEditModal}
          onClose={() => setShowEditModal(null)}
          onSave={loadLinks}
        />
      )}

      {/* Bulk Shorten Modal */}
      {showBulkModal && (
        <BulkShortenModal
          onClose={() => setShowBulkModal(false)}
          onComplete={loadLinks}
        />
      )}
    </div>
  );
}

// QR Code Modal Component
function QRCodeModal({ link, qrCode, onClose }: { link: ShortLink; qrCode: string; onClose: () => void }) {
  const downloadQR = (format: 'png' | 'svg') => {
    const element = document.createElement('a');
    element.href = qrCode;
    element.download = `qr-${link.shortCode}.${format}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">QR Code</h3>
        <div className="text-center">
          <img src={qrCode} alt="QR Code" className="mx-auto mb-4" />
          <p className="text-sm text-gray-600 mb-4">{link.shortUrl}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => downloadQR('png')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download PNG
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Link Modal Component
function EditLinkModal({ link, onClose, onSave }: { link: ShortLink; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    originalUrl: link.originalUrl,
    title: link.title || '',
    tags: link.tags?.join(', ') || '',
    password: '',
    isActive: link.isActive,
  });

  const handleSave = async () => {
    try {
      await linkService.updateLink(link.shortCode, {
        originalUrl: formData.originalUrl,
        title: formData.title || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : undefined,
        password: formData.password || undefined,
        isActive: formData.isActive,
      });
      onSave();
      onClose();
    } catch (error) {
      logger.error('Failed to update link', error);
      alert('Failed to update link');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Edit Link</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Destination URL</label>
            <input
              type="url"
              value={formData.originalUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, originalUrl: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password Protection</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Leave empty to remove password"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="mr-2"
            />
            <label htmlFor="isActive" className="text-sm font-medium">Link is active</label>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Bulk Shorten Modal Component
function BulkShortenModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [urls, setUrls] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleBulkShorten = async () => {
    const urlList = urls.split('\n').filter(url => url.trim());
    if (urlList.length === 0) return;

    setIsProcessing(true);
    try {
      const result = await linkService.bulkShortenUrls(urlList);
      setResults(result);
    } catch (error) {
      logger.error('Failed to bulk shorten URLs', error);
      alert('Failed to process URLs');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Bulk Shorten URLs</h3>
        
        {!results ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">URLs (one per line)</label>
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="https://example.com&#10;https://another-site.com"
                className="w-full border rounded px-3 py-2 h-32"
                disabled={isProcessing}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkShorten}
                disabled={isProcessing || !urls.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Shorten URLs'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="font-medium">Results:</p>
              <p className="text-sm text-gray-600">
                {results.successful} successful, {results.failed} failed out of {results.total} URLs
              </p>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {results.results.map((result: any, index: number) => (
                <div key={index} className="border-b py-2 last:border-b-0">
                  <p className="text-sm font-medium">{result.original}</p>
                  {result.error ? (
                    <p className="text-sm text-red-600">Error: {result.error}</p>
                  ) : (
                    <p className="text-sm text-green-600">✓ {result.shortened}</p>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { 
  MoreVertical, 
  ExternalLink, 
  Copy, 
  Edit, 
  Trash2, 
  Send, 
  BarChart3, 
  Calendar, 
  User, 
  Building, 
  Mail, 
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  RefreshCw
} from 'lucide-react';
import { ClientPortal, clientPortalService } from '@/services/client-portal.service';

interface PortalCardProps {
  portal: ClientPortal;
  onDelete: () => void;
  onUpdate: () => void;
}

export const PortalCard: React.FC<PortalCardProps> = ({ portal, onDelete, onUpdate }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this portal? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await clientPortalService.deletePortal(portal._id);
      onDelete();
    } catch (error) {
      console.error('Failed to delete portal:', error);
      // Could add toast notification here
    } finally {
      setIsDeleting(false);
    }
  };

  const copyPortalUrl = () => {
    const url = `${window.location.origin}/portal/${portal.slug}`;
    navigator.clipboard.writeText(url);
    // Could add toast notification here
  };

  const sendEmail = () => {
    const url = `${window.location.origin}/portal/${portal.slug}`;
    const subject = encodeURIComponent(`Review Required: ${portal.name}`);
    const body = encodeURIComponent(
      `Hi ${portal.clientName},\n\nPlease review and approve the content at: ${url}\n\nThanks!`
    );
    window.open(`mailto:${portal.clientEmail}?subject=${subject}&body=${body}`);
  };

  const getStatusBadge = () => {
    switch (portal.status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Clock className="w-3 h-3 mr-1" />
            Inactive
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  const getProgressStats = () => {
    const totalPosts = portal.posts.length;
    const approvedPosts = portal.postApprovals.filter(a => a.status === 'approved').length;
    const rejectedPosts = portal.postApprovals.filter(a => a.status === 'rejected').length;
    const reviewedPosts = approvedPosts + rejectedPosts;
    const progressPercentage = totalPosts > 0 ? (reviewedPosts / totalPosts) * 100 : 0;

    return {
      totalPosts,
      reviewedPosts,
      approvedPosts,
      rejectedPosts,
      progressPercentage,
    };
  };

  const stats = getProgressStats();
  const isExpired = portal.expiresAt && new Date(portal.expiresAt) < new Date();
  const daysUntilExpiry = portal.expiresAt 
    ? Math.ceil((new Date(portal.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{portal.name}</h3>
          <div className="flex items-center mt-1 space-x-2">
            {getStatusBadge()}
            {portal.passwordProtected && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <Shield className="w-3 h-3 mr-1" />
                Protected
              </span>
            )}
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  copyPortalUrl();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </button>
              <button
                onClick={() => {
                  window.open(`/portal/${portal.slug}`, '_blank');
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Preview Portal
              </button>
              <button
                onClick={() => {
                  sendEmail();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Reminder
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => {
                  // TODO: Open edit modal
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Portal
              </button>
              <button
                onClick={() => {
                  handleDelete();
                  setShowMenu(false);
                }}
                disabled={isDeleting}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center disabled:opacity-50"
              >
                {isDeleting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete Portal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Client Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <User className="w-4 h-4 mr-2" />
          <span>{portal.clientName}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="w-4 h-4 mr-2" />
          <span className="truncate">{portal.clientEmail}</span>
        </div>
        {portal.clientCompany && (
          <div className="flex items-center text-sm text-gray-600">
            <Building className="w-4 h-4 mr-2" />
            <span>{portal.clientCompany}</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Review Progress</span>
          <span>{stats.reviewedPosts}/{stats.totalPosts} posts</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${stats.progressPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
          <span>{stats.approvedPosts} approved</span>
          <span>{stats.rejectedPosts} rejected</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center text-gray-400 mb-1">
            <Eye className="w-4 h-4" />
          </div>
          <div className="text-lg font-semibold text-gray-900">{portal.accessCount}</div>
          <div className="text-xs text-gray-500">Views</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center text-gray-400 mb-1">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {daysUntilExpiry !== null ? (
              isExpired ? '0' : daysUntilExpiry
            ) : '∞'}
          </div>
          <div className="text-xs text-gray-500">
            {isExpired ? 'Expired' : 'Days left'}
          </div>
        </div>
      </div>

      {/* Last Access */}
      {portal.lastAccessedAt && (
        <div className="text-xs text-gray-500 mb-4">
          Last accessed: {new Date(portal.lastAccessedAt).toLocaleDateString()}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={copyPortalUrl}
          className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center"
        >
          <Copy className="w-4 h-4 mr-1" />
          Copy Link
        </button>
        <button
          onClick={sendEmail}
          className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center"
        >
          <Send className="w-4 h-4 mr-1" />
          Send Email
        </button>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};
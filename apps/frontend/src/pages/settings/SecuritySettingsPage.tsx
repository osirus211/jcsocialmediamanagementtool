/**
 * Security Settings Page
 * 
 * Manages security-related settings including 2FA status,
 * enable/disable functionality, and backup code regeneration.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  Key, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  X
} from 'lucide-react';
import { TwoFactorService } from '@/services/two-factor.service';
import { useAuthStore } from '@/store/auth.store';

interface DisableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (token: string) => void;
  isLoading: boolean;
  error: string | null;
}

interface BackupCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  codes: string[];
}

function DisableTwoFactorModal({ isOpen, onClose, onConfirm, isLoading, error }: DisableModalProps) {
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      onConfirm(token);
    }
  };

  const handleClose = () => {
    setToken('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Disable Two-Factor Authentication
          </h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          This will make your account less secure. Enter your current authentication code to confirm.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Authentication Code
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setToken(value);
              }}
              placeholder="000000"
              className="w-full px-4 py-2 text-center font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || token.length !== 6}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Disabling...' : 'Disable 2FA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BackupCodesModal({ isOpen, onClose, codes }: BackupCodesModalProps) {
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  const handleCopyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set(prev).add(itemId));
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownloadBackupCodes = () => {
    const content = [
      'Two-Factor Authentication Backup Codes',
      '==========================================',
      '',
      'Keep these codes safe! Each code can only be used once.',
      'Use them to access your account if you lose your authenticator device.',
      '',
      ...codes.map((code, index) => `${index + 1}. ${code}`),
      '',
      `Generated on: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              New Backup Codes
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> Your old backup codes are no longer valid. 
            Save these new codes in a secure location.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">Backup Codes</h4>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopyToClipboard(codes.join('\n'), 'all-codes')}
                className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                {copiedItems.has('all-codes') ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy All
              </button>
              <button
                onClick={handleDownloadBackupCodes}
                className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {codes.map((code, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-white border rounded font-mono text-sm"
              >
                <span>{code}</span>
                <button
                  onClick={() => handleCopyToClipboard(code, `code-${index}`)}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Copy code"
                >
                  {copiedItems.has(`code-${index}`) ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function SecuritySettingsPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [regenerateToken, setRegenerateToken] = useState('');
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);

  // Check if user has 2FA enabled
  const twoFactorEnabled = user?.twoFactorEnabled || false;

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleEnable2FA = () => {
    navigate('/settings/2fa/setup');
  };

  const handleDisable2FA = async (token: string) => {
    try {
      setIsLoading(true);
      clearMessages();
      
      await TwoFactorService.disableTwoFactor(token);
      
      // Refresh user data
      await refreshUser();
      
      setSuccess('Two-factor authentication has been disabled');
      setShowDisableModal(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!regenerateToken.trim()) {
      setError('Please enter your authentication code');
      return;
    }

    try {
      setIsLoading(true);
      clearMessages();
      
      const response = await TwoFactorService.regenerateBackupCodes(regenerateToken);
      
      setNewBackupCodes(response.backupCodes);
      setShowBackupCodesModal(true);
      setShowRegenerateForm(false);
      setRegenerateToken('');
      setSuccess('Backup codes regenerated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to regenerate backup codes');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="h-8 w-8" />
          Security Settings
        </h1>
        <p className="mt-2 text-gray-600">
          Manage your account security and two-factor authentication
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-700">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Two-Factor Authentication Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`
              p-3 rounded-lg
              ${twoFactorEnabled ? 'bg-green-100' : 'bg-gray-100'}
            `}>
              {twoFactorEnabled ? (
                <ShieldCheck className="h-6 w-6 text-green-600" />
              ) : (
                <ShieldX className="h-6 w-6 text-gray-600" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Two-Factor Authentication
                </h3>
                <span className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${twoFactorEnabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                  }
                `}>
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              <p className="text-gray-600 mb-4">
                {twoFactorEnabled 
                  ? 'Your account is protected with two-factor authentication. You\'ll need your authenticator app or backup codes to sign in.'
                  : 'Add an extra layer of security to your account by requiring a code from your phone in addition to your password.'
                }
              </p>

              <div className="flex flex-wrap gap-3">
                {!twoFactorEnabled ? (
                  <button
                    onClick={handleEnable2FA}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Enable Two-Factor Authentication
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowDisableModal(true)}
                      className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Disable 2FA
                    </button>
                    
                    {!showRegenerateForm ? (
                      <button
                        onClick={() => setShowRegenerateForm(true)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Regenerate Backup Codes
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={regenerateToken}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setRegenerateToken(value);
                            clearMessages();
                          }}
                          placeholder="Auth code"
                          className="px-3 py-2 text-sm border border-gray-300 rounded font-mono"
                          maxLength={6}
                        />
                        <button
                          onClick={handleRegenerateBackupCodes}
                          disabled={isLoading || regenerateToken.length !== 6}
                          className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isLoading ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            'Generate'
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setShowRegenerateForm(false);
                            setRegenerateToken('');
                            clearMessages();
                          }}
                          className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Security Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Security Best Practices</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• Use a strong, unique password for your account</li>
          <li>• Enable two-factor authentication for enhanced security</li>
          <li>• Keep your backup codes in a safe, secure location</li>
          <li>• Regularly review your account activity</li>
          <li>• Log out from shared or public devices</li>
        </ul>
      </div>

      {/* Modals */}
      <DisableTwoFactorModal
        isOpen={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        onConfirm={handleDisable2FA}
        isLoading={isLoading}
        error={error}
      />

      <BackupCodesModal
        isOpen={showBackupCodesModal}
        onClose={() => setShowBackupCodesModal(false)}
        codes={newBackupCodes}
      />
    </div>
  );
}
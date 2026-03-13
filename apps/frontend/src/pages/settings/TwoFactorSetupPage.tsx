/**
 * Two-Factor Authentication Setup Page
 * 
 * 4-step wizard for setting up 2FA:
 * 1. Introduction
 * 2. QR Code Display
 * 3. Token Verification
 * 4. Backup Codes Display
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Shield, 
  Smartphone, 
  Key, 
  Download, 
  Copy, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { TwoFactorService, TwoFactorSetupResponse } from '@/services/two-factor.service';

interface SetupStep {
  id: number;
  title: string;
  description: string;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 1,
    title: 'Introduction',
    description: 'Learn about two-factor authentication'
  },
  {
    id: 2,
    title: 'Scan QR Code',
    description: 'Add your account to an authenticator app'
  },
  {
    id: 3,
    title: 'Verify Setup',
    description: 'Enter a code from your authenticator app'
  },
  {
    id: 4,
    title: 'Backup Codes',
    description: 'Save your recovery codes'
  }
];

export function TwoFactorSetupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationToken, setVerificationToken] = useState('');
  const [showManualSecret, setShowManualSecret] = useState(false);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  const handleStartSetup = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await TwoFactorService.setupTwoFactor();
      setSetupData(data);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start 2FA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationToken.trim()) {
      setError('Please enter a verification code');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await TwoFactorService.verifySetup(verificationToken);
      setBackupCodes(response.backupCodes);
      setCurrentStep(4);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

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
      ...backupCodes.map((code, index) => `${index + 1}. ${code}`),
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

  const handleFinish = () => {
    navigate('/settings/security');
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {SETUP_STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
            ${currentStep >= step.id 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-600'
            }
          `}>
            {currentStep > step.id ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              step.id
            )}
          </div>
          {index < SETUP_STEPS.length - 1 && (
            <div className={`
              w-16 h-0.5 mx-2
              ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'}
            `} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="text-center max-w-2xl mx-auto">
      <div className="mb-8">
        <Shield className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Secure Your Account with Two-Factor Authentication
        </h2>
        <p className="text-gray-600 text-lg">
          Add an extra layer of security to your account by requiring a code from your phone 
          in addition to your password.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-3">What you'll need:</h3>
        <div className="space-y-2 text-blue-800">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5" />
            <span>A smartphone or tablet</span>
          </div>
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5" />
            <span>An authenticator app (Google Authenticator, Authy, etc.)</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => navigate('/settings/security')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleStartSetup}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Setting up...' : 'Get Started'}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Scan QR Code
        </h2>
        <p className="text-gray-600">
          Open your authenticator app and scan this QR code to add your account.
        </p>
      </div>

      {setupData && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center mb-6">
          <QRCodeSVG
            value={setupData.otpauthUrl}
            size={200}
            className="mx-auto mb-4"
          />
          
          <details className="mt-6">
            <summary 
              className="cursor-pointer text-blue-600 hover:text-blue-700 text-sm font-medium"
              onClick={() => setShowManualSecret(!showManualSecret)}
            >
              Can't scan? Enter code manually
            </summary>
            
            {showManualSecret && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  Enter this code in your authenticator app:
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="px-3 py-2 bg-white border rounded font-mono text-sm">
                    {setupData.secret}
                  </code>
                  <button
                    onClick={() => handleCopyToClipboard(setupData.secret, 'secret')}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Copy secret"
                  >
                    {copiedItems.has('secret') ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </details>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(1)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Verify Setup
        </h2>
        <p className="text-gray-600">
          Enter the 6-digit code from your authenticator app to complete setup.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Verification Code
          </label>
          <input
            type="text"
            value={verificationToken}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setVerificationToken(value);
              setError(null);
            }}
            placeholder="000000"
            className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={6}
            autoComplete="off"
          />
          <p className="mt-1 text-sm text-gray-500">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <button
            onClick={() => setCurrentStep(2)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={handleVerifySetup}
            disabled={isLoading || verificationToken.length !== 6}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Verify & Enable'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Two-Factor Authentication Enabled!
        </h2>
        <p className="text-gray-600">
          Your account is now protected with 2FA. Save these backup codes in a safe place.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">
              Important: Save Your Backup Codes
            </h3>
            <p className="text-yellow-800 text-sm">
              These codes can be used to access your account if you lose your authenticator device. 
              Each code can only be used once. Store them in a secure location.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Backup Codes</h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleCopyToClipboard(backupCodes.join('\n'), 'backup-codes')}
              className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {copiedItems.has('backup-codes') ? (
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
          {backupCodes.map((code, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-50 rounded font-mono text-sm"
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
          onClick={handleFinish}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Complete Setup
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Two-Factor Authentication Setup
        </h1>
        <p className="mt-2 text-gray-600">
          Step {currentStep} of {SETUP_STEPS.length}: {SETUP_STEPS[currentStep - 1]?.title}
        </p>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Error Message */}
      {error && currentStep !== 3 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl mx-auto">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
    </div>
  );
}
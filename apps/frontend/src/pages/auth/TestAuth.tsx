import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { CheckCircle, XCircle, Mail, User, Lock, Send } from 'lucide-react';

interface ApiResponse {
  success: boolean;
  message: string;
  [key: string]: any;
}

interface EmailStatus {
  provider: string;
  fromEmail: string;
  smtpConfigured: boolean;
  resendConfigured: boolean;
}

const TestAuth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, ApiResponse>>({});
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);

  // Form states
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [registerForm, setRegisterForm] = useState({
    email: 'testuser@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  });
  const [loginForm, setLoginForm] = useState({
    email: 'testuser@example.com',
    password: 'TestPassword123!',
  });

  const apiCall = async (endpoint: string, method: string = 'GET', body?: any): Promise<ApiResponse> => {
    const response = await fetch(`/api/v1/test-auth${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return await response.json();
  };

  const handleTest = async (testName: string, apiCall: () => Promise<ApiResponse>) => {
    setLoading(true);
    try {
      const result = await apiCall();
      setResults(prev => ({ ...prev, [testName]: result }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          message: error.message || 'Network error',
        },
      }));
    } finally {
      setLoading(false);
    }
  };

  const loadEmailStatus = async () => {
    try {
      const result = await apiCall('/email-status');
      if (result.success) {
        setEmailStatus(result.emailConfig);
      }
    } catch (error) {
      console.error('Failed to load email status:', error);
    }
  };

  React.useEffect(() => {
    loadEmailStatus();
  }, []);

  const ResultAlert: React.FC<{ testName: string }> = ({ testName }) => {
    const result = results[testName];
    if (!result) return null;

    return (
      <Alert className={`mt-4 ${result.success ? 'border-green-500' : 'border-red-500'}`}>
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <AlertDescription>
            <strong>{result.success ? 'Success' : 'Error'}:</strong> {result.message}
            {result.user && (
              <div className="mt-2 text-sm">
                <strong>User:</strong> {result.user.firstName} {result.user.lastName} ({result.user.email})
              </div>
            )}
            {result.hasAccessToken && (
              <div className="text-sm text-green-600">✓ Access token generated</div>
            )}
            {result.hasRefreshToken && (
              <div className="text-sm text-green-600">✓ Refresh token generated</div>
            )}
          </AlertDescription>
        </div>
      </Alert>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Authentication & Email Testing</h1>
        <p className="text-gray-600">Test authentication flows and email functionality</p>
      </div>

      {/* Email Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emailStatus ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Provider</Label>
                <p className="text-sm text-gray-600">{emailStatus.provider}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">From Email</Label>
                <p className="text-sm text-gray-600">{emailStatus.fromEmail}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">SMTP Configured</Label>
                <p className={`text-sm ${emailStatus.smtpConfigured ? 'text-green-600' : 'text-red-600'}`}>
                  {emailStatus.smtpConfigured ? '✓ Yes' : '✗ No'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Resend Configured</Label>
                <p className={`text-sm ${emailStatus.resendConfigured ? 'text-green-600' : 'text-red-600'}`}>
                  {emailStatus.resendConfigured ? '✓ Yes' : '✗ No'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading email status...</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email">Email Testing</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="password">Password Reset</TabsTrigger>
        </TabsList>

        {/* Email Testing Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Test Email Sending
              </CardTitle>
              <CardDescription>
                Send a test password reset email to verify SMTP configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="testEmail">Test Email Address</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter email to send test to"
                />
              </div>
              <Button
                onClick={() =>
                  handleTest('sendEmail', () =>
                    apiCall('/send-email', 'POST', { to: testEmail })
                  )
                }
                disabled={loading || !testEmail}
                className="w-full"
              >
                {loading ? 'Sending...' : 'Send Test Email'}
              </Button>
              <ResultAlert testName="sendEmail" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="auth">
          <div className="space-y-6">
            {/* Registration Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Test User Registration
                </CardTitle>
                <CardDescription>
                  Register a new test user account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="regFirstName">First Name</Label>
                    <Input
                      id="regFirstName"
                      value={registerForm.firstName}
                      onChange={(e) =>
                        setRegisterForm(prev => ({ ...prev, firstName: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="regLastName">Last Name</Label>
                    <Input
                      id="regLastName"
                      value={registerForm.lastName}
                      onChange={(e) =>
                        setRegisterForm(prev => ({ ...prev, lastName: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="regEmail">Email</Label>
                  <Input
                    id="regEmail"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm(prev => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="regPassword">Password</Label>
                  <Input
                    id="regPassword"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm(prev => ({ ...prev, password: e.target.value }))
                    }
                  />
                </div>
                <Button
                  onClick={() =>
                    handleTest('register', () =>
                      apiCall('/register', 'POST', registerForm)
                    )
                  }
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Registering...' : 'Register Test User'}
                </Button>
                <ResultAlert testName="register" />
              </CardContent>
            </Card>

            <Separator />

            {/* Login Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Test User Login
                </CardTitle>
                <CardDescription>
                  Login with test user credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="loginEmail">Email</Label>
                  <Input
                    id="loginEmail"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm(prev => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="loginPassword">Password</Label>
                  <Input
                    id="loginPassword"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm(prev => ({ ...prev, password: e.target.value }))
                    }
                  />
                </div>
                <Button
                  onClick={() =>
                    handleTest('login', () =>
                      apiCall('/login', 'POST', loginForm)
                    )
                  }
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Logging in...' : 'Login Test User'}
                </Button>
                <ResultAlert testName="login" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Password Reset Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Test Password Reset
              </CardTitle>
              <CardDescription>
                Test the password reset email flow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="resetEmail">Email Address</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm(prev => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Enter email for password reset"
                />
              </div>
              <Button
                onClick={() =>
                  handleTest('forgotPassword', () =>
                    apiCall('/forgot-password', 'POST', { email: loginForm.email })
                  )
                }
                disabled={loading || !loginForm.email}
                className="w-full"
              >
                {loading ? 'Sending...' : 'Send Password Reset Email'}
              </Button>
              <ResultAlert testName="forgotPassword" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">SMTP Configuration</h4>
            <p className="text-sm text-gray-600 mb-2">
              To test with real emails, configure SMTP in your .env file:
            </p>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com`}
            </pre>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Testing Flow</h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>First, test email sending to verify SMTP configuration</li>
              <li>Register a new test user account</li>
              <li>Try logging in with the registered credentials</li>
              <li>Test password reset email functionality</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestAuth;
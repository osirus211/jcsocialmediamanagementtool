import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export function useWebAuthn() {
  async function registerPasskey() {
    try {
      // Get registration options from server
      const optionsRes = await fetch('/api/v1/auth/webauthn/register/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (!optionsRes.ok) {
        throw new Error('Failed to get registration options');
      }
      
      const { data: options } = await optionsRes.json();
      
      // Start WebAuthn registration
      const attResp = await startRegistration(options);
      
      // Verify registration with server
      const verifyRes = await fetch('/api/v1/auth/webauthn/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ response: attResp })
      });
      
      if (!verifyRes.ok) {
        throw new Error('Failed to verify registration');
      }
      
      return verifyRes.json();
    } catch (error) {
      console.error('Passkey registration failed:', error);
      throw error;
    }
  }

  async function authenticatePasskey(email: string) {
    try {
      // Get authentication options from server
      const optionsRes = await fetch('/api/v1/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      if (!optionsRes.ok) {
        throw new Error('Failed to get authentication options');
      }
      
      const { data: options } = await optionsRes.json();
      
      // Start WebAuthn authentication
      const authResp = await startAuthentication(options);
      
      // Verify authentication with server
      const verifyRes = await fetch('/api/v1/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, response: authResp })
      });
      
      if (!verifyRes.ok) {
        throw new Error('Failed to verify authentication');
      }
      
      return verifyRes.json();
    } catch (error) {
      console.error('Passkey authentication failed:', error);
      throw error;
    }
  }

  return { registerPasskey, authenticatePasskey };
}
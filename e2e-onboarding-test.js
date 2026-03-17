/**
 * E2E Onboarding Test Script
 * 
 * This script tests the complete onboarding flow end-to-end
 */

const API_BASE = 'http://localhost:5000/api/v1';

class OnboardingE2ETest {
  constructor() {
    this.authToken = null;
    this.userId = null;
    this.testEmail = `e2e-test-${Date.now()}@example.com`;
  }

  async log(message, data = null) {
    console.log(`[E2E] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  async error(message, error) {
    console.error(`[E2E ERROR] ${message}`, error);
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (this.authToken) {
      config.headers.Authorization = `Bearer ${this.authToken}`;
    }

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseData.message || responseData.error}`);
      }

      return responseData;
    } catch (error) {
      this.error(`Request failed: ${method} ${endpoint}`, error.message);
      throw error;
    }
  }

  async testBackendHealth() {
    this.log('Testing backend health...');
    try {
      const response = await fetch('http://localhost:5000/health');
      const data = await response.json();
      this.log('✅ Backend health check passed', { status: data.status });
      return true;
    } catch (error) {
      this.error('❌ Backend health check failed', error);
      return false;
    }
  }

  async testUserRegistration() {
    this.log('Testing user registration...');
    try {
      const userData = {
        email: this.testEmail,
        password: 'TestPassword123!',
        firstName: 'E2E',
        lastName: 'Test'
      };

      const response = await this.makeRequest('POST', '/auth/register', userData);
      
      this.authToken = response.accessToken;
      this.userId = response.user._id;
      
      this.log('✅ User registration successful', {
        userId: this.userId,
        email: response.user.email,
        onboardingCompleted: response.user.onboardingCompleted,
        onboardingStep: response.user.onboardingStep
      });
      
      return true;
    } catch (error) {
      this.error('❌ User registration failed', error);
      return false;
    }
  }

  async testOnboardingProgress() {
    this.log('Testing onboarding progress fetch...');
    try {
      const response = await this.makeRequest('GET', '/onboarding/progress');
      
      this.log('✅ Onboarding progress fetched', response.data);
      
      // Verify initial state
      if (response.data.currentStep !== 0 || response.data.completed !== false) {
        throw new Error('Initial onboarding state is incorrect');
      }
      
      return response.data;
    } catch (error) {
      this.error('❌ Onboarding progress fetch failed', error);
      return null;
    }
  }

  async testStepUpdate(step) {
    this.log(`Testing step update to step ${step}...`);
    try {
      const response = await this.makeRequest('PUT', '/onboarding/step', { step });
      
      this.log(`✅ Step ${step} update successful`, response.data);
      
      // Verify step was updated
      if (response.data.currentStep !== step) {
        throw new Error(`Step update failed: expected ${step}, got ${response.data.currentStep}`);
      }
      
      return response.data;
    } catch (error) {
      this.error(`❌ Step ${step} update failed`, error);
      return null;
    }
  }

  async testOnboardingCompletion() {
    this.log('Testing onboarding completion...');
    try {
      const response = await this.makeRequest('POST', '/onboarding/complete', {});
      
      this.log('✅ Onboarding completion successful', response.data);
      
      // Verify completion
      if (!response.data.completed || response.data.currentStep !== 5) {
        throw new Error('Onboarding completion verification failed');
      }
      
      return response.data;
    } catch (error) {
      this.error('❌ Onboarding completion failed', error);
      return null;
    }
  }

  async testOnboardingSkip() {
    this.log('Testing onboarding skip (with new user)...');
    try {
      // Create a new user for skip test
      const skipTestEmail = `skip-test-${Date.now()}@example.com`;
      const userData = {
        email: skipTestEmail,
        password: 'TestPassword123!',
        firstName: 'Skip',
        lastName: 'Test'
      };

      const registerResponse = await this.makeRequest('POST', '/auth/register', userData);
      const skipToken = registerResponse.accessToken;
      
      // Test skip with new token
      const response = await fetch(`${API_BASE}/onboarding/skip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${skipToken}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Skip failed: ${data.message || data.error}`);
      }
      
      this.log('✅ Onboarding skip successful', data.data);
      
      // Verify skip completion
      if (!data.data.completed) {
        throw new Error('Onboarding skip verification failed');
      }
      
      return data.data;
    } catch (error) {
      this.error('❌ Onboarding skip failed', error);
      return null;
    }
  }

  async testEdgeCases() {
    this.log('Testing edge cases...');
    
    // Test invalid step
    try {
      await this.makeRequest('PUT', '/onboarding/step', { step: 'invalid' });
      this.error('❌ Invalid step should have failed');
      return false;
    } catch (error) {
      this.log('✅ Invalid step properly rejected');
    }

    // Test null step
    try {
      await this.makeRequest('PUT', '/onboarding/step', { step: null });
      this.error('❌ Null step should have failed');
      return false;
    } catch (error) {
      this.log('✅ Null step properly rejected');
    }

    // Test out of range step
    try {
      await this.makeRequest('PUT', '/onboarding/step', { step: 999 });
      this.error('❌ Out of range step should have failed');
      return false;
    } catch (error) {
      this.log('✅ Out of range step properly rejected');
    }

    return true;
  }

  async runFullTest() {
    this.log('🚀 Starting E2E Onboarding Test Suite');
    
    const results = {
      backendHealth: false,
      userRegistration: false,
      onboardingProgress: false,
      stepUpdates: [],
      onboardingCompletion: false,
      onboardingSkip: false,
      edgeCases: false
    };

    try {
      // Test 1: Backend Health
      results.backendHealth = await this.testBackendHealth();
      if (!results.backendHealth) return results;

      // Test 2: User Registration
      results.userRegistration = await this.testUserRegistration();
      if (!results.userRegistration) return results;

      // Test 3: Onboarding Progress
      const initialProgress = await this.testOnboardingProgress();
      results.onboardingProgress = !!initialProgress;
      if (!results.onboardingProgress) return results;

      // Test 4: Step Updates (0 -> 1 -> 2 -> 3)
      for (let step = 1; step <= 3; step++) {
        const stepResult = await this.testStepUpdate(step);
        results.stepUpdates.push({ step, success: !!stepResult });
        if (!stepResult) return results;
      }

      // Test 5: Onboarding Completion
      const completionResult = await this.testOnboardingCompletion();
      results.onboardingCompletion = !!completionResult;

      // Test 6: Onboarding Skip (separate user)
      const skipResult = await this.testOnboardingSkip();
      results.onboardingSkip = !!skipResult;

      // Test 7: Edge Cases
      results.edgeCases = await this.testEdgeCases();

      this.log('🎉 E2E Test Suite Completed!', results);
      
      // Summary
      const allPassed = results.backendHealth && 
                       results.userRegistration && 
                       results.onboardingProgress && 
                       results.stepUpdates.every(s => s.success) && 
                       results.onboardingCompletion && 
                       results.onboardingSkip && 
                       results.edgeCases;

      this.log(allPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED');
      
      return results;

    } catch (error) {
      this.error('💥 Test suite crashed', error);
      return results;
    }
  }
}

// Run the test if this script is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  const test = new OnboardingE2ETest();
  test.runFullTest().then(results => {
    console.log('\n=== FINAL RESULTS ===');
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  }).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
} else {
  // Browser environment
  window.OnboardingE2ETest = OnboardingE2ETest;
}
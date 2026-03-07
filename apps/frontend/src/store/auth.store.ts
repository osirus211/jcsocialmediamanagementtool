import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api-client';
import {
  AuthState,
  AuthActions,
  User,
  RegisterData,
  LoginResponse,
  RegisterResponse,
  RefreshResponse,
  MeResponse,
} from '@/types/auth.types';

interface AuthStore extends AuthState, AuthActions {}

/**
 * Global authentication store
 * 
 * Security:
 * - Access token stored in memory only (not persisted)
 * - Refresh token stored in httpOnly cookie (backend)
 * - User data persisted to localStorage for UX
 * - Auth state cleared on logout
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: false,
      authChecked: false,
      accessToken: null, // Memory only, not persisted

      // Actions
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setAuthChecked: (checked) => {
        set({ authChecked: checked });
      },

      /**
       * Login user with email and password
       */
      login: async (email, password) => {
        try {
          console.log('login: Starting login for:', email);
          set({ isLoading: true });

          const response = await apiClient.post<LoginResponse>('/auth/login', {
            email,
            password,
          });

          console.log('login: Response received:', response);
          const { user, accessToken } = response;

          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
            authChecked: true,
          });
          console.log('login: Login successful');
        } catch (error: any) {
          console.error('login: Login failed:', error);
          console.error('login: Error response:', error.response);
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Login failed');
        }
      },

      /**
       * Register new user
       */
      register: async (data: RegisterData) => {
        try {
          set({ isLoading: true });

          const response = await apiClient.post<RegisterResponse>('/auth/register', data);

          const { user, accessToken } = response;

          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
            authChecked: true,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Registration failed');
        }
      },

      /**
       * Logout user
       * Clears auth state and calls logout endpoint
       */
      logout: async () => {
        try {
          // Call logout endpoint to invalidate refresh token
          await apiClient.post('/auth/logout', {});
        } catch (error) {
          // Continue with logout even if API call fails
          console.error('Logout API error:', error);
        } finally {
          // Clear auth state
          get().clearAuth();
        }
      },

      /**
       * Fetch current user from /auth/me
       * Used for session restoration
       */
      fetchMe: async () => {
        try {
          set({ isLoading: true });

          // If we have a user but no access token, skip /me and go straight to refresh
          const currentState = get();
          if (currentState.user && !currentState.accessToken) {
            console.log('fetchMe: User exists but no token, attempting refresh...');
            const newToken = await get().refreshToken();
            
            if (newToken) {
              // Now fetch user with the new token
              try {
                const response = await apiClient.get<MeResponse>('/auth/me');
                set({
                  user: response.user,
                  isAuthenticated: true,
                  isLoading: false,
                  authChecked: true,
                });
                return;
              } catch (retryError) {
                console.error('fetchMe: Failed to get user after refresh:', retryError);
                get().clearAuth();
                return;
              }
            } else {
              console.log('fetchMe: Refresh failed, clearing auth');
              get().clearAuth();
              return;
            }
          }

          const response = await apiClient.get<MeResponse>('/auth/me');

          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            authChecked: true,
          });
        } catch (error) {
          console.error('fetchMe: /auth/me failed, attempting token refresh...', error);
          // If /me fails, try to refresh token
          try {
            const newToken = await get().refreshToken();
            
            if (newToken) {
              console.log('🔑 About to retry /auth/me with new token:', newToken.substring(0, 20) + '...');
              // Retry /me with new token
              try {
                const response = await apiClient.get<MeResponse>('/auth/me');
                set({
                  user: response.user,
                  isAuthenticated: true,
                  isLoading: false,
                  authChecked: true,
                });
              } catch (retryError) {
                console.error('fetchMe: Retry failed after refresh:', retryError);
                get().clearAuth();
              }
            } else {
              console.log('fetchMe: No token from refresh, clearing auth');
              get().clearAuth();
            }
          } catch (refreshError) {
            // Refresh failed, clear auth
            console.error('fetchMe: Refresh error:', refreshError);
            get().clearAuth();
          }
        }
      },

      /**
       * Refresh access token using httpOnly cookie
       * Returns new access token or null if refresh fails
       */
      refreshToken: async () => {
        try {
          console.log('refreshToken: Attempting to refresh token...');
          const response = await apiClient.post<RefreshResponse>('/auth/refresh', {});

          const { accessToken } = response;
          console.log('refreshToken: Success! Got new access token');

          set({ accessToken });

          // CRITICAL: Manually update window reference for interceptor
          // Zustand subscription may not have fired yet (race condition)
          if (typeof window !== 'undefined') {
            (window as any).__AUTH_STORE__ = { ...get(), accessToken };
          }

          console.log('🔑 Token stored in Zustand:', accessToken.substring(0, 20) + '...');
          console.log('🔑 Window store updated:', (window as any).__AUTH_STORE__?.accessToken?.substring(0, 20) + '...');

          return accessToken;
        } catch (error: any) {
          console.error('Token refresh failed:', error);
          console.error('Error response:', error.response?.data);
          console.error('Error status:', error.response?.status);
          get().clearAuth();
          return null;
        }
      },

      /**
       * Clear all auth state
       * Called on logout or auth failure
       */
      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          authChecked: true,
        });
        
        // Explicitly clear localStorage to ensure clean logout
        try {
          localStorage.removeItem('auth-storage');
        } catch (error) {
          console.error('Failed to clear localStorage:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user data, not tokens or auth state
      // isAuthenticated will be determined by whether we can restore the session
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Upgrade modal state
let upgradeModalCallback: ((limitType: string, message: string) => void) | null = null;

/**
 * Register callback to show upgrade modal
 * Called from app initialization
 */
export function registerUpgradeModalCallback(callback: (limitType: string, message: string) => void) {
  upgradeModalCallback = callback;
}

/**
 * Subscribe to token refresh
 * Used to queue requests while refresh is in progress
 */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * Notify all subscribers when token is refreshed
 */
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important for httpOnly cookies
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors() {
    // Request interceptor: Add access token and workspace ID to headers
    this.client.interceptors.request.use(
      (config) => {
        // Get access token from window reference (set by auth store)
        const token = getAccessTokenForInterceptor();
        console.log('🔑 Interceptor reading token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
        
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Get workspace ID from window reference (set by workspace store)
        const workspaceId = getWorkspaceIdForInterceptor();
        
        // Add workspace ID header for tenant-scoped requests
        // Skip for auth and workspace list endpoints
        const skipWorkspaceHeader = 
          config.url?.includes('/auth/') ||
          config.url === '/workspaces' ||
          config.url?.match(/^\/workspaces$/) ||
          config.method?.toLowerCase() === 'post' && config.url === '/workspaces';

        if (workspaceId && !skipWorkspaceHeader && config.headers) {
          config.headers['x-workspace-id'] = workspaceId;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: Handle 401 errors and refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 402 Payment Required - Plan limit reached
        if (error.response?.status === 402) {
          const errorData = error.response.data as any;
          const limitType = errorData?.limitType || 'posts';
          const message = errorData?.message || 'You have reached your plan limit';
          
          // Show upgrade modal if callback is registered
          if (upgradeModalCallback) {
            upgradeModalCallback(limitType, message);
          }
          
          return Promise.reject(error);
        }

        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          // Skip refresh for auth endpoints to prevent infinite loop
          if (originalRequest.url?.includes('/auth/login') || 
              originalRequest.url?.includes('/auth/register') ||
              originalRequest.url?.includes('/auth/refresh')) {
            return Promise.reject(error);
          }

          originalRequest._retry = true;

          // If already refreshing, queue this request
          if (isRefreshing) {
            return new Promise((resolve) => {
              subscribeTokenRefresh((token: string) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                resolve(this.client(originalRequest));
              });
            });
          }

          isRefreshing = true;

          try {
            // Attempt to refresh token
            const response = await this.client.post('/auth/refresh', {});
            const { accessToken } = response.data;

            // Update token in store
            this.setAccessToken(accessToken);

            // Notify all queued requests
            onTokenRefreshed(accessToken);

            // Retry original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }

            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            this.handleAuthFailure();
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Get access token from auth store
   * Not used directly, kept for reference
   */
  private getAccessToken(): string | null {
    return getAccessTokenForInterceptor();
  }

  /**
   * Set access token in auth store
   */
  private setAccessToken(token: string) {
    import('@/store/auth.store').then(({ useAuthStore }) => {
      useAuthStore.getState().setAccessToken(token);
    });
  }

  /**
   * Handle authentication failure
   * Clear auth state and redirect to login
   */
  private handleAuthFailure() {
    import('@/store/auth.store').then(({ useAuthStore }) => {
      useAuthStore.getState().clearAuth();
    });

    // Redirect to login if not already there
    if (!window.location.pathname.includes('/auth/login')) {
      window.location.href = '/auth/login';
    }
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

// Export a function to get access token for use in interceptors
export function getAccessTokenForInterceptor(): string | null {
  try {
    // This will be called synchronously in the interceptor
    // We need to access the store state directly
    const state = (window as any).__AUTH_STORE__;
    return state?.accessToken || null;
  } catch (error) {
    return null;
  }
}

// Export a function to get workspace ID for use in interceptors
export function getWorkspaceIdForInterceptor(): string | null {
  try {
    // This will be called synchronously in the interceptor
    // We need to access the store state directly
    const state = (window as any).__WORKSPACE_STORE__;
    return state?.currentWorkspaceId || null;
  } catch (error) {
    return null;
  }
}

// Store reference to auth store state for interceptor
if (typeof window !== 'undefined') {
  // Initialize immediately with empty state
  (window as any).__AUTH_STORE__ = { accessToken: null };
  (window as any).__WORKSPACE_STORE__ = { currentWorkspaceId: null };
  
  // Then subscribe to updates
  import('@/store/auth.store').then(({ useAuthStore }) => {
    // Set initial state
    (window as any).__AUTH_STORE__ = useAuthStore.getState();
    
    // Subscribe to changes
    useAuthStore.subscribe((state) => {
      (window as any).__AUTH_STORE__ = state;
    });
  });

  // Store reference to workspace store state for interceptor
  import('@/store/workspace.store').then(({ useWorkspaceStore }) => {
    // Set initial state
    (window as any).__WORKSPACE_STORE__ = useWorkspaceStore.getState();
    
    // Subscribe to changes
    useWorkspaceStore.subscribe((state) => {
      (window as any).__WORKSPACE_STORE__ = state;
    });
  });
}

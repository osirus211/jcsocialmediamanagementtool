export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  isEmailVerified: boolean;
  provider: 'local' | 'google';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authChecked: boolean;
  accessToken: string | null;
}

export interface AuthActions {
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthChecked: (checked: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  clearAuth: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
  accessToken: string;
}

export interface RefreshResponse {
  message: string;
  accessToken: string;
}

export interface MeResponse {
  user: User;
}

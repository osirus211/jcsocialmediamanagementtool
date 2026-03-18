export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  role: 'owner' | 'admin' | 'member';
  isEmailVerified: boolean;
  provider: 'local' | 'google';
  twoFactorEnabled: boolean;
  onboardingCompleted: boolean;
  onboardingStep: number;
  notificationPreferences: {
    email: {
      postPublished: boolean;
      postFailed: boolean;
      weeklyReport: boolean;
      accountIssues: boolean;
    };
    push: {
      postPublished: boolean;
      postFailed: boolean;
      accountIssues: boolean;
    };
  };
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
  login: (email: string, password: string) => Promise<LoginResult>;
  completeLogin: (userId: string, token: string) => Promise<LoginResponse>;
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
  marketingConsent?: boolean;
}

export interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
}

export interface TwoFactorChallengeResponse {
  requiresTwoFactor: true;
  userId: string;
  message: string;
}

export type LoginResult = LoginResponse | TwoFactorChallengeResponse;

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

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

export interface UpdateProfileResponse {
  message: string;
  user: User;
}

export interface UploadAvatarResponse {
  message: string;
  avatarUrl: string;
}

export interface UserSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface GetSessionsResponse {
  sessions: UserSession[];
}

export interface UpdateNotificationPreferencesData {
  email?: {
    postPublished?: boolean;
    postFailed?: boolean;
    weeklyReport?: boolean;
    accountIssues?: boolean;
  };
  push?: {
    postPublished?: boolean;
    postFailed?: boolean;
    accountIssues?: boolean;
  };
}

export interface UpdateNotificationPreferencesResponse {
  message: string;
  notificationPreferences: User['notificationPreferences'];
}

export interface DeleteAccountData {
  password: string;
}

export interface DeleteAccountResponse {
  message: string;
}

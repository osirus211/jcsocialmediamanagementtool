export interface OnboardingProgress {
  userId: string;
  currentStep: number;
  completed: boolean;
  completedSteps: number[];
}

export interface OnboardingStepData {
  role?: string;
  teamSize?: string;
  primaryGoal?: string;
  connectedAccounts?: string[];
  firstPostCreated?: boolean;
  teamMembersInvited?: string[];
}

export interface OnboardingState {
  progress: OnboardingProgress | null;
  isLoading: boolean;
  currentStepData: OnboardingStepData;
}

export interface OnboardingActions {
  fetchProgress: () => Promise<void>;
  updateStep: (step: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  updateStepData: (data: Partial<OnboardingStepData>) => void;
  clearOnboarding: () => void;
}

export interface OnboardingStore extends OnboardingState, OnboardingActions {}

// Step definitions
export const ONBOARDING_STEPS = {
  WELCOME: 0,
  CONNECT_ACCOUNTS: 1,
  CREATE_POST: 2,
  INVITE_TEAM: 3,
  COMPLETE: 4,
} as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[keyof typeof ONBOARDING_STEPS];

// Role options for step 1
export const ROLE_OPTIONS = [
  { value: 'founder', label: 'Founder/CEO', description: 'Building and growing my business' },
  { value: 'marketer', label: 'Marketer', description: 'Managing marketing campaigns' },
  { value: 'agency', label: 'Agency Owner', description: 'Managing multiple client accounts' },
  { value: 'creator', label: 'Content Creator', description: 'Creating and sharing content' },
] as const;

// Team size options for step 1
export const TEAM_SIZE_OPTIONS = [
  { value: 'solo', label: 'Just me', description: 'Working alone' },
  { value: 'small', label: '2-5 people', description: 'Small team' },
  { value: 'medium', label: '6-20 people', description: 'Medium team' },
  { value: 'large', label: '20+ people', description: 'Large team' },
] as const;

// Primary goal options for step 1
export const GOAL_OPTIONS = [
  { value: 'grow-audience', label: 'Grow my audience', description: 'Increase followers and engagement' },
  { value: 'save-time', label: 'Save time', description: 'Automate and streamline posting' },
  { value: 'manage-clients', label: 'Manage clients', description: 'Handle multiple client accounts' },
  { value: 'increase-sales', label: 'Increase sales', description: 'Drive more conversions' },
] as const;
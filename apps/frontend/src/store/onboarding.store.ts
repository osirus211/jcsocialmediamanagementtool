import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api-client';
import {
  OnboardingStore,
  OnboardingProgress,
  OnboardingStepData,
} from '@/types/onboarding.types';
import { logger } from '@/lib/logger';

/**
 * Global onboarding store
 * 
 * Manages onboarding flow state and progress
 */
export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // State
      progress: null,
      isLoading: false,
      currentStepData: {},

      // Actions
      fetchProgress: async () => {
        try {
          set({ isLoading: true });
          
          const response = await apiClient.get<{ data: OnboardingProgress }>('/onboarding/progress');
          
          set({
            progress: response.data,
            isLoading: false,
          });
        } catch (error: any) {
          logger.error('Failed to fetch onboarding progress', { error: error.message });
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Failed to fetch onboarding progress');
        }
      },

      updateStep: async (step: number) => {
        try {
          set({ isLoading: true });
          
          const response = await apiClient.put<{ data: OnboardingProgress }>('/onboarding/step', {
            step,
          });
          
          set({
            progress: response.data,
            isLoading: false,
          });
        } catch (error: any) {
          logger.error('Failed to update onboarding step', { error: error.message });
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Failed to update onboarding step');
        }
      },

      completeOnboarding: async () => {
        try {
          set({ isLoading: true });
          
          const response = await apiClient.post<{ data: OnboardingProgress }>('/onboarding/complete');
          
          set({
            progress: response.data,
            isLoading: false,
          });
        } catch (error: any) {
          logger.error('Failed to complete onboarding', { error: error.message });
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Failed to complete onboarding');
        }
      },

      skipOnboarding: async () => {
        try {
          set({ isLoading: true });
          
          const response = await apiClient.post<{ data: OnboardingProgress }>('/onboarding/skip');
          
          set({
            progress: response.data,
            isLoading: false,
          });
        } catch (error: any) {
          logger.error('Failed to skip onboarding', { error: error.message });
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Failed to skip onboarding');
        }
      },

      updateStepData: (data: Partial<OnboardingStepData>) => {
        set((state) => ({
          currentStepData: {
            ...state.currentStepData,
            ...data,
          },
        }));
      },

      clearOnboarding: () => {
        set({
          progress: null,
          isLoading: false,
          currentStepData: {},
        });
      },
    }),
    {
      name: 'onboarding-storage',
      // Only persist step data, not progress (that comes from server)
      partialize: (state) => ({
        currentStepData: state.currentStepData,
      }),
    }
  )
);
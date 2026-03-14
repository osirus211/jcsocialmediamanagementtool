import { toast as toastManager } from '@/lib/notifications';

export const useToast = () => {
  return {
    toast: (options: { title?: string; description?: string; variant?: 'default' | 'destructive' }) => {
      const message = options.title || options.description || '';
      const type = options.variant === 'destructive' ? 'error' : 'info';
      return toastManager.show(message, { type });
    },
  };
};
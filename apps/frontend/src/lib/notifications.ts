// Simple notification system to replace react-hot-toast

interface NotificationOptions {
  duration?: number;
  type?: 'success' | 'error' | 'info';
}

class NotificationManager {
  private notifications: Map<string, HTMLElement> = new Map();
  private counter = 0;

  show(message: string, options: NotificationOptions = {}) {
    const { duration = 3000, type = 'info' } = options;
    const id = `notification-${++this.counter}`;

    // Create notification element
    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `fixed bottom-4 right-4 z-50 animate-slide-up min-w-[300px] ${this.getTypeClasses(type)}`;
    
    notification.innerHTML = `
      <div class="flex items-center gap-3 p-4 rounded-lg shadow-lg border">
        <div class="flex-shrink-0">
          ${this.getIcon(type)}
        </div>
        <p class="flex-1 text-sm font-medium">
          ${message}
        </p>
        <button class="flex-shrink-0 hover:opacity-70" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(notification);
    this.notifications.set(id, notification);

    // Auto-remove after duration
    setTimeout(() => {
      this.remove(id);
    }, duration);

    return id;
  }

  private remove(id: string) {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.remove();
      this.notifications.delete(id);
    }
  }

  private getTypeClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'text-green-900 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-900 bg-red-50 border-red-200';
      default:
        return 'text-blue-900 bg-blue-50 border-blue-200';
    }
  }

  private getIcon(type: string): string {
    switch (type) {
      case 'success':
        return '<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      case 'error':
        return '<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      default:
        return '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }
  }

  success(message: string, options?: Omit<NotificationOptions, 'type'>) {
    return this.show(message, { ...options, type: 'success' });
  }

  error(message: string, options?: Omit<NotificationOptions, 'type'>) {
    return this.show(message, { ...options, type: 'error' });
  }

  info(message: string, options?: Omit<NotificationOptions, 'type'>) {
    return this.show(message, { ...options, type: 'info' });
  }
}

export const toast = new NotificationManager();
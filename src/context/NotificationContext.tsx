import React, { createContext, useContext, useState, useCallback } from 'react';
import { type ReactNode } from 'react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  actionLabel?: string;
  action?: () => void;
}

interface NotificationContextValue {
  showNotification: (message: string, type?: NotificationType, actionLabel?: string, action?: () => void) => void;
  notify: (message: string, options?: { type?: NotificationType }) => void;
  removeNotification: (id: string) => void;
  notifications: Notification[];
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType = 'info', actionLabel?: string, action?: () => void) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type, actionLabel, action }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }, []);

  const notify = useCallback((message: string, options?: { type?: NotificationType }) => {
    showNotification(message, options?.type || 'info');
  }, [showNotification]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, notify, removeNotification, notifications }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-sm shadow-lg border transition-all duration-500 animate-fade-in ${
              n.type === 'success'
                ? 'bg-white border-sage text-ink'
                : n.type === 'error'
                ? 'bg-white border-rose text-ink'
                : 'bg-white border-silk text-ink'
            }`}
          >
            <div className={`flex-shrink-0 ${
              n.type === 'success' ? 'text-sage' : n.type === 'error' ? 'text-rose' : 'text-ink-light'
            }`}>
              {n.type === 'success' ? <CheckCircle2 size={18} /> : n.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
            </div>
            <div className="flex-1 text-sm font-light leading-relaxed">
              {n.message}
              {n.action && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    n.action?.();
                    removeNotification(n.id);
                  }}
                  className="block mt-2 text-xs font-medium text-rose hover:underline"
                >
                  {n.actionLabel || 'Add to Cart'}
                </button>
              )}
            </div>
            <button
              onClick={() => removeNotification(n.id)}
              className="flex-shrink-0 text-ink-light hover:text-ink transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}

import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type ToastMessage = {
  id: number;
  message: string;
  type?: ToastType;
  duration?: number;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    
    // Auto-remove after 5 seconds
    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);

    return () => {
      clearTimeout(timeout);
      setToasts(prev => prev.filter(t => t.id !== id));
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

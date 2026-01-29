// Toast notification system

import { createContext, useState, useCallback } from 'react';
import type { Toast } from '@/types';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastContextType {
    showToast: (message: string, type: Toast['type']) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: Toast['type']) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: Toast = { id, message, type };

        setToasts((prev) => [...prev, newToast]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const getIcon = (type: Toast['type']) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-[var(--neon-lime)]" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-400" />;
            case 'info':
                return <Info className="w-5 h-5 text-blue-400" />;
        }
    };

    const getBorderColor = (type: Toast['type']) => {
        switch (type) {
            case 'success':
                return 'border-l-[var(--neon-lime)]';
            case 'error':
                return 'border-l-red-500';
            case 'info':
                return 'border-l-blue-500';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              pointer-events-auto
              flex items-center gap-3 px-4 py-3 rounded-xl
              bg-[var(--surface-secondary)] border border-white/[0.06]
              border-l-4 ${getBorderColor(toast.type)}
              shadow-2xl
              animate-fade-in
              min-w-[300px] max-w-[400px]
            `}
                    >
                        {getIcon(toast.type)}
                        <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
                            {toast.message}
                        </span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <X className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

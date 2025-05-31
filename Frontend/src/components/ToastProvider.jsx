import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from './Toast';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type, duration };
        
        setToasts(prev => [...prev, toast]);
        
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showSuccess = useCallback((message, duration) => {
        return addToast(message, 'success', duration);
    }, [addToast]);

    const showError = useCallback((message, duration) => {
        return addToast(message, 'error', duration);
    }, [addToast]);

    const showWarning = useCallback((message, duration) => {
        return addToast(message, 'warning', duration);
    }, [addToast]);

    const showInfo = useCallback((message, duration) => {
        return addToast(message, 'info', duration);
    }, [addToast]);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    const value = {
        showSuccess,
        showError,
        showWarning,
        showInfo,
        clearAll,
        addToast,
        removeToast
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 9999 }}>
                {toasts.map((toast, index) => (
                    <div 
                        key={toast.id}
                        style={{
                            position: 'absolute',
                            top: `${10 + index * 70}px`,
                            right: '10px'
                        }}
                    >
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            duration={toast.duration}
                            onClose={() => removeToast(toast.id)}
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

import React, { useState, useEffect } from 'react';
import styles from './Toast.module.css';

const Toast = ({ message, type = 'success', duration = 4000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        // Start animation after component mounts
        const animationTimer = setTimeout(() => {
            setIsAnimating(true);
        }, 10);

        // Auto-hide after duration
        const hideTimer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => {
            clearTimeout(animationTimer);
            clearTimeout(hideTimer);
        };
    }, [duration]);

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
        }, 300); // Match the CSS transition duration
    };

    if (!isVisible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                            d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z"
                            fill="currentColor"
                        />
                    </svg>
                );
            case 'error':
                return (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                            d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z"
                            fill="currentColor"
                        />
                    </svg>
                );
            case 'warning':
                return (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                            d="M1 17H19L10 2L1 17ZM11 14H9V12H11V14ZM11 10H9V6H11V10Z"
                            fill="currentColor"
                        />
                    </svg>
                );
            case 'info':
                return (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                            d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z"
                            fill="currentColor"
                        />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div 
            className={`${styles.toast} ${styles[type]} ${isAnimating ? styles.show : ''}`}
            role="alert"
            aria-live="polite"
        >
            <div className={styles.toastContent}>
                <div className={styles.toastIcon}>
                    {getIcon()}
                </div>
                <div className={styles.toastMessage}>
                    {message}
                </div>
                <button 
                    className={styles.toastClose}
                    onClick={handleClose}
                    aria-label="Close notification"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M12 4L4 12M4 4L12 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Toast;

import React, { useState, useEffect } from 'react';
import { FaBell } from 'react-icons/fa';
import api from '../utils/api';
import styles from './NotificationIcon.module.css';

/**
 * NotificationIcon Component - Professional notification bell with badge
 * 
 * Features:
 * - Real-time change count indicator
 * - Professional animation and styling
 * - Auto-refresh capability
 * - Click handler for opening panel
 */
const NotificationIcon = ({ siteID, onClick }) => {
    // ===========================================
    // STATE MANAGEMENT
    // ===========================================
    
    const [changeCount, setChangeCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasNewChanges, setHasNewChanges] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    // ===========================================
    // DATA FETCHING
    // ===========================================
    
    /**
     * Fetches recent changes count for the notification badge
     */
    const fetchChangeCount = async () => {
        if (!siteID) return;
        
        setIsLoading(true);
        
        try {
            // Get changes from last 24 hours
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const response = await api.get(`/api/change-tracking/recent?limit=100&siteID=${siteID}`);
            
            if (response.success) {
                // Filter changes from last 24 hours
                const recentChanges = (response.data || []).filter(change => {
                    const changeDate = new Date(change.timestamp);
                    return changeDate > yesterday;
                });
                
                const newCount = recentChanges.length;
                
                // Check if there are new changes since last check
                if (lastCheck && newCount > changeCount) {
                    setHasNewChanges(true);
                    
                    // Auto-remove the "new changes" indicator after 5 seconds
                    setTimeout(() => {
                        setHasNewChanges(false);
                    }, 5000);
                }
                
                setChangeCount(newCount);
                setLastCheck(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch change count:', error);
            // On error, don't update the count to avoid confusion
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Handle click with haptic feedback simulation
     */
    const handleClick = () => {
        // Remove the "new changes" indicator when clicked
        setHasNewChanges(false);
        
        // Call the parent's onClick handler
        if (onClick) {
            onClick();
        }
    };

    // ===========================================
    // EFFECT HOOKS
    // ===========================================
    
    /**
     * Initial data fetch and setup interval
     */
    useEffect(() => {
        if (siteID) {
            fetchChangeCount();
            
            // Set up auto-refresh every 30 seconds
            const interval = setInterval(fetchChangeCount, 30000);
            
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteID]);

    // ===========================================
    // RENDER COMPONENT
    // ===========================================
    
    return (
        <div className={styles.notificationContainer}>
            <button
                className={`${styles.notificationButton} ${hasNewChanges ? styles.hasNewChanges : ''} ${isLoading ? styles.loading : ''}`}
                onClick={handleClick}
                aria-label={`${changeCount} recent changes. Click to view details.`}
                title={`${changeCount} recent changes in the last 24 hours`}
            >
                <FaBell className={styles.bellIcon} />
                
                {changeCount > 0 && (
                    <div className={`${styles.badge} ${hasNewChanges ? styles.badgeNew : ''}`}>
                        <span className={styles.badgeText}>
                            {changeCount > 99 ? '99+' : changeCount}
                        </span>
                    </div>
                )}
                
                {isLoading && (
                    <div className={styles.loadingIndicator}>
                        <div className={styles.loadingSpinner}></div>
                    </div>
                )}
                
                {/* Pulse animation overlay for new changes */}
                {hasNewChanges && (
                    <div className={styles.pulseOverlay}></div>
                )}
            </button>
        </div>
    );
};

export default NotificationIcon;

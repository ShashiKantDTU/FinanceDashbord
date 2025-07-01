import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
    FaTimes, 
    FaClock, 
    FaUser, 
    FaEdit, 
    FaSearch, 
    FaSync, 
    FaFilter, 
    FaExchangeAlt, 
    FaPlus, 
    FaMinus, 
    FaCircle,
    FaMoneyBillWave,
    FaCalendarAlt,
    FaBusinessTime,
    FaPencilAlt,
    FaCalendarCheck,
    FaExclamationTriangle,
    FaExternalLinkAlt
} from 'react-icons/fa';
import api from '../utils/api';
import styles from './ChangeTrackingPanel.module.css';

/**
 * ChangeTrackingPanel Component - Professional sliding panel for change tracking
 * 
 * Features:
 * - Recent changes display with real-time updates
 * - Search and filter functionality
 * - Professional UI matching project theme
 * - Automatic refresh capability
 * - Responsive design
 */
const ChangeTrackingPanel = ({ isOpen, onClose, siteID }) => {
    // ===========================================
    // STATE MANAGEMENT
    // ===========================================
    
    const [recentChanges, setRecentChanges] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all', 'attendance', 'payouts', 'bonus'
    const [refreshInterval, setRefreshInterval] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState(null);

    // ===========================================
    // DATA FETCHING FUNCTIONS
    // ===========================================
    
    /**
     * Fetches recent changes from the change tracking API
     */
    const fetchRecentChanges = async () => {
        if (!siteID) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.get(`/api/change-tracking/recent?limit=50&siteID=${siteID}`);
            
            if (response.success) {
                setRecentChanges(response.data || []);
                setLastUpdated(new Date());
            } else {
                throw new Error(response.message || 'Failed to fetch changes');
            }
        } catch (error) {
            console.error('Failed to fetch recent changes:', error);
            setError('Failed to load recent changes. Please try again.');
            setRecentChanges([]);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Manual refresh function
     */
    const handleRefresh = () => {
        fetchRecentChanges();
    };

    /**
     * Auto-refresh toggle
     */
    const toggleAutoRefresh = () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            setRefreshInterval(null);
        } else {
            const interval = setInterval(fetchRecentChanges, 30000); // 30 seconds
            setRefreshInterval(interval);
        }
    };

    // ===========================================
    // DATA PROCESSING
    // ===========================================
    
    /**
     * Filter and search changes
     */
    const filteredChanges = recentChanges.filter(change => {
        // Search filter
        const matchesSearch = change.displayMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             change.employeeID?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Type filter
        if (filterType === 'all') {
            return matchesSearch;
        }
        
        const field = change.field?.toLowerCase();
        switch (filterType) {
            case 'attendance':
                return matchesSearch && field === 'attendance';
            case 'payouts':
                return matchesSearch && field === 'payouts';
            case 'bonus':
                return matchesSearch && field === 'additional_req_pays';
            default:
                return matchesSearch;
        }
    });

    /**
     * Format timestamp for display with enhanced readability
     */
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown time';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);
        
        if (diffInMinutes < 1) return { relative: 'Just now', absolute: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
        if (diffInMinutes < 60) return { relative: `${diffInMinutes}m ago`, absolute: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
        if (diffInHours < 24) return { relative: `${diffInHours}h ago`, absolute: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
        if (diffInDays < 7) return { relative: `${diffInDays}d ago`, absolute: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
        
        return { 
            relative: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            absolute: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
    };

    /**
     * Get priority level for changes
     */
    const getChangePriority = (changeType, field) => {
        const priorityMatrix = {
            attendance: { removed: 'high', added: 'medium', modified: 'low' },
            payouts: { added: 'high', removed: 'high', modified: 'medium' },
            additional_req_pays: { added: 'medium', removed: 'medium', modified: 'low' }
        };
        
        return priorityMatrix[field]?.[changeType] || 'low';
    };

    /**
     * Extract meaningful data from change description
     */
    const parseChangeData = (change) => {
        const description = change.displayMessage || change.changeDescription || '';
        
        // Extract monetary values
        const moneyMatch = description.match(/₹([\d,]+)/);
        const amount = moneyMatch ? moneyMatch[1] : null;
        
        // Extract attendance values
        const attendanceMatch = description.match(/(Present|Absent|Holiday|Leave)([^)]*)/);
        const attendanceInfo = attendanceMatch ? attendanceMatch[0] : null;
        
        // Extract action type
        let actionType = 'updated';
        if (description.toLowerCase().includes('added')) actionType = 'added';
        else if (description.toLowerCase().includes('removed')) actionType = 'removed';
        else if (description.toLowerCase().includes('marked')) actionType = 'marked';
        
        return {
            amount,
            attendanceInfo,
            actionType,
            description: description
        };
    };

    /**
     * Get change type icon and styling
     */
    const getChangeTypeStyle = (changeType) => {
        const changeStyles = {
            added: { 
                icon: FaPlus, 
                color: 'var(--color-success)', 
                bgColor: 'var(--color-success-subtle)',
                label: 'Added'
            },
            removed: { 
                icon: FaMinus, 
                color: 'var(--color-error)', 
                bgColor: 'var(--color-error-subtle)',
                label: 'Removed'
            },
            modified: { 
                icon: FaEdit, 
                color: 'var(--color-warning)', 
                bgColor: 'var(--color-warning-subtle)',
                label: 'Modified'
            },
            updated: { 
                icon: FaExchangeAlt, 
                color: 'var(--color-info)', 
                bgColor: 'var(--color-info-subtle)',
                label: 'Updated'
            }
        };
        
        return changeStyles[changeType] || changeStyles.updated;
    };

    /**
     * Get field display name and color
     */
    const getFieldStyle = (field) => {
        const fieldStyles = {
            attendance: { 
                label: 'Attendance', 
                color: 'var(--color-primary)',
                bgColor: 'var(--color-primary-subtle)'
            },
            payouts: { 
                label: 'Payouts', 
                color: 'var(--color-success)',
                bgColor: 'var(--color-success-subtle)'
            },
            additional_req_pays: { 
                label: 'Bonus', 
                color: 'var(--color-warning)',
                bgColor: 'var(--color-warning-subtle)'
            }
        };
        
        return fieldStyles[field] || { 
            label: field?.charAt(0).toUpperCase() + field?.slice(1) || 'Unknown',
            color: 'var(--color-text-tertiary)',
            bgColor: 'var(--color-bg-tertiary)'
        };
    };

    /**
     * Group changes by timeline for better organization
     */
    const groupChangesByTimeline = (changes) => {
        const groups = {
            today: [],
            yesterday: [],
            thisWeek: [],
            older: []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        changes.forEach(change => {
            const changeDate = new Date(change.timestamp);
            const changeDateOnly = new Date(changeDate.getFullYear(), changeDate.getMonth(), changeDate.getDate());

            if (changeDateOnly.getTime() === today.getTime()) {
                groups.today.push(change);
            } else if (changeDateOnly.getTime() === yesterday.getTime()) {
                groups.yesterday.push(change);
            } else if (changeDate >= weekAgo) {
                groups.thisWeek.push(change);
            } else {
                groups.older.push(change);
            }
        });

        return groups;
    };

    /**
     * Get statistics for the current changes
     */
    const getChangeStatistics = (changes) => {
        const stats = {
            total: changes.length,
            byType: { added: 0, removed: 0, modified: 0, updated: 0 },
            byField: { attendance: 0, payouts: 0, additional_req_pays: 0 },
            byPriority: { high: 0, medium: 0, low: 0 }
        };

        changes.forEach(change => {
            stats.byType[change.changeType] = (stats.byType[change.changeType] || 0) + 1;
            stats.byField[change.field] = (stats.byField[change.field] || 0) + 1;
            const priority = getChangePriority(change.changeType, change.field);
            stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
        });

        return stats;
    };

    // ===========================================
    // EFFECT HOOKS
    // ===========================================
    
    /**
     * Fetch data when panel opens or siteID changes
     */
    useEffect(() => {
        if (isOpen && siteID) {
            fetchRecentChanges();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, siteID]);

    /**
     * Cleanup intervals on unmount
     */
    useEffect(() => {
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
    }, [refreshInterval]);

    /**
     * Handle escape key to close panel
     */
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // ===========================================
    // RENDER COMPONENT
    // ===========================================
    
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className={styles.backdrop} onClick={onClose} />
            
            {/* Sliding Panel */}
            <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
                {/* Panel Header */}
                <div className={styles.header}>
                    <div className={styles.headerTop}>
                        <div className={styles.headerTitle}>
                            <h2>Change Tracking</h2>
                            <p>Real-time activity monitoring for this site</p>
                        </div>
                        
                        <div className={styles.headerButtons}>
                            <Link 
                                to={`/change-tracking/${siteID}`}
                                className={styles.detailsButton}
                                title="View detailed monthly change tracking"
                            >
                                <FaExternalLinkAlt />
                                <span>View Details</span>
                            </Link>
                            
                            <button 
                                className={styles.closeButton}
                                onClick={onClose}
                                aria-label="Close panel"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                    
                    {/* Search and Controls */}
                    <div className={styles.headerControls}>
                        <div className={styles.searchContainer}>
                            <FaSearch className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Search changes, employee ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={styles.searchInput}
                            />
                        </div>
                        
                        <div className={styles.filterContainer}>
                            <FaFilter className={styles.filterIcon} />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className={styles.filterSelect}
                            >
                                <option value="all">All Changes</option>
                                <option value="attendance">Attendance</option>
                                <option value="payouts">Payouts</option>
                                <option value="bonus">Bonus</option>
                            </select>
                        </div>
                        
                        <div className={styles.actionControls}>
                            <button
                                className={`${styles.refreshButton} ${loading ? styles.loading : ''}`}
                                onClick={handleRefresh}
                                disabled={loading}
                                aria-label="Refresh changes"
                            >
                                <FaSync className={loading ? styles.spinning : ''} />
                            </button>
                            
                            <button
                                className={`${styles.autoRefreshButton} ${refreshInterval ? styles.active : ''}`}
                                onClick={toggleAutoRefresh}
                                aria-label="Toggle auto-refresh"
                            >
                                <FaCircle className={styles.statusDot} />
                                Auto
                            </button>
                        </div>
                    </div>
                    
                    {/* Status Bar */}
                    <div className={styles.statusBar}>
                        <div className={styles.statusInfo}>
                            <span className={styles.changeCount}>
                                {filteredChanges.length} {filteredChanges.length === 1 ? 'change' : 'changes'}
                            </span>
                            {lastUpdated && (
                                <span className={styles.lastUpdated}>
                                    <FaClock className={styles.clockIcon} />
                                    Last updated {formatTimestamp(lastUpdated.toISOString()).relative}
                                </span>
                            )}
                        </div>
                        
                        {refreshInterval && (
                            <div className={styles.autoRefreshIndicator}>
                                <div className={styles.pulseIndicator}></div>
                                <span>Auto-refresh active</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Panel Content */}
                <div className={styles.content}>
                    {loading && recentChanges.length === 0 ? (
                        <div className={styles.loadingState}>
                            <div className={styles.loadingSpinner}></div>
                            <h3>Loading Changes</h3>
                            <p>Fetching recent activity...</p>
                        </div>
                    ) : error ? (
                        <div className={styles.errorState}>
                            <div className={styles.errorIcon}>⚠️</div>
                            <h3>Unable to Load Changes</h3>
                            <p>{error}</p>
                            <button onClick={handleRefresh} className={styles.retryButton}>
                                <FaSync />
                                Try Again
                            </button>
                        </div>
                    ) : filteredChanges.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>�</div>
                            <h3>No Changes Found</h3>
                            <p>
                                {searchQuery || filterType !== 'all' 
                                    ? 'No changes match your current filters. Try adjusting your search criteria.' 
                                    : 'No recent activity detected for this site. Changes will appear here when employees data is modified.'
                                }
                            </p>
                            {(searchQuery || filterType !== 'all') && (
                                <button 
                                    onClick={() => {
                                        setSearchQuery('');
                                        setFilterType('all');
                                    }}
                                    className={styles.clearFiltersButton}
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className={styles.changesContainer}>
                            {/* Statistics Overview */}
                            {filteredChanges.length > 0 && (
                                <div className={styles.statisticsSection}>
                                    <div className={styles.statsHeader}>
                                        <h4>Activity Overview</h4>
                                        <span className={styles.totalCount}>{filteredChanges.length} changes</span>
                                    </div>
                                    
                                    <div className={styles.statsGrid}>
                                        {(() => {
                                            const stats = getChangeStatistics(filteredChanges);
                                            return (
                                                <>
                                                    <div className={styles.statCard}>
                                                        <div className={styles.statIcon} style={{ backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)' }}>
                                                            <FaPlus />
                                                        </div>
                                                        <div className={styles.statInfo}>
                                                            <span className={styles.statValue}>{stats.byType.added || 0}</span>
                                                            <span className={styles.statLabel}>Added</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={styles.statCard}>
                                                        <div className={styles.statIcon} style={{ backgroundColor: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>
                                                            <FaEdit />
                                                        </div>
                                                        <div className={styles.statInfo}>
                                                            <span className={styles.statValue}>{(stats.byType.modified || 0) + (stats.byType.updated || 0)}</span>
                                                            <span className={styles.statLabel}>Modified</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={styles.statCard}>
                                                        <div className={styles.statIcon} style={{ backgroundColor: 'var(--color-error-subtle)', color: 'var(--color-error)' }}>
                                                            <FaMinus />
                                                        </div>
                                                        <div className={styles.statInfo}>
                                                            <span className={styles.statValue}>{stats.byType.removed || 0}</span>
                                                            <span className={styles.statLabel}>Removed</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={styles.statCard}>
                                                        <div className={styles.statIcon} style={{ backgroundColor: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
                                                            <FaExclamationTriangle />
                                                        </div>
                                                        <div className={styles.statInfo}>
                                                            <span className={styles.statValue}>{stats.byPriority.high || 0}</span>
                                                            <span className={styles.statLabel}>High Priority</span>
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Timeline Grouped Changes */}
                            <div className={styles.changesList}>
                                {(() => {
                                    const groupedChanges = groupChangesByTimeline(filteredChanges);
                                    const timelineGroups = [
                                        { key: 'today', label: 'Today', changes: groupedChanges.today },
                                        { key: 'yesterday', label: 'Yesterday', changes: groupedChanges.yesterday },
                                        { key: 'thisWeek', label: 'This Week', changes: groupedChanges.thisWeek },
                                        { key: 'older', label: 'Older', changes: groupedChanges.older }
                                    ];

                                    return timelineGroups.map(group => {
                                        if (group.changes.length === 0) return null;

                                        return (
                                            <div key={group.key} className={styles.timelineGroup}>
                                                <div className={styles.timelineHeader}>
                                                    <h4 className={styles.timelineTitle}>{group.label}</h4>
                                                    <span className={styles.timelineCount}>{group.changes.length}</span>
                                                </div>
                                                
                                                <div className={styles.timelineChanges}>
                                                                    {group.changes.map((change, index) => {
                                                        const typeStyle = getChangeTypeStyle(change.changeType);
                                                        const fieldStyle = getFieldStyle(change.field);
                                                        const IconComponent = typeStyle.icon;
                                                        const timeData = formatTimestamp(change.timestamp);
                                                        const priority = getChangePriority(change.changeType, change.field);
                                                        const changeData = parseChangeData(change);
                                                        
                                                        return (
                                                            <div 
                                                                key={change._id || index} 
                                                                className={`${styles.changeItem} ${styles[`priority-${priority}`]}`}
                                                            >
                                                                {/* Priority Indicator */}
                                                                <div className={`${styles.priorityIndicator} ${styles[`priority-${priority}`]}`}></div>
                                                                
                                                                {/* Main Change Content */}
                                                                <div className={styles.changeContent}>
                                                                    {/* Header Section */}
                                                                    <div className={styles.changeHeader}>
                                                                        <div className={styles.changeIconSection}>
                                                                            <div 
                                                                                className={styles.changeTypeIcon}
                                                                                style={{ 
                                                                                    backgroundColor: typeStyle.bgColor,
                                                                                    color: typeStyle.color 
                                                                                }}
                                                                            >
                                                                                <IconComponent />
                                                                            </div>
                                                                            <div className={styles.changeMetadata}>
                                                                                <div className={styles.changeAction}>{changeData.actionType}</div>
                                                                                <div className={styles.changeCategory}>{fieldStyle.label}</div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className={styles.changeStatusBadges}>
                                                                            <span 
                                                                                className={styles.changeTypeBadge}
                                                                                style={{ 
                                                                                    backgroundColor: typeStyle.bgColor,
                                                                                    color: typeStyle.color 
                                                                                }}
                                                                            >
                                                                                {typeStyle.label}
                                                                            </span>
                                                                            
                                                                            <span 
                                                                                className={styles.fieldBadge}
                                                                                style={{ 
                                                                                    backgroundColor: fieldStyle.bgColor,
                                                                                    color: fieldStyle.color 
                                                                                }}
                                                                            >
                                                                                {fieldStyle.label}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Employee & Time Info */}
                                                                    <div className={styles.changeInfoSection}>
                                                                        <div className={styles.employeeInfo}>
                                                                            <div className={styles.employeeAvatar}>
                                                                                <FaUser />
                                                                            </div>
                                                                            <div className={styles.employeeDetails}>
                                                                                <span className={styles.employeeId}>{change.employeeID}</span>
                                                                                <span className={styles.employeeLabel}>Employee ID</span>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className={styles.timeInfo}>
                                                                            <div className={styles.timeRelative}>{timeData.relative}</div>
                                                                            <div className={styles.timeAbsolute}>{timeData.absolute}</div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Enhanced Description */}
                                                                    <div className={styles.changeDescriptionSection}>
                                                                        <div className={styles.changeDescription}>
                                                                            {changeData.description}
                                                                        </div>
                                                                        
                                                                        {/* Highlighted Data */}
                                                                        {(changeData.amount || changeData.attendanceInfo) && (
                                                                            <div className={styles.changeHighlights}>
                                                                                {changeData.amount && (
                                                                                    <div className={styles.amountHighlight}>
                                                                                        <span className={styles.amountLabel}>Amount</span>
                                                                                        <span className={styles.amountValue}>₹{changeData.amount}</span>
                                                                                    </div>
                                                                                )}
                                                                                
                                                                                {changeData.attendanceInfo && (
                                                                                    <div className={styles.attendanceHighlight}>
                                                                                        <span className={styles.attendanceLabel}>Status</span>
                                                                                        <span className={styles.attendanceValue}>{changeData.attendanceInfo}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* Footer with Author */}
                                                                    {change.changedBy && (
                                                                        <div className={styles.changeFooter}>
                                                                            <div className={styles.authorSection}>
                                                                                <FaEdit className={styles.authorIcon} />
                                                                                <span className={styles.authorText}>
                                                                                    Modified by <strong>{change.changedBy}</strong>
                                                                                </span>
                                                                            </div>
                                                                            
                                                                            <div className={styles.changeId}>
                                                                                #{(change._id || 'temp').slice(-6)}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ChangeTrackingPanel;

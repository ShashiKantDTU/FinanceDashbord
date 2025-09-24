import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  FaFilter,
  FaSync,
  FaUsers,
  FaPlus,
  FaMinus,
  FaEdit,
  FaExclamationTriangle,
  FaClock,
  FaUser,
  FaComment,
  FaMoneyBillWave,
  FaBusinessTime,
  FaHistory,
  FaListAlt,
  FaEye,
  FaInfoCircle,
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
  FaKeyboard,
  FaBell,
  FaSearch,
} from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import api from "../utils/api";
import styles from "./ChangeTracking.module.css";

// Custom hook for debounced search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Custom hook for keyboard shortcuts
const useKeyboardShortcuts = (callbacks) => {
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Check for Ctrl+R (refresh)
      if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        callbacks.refresh?.();
      }
      // Check for Ctrl+F (focus search)
      if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        callbacks.focusSearch?.();
      }
      // Check for Escape (clear filters)
      if (event.key === 'Escape') {
        callbacks.clearFilters?.();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [callbacks]);
};

// Enhanced change item component for better performance
const ChangeItem = React.memo(({ change, index, groupKey, onItemClick, getFieldStyle, getChangeTypeStyle, parseChangeData, formatTimestamp, viewMode }) => {
  const fieldStyle = getFieldStyle(change.field);
  const typeStyle = getChangeTypeStyle(change.changeType);
  const changeData = parseChangeData(change);
  const timestamp = formatTimestamp(change.timestamp);
  const IconComponent = fieldStyle.icon;
  const TypeIcon = typeStyle.icon;

  return (
    <div
      key={`${groupKey}-${change.id || index}`}
      className={`${styles.changeItem} ${styles[changeData.priority]}`}
      style={{ "--i": index, "--field-color": fieldStyle.color }}
      onClick={() => onItemClick?.(change)}
      role="button"
      tabIndex={0}
      aria-label={`Change: ${changeData.description}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onItemClick?.(change);
        }
      }}
    >
      <div className={styles.changeItemHeader}>
        <div className={styles.changeMainInfo}>
          <div className={styles.changeTitle}>
            <div 
              className={`${styles.changeTypeIcon} ${styles[change.changeType]}`}
              style={{ backgroundColor: typeStyle.color }}
              aria-label={`Change type: ${typeStyle.label}`}
            >
              <TypeIcon size={10} />
            </div>
            <span className={styles.employeeID}>{change.employeeID || "Unknown"}</span>
            <span className={styles.changeSeparator} aria-hidden="true">•</span>
            <span className={styles.changeAction}>{changeData.actionType}</span>
            <div 
              className={`${styles.fieldIcon}`}
              style={{ color: fieldStyle.color }}
              aria-label={`Field: ${fieldStyle.label}`}
            >
              <IconComponent size={12} />
            </div>
            <span className={styles.fieldName}>{change.fieldDisplayName || fieldStyle.label}</span>
          </div>
          
          {viewMode === "chronological" && (
            <div className={styles.changeTimestamp}>
              <FaClock size={8} aria-hidden="true" />
              <span>{timestamp.date}</span>
              <span className={styles.timeOnly}>{timestamp.time}</span>
            </div>
          )}
        </div>
        
        {changeData.isAttendanceChange && (
          <div className={styles.changeTypeBadge} style={{ backgroundColor: '#10b981' }}>
            <FaClock size={8} aria-hidden="true" />
            Attendance
          </div>
        )}
        
        {changeData.isPaymentChange && (
          <div className={styles.changeTypeBadge} style={{ backgroundColor: '#3b82f6' }}>
            <FaMoneyBillWave size={8} aria-hidden="true" />
            Payment
          </div>
        )}
      </div>

      <div className={styles.changeDescription}>
        {changeData.description}
      </div>

      {change.changedBy && (
        <div className={styles.changeFooter}>
          <div className={styles.changedBy}>
            <FaUser size={8} aria-hidden="true" />
            {change.changedBy}
          </div>
        </div>
      )}
    </div>
  );
});

const ChangeTracking = () => {
  const { siteID } = useParams();
  const searchInputRef = useRef(null);

  // Use site ID from params or provide fallback
  const actualSiteID = siteID || '6833ff004bd307e45abbfb41';

  const [changes, setChanges] = useState([]);
  const [groupedChanges, setGroupedChanges] = useState({});
  const [totalChanges, setTotalChanges] = useState(0);
  const [allAvailableFields, setAllAvailableFields] = useState([]); // Store all field options
  const [allAvailableChangeTypes, setAllAvailableChangeTypes] = useState([]); // Store all change type options
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterField, setFilterField] = useState("all");
  const [filterChangeType, setFilterChangeType] = useState("all");
  const [viewMode, setViewMode] = useState("chronological"); // "chronological" or "grouped"
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  
  // Date range filtering states
  const [dateRangeType, setDateRangeType] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Real-time updates
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState(30);

  // Debounced search for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const fetchRecentChanges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API parameters
      const apiParams = {
        siteID: actualSiteID,
        limit: recordsPerPage,
        page: currentPage,
        field: filterField !== "all" ? filterField : undefined,
        changeType: filterChangeType !== "all" ? filterChangeType : undefined,
        search: debouncedSearchQuery || undefined,
        dateRange: dateRangeType,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };

      // Debug: Log the API request parameters
      console.log('API Request Parameters:', apiParams);

      // Use detailed change tracking API with pagination
      const response = await api.get(`/api/detailed-change-tracking/recent-changes`, {
        params: apiParams
      });

      // Check if we have data
      if (response.data) {
        const responseData = response.data.data || response.data;
        const allChanges = responseData.allChanges || [];
        
        // Debug: Log the API response
        console.log('API Response Data:', responseData);
        console.log('All Changes:', allChanges);
        console.log('Sample change object:', allChanges[0]);
        
        // Extract data from response
        if (response.data.success || allChanges.length > 0) {
          // Pagination is at the root level of response.data
          const pagination = response.data.pagination;
          const groupedByTime = responseData.groupedByTime || {};
          const totalChanges = responseData.totalChanges || 0;
          
          // Store both flat array and grouped data
          setChanges(allChanges);
          setGroupedChanges(groupedByTime);
          setTotalChanges(totalChanges);
          
          // Update all available options when no filters are applied (to maintain full list)
          if (filterField === "all" && filterChangeType === "all" && !debouncedSearchQuery) {
            const allFields = [...new Set(allChanges.map((change) => change.field).filter(Boolean))];
            const allTypes = [...new Set(allChanges.map((change) => change.changeType).filter(Boolean))];
            setAllAvailableFields(allFields.sort());
            setAllAvailableChangeTypes(allTypes.sort());
          }
          
          // Update pagination state if available
          if (pagination) {
            setTotalPages(pagination.totalPages || 1);
            setHasNext(pagination.hasNext || false);
            setHasPrev(pagination.hasPrev || false);
          } else {
            // Calculate totalPages manually if not provided
            const calculatedTotalPages = Math.ceil(totalChanges / recordsPerPage);
            setTotalPages(calculatedTotalPages);
            setHasNext(currentPage < calculatedTotalPages);
            setHasPrev(currentPage > 1);
          }
          
          // Reset countdown when data is refreshed
          if (autoRefresh) {
            setNextRefreshCountdown(30);
          }
        } else {
          setChanges([]);
          setGroupedChanges({});
          setTotalChanges(0);
          setTotalPages(1);
          setHasNext(false);
          setHasPrev(false);
        }
      } else {
        setChanges([]);
        setGroupedChanges({});
        setTotalChanges(0);
        setTotalPages(1);
        setHasNext(false);
        setHasPrev(false);
      }
    } catch (err) {
      console.error("Error fetching recent changes:", err);
      setError("Failed to load change tracking data. Please try again.");
      setChanges([]);
      setGroupedChanges({});
      setTotalChanges(0);
    } finally {
      setLoading(false);
    }
  }, [actualSiteID, filterField, currentPage, recordsPerPage, filterChangeType, debouncedSearchQuery, dateRangeType, customStartDate, customEndDate, autoRefresh]);

  const refreshData = useCallback(() => {
    fetchRecentChanges();
  }, [fetchRecentChanges]);

  // Keyboard shortcuts
  const keyboardCallbacks = useMemo(() => ({
    refresh: () => refreshData(),
    focusSearch: () => searchInputRef.current?.focus(),
    clearFilters: () => {
      setSearchQuery("");
      setFilterField("all");
      setFilterChangeType("all");
      setDateRangeType("7days"); // Reset to "Last 7 Days" instead of "all"
    }
  }), [refreshData]);

  useKeyboardShortcuts(keyboardCallbacks);

  // Export functionality
  const exportToCSV = useCallback(() => {
    const headers = ['Employee ID', 'Field', 'Change Type', 'Description', 'Changed By', 'Timestamp'];
    const csvData = changes.map(change => [
      change.employeeID || '',
      change.fieldDisplayName || change.field || '',
      change.changeType || '',
      change.description || change.displayMessage || '',
      change.changedBy || '',
      new Date(change.timestamp).toLocaleString()
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `change-tracking-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [changes]);

  // Handle item click for detailed view
  const handleItemClick = useCallback((change) => {
    // Could open a modal or navigate to detail view
    console.log('Change clicked:', change);
  }, []);

  // Auto-refresh functionality with stable reference
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;

  const fetchRecentChangesRef = useRef(fetchRecentChanges);
  fetchRecentChangesRef.current = fetchRecentChanges;

  // Countdown timer for auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      setNextRefreshCountdown(30);
      const countdownInterval = setInterval(() => {
        setNextRefreshCountdown(prev => {
          if (prev <= 1) {
            return 30; // Reset countdown
          }
          return prev - 1;
        });
      }, 1000); // Update every second

      return () => clearInterval(countdownInterval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (autoRefreshRef.current) {
      const interval = setInterval(() => {
        fetchRecentChangesRef.current();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]); // Only depend on autoRefresh state changes

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return { date: "Unknown", time: "Unknown" };

    try {
      const date = new Date(timestamp);
      const dateStr = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      return { date: dateStr, time: timeStr };
    } catch {
      return { date: "Invalid Date", time: "Invalid Time" };
    }
  }, []);

  const getFieldStyle = useCallback((field) => {
    const fieldMap = {
      // Backend-compatible field mapping for detailed change tracking
      attendance: { 
        label: "Attendance", 
        icon: FaClock, 
        category: "attendance",
        color: "#10b981"
      },
      payouts: { 
        label: "Payouts", 
        icon: FaMoneyBillWave, 
        category: "payment",
        color: "#3b82f6"
      },
      additional_req_pays: { 
        label: "Bonus", 
        icon: FaPlus, 
        category: "bonus",
        color: "#f59e0b"
      },
      rate: { 
        label: "Daily Rate", 
        icon: FaMoneyBillWave, 
        category: "rate",
        color: "#10b981"
      },
    };

    return (
      fieldMap[field] || {
        label: field
          ? field.charAt(0).toUpperCase() + field.slice(1)
          : "Unknown",
        icon: FaEdit,
        category: "default",
        color: "#6b7280"
      }
    );
  }, []);

  const getChangeTypeStyle = useCallback((changeType) => {
    const typeMap = {
      added: { label: "Added", icon: FaPlus, color: "#10b981" },
      removed: { label: "Removed", icon: FaMinus, color: "#ef4444" },
      modified: { label: "Modified", icon: FaEdit, color: "#3b82f6" },
      created: { label: "Created", icon: FaPlus, color: "#10b981" },
      updated: { label: "Updated", icon: FaEdit, color: "#3b82f6" },
      deleted: { label: "Deleted", icon: FaMinus, color: "#ef4444" },
    };

    return (
      typeMap[changeType] || {
        label: changeType
          ? changeType.charAt(0).toUpperCase() + changeType.slice(1)
          : "Unknown",
        icon: FaExclamationTriangle,
        color: "#6b7280",
      }
    );
  }, []);

  const parseChangeData = useCallback((change) => {
    const actionType = change.changeType || "modified";
    
    // Use displayMessage from detailed change tracking API for rich descriptions
    const description =
      change.displayMessage ||
      change.description ||
      `${actionType} ${change.field}`;

    // Enhanced priority based on actual backend field types and change types
    let priority = "low";
    if (change.field === "payouts" || change.field === "additional_req_pays") {
      priority = "high";
    } else if (change.field === "attendance") {
      priority = change.changeType === "removed" ? "high" : "medium";
    } else if (change.field === "rate") {
      priority = change.changeType === "modified" ? "medium" : "low";
    } else if (change.changeType === "deleted") {
      priority = "high";
    }

    return {
      actionType: actionType.charAt(0).toUpperCase() + actionType.slice(1),
      description: description,
      priority: priority,
      isAttendanceChange: change.isAttendanceChange || change.field === "attendance",
      isPaymentChange: change.isPaymentChange || change.field === "payouts" || change.field === "additional_req_pays",
    };
  }, []);

  const getChangePriority = useCallback((change) => {
    if (change.field === "rate" || change.changeType === "deleted")
      return "high";
    if (change.field === "payouts" || change.field === "additional_req_pays")
      return "medium";
    return "low";
  }, []);

  // Pagination functions
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  const handleRecordsPerPageChange = useCallback((newLimit) => {
    setRecordsPerPage(newLimit);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Memoized filter options for better performance
  const fieldOptions = useMemo(() => {
    // Use stored all available fields if available, otherwise fall back to current changes
    const fields = allAvailableFields.length > 0 
      ? allAvailableFields 
      : [...new Set(changes.map((change) => change.field).filter(Boolean))].sort();
    console.log('Available field options:', fields);
    return fields;
  }, [allAvailableFields, changes]);

  const changeTypeOptions = useMemo(() => {
    // Use stored all available change types if available, otherwise fall back to current changes
    const types = allAvailableChangeTypes.length > 0 
      ? allAvailableChangeTypes 
      : [...new Set(changes.map((change) => change.changeType).filter(Boolean))].sort();
    return types;
  }, [allAvailableChangeTypes, changes]);

  // Enhanced statistics with better performance
  const statistics = useMemo(() => {
    const stats = {
      total: totalChanges, // Use server total, not client filtered
      byType: {},
      byField: {},
      recent: 0,
      critical: 0,
      uniqueEmployees: new Set(),
    };

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Calculate stats from current page changes only (for display purposes)
    changes.forEach((change) => {
      // Count by type
      const changeType = change.changeType || "unknown";
      stats.byType[changeType] = (stats.byType[changeType] || 0) + 1;

      // Count by field
      const field = change.field || "unknown";
      stats.byField[field] = (stats.byField[field] || 0) + 1;

      // Count recent changes
      if (change.timestamp && new Date(change.timestamp) > oneDayAgo) {
        stats.recent++;
      }

      // Count critical changes
      if (getChangePriority(change) === "high") {
        stats.critical++;
      }

      // Track unique employees
      if (change.employeeID) {
        stats.uniqueEmployees.add(change.employeeID);
      }
    });

    return {
      ...stats,
      uniqueEmployeesCount: stats.uniqueEmployees.size,
    };
  }, [changes, totalChanges, getChangePriority]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterField, filterChangeType, debouncedSearchQuery, dateRangeType, customStartDate, customEndDate]);

  useEffect(() => {
    fetchRecentChanges();
  }, [fetchRecentChanges]);

  // Fetch all available options on mount if not already loaded
  useEffect(() => {
    const fetchAllOptions = async () => {
      if (allAvailableFields.length === 0) {
        try {
          const response = await api.get(`/api/detailed-change-tracking/recent-changes`, {
            params: {
              siteID: actualSiteID,
              limit: 100, // Get more records to ensure we capture all field types
              page: 1,
              dateRange: "thisMonth", // Get broader date range for more field types
            }
          });

          if (response.data?.data?.allChanges) {
            const allChanges = response.data.data.allChanges;
            const allFields = [...new Set(allChanges.map((change) => change.field).filter(Boolean))];
            const allTypes = [...new Set(allChanges.map((change) => change.changeType).filter(Boolean))];
            setAllAvailableFields(allFields.sort());
            setAllAvailableChangeTypes(allTypes.sort());
          }
        } catch (error) {
          console.warn("Failed to fetch all available filter options:", error);
        }
      }
    };

    fetchAllOptions();
  }, [actualSiteID, allAvailableFields.length]);

  // Enhanced change item renderer
  // (Using ChangeItem component instead of inline rendering for better performance)

  // Render grouped changes by time periods using memoized ChangeItem
  const renderGroupedChanges = useCallback(() => {
    const timeGroups = [
      { key: 'today', label: 'Today', icon: FaClock, count: groupedChanges.today?.length || 0 },
      { key: 'yesterday', label: 'Yesterday', icon: FaHistory, count: groupedChanges.yesterday?.length || 0 },
      { key: 'thisWeek', label: 'This Week', icon: FaCalendarAlt, count: groupedChanges.thisWeek?.length || 0 },
      { key: 'older', label: 'Older', icon: FaHistory, count: groupedChanges.older?.length || 0 }
    ];

    return (
      <div className={styles.groupedView}>
        {timeGroups.map(group => {
          if (group.count === 0) return null;
          
          const groupChanges = groupedChanges[group.key] || [];
          const IconComponent = group.icon;
          
          return (
            <div key={group.key} className={styles.timeGroup}>
              <div className={styles.groupHeader}>
                <h3 className={styles.groupTitle}>
                  <IconComponent size={14} />
                  {group.label}
                  <span className={styles.groupCount}>({group.count})</span>
                </h3>
              </div>
              <div className={styles.groupChanges}>
                {groupChanges.map((change, index) => (
                  <ChangeItem
                    key={`${group.key}-${change.id || index}`}
                    change={change}
                    index={index}
                    groupKey={group.key}
                    onItemClick={handleItemClick}
                    getFieldStyle={getFieldStyle}
                    getChangeTypeStyle={getChangeTypeStyle}
                    parseChangeData={parseChangeData}
                    formatTimestamp={formatTimestamp}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [groupedChanges, handleItemClick, getFieldStyle, getChangeTypeStyle, parseChangeData, formatTimestamp, viewMode]);

  return (
    <div className={styles.changeTrackingContainer}>
      <Sidebar activeSection="Change Tracking" />

      <div className={styles.changeTrackingContent}>
        {/* Ultra-Compact Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <div className={styles.titleSection}>
              
              {/* Mini Statistics Row */}
              <div className={styles.statsRow}>
                <div className={styles.miniStatCard} style={{ "--i": 0 }}>
                  <div className={`${styles.miniStatIcon} ${styles.total}`}>
                    <FaListAlt />
                  </div>
                  <div className={styles.miniStatInfo}>
                    <span className={styles.miniStatValue}>
                      {statistics.total}
                    </span>
                    <span className={styles.miniStatLabel}>Total</span>
                  </div>
                </div>

                <div className={styles.miniStatCard} style={{ "--i": 1 }}>
                  <div className={`${styles.miniStatIcon} ${styles.recent}`}>
                    <FaClock />
                  </div>
                  <div className={styles.miniStatInfo}>
                    <span className={styles.miniStatValue}>
                      {statistics.recent}
                    </span>
                    <span className={styles.miniStatLabel}>Recent</span>
                  </div>
                </div>

                <div className={styles.miniStatCard} style={{ "--i": 2 }}>
                  <div className={`${styles.miniStatIcon} ${styles.critical}`}>
                    <FaExclamationTriangle />
                  </div>
                  <div className={styles.miniStatInfo}>
                    <span className={styles.miniStatValue}>
                      {statistics.critical}
                    </span>
                    <span className={styles.miniStatLabel}>Critical</span>
                  </div>
                </div>

                <div className={styles.miniStatCard} style={{ "--i": 3 }}>
                  <div className={`${styles.miniStatIcon} ${styles.employees}`}>
                    <FaUsers />
                  </div>
                  <div className={styles.miniStatInfo}>
                    <span className={styles.miniStatValue}>
                      {statistics.uniqueEmployeesCount}
                    </span>
                    <span className={styles.miniStatLabel}>Employees</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              {actualSiteID && (
                <div className={styles.siteInfo}>
                  <span className={styles.siteLabel}>Site:</span>
                  <span className={styles.siteValue}>{actualSiteID}</span>
                </div>
              )}
              
              {/* Auto-refresh toggle with status */}
              <button
                className={`${styles.toggleButton} ${autoRefresh ? styles.active : ''}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh 
                  ? `Auto-refresh enabled - Next refresh in ${nextRefreshCountdown}s`
                  : "Enable auto-refresh (30s interval)"
                }
                aria-label={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
              >
                <FaBell size={10} />
                {autoRefresh ? `Live ${nextRefreshCountdown}s` : 'Manual'}
              </button>

              {/* Export button */}
              <button
                className={styles.exportButton}
                onClick={exportToCSV}
                title="Export to CSV"
                disabled={changes.length === 0}
                aria-label="Export changes to CSV"
              >
                <FaDownload size={10} />
                Export
              </button>

              {/* Keyboard shortcuts toggle */}
              <button
                className={styles.shortcutsButton}
                onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
                title="Show keyboard shortcuts"
                aria-label="Show keyboard shortcuts"
              >
                <FaKeyboard size={10} />
              </button>

              <button
                className={styles.refreshButton}
                onClick={refreshData}
                disabled={loading}
                title="Refresh data (Ctrl+R)"
                aria-label="Refresh data"
              >
                <FaSync size={12} className={loading ? styles.spinning : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Control Panel - Statistics + Filters Combined */}
        <div className={styles.controlPanel}>
          {/* Mini Filters Row */}
          <div className={styles.filtersRow}>
            <div className={styles.miniFilterGroup}>
              <label className={styles.miniFilterLabel}>
                <FaSearch size={8} style={{ marginRight: '2px' }} />
                Search:
              </label>
              <input
                ref={searchInputRef}
                type="text"
                className={styles.miniSearchInput}
                placeholder="Search changes... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search changes"
              />
            </div>

            <div className={styles.miniFilterGroup}>
              <label className={styles.miniFilterLabel}>Field:</label>
              <select
                className={styles.miniFilterSelect}
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
              >
                <option value="all">All</option>
                {fieldOptions.map((field) => (
                  <option key={field} value={field}>
                    {getFieldStyle(field).label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.miniFilterGroup}>
              <label className={styles.miniFilterLabel}>Type:</label>
              <select
                className={styles.miniFilterSelect}
                value={filterChangeType}
                onChange={(e) => setFilterChangeType(e.target.value)}
              >
                <option value="all">All</option>
                {changeTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {getChangeTypeStyle(type).label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.miniFilterGroup}>
              <label className={styles.miniFilterLabel}>
                <FaCalendarAlt size={8} style={{ marginRight: '2px' }} />
                Date:
              </label>
              <select
                className={styles.miniFilterSelect}
                value={dateRangeType}
                onChange={(e) => setDateRangeType(e.target.value)}
              >
                <option value="1day">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {dateRangeType === "custom" && (
              <>
                <div className={styles.miniFilterGroup}>
                  <label className={styles.miniFilterLabel}>From:</label>
                  <input
                    type="date"
                    className={styles.miniDateInput}
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className={styles.miniFilterGroup}>
                  <label className={styles.miniFilterLabel}>To:</label>
                  <input
                    type="date"
                    className={styles.miniDateInput}
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Actions Row */}
          <div className={styles.actionsRow}>
            <span className={styles.countBadge}>
              Page {currentPage} of {totalPages} ({totalChanges} total)
            </span>
            
            {/* Records per page selector */}
            <div className={styles.miniFilterGroup}>
              <label className={styles.miniFilterLabel}>Per page:</label>
              <select
                className={styles.miniFilterSelect}
                value={recordsPerPage}
                onChange={(e) => handleRecordsPerPageChange(parseInt(e.target.value))}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {dateRangeType && (
              <span className={styles.dateRangeBadge}>
                <FaCalendarAlt size={8} />
                {dateRangeType === "1day" && "Today"}
                {dateRangeType === "7days" && "Last 7 Days"}
                {dateRangeType === "thisMonth" && "This Month"}
                {dateRangeType === "custom" && customStartDate && customEndDate && 
                  `${customStartDate} to ${customEndDate}`}
                {dateRangeType === "custom" && (!customStartDate || !customEndDate) && 
                  "Custom Range"}
              </span>
            )}
            <div className={styles.viewModeToggle}>
              <button
                className={`${styles.viewModeButton} ${viewMode === "chronological" ? styles.active : ""}`}
                onClick={() => setViewMode("chronological")}
                title="Chronological view"
              >
                <FaHistory size={10} />
                Timeline
              </button>
              <button
                className={`${styles.viewModeButton} ${viewMode === "grouped" ? styles.active : ""}`}
                onClick={() => setViewMode("grouped")}
                title="Grouped by time periods"
              >
                <FaListAlt size={10} />
                Grouped
              </button>
            </div>
          </div>
        </div>

        {/* Maximized Main Content Area - 85% of Viewport */}
        <div className={styles.changesCard}>
          <div className={styles.changesHeader}>
            <h2 className={styles.changesTitle}>
              <FaEye />
              Recent Changes
            </h2>
          </div>

          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p className={styles.loadingText}>Loading changes</p>
            </div>
          ) : error ? (
            <div className={styles.emptyState}>
              <FaExclamationTriangle className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>Error Loading Data</h3>
              <p className={styles.emptyDescription}>{error}</p>
              <button className={styles.refreshButton} onClick={refreshData}>
                <FaSync />
                Try Again
              </button>
            </div>
          ) : changes.length === 0 ? (
            <div className={styles.emptyState}>
              <FaHistory className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>No Changes Found</h3>
              <p className={styles.emptyDescription}>
                {searchQuery ||
                filterField !== "all" ||
                filterChangeType !== "all"
                  ? "No changes match your filters."
                  : "No changes available yet."}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.changesList}>
                {viewMode === "grouped" ? (
                  renderGroupedChanges()
                ) : (
                  changes.map((change, index) => (
                    <ChangeItem
                      key={`change-${change.id || index}`}
                      change={change}
                      index={index}
                      onItemClick={handleItemClick}
                      getFieldStyle={getFieldStyle}
                      getChangeTypeStyle={getChangeTypeStyle}
                      parseChangeData={parseChangeData}
                      formatTimestamp={formatTimestamp}
                      viewMode={viewMode}
                    />
                  ))
                )}
              </div>

              {/* Compact Pagination Footer */}
              {totalChanges > 0 && (
                <div className={styles.paginationFooter}>
                  <div className={styles.paginationInfo}>
                    <span className={styles.pageText}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <span className={styles.recordsText}>
                      (Showing {changes.length} of {recordsPerPage} per page, {totalChanges} total)
                    </span>
                  </div>
                  
                  <div className={styles.paginationControls}>
                    <button
                      className={styles.paginationButton}
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!hasPrev}
                      title="Previous page"
                    >
                      <FaChevronLeft size={10} />
                    </button>
                    
                    <button
                      className={styles.paginationButton}
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!hasNext}
                      title="Next page"
                    >
                      <FaChevronRight size={10} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Keyboard Shortcuts Modal */}
        {showKeyboardShortcuts && (
          <div 
            className={styles.modal}
            onClick={() => setShowKeyboardShortcuts(false)}
            role="dialog"
            aria-labelledby="shortcuts-title"
            aria-modal="true"
          >
            <div 
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 id="shortcuts-title">Keyboard Shortcuts</h3>
                <button 
                  className={styles.modalClose}
                  onClick={() => setShowKeyboardShortcuts(false)}
                  aria-label="Close shortcuts modal"
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.shortcutItem}>
                  <kbd>Ctrl + R</kbd>
                  <span>Refresh data</span>
                </div>
                <div className={styles.shortcutItem}>
                  <kbd>Ctrl + F</kbd>
                  <span>Focus search input</span>
                </div>
                <div className={styles.shortcutItem}>
                  <kbd>Escape</kbd>
                  <span>Clear all filters</span>
                </div>
                <div className={styles.shortcutItem}>
                  <kbd>Enter / Space</kbd>
                  <span>Click focused change item</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangeTracking;

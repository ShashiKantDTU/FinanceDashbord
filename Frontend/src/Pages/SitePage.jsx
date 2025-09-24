import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { FaSearch, FaFilter, FaChevronLeft, FaChevronRight, FaDownload, FaCalendarAlt, FaChartLine } from 'react-icons/fa';
import { useParams } from 'react-router-dom';
import CustomSpinner from '../components/CustomSpinner';
import NotificationIcon from '../components/NotificationIcon';
import ChangeTrackingPanel from '../components/ChangeTrackingPanel';

import styles from './SitePage.module.css';
import Sidebar from '../components/Sidebar';
import api from '../utils/api';

/**
 * SitePage Component - Manages employee payment records and site operations
 * 
 * Features:
 * - Employee payment tracking (Advance/Balance)
 * - Monthly data filtering with calendar picker
 * - Search and filter functionality
 * - Pagination for data display
 * - Summary statistics calculation
 * - Export functionality (placeholder)
 */
const SitePage = () => {
    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================
    
    /**
     * Gets current year-month in YYYY-MM format
     * @returns {string} Current year-month (e.g., "2025-05")
     */
    const getCurrentYearMonth = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    /**
     * Gets the site ID from URL parameters
     * @return {string} Site ID from URL params
     * 
     */
    const { siteID } = useParams();

    console.log(`Site ID from URL: ${siteID}`);

    // Initialize current year-month
    const currentYearMonth = getCurrentYearMonth();    // ===========================================
    // MOCK DATA - Replace with API calls in production
    // ===========================================
    
    // ===========================================
    // STATE MANAGEMENT
    // ===========================================
    
    // Main component states
    const [selectedYearMonth, setSelectedYearMonth] = useState(currentYearMonth);
    const [isLoading, setIsLoading] = useState(false);
    const [employeeData, setEmployeeData] = useState([]);
    
    // Calendar picker states
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0 });
    const calendarRef = useRef(null);
    const portalCalendarRef = useRef(null);
    const monthButtonRef = useRef(null);

    // Search and filtering states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all', 'advance', 'balance'
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Notification panel states
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

    // ===========================================
    // DATA FETCHING FUNCTIONS
    // ===========================================
    
    /**
     * Fetches employee data for a specific year-month
     * Currently uses mock data, but prepared for API integration
     * @param {string} yearMonth - Year-month in YYYY-MM format
     * @returns {Array} Employee data array
     */
    const fetchEmployeeData = async (yearMonth , siteID) => {
        setIsLoading(true);
        
        try {
            // TODO: Replace with actual API call when backend is ready
            // const response = await fetch(`/api/employees/${yearMonth}`);
            // const data = await response.json();
              console.log(`Fetching data for year-month: ${yearMonth}`);

            const year = yearMonth.split('-')[0];
            const month = yearMonth.split('-')[1];
            const employees = await api.get(`/api/employee/employeewithpendingpayouts/?month=${month}&year=${year}&siteID=${siteID}`)
            
            // Backend calculation explanation:
            // closing_balance = carryForward + totalWage - totalPayouts
            // - carryForward: previous month's balance (+ or -)
            // - totalWage: current month earnings (rate × attendance + additional pays)
            // - totalPayouts: money already paid to employee this month
            //            // Result interpretation:
            // - closing_balance < 0: Employee owes money (Advance taken)
            // - closing_balance > 0: Employee is owed money (Balance)
            
            // Return data in the expected format
        //     [
        // {
        //     "carry_forwarded": {
        //         "value": -150.5,
        //         "remark": "old month carry forward",
        //         "date": "2025-05-27T05:49:23.012Z"
        //     },
        //     "_id": "6834c4e0c4b6d9c0876d90a6",
        //     "name": "John Smith",
        //     "rate": 30,
        //     "month": 5,
        //     "year": 2025,
        //     "siteID": {
        //         "_id": "6833ff004bd307e45abbfb41",
        //         "sitename": "NewSite"
        //     },
        //     "payouts": [
        //         {
        //             "value": 585,
        //             "remark": "Holiday allowance",
        //             "date": "2025-05-06T01:19:52.307Z",
        //             "createdBy": "user1@company.com",
        //             "_id": "6834c4e0c4b6d9c0876d90a7"
        //         },
        //         {
        //             "value": 124,
        //             "remark": "Performance bonus",
        //             "date": "2025-05-10T16:24:14.397Z",
        //             "createdBy": "user1@company.com",
        //             "_id": "6834c4e0c4b6d9c0876d90a8"
        //         }
        //     ],
        //     "wage": 1758,
        //     "additional_req_pays": [
        //         {
        //             "value": 493,
        //             "remark": "Meal allowance",
        //             "date": "2025-05-14T23:56:28.562Z",
        //             "_id": "6834c4e0c4b6d9c0876d90a9"
        //         },
        //         {
        //             "value": 76,
        //             "remark": "Holiday allowance",
        //             "date": "2025-05-24T00:17:20.074Z",
        //             "_id": "6834c4e0c4b6d9c0876d90aa"
        //         }
        //     ],
        //     "attendance": [
        //         "P3",
        //         "P2",
        //         "P",
        //         "P1",
        //         "P2",
        //         "A1",
        //         "P3",
        //         "P3",
        //         "P2",
        //         "P1",
        //         "P1",
        //         "P3",
        //         "P1",
        //         "P1",
        //         "P2",
        //         "A2",
        //         "P2",
        //         "P3",
        //         "P1",
        //         "P3",
        //         "P2",
        //         "P1",
        //         "P2",
        //         "P1",
        //         "P",
        //         "P1",
        //         "P",
        //         "P",
        //         "P1",
        //         "A2",
        //         "P1"
        //     ],
        //     "closing_balance": 729.5,
        //     "createdBy": "user1@company.com",
        //     "attendanceHistory": {},
        //     "__v": 0,
        //     "createdAt": "2025-05-26T19:45:36.866Z",
        //     "updatedAt": "2025-05-27T05:49:23.091Z",
        //     "totalWage": 1589,
        //     "totalPayouts": 709,
        //     "carryForward": -150.5,
        //     "totalAttendance": 34,
        //     "totalDays": 28,
        //     "totalovertime": 48
        // }]            
            let serialcount = 1;
            const employeesData = employees.data.map(employee => ({
                id: serialcount++,
                name: employee.name,
                payment: Math.abs(employee.closing_balance).toString(), // Show absolute value for clarity
                paymentType: employee.closing_balance < 0 ? 'Advance' : 'Balance', // Use closing_balance to determine type
                rate: employee.rate,
                month: employee.month,
                year: employee.year,
                siteID: employee.siteID._id
            }))









            
            
            setEmployeeData(employeesData);
            
            
        } catch (error) {
            console.error('Error fetching employee data:', error);
            setEmployeeData([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // ===========================================
    // EVENT HANDLERS
    // ===========================================
    
    /**
     * Handles year-month selection change from calendar
     * @param {string} newYearMonth - New year-month selection
     */
    const handleYearMonthChange = useCallback(async (newYearMonth) => {
        setSelectedYearMonth(newYearMonth);
        setShowCalendar(false);
        setCurrentPage(1); // Reset to first page when changing month
        
        // Fetch data for the new year-month
        await fetchEmployeeData(newYearMonth, siteID);
    }, [siteID]);    // ===========================================
    // OPTIMIZED EVENT HANDLERS
    // ===========================================
    
    /**
     * Handles search input changes
     * @param {Event} e - Input change event
     */
    const handleSearchChange = useCallback((e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset to first page when searching
    }, []);

    /**
     * Handles filter type changes (all/advance/balance)
     * @param {string} type - Filter type
     */
    const handleFilterChange = useCallback((type) => {
        setFilterType(type);
        setCurrentPage(1); // Reset to first page when filtering
    }, []);

    /**
     * Handles pagination page changes
     * @param {number} page - Page number to navigate to
     */
    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
    }, []);
    
    /**
     * Handles notification icon click
     */
    const handleNotificationClick = useCallback(() => {
        setIsNotificationPanelOpen(true);
    }, []);

    /**
     * Handles notification panel close
     */
    const handleNotificationPanelClose = useCallback(() => {
        setIsNotificationPanelOpen(false);
    }, []);

    /**
     * Handles calendar toggle with position calculation
     */
    const handleCalendarToggle = useCallback(() => {
        if (!showCalendar && monthButtonRef.current) {
            const rect = monthButtonRef.current.getBoundingClientRect();
            setCalendarPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.right - 280 + window.scrollX // 280px is calendar width, align to right
            });
        }
        setShowCalendar(!showCalendar);
    }, [showCalendar]);
    
    
    // ===========================================
    // CALENDAR UTILITY FUNCTIONS
    // ===========================================
    
    // Month names for calendar display
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    /**
     * Checks if a month should be disabled in the calendar
     * Disables future months and years
     * @param {number} year - Year to check
     * @param {number} month - Month index (0-11) to check
     * @returns {boolean} True if month should be disabled
     */
    const isMonthDisabled = (year, month) => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
        // Disable if year is greater than current year
        if (year > currentYear) return true;
        
        // If same year, disable if month is greater than current month
        if (year === currentYear && month > currentMonth) return true;
        
        return false;
    };

    /**
     * Formats selected year-month for display in the calendar button
     * @returns {string} Formatted display string
     */
    const formatSelectedYearMonthDisplay = () => {
        const [year, month] = selectedYearMonth.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };    /**
     * Handles calendar year navigation - previous year
     */
    const handlePreviousYear = useCallback(() => {
        setCalendarYear(prev => prev - 1);
    }, []);

    /**
     * Handles calendar year navigation - next year
     * Prevents navigation beyond current year
     */
    const handleNextYear = useCallback(() => {
        const currentYear = new Date().getFullYear();
        if (calendarYear < currentYear) {
            setCalendarYear(prev => prev + 1);
        }
    }, [calendarYear]);

    /**
     * Handles month selection from calendar
     * @param {number} monthIndex - Selected month index (0-11)
     */
    const handleMonthSelect = useCallback((monthIndex) => {
        if (isMonthDisabled(calendarYear, monthIndex)) return;
        
        const month = String(monthIndex + 1).padStart(2, '0');
        const newSelectedYearMonth = `${calendarYear}-${month}`;
        handleYearMonthChange(newSelectedYearMonth);
    }, [calendarYear, handleYearMonthChange]);

    // ===========================================
    // DATA PROCESSING AND CALCULATIONS
    // ===========================================
      // ===========================================
    // PERFORMANCE OPTIMIZED CALCULATIONS
    // ===========================================
    
    /**
     * Memoized filtered employees - only recalculates when dependencies change
     */
    const filteredEmployees = useMemo(() => {
        return employeeData.filter(employee => {
            // Check if employee matches search query (name or ID)
            const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 employee.id.toString().includes(searchQuery);
            
            // If "all" filter is selected, return only search matches
            if (filterType === 'all') {
                return matchesSearch;
            }
            
            // Otherwise, match both search and filter type
            return matchesSearch && employee.paymentType.toLowerCase() === filterType.toLowerCase();
        });
    }, [employeeData, searchQuery, filterType]);

    /**
     * Memoized pagination calculations
     */
    const paginationData = useMemo(() => {
        const indexOfLastItem = currentPage * itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - itemsPerPage;
        const currentItems = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
        const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

        // Generate page numbers array for pagination
        const pageNumbers = [];
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
        }

        return {
            indexOfLastItem,
            indexOfFirstItem,
            currentItems,
            totalPages,
            pageNumbers
        };
    }, [filteredEmployees, currentPage, itemsPerPage]);    /**
     * Memoized summary statistics
     */
    const summaryStats = useMemo(() => {
        const totalEmployees = filteredEmployees.length;
        
        // Separate employees by payment type
        const advanceEmployees = filteredEmployees.filter(emp => emp.paymentType === 'Advance');
        const balanceEmployees = filteredEmployees.filter(emp => emp.paymentType === 'Balance');
        
        // Count totals
        const totalAdvancePayments = advanceEmployees.length;
        const totalBalancePayments = balanceEmployees.length;
        
        // Calculate amounts
        const totalAdvanceAmount = advanceEmployees.reduce((sum, emp) => sum + parseInt(emp.payment), 0);
        const totalBalanceAmount = balanceEmployees.reduce((sum, emp) => sum + parseInt(emp.payment), 0);
        const totalPaymentAmount = totalAdvanceAmount + totalBalanceAmount;

        return {
            totalEmployees,
            totalAdvancePayments,
            totalBalancePayments,
            totalAdvanceAmount,
            totalBalanceAmount,
            totalPaymentAmount
        };
    }, [filteredEmployees]);

    // ===========================================
    // EFFECT HOOKS
    // ===========================================
    
    /**
     * Close calendar when clicking outside
     */
    useEffect(() => {
        const handleClickOutside = (event) => {
            const isClickInsideButton = monthButtonRef.current && monthButtonRef.current.contains(event.target);
            const isClickInsideCalendar = portalCalendarRef.current && portalCalendarRef.current.contains(event.target);
            
            if (!isClickInsideButton && !isClickInsideCalendar) {
                setShowCalendar(false);
            }
        };

        if (showCalendar) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCalendar]);

    /**
     * Load data for current year-month on component mount
     */
    useEffect(() => {
        fetchEmployeeData(currentYearMonth, siteID);
        console.log(`Loading data for current year-month: ${currentYearMonth}`);
    }, [currentYearMonth, siteID]);    // ===========================================
    // COMPONENT RENDER
    // ===========================================

    return (
        <div className={styles.sitePageContainer}>
            <Sidebar activeSection="Site Management" />
            <div className={styles.sitePageContent}>
                {/* Page Header Section */}
                <div className={styles.header}>
                    <div className={styles.headerTop}>
                        <div className={styles.headerText}>
                            <h1>Site Management</h1>
                            <p>Manage and monitor employee payments and site operations</p>
                        </div>
                        
                        {/* Notification and Controls Section */}
                        <div className={styles.headerControls}>
                            {/* Notification Icon */}
                            <NotificationIcon 
                                siteID={siteID}
                                onClick={handleNotificationClick}
                            />
                            
                            {/* Detailed Change Tracking Button */}
                            <Link 
                                to={`/change-tracking/${siteID}`}
                                className={styles.changeTrackingButton}
                                title="View detailed change tracking"
                            >
                                <FaChartLine />
                                <span>Detailed View</span>
                            </Link>
                            
                            {/* Month/Year Selector with Calendar */}
                            <div className={styles.monthSelector} ref={calendarRef}>
                                <button 
                                    ref={monthButtonRef}
                                    type="button"
                                    className={styles.monthButton}
                                    onClick={handleCalendarToggle}
                                    disabled={isLoading}
                                    aria-label="Select month and year"
                                >
                                    <FaCalendarAlt />
                                    <span>{formatSelectedYearMonthDisplay()}</span>
                                    <svg 
                                        className={`${styles.chevron} ${showCalendar ? styles.chevronUp : ''}`}
                                        width="16" 
                                        height="16" 
                                        viewBox="0 0 16 16" 
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path 
                                            d="M4 6L8 10L12 6" 
                                            stroke="currentColor" 
                                            strokeWidth="2" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                                
                                {/* Calendar Dropdown */}
                                {showCalendar && ReactDOM.createPortal(
                                    <div 
                                        ref={portalCalendarRef}
                                        className={styles.calendarDropdown}
                                        style={{
                                            top: `${calendarPosition.top}px`,
                                            left: `${calendarPosition.left}px`
                                        }}
                                    >
                                        {/* Calendar Header with Year Navigation */}
                                        <div className={styles.calendarHeader}>
                                            <button 
                                                type="button"
                                                className={styles.yearNavButton}
                                                onClick={handlePreviousYear}
                                                aria-label="Previous year"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                    <path 
                                                        d="M10 12L6 8L10 4" 
                                                        stroke="currentColor" 
                                                        strokeWidth="2" 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                            <span className={styles.yearDisplay}>{calendarYear}</span>
                                            <button 
                                                type="button"
                                                className={styles.yearNavButton}
                                                onClick={handleNextYear}
                                                disabled={calendarYear >= new Date().getFullYear()}
                                                aria-label="Next year"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                    <path 
                                                        d="M6 4L10 8L6 12" 
                                                        stroke="currentColor" 
                                                        strokeWidth="2" 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                        
                                        {/* Month Grid */}
                                        <div className={styles.monthGrid}>
                                            {monthNames.map((monthName, index) => {
                                                const disabled = isMonthDisabled(calendarYear, index);
                                                const isSelected = selectedYearMonth === `${calendarYear}-${String(index + 1).padStart(2, '0')}`;
                                                const isCurrent = calendarYear === new Date().getFullYear() && index === new Date().getMonth();
                                                
                                                return (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        className={`${styles.monthCell} ${
                                                            disabled ? styles.monthDisabled : ''
                                                        } ${
                                                            isSelected ? styles.monthSelected : ''
                                                        } ${
                                                            isCurrent ? styles.monthCurrent : ''
                                                        }`}
                                                        onClick={() => handleMonthSelect(index)}
                                                        disabled={disabled}
                                                        aria-label={`Select ${monthName} ${calendarYear}`}
                                                    >
                                                        {monthName.slice(0, 3)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>,
                                    document.body
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Dashboard Content */}
                <div className={styles.dashboardContainer}>
                    {/* Statistics Cards Row */}
                    <div className={styles.statsRow}>                        {/* Total Employees Card */}
                        <div className={styles.statCard}>
                            <div className={styles.statCardInner}>
                                <div className={styles.statInfo}>
                                    <div className={styles.statLabel}>Total Employees</div>
                                    <div className={styles.statNumber}>{summaryStats.totalEmployees}</div>
                                </div>
                                <div className={styles.statIconBox}>
                                    <div className={styles.statIcon} style={{ background: 'rgba(77, 122, 240, 0.1)', color: '#4D7AF0' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                                            <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                            <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.statProgress}>
                                <div className={styles.statProgressBar} style={{ width: '100%', background: '#4D7AF0' }}></div>
                            </div>
                        </div>                        {/* Total Advance Payments Card */}
                        <div className={styles.statCard}>
                            <div className={styles.statCardInner}>
                                <div className={styles.statInfo}>
                                    <div className={styles.statLabel}>Total Advance Payments</div>
                                    <div className={styles.statNumber}>₹{summaryStats.totalAdvanceAmount.toLocaleString()}</div>
                                </div>
                                <div className={styles.statIconBox}>
                                    <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                                            <path d="M16 14H8M12 10H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.statProgress}>
                                <div 
                                    className={styles.statProgressBar} 
                                    style={{ 
                                        width: `${(summaryStats.totalAdvanceAmount / (summaryStats.totalPaymentAmount || 1) * 100)}%`, 
                                        background: '#10B981' 
                                    }}
                                ></div>
                            </div>
                        </div>                        {/* Total Balance Payments Card */}
                        <div className={styles.statCard}>
                            <div className={styles.statCardInner}>
                                <div className={styles.statInfo}>
                                    <div className={styles.statLabel}>Total Balance Payments</div>
                                    <div className={styles.statNumber}>₹{summaryStats.totalBalanceAmount.toLocaleString()}</div>
                                </div>
                                <div className={styles.statIconBox}>
                                    <div className={styles.statIcon} style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#F97316' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                                            <path d="M16 14H8M16 10H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.statProgress}>
                                <div 
                                    className={styles.statProgressBar} 
                                    style={{ 
                                        width: `${(summaryStats.totalBalanceAmount / (summaryStats.totalPaymentAmount || 1) * 100)}%`, 
                                        background: '#F97316' 
                                    }}
                                ></div>
                            </div>
                        </div>                        {/* Total Payment Card */}
                        <div className={styles.statCard}>
                            <div className={styles.statCardInner}>
                                <div className={styles.statInfo}>
                                    <div className={styles.statLabel}>Total Payment</div>
                                    <div className={styles.statNumber}>₹{summaryStats.totalPaymentAmount.toLocaleString()}</div>
                                </div>
                                <div className={styles.statIconBox}>
                                    <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.statProgress}>
                                <div className={styles.statProgressBar} style={{ width: '100%', background: '#8B5CF6' }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Employee Table Section */}
                    <div className={styles.tableContainer}>                        {/* Table Header with Controls */}
                        <div className={styles.tableHeader}>
                            <h2>Employee Payment Records</h2>
                            <div className={styles.tableControls}>
                                {/* Search Bar */}                                <div className={styles.searchBar}>
                                    <FaSearch className={styles.searchIcon} aria-hidden="true" />
                                    <input 
                                        type="text" 
                                        placeholder="Search name or ID..." 
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        className={styles.searchInput}
                                        aria-label="Search employees by name or ID"
                                    />
                                </div>
                                  {/* Filter Controls */}                                <div className={styles.filterControls}>
                                    <button 
                                        className={`${styles.filterButton} ${filterType === 'all' ? styles.active : ''}`}
                                        onClick={() => handleFilterChange('all')}
                                        aria-pressed={filterType === 'all'}
                                    >
                                        All
                                    </button>
                                    <button 
                                        className={`${styles.filterButton} ${filterType === 'advance' ? styles.active : ''}`}
                                        onClick={() => handleFilterChange('advance')}
                                        aria-pressed={filterType === 'advance'}
                                    >
                                        Advance
                                    </button>
                                    <button 
                                        className={`${styles.filterButton} ${filterType === 'balance' ? styles.active : ''}`}
                                        onClick={() => handleFilterChange('balance')}
                                        aria-pressed={filterType === 'balance'}
                                    >
                                        Balance
                                    </button>
                                </div>
                            </div>
                        </div>
                          {/* Employee Data Table */}
                        <div className={styles.tableWrapper}>
                            <table className={styles.employeeTable}>
                                <thead>
                                    <tr>
                                        <th className={styles.idCell}>ID</th>
                                        <th className={styles.nameCell}>Employee Name</th>
                                        <th className={styles.amountCell}>Amount</th>
                                        <th className={styles.typeCell}>Payment Type</th>
                                        <th className={styles.actionCell}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginationData.currentItems.length > 0 ? (
                                        paginationData.currentItems.map((employee) => (
                                            <tr key={employee.id}>
                                                <td className={styles.idCell}>{employee.id}</td>
                                                <td className={styles.nameCell}>{employee.name}</td>
                                                <td className={styles.amountCell}>
                                                    ₹{parseInt(employee.payment).toLocaleString()}
                                                </td>
                                                <td className={styles.typeCell}>
                                                    <span className={`${styles.badge} ${styles[employee.paymentType.toLowerCase()]}`}>
                                                        {employee.paymentType}
                                                    </span>
                                                </td>
                                                <td className={styles.actionCell}>
                                                    <button 
                                                        className={styles.viewButton} 
                                                        aria-label={`View ${employee.name}'s details`}
                                                        onClick={() => {/* Add view handler here */}}
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className={styles.noData}>
                                                {isLoading ? (
                                                    <div className={styles.loadingTable}>
                                                        <CustomSpinner size={60} color="#059669" />
                                                    </div>
                                                ) : (
                                                    <div className={styles.noDataFound}>
                                                        No employees found matching your criteria
                                                    </div>
                                                )}
                                            </td>
                                        </tr>                                    )}
                                </tbody>
                            </table>
                        </div>
                          {/* Combined Modern Footer with Pagination and Info */}
                        <div className={styles.combinedFooter}>
                            {/* Left: Entry Info */}
                            <div className={styles.footerInfo}>
                                Showing {paginationData.indexOfFirstItem + 1} to {Math.min(paginationData.indexOfLastItem, filteredEmployees.length)} of {filteredEmployees.length} entries
                            </div>
                            
                            {/* Center: Pagination Controls */}
                            {paginationData.totalPages > 1 && (
                                <div className={styles.paginationControls}>
                                    <button 
                                        className={styles.paginationButton} 
                                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        aria-label="Previous page"                                    >
                                        <FaChevronLeft aria-hidden="true" />
                                    </button>
                                    
                                    <div className={styles.pageNumbers}>
                                        {paginationData.pageNumbers.map(number => (
                                            <button
                                                key={number}
                                                className={`${styles.pageNumber} ${currentPage === number ? styles.activePage : ''}`}
                                                onClick={() => handlePageChange(number)}
                                                aria-label={`Page ${number}`}
                                                aria-current={currentPage === number ? 'page' : undefined}
                                            >
                                                {number}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <button 
                                        className={styles.paginationButton} 
                                        onClick={() => handlePageChange(Math.min(paginationData.totalPages, currentPage + 1))}
                                        disabled={currentPage === paginationData.totalPages}
                                        aria-label="Next page"
                                    >
                                        <FaChevronRight aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                            
                            {/* Right: Items Per Page Selector */}
                            <div className={styles.itemsPerPageSelector}>
                                <label htmlFor="itemsPerPage">Per page:</label>
                                <select 
                                    id="itemsPerPage"
                                    value={itemsPerPage} 
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1); // Reset to first page when changing items per page
                                    }}
                                    aria-label="Items per page"                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Change Tracking Notification Panel */}
            <ChangeTrackingPanel 
                isOpen={isNotificationPanelOpen}
                onClose={handleNotificationPanelClose}
                siteID={siteID}
            />
        </div>
    );
}

export default SitePage;
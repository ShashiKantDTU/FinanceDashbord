import React, { memo, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import AttendanceRow from './AttendanceRow';
import styles from '../Pages/Attendance.module.css';

// Highly optimized virtualized attendance table
const VirtualizedAttendanceTable = memo(({ 
    filteredAttendanceData,
    attendanceData, // Original full data for correct indexing
    selectedMonth,
    isEditMode,
    shouldShowInputs,
    setVisibleRows,
    onAttendanceChange,
    onDeleteEmployee,
    validAttendanceOptions
}) => {
    const tableRef = useRef(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
    const rowHeight = 60; // Approximate row height in pixels
    const overscan = 5; // Render extra rows for smooth scrolling
    
    // Memoized table header with merged day and date
    const tableHeader = useMemo(() => {
        const [year, month] = selectedMonth.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        // Helper to get day of week string
        const getDayOfWeek = (y, m, d) => {
            const date = new Date(y, m - 1, d);
            return date.toLocaleDateString('en-US', { weekday: 'short' }); // e.g., Mon, Tue
        };
        return (
            <thead>
                <tr>
                    <th className={styles.stickyColumn}>ID</th>
                    <th className={styles.stickyColumn}>Employee Name</th>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                        const dateObj = new Date(year, month - 1, i + 1);
                        const isSunday = dateObj.getDay() === 0;
                        return (
                            <th
                                key={i + 1}
                                className={
                                    styles.dayColumn + ' ' +
                                    styles.compactDayHeader +
                                    (isSunday ? ' ' + styles.sundayHeader : '')
                                }
                            >
                                <div className={styles.compactDayHeaderContent}>
                                    <span
                                        className={
                                            styles.dayOfWeek + (isSunday ? ' ' + styles.sundayHeader : '')
                                        }
                                    >
                                        {getDayOfWeek(year, month, i + 1)}
                                    </span>
                                    <span className={styles.dayNumber}>{i + 1}</span>
                                </div>
                            </th>
                        );
                    })}
                    <th className={styles.summaryColumn}>Present</th>
                    <th className={styles.summaryColumn}>Overtime (hrs)</th>
                    <th className={styles.summaryColumn}>Absent</th>
                    <th className={styles.summaryColumn}>Final Days</th>
                    <th className={styles.summaryColumn}>Payment (₹)</th>
                    {!isEditMode && <th className={styles.summaryColumn}>Actions</th>}
                </tr>
            </thead>
        );
    }, [selectedMonth, isEditMode]);

    // Calculate visible rows based on scroll position
    const updateVisibleRange = useCallback(() => {
        if (!tableRef.current) return;
        
        const container = tableRef.current.closest(`.${styles.tableWrapper}`);
        if (!container) return;
        
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        
        const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / rowHeight) + (overscan * 2);
        const end = Math.min(filteredAttendanceData.length, start + visibleCount);
        
        setVisibleRange({ start, end });
        
        // Update visible rows for progressive edit mode
        const visibleIndices = [];
        for (let i = start; i < end; i++) {
            const employee = filteredAttendanceData[i];
            if (!employee) continue;
            
            // Find the original index of this employee in the full attendanceData
            const originalIndex = attendanceData.findIndex(emp => 
                (emp.id || emp._id) === (employee.id || employee._id)
            );
            
            if (originalIndex >= 0) {
                visibleIndices.push(originalIndex);
            }
        }
        setVisibleRows(visibleIndices);
    }, [filteredAttendanceData, attendanceData, setVisibleRows]);

    // Set up scroll listener
    useEffect(() => {
        const container = tableRef.current?.closest(`.${styles.tableWrapper}`);
        if (!container) return;
        
        // Initial calculation
        updateVisibleRange();
        
        // Throttled scroll handler
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    updateVisibleRange();
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        container.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updateVisibleRange);
        
        return () => {
            container.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', updateVisibleRange);
        };
    }, [updateVisibleRange]);

    // Memoized visible rows only
    const visibleRows = useMemo(() => {
        const rows = [];
        const { start, end } = visibleRange;
        
        // Calculate proper column count for spacer rows
        const daysInMonth = new Date(
            selectedMonth.split('-')[0], 
            selectedMonth.split('-')[1], 
            0
        ).getDate();
        const columnCount = 2 + daysInMonth + 5 + (isEditMode ? 0 : 1); // ID + Name + Days + Summary cols + Actions
        
        // Spacer before visible rows
        if (start > 0) {
            rows.push(
                <tr key="spacer-top" className={styles.virtualTableSpacer} data-spacer="true" 
                    style={{ '--spacer-height': `${start * rowHeight}px` }}>
                    <td colSpan={columnCount}></td>
                </tr>
            );
        }
        
        // Render only visible rows
        for (let i = start; i < end; i++) {
            const employee = filteredAttendanceData[i];
            if (!employee) continue;
            
            // Find the original index of this employee in the full attendanceData
            // This ensures progressive edit mode works correctly with search
            const originalIndex = attendanceData.findIndex(emp => 
                (emp.id || emp._id) === (employee.id || employee._id)
            );
            
            rows.push(
                <AttendanceRow
                    key={employee.id || employee._id || i}
                    employee={employee}
                    employeeIndex={originalIndex >= 0 ? originalIndex : i}
                    selectedMonth={selectedMonth}
                    isRowInEditMode={shouldShowInputs}
                    onAttendanceChange={onAttendanceChange}
                    onDeleteEmployee={onDeleteEmployee}
                    validAttendanceOptions={validAttendanceOptions}
                />
            );
        }
        
        // Spacer after visible rows
        const remaining = filteredAttendanceData.length - end;
        if (remaining > 0) {
            rows.push(
                <tr key="spacer-bottom" className={styles.virtualTableSpacer} data-spacer="true"
                    style={{ '--spacer-height': `${remaining * rowHeight}px` }}>
                    <td colSpan={columnCount}></td>
                </tr>
            );
        }
        
        return rows;
    }, [visibleRange, filteredAttendanceData, attendanceData, selectedMonth, shouldShowInputs, onAttendanceChange, onDeleteEmployee, validAttendanceOptions, isEditMode]);

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.attendanceTable} ref={tableRef}>
                {tableHeader}
                <tbody>
                    {visibleRows}
                </tbody>
            </table>
        </div>
    );
});

VirtualizedAttendanceTable.displayName = 'VirtualizedAttendanceTable';

export default VirtualizedAttendanceTable;

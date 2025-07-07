import React, { memo, useMemo, useCallback } from 'react';
import styles from '../Pages/Attendance.module.css';
import HighPerformanceAttendanceCell from './HighPerformanceAttendanceCell';

// Memoized individual attendance row component to prevent unnecessary re-renders
const AttendanceRow = memo(({ 
    employee, 
    employeeIndex, 
    selectedMonth, 
    isRowInEditMode, // New prop to check if this specific row is in edit mode
    onAttendanceChange,
    onDeleteEmployee,
    validAttendanceOptions 
}) => {
    // Memoized attendance calculations - only recalculate when attendance data changes
    const attendanceStats = useMemo(() => {
        const attendanceArray = employee.attendance || [];
        
        // Calculate Total Present Days
        const totalPresentCount = attendanceArray.reduce((acc, status) => {
            return acc + (status && status.toUpperCase().includes('P') ? 1 : 0);
        }, 0);

        // Calculate Total Overtime Hours
        const totalOvertimeHours = attendanceArray.reduce((acc, status) => {
            if (status && status.length > 1) {
                const overtimePart = status.substring(1);
                const hours = parseInt(overtimePart, 10);
                return acc + (isNaN(hours) ? 0 : hours);
            }
            return acc;
        }, 0);

        // Calculate Total Absent Days
        const totalAbsentCount = attendanceArray.reduce((acc, status) => {
            return acc + (status && status.toUpperCase().includes('A') ? 1 : 0);
        }, 0);
        
        // Calculate Final Attendance Days
        const overtimeDaysEquivalent = Math.floor(totalOvertimeHours / 8);
        const remainingOvertimeHoursPart = totalOvertimeHours % 8;
        const remainingOvertimeDecimalContribution = remainingOvertimeHoursPart / 10;
        const finalAttendanceDays = totalPresentCount + overtimeDaysEquivalent + remainingOvertimeDecimalContribution;

        // Calculate Payment
        const dailyRate = employee.rate || 550;
        const paymentAmount = (finalAttendanceDays * dailyRate).toFixed(2);

        return {
            totalPresentCount,
            totalOvertimeHours,
            totalAbsentCount,
            finalAttendanceDays,
            paymentAmount
        };
    }, [employee.attendance, employee.rate]);

    // Memoized days in month calculation
    const daysInMonth = useMemo(() => {
        const [year, month] = selectedMonth.split('-');
        return new Date(year, month, 0).getDate();
    }, [selectedMonth]);

    // Memoized delete handler
    const handleDelete = useCallback(() => {
        onDeleteEmployee(employee);
    }, [employee, onDeleteEmployee]);

    // Memoized attendance change handler
    const handleAttendanceChange = useCallback((dayIndex, newValue) => {
        onAttendanceChange(employeeIndex, dayIndex, newValue);
    }, [employeeIndex, onAttendanceChange]);

    return (
        <tr>
            <td className={styles.stickyColumn}>{employee.id}</td>
            <td className={styles.stickyColumn}>{employee.name}</td>
            
            {/* Daily Attendance Cells */}
            {Array.from({ length: daysInMonth }, (_, dayCellIndex) => {
                const [year, month] = selectedMonth.split('-');
                const dateObj = new Date(year, month - 1, dayCellIndex + 1);
                const isSunday = dateObj.getDay() === 0;
                return (
                    <HighPerformanceAttendanceCell
                        key={dayCellIndex}
                        dayIndex={dayCellIndex}
                        value={employee.attendance?.[dayCellIndex] || ''}
                        isEditMode={typeof isRowInEditMode === 'function' ? isRowInEditMode(employeeIndex) : false}
                        validAttendanceOptions={validAttendanceOptions}
                        onChange={handleAttendanceChange}
                        isSunday={isSunday}
                    />
                );
            })}
            
            {/* Summary Columns */}
            <td className={styles.summaryColumn}>{attendanceStats.totalPresentCount}</td>
            <td className={styles.summaryColumn}>{attendanceStats.totalOvertimeHours}</td>
            <td className={styles.summaryColumn}>{attendanceStats.totalAbsentCount}</td>
            <td className={styles.summaryColumn}>{attendanceStats.finalAttendanceDays.toFixed(1)}</td>
            <td className={styles.summaryColumn}>₹{attendanceStats.paymentAmount}</td>
            
            {!(typeof isRowInEditMode === 'function' && isRowInEditMode(employeeIndex)) && (
                <td className={styles.summaryColumn}>
                    <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={handleDelete}
                        title={`Delete ${employee.name}`}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                                d="M6.5 1H9.5A1 1 0 0 1 10.5 2V3H13A0.5 0.5 0 0 1 13 4H12V13A2 2 0 0 1 10 15H6A2 2 0 0 1 4 13V4H3A0.5 0.5 0 0 1 3 3H5.5V2A1 1 0 0 1 6.5 1ZM5.5 4V13A1 1 0 0 0 6.5 14H9.5A1 1 0 0 0 10.5 13V4H5.5ZM7 6A0.5 0.5 0 0 1 7.5 6.5V11.5A0.5 0.5 0 0 1 6.5 11.5V6.5A0.5 0.5 0 0 1 7 6ZM9 6A0.5 0.5 0 0 1 9.5 6.5V11.5A0.5 0.5 0 0 1 8.5 11.5V6.5A0.5 0.5 0 0 1 9 6Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </td>
            )}
        </tr>
    );
});

AttendanceRow.displayName = 'AttendanceRow';

export default AttendanceRow;

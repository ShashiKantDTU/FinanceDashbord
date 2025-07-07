import React, { memo, useCallback, useMemo, useRef } from 'react';
import styles from '../Pages/Attendance.module.css';

// Ultra-optimized attendance input cell component
const HighPerformanceAttendanceCell = memo(({ 
    dayIndex, 
    value, 
    isEditMode, 
    validAttendanceOptions, 
    onChange,
    isSunday
}) => {
    const inputRef = useRef(null);
    const previousValueRef = useRef(value);
    
    // Memoized change handler with debouncing
    const handleChange = useCallback((e) => {
        const newValue = e.target.value.toUpperCase();
        
        // Only update if value actually changed
        if (newValue !== previousValueRef.current) {
            previousValueRef.current = newValue;
            onChange(dayIndex, newValue);
        }
    }, [dayIndex, onChange]);
    
    // Optimized key handler for better UX
    const handleKeyDown = useCallback((e) => {
        const input = e.target;
        
        // Tab to next cell
        if (e.key === 'Tab') {
            e.preventDefault();
            const nextInput = input.closest('tr')?.querySelector(`input[data-day="${dayIndex + 1}"]`);
            if (nextInput) {
                nextInput.focus();
            }
        }
        
        // Enter to next row same day
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextRow = input.closest('tr')?.nextElementSibling;
            const sameColumnInput = nextRow?.querySelector(`input[data-day="${dayIndex}"]`);
            if (sameColumnInput) {
                sameColumnInput.focus();
            }
        }
        
        // Quick shortcuts
        if (e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            input.value = 'P';
            handleChange(e);
        }
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            input.value = 'A';
            handleChange(e);
        }
    }, [dayIndex, handleChange]);
    
    // Memoized cell style calculation
    const cellStyle = useMemo(() => {
        const baseStyle = styles.dayColumn;
        if (value) {
            if (value.toUpperCase().includes('P')) return `${baseStyle} ${styles.present}`;
            if (value.toUpperCase().includes('A')) return `${baseStyle} ${styles.absent}`;
        }
        return `${baseStyle} ${styles.notMarked}`;
    }, [value]);
    
    // Memoized validation
    const isInvalid = useMemo(() => {
        if (!value) return false;
        // Accept lower and uppercase by comparing uppercase
        return !validAttendanceOptions.includes(value.toUpperCase());
    }, [value, validAttendanceOptions]);
    
    // Removed auto-focus effect to prevent scrolling focus issues
    // Focus should only be triggered by user interaction (clicking, tabbing)
    
    if (isEditMode) {
        return (
            <td className={cellStyle + (isSunday ? ' ' + styles.sundayCell : '')}>
                <input
                    ref={inputRef}
                    type="text"
                    className={`${styles.attendanceInput} ${isInvalid ? styles.invalidInput : ''}`}
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    data-day={dayIndex}
                    placeholder="-"
                    maxLength="3"
                    title={`Valid: ${validAttendanceOptions.join(', ')} | Shortcuts: P, A | Tab: Next cell | Enter: Same column next row`}
                    autoComplete="off"
                    spellCheck="false"
                />
            </td>
        );
    }
    
    return (
        <td className={cellStyle + (isSunday ? ' ' + styles.sundayCell : '')}>
            <span className={styles.attendanceStatus}>
                {value || '-'}
            </span>
        </td>
    );
});

HighPerformanceAttendanceCell.displayName = 'HighPerformanceAttendanceCell';

export default HighPerformanceAttendanceCell;

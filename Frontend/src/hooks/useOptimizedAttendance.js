import { useCallback, useMemo, useRef } from 'react';
import { useToast } from '../components/ToastProvider';

// Custom hook for optimized attendance management
export const useOptimizedAttendance = (attendanceData, setAttendanceData, originalAttendanceData, setChanges, isEditMode) => {
    const { showWarning } = useToast();
    
    // Memoized valid attendance options
    const validAttendanceOptions = useMemo(() => {
        const options = ['P', 'A'];
        for (let i = 1; i <= 23; i++) {
            options.push(`P${i}`);
            options.push(`A${i}`);
        }
        return options;
    }, []);

    // Use refs to batch updates and prevent unnecessary re-renders
    const pendingChangesRef = useRef(new Map());
    const batchTimeoutRef = useRef(null);

    // Optimized attendance change handler with debouncing
    const handleAttendanceChange = useCallback((employeeIndex, dayIndex, newValue) => {
        if (!isEditMode) return;
        
        // Validate input
        if (newValue && !validAttendanceOptions.includes(newValue)) {
            showWarning(`Invalid attendance code: ${newValue}. Valid codes: P, A, P1-P23, A1-A23`);
            return;
        }

        // Create a unique key for this change
        const changeKey = `${employeeIndex}-${dayIndex}`;
        
        // Store the change in pending changes
        pendingChangesRef.current.set(changeKey, {
            employeeIndex,
            dayIndex,
            newValue,
            timestamp: Date.now()
        });

        // Clear existing timeout
        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
        }

        // Batch the updates with a small delay to prevent excessive re-renders
        batchTimeoutRef.current = setTimeout(() => {
            const pendingChanges = Array.from(pendingChangesRef.current.values());
            
            if (pendingChanges.length === 0) return;

            // Apply all pending changes in a single state update
            setAttendanceData(prevData => {
                const newData = [...prevData];
                const changesToTrack = [];

                pendingChanges.forEach(({ employeeIndex, dayIndex, newValue }) => {
                    if (newData[employeeIndex] && newData[employeeIndex].attendance) {
                        const currentEmployee = newData[employeeIndex];
                        const oldValue = currentEmployee.attendance[dayIndex] || '';
                        
                        // Only update if value actually changed
                        if (oldValue !== newValue) {
                            // Create a new attendance array for this employee only
                            newData[employeeIndex] = {
                                ...currentEmployee,
                                attendance: [...currentEmployee.attendance]
                            };
                            newData[employeeIndex].attendance[dayIndex] = newValue;

                            // Track change for confirmation dialog
                            const originalValue = originalAttendanceData[employeeIndex]?.attendance[dayIndex] || '';
                            if (originalValue !== newValue) {
                                changesToTrack.push({
                                    employeeIndex,
                                    employeeName: currentEmployee.name,
                                    day: dayIndex + 1,
                                    oldValue: originalValue,
                                    newValue: newValue
                                });
                            }
                        }
                    }
                });

                // Update changes tracking
                if (changesToTrack.length > 0) {
                    setChanges(prevChanges => {
                        const newChanges = [...prevChanges];
                        
                        changesToTrack.forEach(change => {
                            // Remove any existing change for this employee/day combination
                            const existingIndex = newChanges.findIndex(
                                c => c.employeeIndex === change.employeeIndex && c.day === change.day
                            );
                            
                            if (existingIndex !== -1) {
                                newChanges.splice(existingIndex, 1);
                            }
                            
                            // Add the new change if it's different from original
                            if (change.oldValue !== change.newValue) {
                                newChanges.push(change);
                            }
                        });
                        
                        return newChanges;
                    });
                }

                return newData;
            });

            // Clear pending changes
            pendingChangesRef.current.clear();
        }, 150); // 150ms debounce delay
    }, [isEditMode, validAttendanceOptions, setAttendanceData, originalAttendanceData, setChanges, showWarning]);

    // Cleanup timeout on unmount
    const cleanup = useCallback(() => {
        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
        }
    }, []);

    return {
        handleAttendanceChange,
        validAttendanceOptions,
        cleanup
    };
};

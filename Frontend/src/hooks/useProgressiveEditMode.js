import { useState, useCallback, useRef } from 'react';

// Custom hook for highly optimized progressive edit mode
export const useProgressiveEditMode = (totalEmployees) => {
    const [isEditMode, setIsEditMode] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [enabledRows, setEnabledRows] = useState(new Set());
    
    // Track visible viewport for optimization
    const visibleRowsRef = useRef(new Set());
    
    // Immediate edit mode activation with deferred input rendering
    const enableEditMode = useCallback(async () => {
        if (totalEmployees === 0) return;
        
        setIsTransitioning(true);
        setIsEditMode(true);
        
        // Step 1: Immediately show edit mode UI (buttons, etc.)
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Step 2: Enable only visible rows first (viewport optimization)
        const visibleRows = Array.from(visibleRowsRef.current);
        if (visibleRows.length > 0) {
            setEnabledRows(new Set(visibleRows));
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        // Step 3: Enable remaining rows in micro-batches (only 3 rows at a time)
        const remainingRows = [];
        for (let i = 0; i < totalEmployees; i++) {
            if (!visibleRows.includes(i)) {
                remainingRows.push(i);
            }
        }
        
        // Process in micro-batches of 3 rows with minimal delay
        for (let i = 0; i < remainingRows.length; i += 3) {
            const batch = remainingRows.slice(i, i + 3);
            
            setEnabledRows(prev => {
                const newSet = new Set(prev);
                batch.forEach(rowIndex => newSet.add(rowIndex));
                return newSet;
            });
            
            // Much smaller delay - only 5ms between micro-batches
            if (i + 3 < remainingRows.length) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
        
        setIsTransitioning(false);
    }, [totalEmployees]);
    
    // Instant disable with cleanup
    const disableEditMode = useCallback(() => {
        setIsEditMode(false);
        setEnabledRows(new Set());
        setIsTransitioning(false);
        visibleRowsRef.current.clear();
    }, []);
    
    // Track visible rows for viewport optimization
    const setVisibleRows = useCallback((visibleRowIndices) => {
        visibleRowsRef.current = new Set(visibleRowIndices);
    }, []);
    
    // Optimized row check
    const isRowInEditMode = useCallback((rowIndex) => {
        return isEditMode && enabledRows.has(rowIndex);
    }, [isEditMode, enabledRows]);
    
    // Check if row should show edit inputs (more restrictive)
    const shouldShowInputs = useCallback((rowIndex) => {
        return isEditMode && !isTransitioning && enabledRows.has(rowIndex);
    }, [isEditMode, isTransitioning, enabledRows]);
    
    return {
        isEditMode,
        isTransitioning,
        enableEditMode,
        disableEditMode,
        isRowInEditMode,
        shouldShowInputs,
        setVisibleRows,
        enabledRowsCount: enabledRows.size
    };
};

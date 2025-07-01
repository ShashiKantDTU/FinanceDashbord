/**
 * Optimized Change Tracker Utility Module
 * 
 * This module provides lightweight, precise change tracking that stores only the exact changes made.
 * Features:
 * - Tracks only critical fields: attendance, payouts, additional_req_pays
 * - Stores minimal diff data instead of full document snapshots
 * - Creates separate log entries for each field change
 * - Uses synthetic keys for arrays without _id
 * - Optimized for storage efficiency and audit clarity
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// Import the Optimized ChangeTracking model
const ChangeTracking = require('../models/OptimizedChangeTrackingSchema');

/**
 * Generate a synthetic unique key for objects without _id
 * Uses a more flexible approach to match payment objects for modification detection
 * @param {Object} item - The item to generate key for
 * @returns {String} Unique key
 */
const generateSyntheticKey = (item) => {
    if (!item) return null;
    
    // For payouts and additional_req_pays: use date + createdBy + value + remark as primary key
    // This ensures uniqueness even when multiple payments are made on the same date by the same user
    if (item.date && item.createdBy) {
        const dateStr = new Date(item.date).toISOString().split('T')[0]; // YYYY-MM-DD
        const valueStr = String(item.value || 0);
        const remarkStr = String(item.remark || '').substring(0, 20); // Increased length for better uniqueness
        return `${dateStr}_${item.createdBy}_${valueStr}_${remarkStr}`;
    }
    
    // Fallback: use value + remark + date for partial matching
    if (item.value !== undefined && item.remark && item.date) {
        const valueStr = String(item.value);
        const remarkStr = String(item.remark).substring(0, 20);
        const dateStr = new Date(item.date).toISOString().split('T')[0];
        return `${valueStr}_${remarkStr}_${dateStr}`;
    }
    
    // Secondary fallback: use value + remark for partial matching (less reliable but better than nothing)
    if (item.value !== undefined && item.remark) {
        const valueStr = String(item.value);
        const remarkStr = String(item.remark).substring(0, 20);
        return `${valueStr}_${remarkStr}`;
    }
    
    // Final fallback: use JSON hash
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(item));
    return hash.digest('hex').substring(0, 8);
};

/**
 * Decode attendance value to human-readable format
 * @param {String} attendanceValue - Encoded attendance (e.g., "P", "P1", "A7", "P20")
 * @returns {Object} Decoded attendance information
 */
const decodeAttendanceValue = (attendanceValue) => {
    if (!attendanceValue || typeof attendanceValue !== 'string') {
        return {
            status: 'Unknown',
            overtime: 0,
            display: 'Unknown attendance',
            raw: attendanceValue
        };
    }
    
    // Extract status (P or A) and overtime hours
    const match = attendanceValue.match(/^([PA])(\d*)$/);
    
    if (!match) {
        return {
            status: 'Invalid',
            overtime: 0,
            display: `Invalid attendance: ${attendanceValue}`,
            raw: attendanceValue
        };
    }
    
    const status = match[1] === 'P' ? 'Present' : 'Absent';
    const overtime = match[2] ? parseInt(match[2]) : 0;
    
    let display = status;
    if (overtime > 0) {
        display += ` + ${overtime}h overtime`;
    }
    
    return {
        status,
        overtime,
        display,
        raw: attendanceValue
    };
};

/**
 * Calculate the exact date based on attendance array index
 * @param {Number} index - Position in the attendance array (0-based)
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 * @returns {Object} Date information
 */
const calculateAttendanceDate = (index, month, year) => {
    // Create date object for the first day of the month
    const firstDay = new Date(year, month - 1, 1); // month is 0-based in Date constructor
    
    // Add the index to get the exact day
    const attendanceDate = new Date(year, month - 1, index + 1);
    
    // Get last day of month to validate
    const lastDay = new Date(year, month, 0).getDate();
    
    // Validate that the index doesn't exceed the month's days
    if (index + 1 > lastDay) {
        return {
            day: index + 1,
            month,
            year,
            date: null,
            dateString: `Invalid date (Day ${index + 1} doesn't exist in ${month}/${year})`,
            isValid: false
        };
    }
    
    return {
        day: index + 1,
        month,
        year,
        date: attendanceDate,
        dateString: attendanceDate.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        }),
        dayName: attendanceDate.toLocaleDateString('en-US', { weekday: 'long' }),
        isValid: true
    };
};

/**
 * Compare arrays of strings (for attendance) with detailed change tracking and attendance decoding
 * Handles attendance arrays like ["P", "P20", "A", "A23"] where P/A = Present/Absent and numbers = overtime
 * Enhanced to detect position-based changes (A to P at same position) with exact date calculation
 * @param {Array} oldArray - Original array
 * @param {Array} newArray - Updated array
 * @param {Number} month - Month for date calculation (optional)
 * @param {Number} year - Year for date calculation (optional)
 * @returns {Object} Detailed changes with specific dates and transitions
 */
const compareStringArrays = (oldArray = [], newArray = [], month = null, year = null) => {
    const detailedChanges = [];
    
    // Method 1: Position-based comparison (for when array lengths are same)
    if (oldArray.length === newArray.length) {
        for (let i = 0; i < oldArray.length; i++) {
            const oldValue = oldArray[i];
            const newValue = newArray[i];
            
            if (oldValue !== newValue) {
                const oldDecoded = decodeAttendanceValue(oldValue);
                const newDecoded = decodeAttendanceValue(newValue);
                
                // Calculate the exact date for this attendance change
                const dateInfo = month && year ? calculateAttendanceDate(i, month, year) : null;
                
                detailedChanges.push({
                    changeType: 'modified',
                    attendanceValue: newValue,
                    decoded: newDecoded,
                    from: oldDecoded.display,
                    to: newDecoded.display,
                    position: i,
                    dateInfo: dateInfo,
                    description: dateInfo && dateInfo.isValid 
                        ? `Attendance changed on ${dateInfo.dateString} (${dateInfo.dayName}): ${oldDecoded.display} (${oldValue}) → ${newDecoded.display} (${newValue})`
                        : `Attendance changed at position ${i + 1}: ${oldDecoded.display} (${oldValue}) → ${newDecoded.display} (${newValue})`
                });
            }
        }
    }
    
    // Method 2: Set-based comparison (for different length arrays or when position-based didn't find changes)
    if (detailedChanges.length === 0 || oldArray.length !== newArray.length) {
        const oldSet = new Set(oldArray);
        const newSet = new Set(newArray);
        
        // Track added attendance values
        const added = newArray.filter(item => !oldSet.has(item));
        added.forEach((attendanceValue, index) => {
            const decoded = decodeAttendanceValue(attendanceValue);
            const position = newArray.indexOf(attendanceValue);
            const dateInfo = month && year ? calculateAttendanceDate(position, month, year) : null;
            
            detailedChanges.push({
                changeType: 'added',
                attendanceValue: attendanceValue,
                decoded: decoded,
                from: null,
                to: decoded.display,
                position: position,
                dateInfo: dateInfo,
                description: dateInfo && dateInfo.isValid
                    ? `Attendance added on ${dateInfo.dateString} (${dateInfo.dayName}): ${decoded.display} (${attendanceValue})`
                    : `Attendance added: ${decoded.display} (${attendanceValue}) at position ${position + 1}`
            });
        });
        
        // Track removed attendance values
        const removed = oldArray.filter(item => !newSet.has(item));
        removed.forEach((attendanceValue, index) => {
            const decoded = decodeAttendanceValue(attendanceValue);
            const position = oldArray.indexOf(attendanceValue);
            const dateInfo = month && year ? calculateAttendanceDate(position, month, year) : null;
            
            detailedChanges.push({
                changeType: 'removed',
                attendanceValue: attendanceValue,
                decoded: decoded,
                from: decoded.display,
                to: null,
                position: position,
                dateInfo: dateInfo,
                description: dateInfo && dateInfo.isValid
                    ? `Attendance removed from ${dateInfo.dateString} (${dateInfo.dayName}): ${decoded.display} (${attendanceValue})`
                    : `Attendance removed: ${decoded.display} (${attendanceValue}) from position ${position + 1}`
            });
        });
    }
    
    return {
        hasChanges: detailedChanges.length > 0,
        changes: {
            detailedChanges,
            summary: {
                totalChanges: detailedChanges.length,
                added: detailedChanges.filter(c => c.changeType === 'added').length,
                removed: detailedChanges.filter(c => c.changeType === 'removed').length,
                modified: detailedChanges.filter(c => c.changeType === 'modified').length,
                totalDays: newArray.length,
                previousDays: oldArray.length
            }
        }
    };
};

/**
 * Compare number values for tracking changes
 * @param {Number} oldValue - Original number value
 * @param {Number} newValue - Updated number value
 * @param {String} fieldName - Name of the field being compared
 * @returns {Object} Detailed changes for number field
 */
const compareNumbers = (oldValue = 0, newValue = 0, fieldName = 'value') => {
    const detailedChanges = [];
    
    // Convert to numbers for comparison
    const oldNum = parseFloat(oldValue) || 0;
    const newNum = parseFloat(newValue) || 0;
    
    // Check if values are different
    if (oldNum !== newNum) {
        const difference = newNum - oldNum;
        const percentageChange = oldNum !== 0 ? ((difference / oldNum) * 100).toFixed(2) : 'N/A';
        
        detailedChanges.push({
            changeType: 'modified',
            from: oldNum,
            to: newNum,
            difference: difference,
            percentageChange: percentageChange,
            description: `${fieldName} changed from ₹${oldNum.toLocaleString('en-IN')} to ₹${newNum.toLocaleString('en-IN')} (${difference > 0 ? '+' : ''}₹${difference.toLocaleString('en-IN')}${percentageChange !== 'N/A' ? `, ${difference > 0 ? '+' : ''}${percentageChange}%` : ''})`
        });
    }
    
    return {
        hasChanges: detailedChanges.length > 0,
        changes: {
            detailedChanges,
            summary: {
                totalChanges: detailedChanges.length,
                modified: detailedChanges.length
            }
        }
    };
};

/**
 * Analyze what types of changes are happening to optimize processing
 * @param {Object} oldData - Original employee data
 * @param {Object} newData - Updated employee data  
 * @param {Object} criticalFields - Field definitions
 * @returns {Object} Analysis of changes
 */
const analyzeChangeTypes = (oldData, newData, criticalFields) => {
    const fieldsBeingUpdated = [];
    let attendanceChanged = false;
    let paymentsChanged = false;
    let rateChanged = false;
    let totalChanges = 0;
    
    // Check each critical field for changes
    Object.keys(criticalFields).forEach(fieldName => {
        const oldValue = oldData[fieldName];
        const newValue = newData[fieldName];
        
        // Quick comparison to see if field changed
        let hasChanged = false;
        
        if (criticalFields[fieldName].type === 'number') {
            // For numbers, use numeric comparison
            const oldNum = parseFloat(oldValue) || 0;
            const newNum = parseFloat(newValue) || 0;
            hasChanged = oldNum !== newNum;
        } else {
            // For arrays and other types, use JSON comparison
            hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
        }
        
        if (hasChanged) {
            fieldsBeingUpdated.push(fieldName);
            
            if (fieldName === 'attendance') {
                attendanceChanged = true;
            } else if (fieldName === 'payouts' || fieldName === 'additional_req_pays') {
                paymentsChanged = true;
            } else if (fieldName === 'rate') {
                rateChanged = true;
            }
            
            // Rough estimate of change complexity
            if (Array.isArray(oldValue) && Array.isArray(newValue)) {
                totalChanges += Math.max(oldValue.length, newValue.length);
            } else {
                totalChanges += 1;
            }
        }
    });
    
    // Determine update type
    let updateType = 'unknown';
    if (attendanceChanged && paymentsChanged && rateChanged) {
        updateType = 'comprehensive'; // All types changed
    } else if (attendanceChanged && paymentsChanged) {
        updateType = 'mixed'; // Both attendance and payments changed
    } else if (attendanceChanged && rateChanged) {
        updateType = 'attendance-rate'; // Attendance and rate changed
    } else if (paymentsChanged && rateChanged) {
        updateType = 'payments-rate'; // Payments and rate changed
    } else if (attendanceChanged) {
        updateType = 'attendance-only'; // Only attendance changed
    } else if (paymentsChanged) {
        updateType = 'payments-only'; // Only payments changed  
    } else if (rateChanged) {
        updateType = 'rate-only'; // Only rate changed
    } else if (fieldsBeingUpdated.length > 0) {
        updateType = 'other'; // Other fields changed
    }
    
    // Determine complexity
    let complexity = 'simple';
    if (totalChanges > 10) {
        complexity = 'high';
    } else if (totalChanges > 3) {
        complexity = 'medium';
    }
    
    return {
        fieldsBeingUpdated,
        updateType,
        complexity,
        attendanceChanged,
        paymentsChanged,
        rateChanged,
        totalChanges,
        hasChanges: fieldsBeingUpdated.length > 0
    };
};
/*
 * Handles real-world scenarios where frontend sends complete new arrays
 * @param {Array} oldArray - Original array of objects
 * @param {Array} newArray - Updated array of objects
 * @param {String} fieldName - Name of the field being compared (for better descriptions)
 * @returns {Object} Detailed changes with specific information about what changed
 */
const compareObjectArrays = (oldArray = [], newArray = [], fieldName = 'payment') => {
    // Create maps using synthetic keys
    const oldMap = new Map();
    const newMap = new Map();
    
    // Build map of old items
    oldArray.forEach(item => {
        const key = generateSyntheticKey(item);
        if (key) oldMap.set(key, item);
    });
    
    // Build map of new items
    newArray.forEach(item => {
        const key = generateSyntheticKey(item);
        if (key) newMap.set(key, item);
    });
    
    const detailedChanges = [];
    
    // Find added items (exist in new but not in old)
    newMap.forEach((item, key) => {
        if (!oldMap.has(key)) {
            detailedChanges.push({
                changeType: 'added',
                item: item,
                from: null,
                to: item,
                description: `New ${fieldName} added: ₹${item.value || 0} - ${item.remark || 'No remark'} (${item.date ? new Date(item.date).toLocaleDateString() : 'No date'})`
            });
        }
    });
    
    // Find removed items (exist in old but not in new)
    oldMap.forEach((item, key) => {
        if (!newMap.has(key)) {
            detailedChanges.push({
                changeType: 'removed',
                item: item,
                from: item,
                to: null,
                description: `${fieldName} removed: ₹${item.value || 0} - ${item.remark || 'No remark'} (${item.date ? new Date(item.date).toLocaleDateString() : 'No date'})`
            });
        }
    });
    
    // Find modified items (exist in both but with different values)
    oldMap.forEach((oldItem, key) => {
        if (newMap.has(key)) {
            const newItem = newMap.get(key);
            
            // Compare all fields for changes
            const changedFields = [];
            const fieldsToCheck = ['value', 'remark', 'date', 'createdBy'];
            
            fieldsToCheck.forEach(field => {
                const oldValue = oldItem[field];
                const newValue = newItem[field];
                
                // Handle date comparison specially
                if (field === 'date') {
                    const oldDateStr = oldValue ? new Date(oldValue).toISOString() : null;
                    const newDateStr = newValue ? new Date(newValue).toISOString() : null;
                    if (oldDateStr !== newDateStr) {
                        changedFields.push({
                            field,
                            from: oldValue ? new Date(oldValue).toLocaleDateString() : null,
                            to: newValue ? new Date(newValue).toLocaleDateString() : null
                        });
                    }
                } else {
                    // Regular field comparison
                    if (String(oldValue) !== String(newValue)) {
                        changedFields.push({
                            field,
                            from: oldValue,
                            to: newValue
                        });
                    }
                }
            });
            
            if (changedFields.length > 0) {
                detailedChanges.push({
                    changeType: 'modified',
                    item: newItem,
                    from: oldItem,
                    to: newItem,
                    changedFields,
                    description: `${fieldName} modified: ${changedFields.map(cf => 
                        `${cf.field} changed from "${cf.from}" to "${cf.to}"`
                    ).join(', ')}`
                });
            }
        }
    });
    
    return {
        hasChanges: detailedChanges.length > 0,
        changes: {
            detailedChanges,
            summary: {
                totalChanges: detailedChanges.length,
                added: detailedChanges.filter(c => c.changeType === 'added').length,
                removed: detailedChanges.filter(c => c.changeType === 'removed').length,
                modified: detailedChanges.filter(c => c.changeType === 'modified').length
            }
        }
    };
};

/**
 * Track changes for critical fields with intelligent field detection and appropriate logic
 * @param {String} siteID - Site identifier
 * @param {String} employeeID - Employee identifier
 * @param {Number} month - Month of change
 * @param {Number} year - Year of change
 * @param {String} changedBy - User who made the change
 * @param {String} remark - Reason for change
 * @param {Object} oldData - Original employee data
 * @param {Object} newData - Updated employee data
 * @returns {Array} Array of detailed change log entries
 */
const trackOptimizedChanges = async (siteID, employeeID, month, year, changedBy, remark, oldData, newData) => {
    try {
        const changeLogEntries = [];
        const timestamp = new Date();
        
        // Define critical fields to track with their display names and types
        const criticalFields = {
            'attendance': { type: 'array_string', displayName: 'Attendance' },
            'payouts': { type: 'array_object', displayName: 'Payouts' },
            'additional_req_pays': { type: 'array_object', displayName: 'Bonus' },
            'rate': { type: 'number', displayName: 'Daily Rate' }
        };
        
        // Pre-analyze what types of changes are happening for optimization
        const changeAnalysis = analyzeChangeTypes(oldData, newData, criticalFields);
        
        console.log(`🔍 Change Analysis for ${employeeID}:`);
        console.log(`   Fields being updated: ${changeAnalysis.fieldsBeingUpdated.join(', ')}`);
        console.log(`   Update type: ${changeAnalysis.updateType}`);
        console.log(`   Complexity: ${changeAnalysis.complexity}`);
        
        // Track changes for each field that has been modified
        for (const fieldName of changeAnalysis.fieldsBeingUpdated) {
            const fieldConfig = criticalFields[fieldName];
            const oldValue = oldData[fieldName];
            const newValue = newData[fieldName];
            
            let comparison;
            
            // Use appropriate comparison logic based on field type
            if (fieldConfig.type === 'array_string') {
                console.log(`📅 Processing attendance changes using position-based + set-based logic with date calculation`);
                comparison = compareStringArrays(oldValue, newValue, month, year);
            } else if (fieldConfig.type === 'array_object') {
                console.log(`💰 Processing ${fieldConfig.displayName.toLowerCase()} changes using key-based modification detection`);
                comparison = compareObjectArrays(oldValue, newValue, fieldConfig.displayName);
            } else if (fieldConfig.type === 'number') {
                console.log(`💵 Processing ${fieldConfig.displayName.toLowerCase()} changes using numeric comparison`);
                comparison = compareNumbers(oldValue, newValue, fieldConfig.displayName);
            }
            
            // If changes detected, create detailed log entries
            if (comparison && comparison.hasChanges) {
                console.log(`   ✓ Detected ${comparison.changes.summary.totalChanges} changes in ${fieldConfig.displayName}`);
                console.log(`     - Added: ${comparison.changes.summary.added || 0}`);
                console.log(`     - Modified: ${comparison.changes.summary.modified || 0}`);
                console.log(`     - Removed: ${comparison.changes.summary.removed || 0}`);
                
                // Create one entry per detailed change for maximum granularity
                comparison.changes.detailedChanges.forEach(detailedChange => {
                    const logEntry = {
                        siteID,
                        employeeID,
                        month,
                        year,
                        field: fieldName,
                        fieldDisplayName: fieldConfig.displayName,
                        fieldType: fieldConfig.type,
                        
                        // Detailed change information
                        changeType: detailedChange.changeType,
                        changeDescription: detailedChange.description,
                        
                        // Specific change data
                        changeData: {
                            from: detailedChange.from,
                            to: detailedChange.to,
                            item: detailedChange.item,
                            changedFields: detailedChange.changedFields || null,
                            position: detailedChange.position || null, // For attendance changes
                            attendanceValue: detailedChange.attendanceValue || null, // For attendance changes
                            dateInfo: detailedChange.dateInfo || null, // For attendance date information
                            attendanceDate: detailedChange.dateInfo ? detailedChange.dateInfo.dateString : null, // Quick access to formatted date
                            dayName: detailedChange.dateInfo ? detailedChange.dateInfo.dayName : null, // Quick access to day name
                            difference: detailedChange.difference || null, // For rate changes
                            percentageChange: detailedChange.percentageChange || null // For rate changes
                        },
                        
                        // Audit information
                        changedBy,
                        remark,
                        timestamp,
                        
                        // Enhanced metadata for frontend display
                        metadata: {
                            displayMessage: generateDisplayMessage(
                                fieldConfig.displayName, 
                                detailedChange, 
                                employeeID, 
                                month, 
                                year, 
                                changedBy,
                                timestamp
                            ),
                            isAttendanceChange: fieldConfig.type === 'array_string',
                            isPaymentChange: fieldConfig.type === 'array_object',
                            isRateChange: fieldConfig.type === 'number',
                            updateType: changeAnalysis.updateType,
                            complexity: changeAnalysis.complexity,
                            totalFieldsUpdated: changeAnalysis.fieldsBeingUpdated.length,
                            fieldsUpdated: changeAnalysis.fieldsBeingUpdated.join(', ')
                        }
                    };
                    
                    changeLogEntries.push(logEntry);
                });
            } else {
                console.log(`   - No changes detected in ${fieldConfig.displayName}`);
            }
        }
        
        // Save all change log entries to database
        if (changeLogEntries.length > 0) {
            await ChangeTracking.insertMany(changeLogEntries);
            
            // Enhanced logging with change analysis
            console.log('\n' + '='.repeat(70));
            console.log('📊 DETAILED CHANGE TRACKING - GRANULAR AUDIT LOGS');
            console.log('='.repeat(70));
            console.log(`👤 Employee: ${employeeID} | 🏢 Site: ${siteID} | 📅 Period: ${month}/${year}`);
            console.log(`✏️  Changed by: ${changedBy} | 🕒 Time: ${timestamp.toLocaleString()}`);
            console.log(`💬 Remark: ${remark}`);
            console.log(`📝 Individual Changes Logged: ${changeLogEntries.length}`);
            console.log(`🔍 Update Type: ${changeAnalysis.updateType} | Complexity: ${changeAnalysis.complexity}`);
            console.log('');
            
            // Group by field for summary
            const changesByField = {};
            changeLogEntries.forEach(entry => {
                if (!changesByField[entry.field]) {
                    changesByField[entry.field] = [];
                }
                changesByField[entry.field].push(entry);
            });
            
            Object.keys(changesByField).forEach(field => {
                const fieldChanges = changesByField[field];
                console.log(`📍 ${fieldChanges[0].fieldDisplayName} Changes (${fieldChanges.length}):`);
                fieldChanges.forEach((change, index) => {
                    console.log(`   ${index + 1}. ${change.metadata.displayMessage}`);
                });
                console.log('');
            });
            
            console.log('='.repeat(70) + '\n');
        } else {
            console.log(`ℹ️  No changes detected for ${employeeID} - data appears unchanged`);
        }
        
        return changeLogEntries;
        
    } catch (error) {
        console.error('❌ Error in detailed change tracking:', error);
        throw error;
    }
};

/**
 * Generate user-friendly display message for frontend with attendance decoding
 * @param {String} fieldDisplayName - Display name of the field
 * @param {Object} detailedChange - The detailed change object
 * @param {String} employeeID - Employee identifier
 * @param {Number} month - Month of change
 * @param {Number} year - Year of change
 * @param {String} changedBy - User who made the change
 * @param {Date} timestamp - When the change was made
 * @returns {String} User-friendly message
 */
const generateDisplayMessage = (fieldDisplayName, detailedChange, employeeID, month, year, changedBy, timestamp) => {
    // Convert UTC timestamp to IST for display
    const timeStr = timestamp.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    if (fieldDisplayName === 'Attendance') {
        // Attendance change messages with decoded values and exact dates
        if (detailedChange.changeType === 'added') {
            const decoded = detailedChange.decoded;
            const dateStr = detailedChange.dateInfo && detailedChange.dateInfo.isValid 
                ? ` on ${detailedChange.dateInfo.dateString} (${detailedChange.dateInfo.dayName})`
                : ` at position ${(detailedChange.position || 0) + 1}`;
            return `${changedBy} marked ${employeeID} as ${decoded.display} (${detailedChange.attendanceValue})${dateStr} for ${month}/${year} at ${timeStr}`;
        } else if (detailedChange.changeType === 'removed') {
            const decoded = detailedChange.decoded;
            const dateStr = detailedChange.dateInfo && detailedChange.dateInfo.isValid 
                ? ` from ${detailedChange.dateInfo.dateString} (${detailedChange.dateInfo.dayName})`
                : ` from position ${(detailedChange.position || 0) + 1}`;
            return `${changedBy} removed ${employeeID}'s ${decoded.display} (${detailedChange.attendanceValue})${dateStr} for ${month}/${year} at ${timeStr}`;
        } else if (detailedChange.changeType === 'modified') {
            // Enhanced message for attendance modifications with exact date
            const dateStr = detailedChange.dateInfo && detailedChange.dateInfo.isValid 
                ? ` on ${detailedChange.dateInfo.dateString} (${detailedChange.dateInfo.dayName})`
                : ` at position ${(detailedChange.position || 0) + 1}`;
            return `${changedBy} changed ${employeeID}'s attendance from ${detailedChange.from} to ${detailedChange.to}${dateStr} for ${month}/${year} at ${timeStr}`;
        }
    } else if (fieldDisplayName === 'Daily Rate') {
        // Rate change messages with amount and percentage details
        if (detailedChange.changeType === 'modified') {
            const difference = detailedChange.difference || 0;
            const percentageChange = detailedChange.percentageChange;
            const changeDirection = difference > 0 ? 'increased' : 'decreased';
            const amountStr = `₹${Math.abs(difference).toLocaleString('en-IN')}`;
            const percentageStr = percentageChange !== 'N/A' ? ` (${Math.abs(parseFloat(percentageChange))}%)` : '';
            
            return `${changedBy} ${changeDirection} ${employeeID}'s daily rate from ₹${detailedChange.from.toLocaleString('en-IN')} to ₹${detailedChange.to.toLocaleString('en-IN')} by ${amountStr}${percentageStr} for ${month}/${year} at ${timeStr}`;
        }
    } else {
        // Payment change messages
        if (detailedChange.changeType === 'added') {
            const item = detailedChange.item;
            return `${changedBy} added ${fieldDisplayName.toLowerCase()} for ${employeeID} (${month}/${year}): ₹${item.value || 0} - ${item.remark || 'No remark'} at ${timeStr}`;
        } else if (detailedChange.changeType === 'removed') {
            const item = detailedChange.item;
            return `${changedBy} removed ${fieldDisplayName.toLowerCase()} for ${employeeID} (${month}/${year}): ₹${item.value || 0} - ${item.remark || 'No remark'} at ${timeStr}`;
        } else if (detailedChange.changeType === 'modified') {
            const changedFieldsStr = detailedChange.changedFields?.map(cf => 
                `${cf.field}: "${cf.from}" → "${cf.to}"`
            ).join(', ') || 'multiple fields';
            return `${changedBy} modified ${fieldDisplayName.toLowerCase()} for ${employeeID} (${month}/${year}): ${changedFieldsStr} at ${timeStr}`;
        }
    }
    
    return `${changedBy} changed ${fieldDisplayName.toLowerCase()} for ${employeeID} (${month}/${year}) at ${timeStr}`;
};

/**
 * Count total changes in a detailed changes object
 * @param {Object} changes - Detailed changes object
 * @returns {Number} Total number of changes
 */
const getChangeCount = (changes) => {
    if (changes.detailedChanges) {
        return changes.detailedChanges.length;
    }
    
    // Fallback for legacy format
    let count = 0;
    if (changes.added) count += changes.added.length;
    if (changes.removed) count += changes.removed.length;
    if (changes.modified) count += changes.modified.length;
    return count;
};

/**
 * Get change history for a specific field
 * @param {String} siteID - Site identifier
 * @param {String} employeeID - Employee identifier
 * @param {String} fieldName - Field name to get history for
 * @param {Object} options - Query options
 * @returns {Object} Field-specific change history
 */
const getFieldChangeHistory = async (siteID, employeeID, fieldName, options = {}) => {
    try {
        const {
            limit = 50,
            page = 1,
            fromDate,
            toDate
        } = options;
        
        const query = {
            siteID,
            employeeID,
            field: fieldName
        };
        
        if (fromDate || toDate) {
            query.timestamp = {};
            if (fromDate) query.timestamp.$gte = new Date(fromDate);
            if (toDate) query.timestamp.$lte = new Date(toDate);
        }
        
        const skip = (page - 1) * limit;
        
        const [records, totalCount] = await Promise.all([
            ChangeTracking.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ChangeTracking.countDocuments(query)
        ]);
        
        return {
            success: true,
            field: fieldName,
            records,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalRecords: totalCount
            }
        };
        
    } catch (error) {
        console.error('Error fetching field change history:', error);
        throw error;
    }
};

/**
 * Get aggregated change statistics by field
 * @param {String} siteID - Optional site filter
 * @param {Object} dateRange - Optional date range
 * @returns {Object} Aggregated statistics
 */
const getFieldChangeStatistics = async (siteID = null, dateRange = {}) => {
    try {
        const matchStage = {};
        
        if (siteID) matchStage.siteID = siteID;
        
        if (dateRange.fromDate || dateRange.toDate) {
            matchStage.timestamp = {};
            if (dateRange.fromDate) matchStage.timestamp.$gte = new Date(dateRange.fromDate);
            if (dateRange.toDate) matchStage.timestamp.$lte = new Date(dateRange.toDate);
        }
        
        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: '$field',
                    totalChanges: { $sum: 1 },
                    totalAdded: {
                        $sum: { $cond: [{ $eq: ['$changeType', 'added'] }, 1, 0] }
                    },
                    totalRemoved: {
                        $sum: { $cond: [{ $eq: ['$changeType', 'removed'] }, 1, 0] }
                    },
                    totalModified: {
                        $sum: { $cond: [{ $eq: ['$changeType', 'modified'] }, 1, 0] }
                    },
                    uniqueEmployees: { $addToSet: '$employeeID' },
                    lastChanged: { $max: '$timestamp' }
                }
            },
            {
                $project: {
                    field: '$_id',
                    totalChanges: 1,
                    totalAdded: 1,
                    totalRemoved: 1,
                    totalModified: 1,
                    uniqueEmployeeCount: { $size: '$uniqueEmployees' },
                    lastChanged: 1
                }
            },
            { $sort: { totalChanges: -1 } }
        ];
        
        const statistics = await ChangeTracking.aggregate(pipeline);
        
        return {
            success: true,
            statistics,
            summary: {
                totalFields: statistics.length,
                dateRange,
                siteFilter: siteID
            }
        };
        
    } catch (error) {
        console.error('Error fetching field change statistics:', error);
        throw error;
    }
};

/**
 * Update employee data with optimized change tracking
 * @param {String} siteID - Site identifier
 * @param {String} employeeID - Employee identifier
 * @param {Number} month - Month being updated
 * @param {Number} year - Year being updated
 * @param {Object} updateData - Data to update
 * @param {String} changedBy - User making the change
 * @param {String} remark - Reason for the update
 * @returns {Object} Update result with optimized tracking
 */
const updateEmployeeDataOptimized = async (siteID, employeeID, month, year, updateData, changedBy, remark) => {
    try {
        // Validate input parameters
        if (!siteID || !employeeID || !month || !year || !updateData || !changedBy) {
            throw new Error('Missing required parameters');
        }
        
        console.log(`🔄 Starting optimized employee data update for ${employeeID} - ${month}/${year}`);
        
        // Import Employee model to avoid dependency issues
        const Employee = require('../models/EmployeeSchema');
        
        // Find the current employee record
        const currentEmployee = await Employee.findOne({
            empid: employeeID,
            siteID: siteID,
            month: month,
            year: year
        });
        
        if (!currentEmployee) {
            throw new Error(`Employee ${employeeID} not found for ${month}/${year} at site ${siteID}`);
        }
        
        // Store snapshot of current data (only critical fields)
        const oldSnapshot = {
            attendance: currentEmployee.attendance || [],
            payouts: currentEmployee.payouts || [],
            additional_req_pays: currentEmployee.additional_req_pays || [],
            rate: currentEmployee.rate || 0
        };
        
        // Apply updates
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && updateData[key] !== null) {
                currentEmployee[key] = updateData[key];
            }
        });
        
        // Create new snapshot after updates
        const newSnapshot = {
            attendance: currentEmployee.attendance || [],
            payouts: currentEmployee.payouts || [],
            additional_req_pays: currentEmployee.additional_req_pays || [],
            rate: currentEmployee.rate || 0
        };
        
        // Save the updated employee
        await currentEmployee.save();
        
        // Track optimized changes (only for critical fields)
        const changeLogEntries = await trackOptimizedChanges(
            siteID,
            employeeID,
            month,
            year,
            changedBy,
            remark,
            oldSnapshot,
            newSnapshot
        );
        
        return {
            success: true,
            message: `Employee ${employeeID} updated successfully for ${month}/${year}`,
            data: {
                updatedEmployee: currentEmployee,
                changeLogEntries: changeLogEntries,
                changesTracked: changeLogEntries.length
            }
        };
        
    } catch (error) {
        console.error('❌ Error in optimized employee data update:', error);
        throw error;
    }
};

module.exports = {
    trackOptimizedChanges,
    updateEmployeeDataOptimized,
    getFieldChangeHistory,
    getFieldChangeStatistics,
    // Utility functions
    generateSyntheticKey,
    compareStringArrays,
    compareObjectArrays,
    compareNumbers,
    getChangeCount,
    generateDisplayMessage,
    decodeAttendanceValue,
    analyzeChangeTypes,
    calculateAttendanceDate
};

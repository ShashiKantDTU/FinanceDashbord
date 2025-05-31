/**
 * Change Tracker Utility Module
 * 
 * This module provides comprehensive change tracking functionality for employee data.
 * It handles:
 * - Deep comparison of complex data structures
 * - Change categorization (ADDED, MODIFIED, REMOVED)
 * - MongoDB persistence with auto-serial numbering
 * - Advanced querying and reporting capabilities
 */

const mongoose = require('mongoose');
const _ = require('lodash');
const crypto = require('crypto');

// Import the ChangeTracking model from the models directory
const ChangeTracking = require('../models/ChangeTrackingSchema');
const EmployeeSchema = require('../models/EmployeeSchema');

// Helper function to get data type description for complex structures
const getDataTypeDescription = (value) => {
    if (_.isNull(value)) return 'null';
    if (_.isUndefined(value)) return 'undefined';
    if (_.isArray(value)) {
        if (_.isEmpty(value)) return 'empty array';
        const firstItemType = _.isObject(value[0]) ? 'object' : typeof value[0];
        return `array of ${firstItemType}s (${value.length} items)`;
    }
    if (_.isObject(value)) {
        const keys = _.keys(value);
        return `object with keys: [${keys.join(', ')}]`;
    }
    return typeof value;
};

// Helper function to format complex values for display
const formatValueForDisplay = (value, maxDepth = 2, currentDepth = 0) => {
    if (currentDepth >= maxDepth) {
        return _.isObject(value) ? '[Complex Object]' : value;
    }
    
    if (_.isArray(value)) {
        if (value.length > 5) {
            const preview = value.slice(0, 3).map(item => formatValueForDisplay(item, maxDepth, currentDepth + 1));
            return `[${preview.join(', ')}, ... ${value.length - 3} more items]`;
        }
        return `[${value.map(item => formatValueForDisplay(item, maxDepth, currentDepth + 1)).join(', ')}]`;
    }
    
    if (_.isObject(value) && !_.isDate(value)) {
        const keys = _.keys(value);
        if (keys.length > 3) {
            const previewKeys = keys.slice(0, 2);
            const preview = previewKeys.map(key => `${key}: ${formatValueForDisplay(value[key], maxDepth, currentDepth + 1)}`);
            return `{${preview.join(', ')}, ... ${keys.length - 2} more}`;
        }
        const formatted = keys.map(key => `${key}: ${formatValueForDisplay(value[key], maxDepth, currentDepth + 1)}`);
        return `{${formatted.join(', ')}}`;
    }
    
    return value;
};

// Helper function to find deep differences between two objects
const findDeepDifferences = (oldObj, newObj, path = '') => {
    const differences = {};
    
    // Get all unique keys from both objects
    const allKeys = _.union(_.keys(oldObj), _.keys(newObj));
    
    _.forEach(allKeys, (key) => {
        const currentPath = path ? `${path}.${key}` : key;
        const oldValue = _.get(oldObj, key);
        const newValue = _.get(newObj, key);
        
        // Check if values are equal using lodash deep comparison
        if (!_.isEqual(oldValue, newValue)) {
            // Handle different types of changes
            let changeType = 'MODIFIED';
            if (_.isUndefined(oldValue) && !_.isUndefined(newValue)) {
                changeType = 'ADDED';
            } else if (!_.isUndefined(oldValue) && _.isUndefined(newValue)) {
                changeType = 'REMOVED';
            }
            
            differences[currentPath] = {
                oldValue: _.cloneDeep(oldValue),
                newValue: _.cloneDeep(newValue),
                oldType: getDataTypeDescription(oldValue),
                newType: getDataTypeDescription(newValue),
                changeType: changeType,
                oldDisplay: formatValueForDisplay(oldValue),
                newDisplay: formatValueForDisplay(newValue)
            };
            
            // For nested objects, also capture nested changes
            if (_.isObject(oldValue) && _.isObject(newValue) && !_.isArray(oldValue) && !_.isArray(newValue)) {
                const nestedDiffs = findDeepDifferences(oldValue, newValue, currentPath);
                _.assign(differences, nestedDiffs);
            }
        }
    });
    
    return differences;
};

// Helper function to generate checksum for data integrity
const generateChecksum = (data) => {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data, Object.keys(data).sort()));
    return hash.digest('hex');
};

// Enhanced TrackChanges function to handle complex data structures and save to MongoDB
/**
 * Enhanced TrackChanges function to handle complex data structures and save to MongoDB
 * @param {String} siteID - Site identifier
 * @param {String} EmpID - Employee identifier
 * @param {Number} correctionMonth - Month of correction (1-12)
 * @param {Number} correctionYear - Year of correction
 * @param {Date} correctionDate - Date when correction was made
 * @param {String} correctionBy - User who made the correction
 * @param {String} correctionRemark - Reason for the correction
 * @param {Object} oldEmployeeData - Original employee data
 * @param {Object} newEmployeeData - Updated employee data
 * @param {Object} metadata - Additional metadata (optional)
 * @returns {Object} Change tracking record with serial number and status
 */
const TrackChanges = async (siteID, EmpID, correctionMonth, correctionYear, correctionDate, correctionBy, correctionRemark, oldEmployeeData, newEmployeeData, metadata = {}) => {
    try {
        // Validate parameters
        if (!siteID || !EmpID || !correctionMonth || !correctionYear || !correctionDate || !correctionBy || !correctionRemark || !oldEmployeeData || !newEmployeeData) {
            throw new Error('Invalid parameters provided for change tracking');
        }

        // Use lodash to perform deep comparison and find differences
        const differences = findDeepDifferences(oldEmployeeData, newEmployeeData);
        
        // Convert differences object to array format expected by new schema
        const changesArray = _.map(differences, (change, fieldPath) => ({
            fieldPath,
            changeType: change.changeType,
            oldValue: change.oldValue,
            newValue: change.newValue,
            oldType: change.oldType,
            newType: change.newType,
            oldDisplay: change.oldDisplay,
            newDisplay: change.newDisplay
        }));

        // Generate checksums for data integrity
        const originalDataChecksum = generateChecksum(oldEmployeeData);
        const newDataChecksum = generateChecksum(newEmployeeData);
        
        // Create comprehensive change log matching the new schema
        const changeLogData = {
            siteID,
            employeeID: EmpID,
            correctionMonth,
            correctionYear,
            correctionDate: new Date(correctionDate),
            correctedBy: correctionBy,
            remark: correctionRemark,
            summary: {
                totalChanges: changesArray.length,
                fieldsAdded: changesArray.filter(change => change.changeType === 'ADDED').length,
                fieldsRemoved: changesArray.filter(change => change.changeType === 'REMOVED').length,
                fieldsModified: changesArray.filter(change => change.changeType === 'MODIFIED').length
            },
            changes: changesArray,
            originalDataChecksum,
            newDataChecksum,
            status: 'PROCESSED',
            metadata: {
                ...metadata,
                processingTime: 0, // Will be calculated
                applicationVersion: process.env.APP_VERSION || '1.0.0'
            }
        };        // Save to database only if there are changes
        let savedRecord = null;
        if (changesArray.length > 0) {
            try {
                // Generate serial number before creating the record
                const lastRecord = await ChangeTracking.findOne({}, { serialNumber: 1 }, { sort: { serialNumber: -1 } });
                const nextSerialNumber = lastRecord ? lastRecord.serialNumber + 1 : 1;
                
                // Add serial number to the change log data
                changeLogData.serialNumber = nextSerialNumber;
                
                console.log(`🔢 Generated serial number: ${nextSerialNumber}`);
                
                const changeTrackingRecord = new ChangeTracking(changeLogData);
                savedRecord = await changeTrackingRecord.save();
                console.log(`✅ Change tracking record saved with Serial #${savedRecord.serialNumber}`);
            } catch (dbError) {
                console.error('❌ Failed to save change tracking record:', dbError);
                // Don't throw error here, just log it - we still want to return the change log
            }
        }

        // Enhanced logging with better formatting
        if (changesArray.length > 0) {
            console.log('\n' + '='.repeat(70));
            console.log('📊 EMPLOYEE DATA CHANGES DETECTED & SAVED');
            console.log('='.repeat(70));
            console.log(`📋 Serial #: ${savedRecord ? savedRecord.serialNumber : 'FAILED_TO_SAVE'}`);
            console.log(`👤 Employee: ${EmpID} | 🏢 Site: ${siteID} | 📅 Period: ${correctionMonth}/${correctionYear}`);
            console.log(`✏️  Corrected by: ${correctionBy} | 🕒 Date: ${new Date(correctionDate).toLocaleString()}`);
            console.log(`💬 Remark: ${correctionRemark}`);
            console.log(`📈 Summary: ${changeLogData.summary.fieldsAdded} added, ${changeLogData.summary.fieldsModified} modified, ${changeLogData.summary.fieldsRemoved} removed`);
            console.log(`🔐 Checksums: Old(${originalDataChecksum.substring(0, 8)}...) → New(${newDataChecksum.substring(0, 8)}...)\n`);
            
            // Group changes by type for better organization
            const groupedChanges = _.groupBy(changesArray, 'changeType');
            
            _.forEach(['ADDED', 'MODIFIED', 'REMOVED'], (changeType) => {
                const typeChanges = groupedChanges[changeType];
                if (typeChanges && typeChanges.length > 0) {
                    console.log(`${changeType === 'ADDED' ? '➕' : changeType === 'MODIFIED' ? '🔄' : '➖'} ${changeType} FIELDS (${typeChanges.length}):`);
                    console.log('-'.repeat(50));
                    
                    _.forEach(typeChanges, (change) => {
                        console.log(`   📍 Field: ${change.fieldPath}`);
                        console.log(`   🏷️  Type: ${change.oldType} → ${change.newType}`);
                        
                        if (changeType !== 'REMOVED') {
                            console.log(`   🆕 New: ${change.newDisplay}`);
                        }
                        if (changeType !== 'ADDED') {
                            console.log(`   📜 Old: ${change.oldDisplay}`);
                        }
                        console.log('');
                    });
                }
            });
            
            console.log('='.repeat(70) + '\n');
        } else {
            console.log(`✅ No changes detected for Employee ${EmpID} at Site ${siteID} - No tracking record created`);
        }

        // Return the saved record with additional metadata
        return {
            ...changeLogData,
            serialNumber: savedRecord ? savedRecord.serialNumber : null,
            _id: savedRecord ? savedRecord._id : null,
            saved: !!savedRecord
        };

    } catch (error) {
        console.error('❌ Error in change tracking process:', error);
        throw error;
    }
};

// Query functions for change tracking data
const getChangeHistory = async (filters = {}, options = {}) => {
    try {
        const {
            siteID,
            employeeID,
            month,
            year,
            correctedBy,
            fromDate,
            toDate,
            changeType
        } = filters;

        const {
            page = 1,
            limit = 50,
            sortBy = 'serialNumber',
            sortOrder = 'desc'
        } = options;

        // Build query
        const query = {};
        
        if (siteID) query.siteID = siteID;
        if (employeeID) query.employeeID = employeeID;
        if (month) query.correctionMonth = month;
        if (year) query.correctionYear = year;
        if (correctedBy) query.correctedBy = correctedBy;
        
        if (fromDate || toDate) {
            query.timestamp = {};
            if (fromDate) query.timestamp.$gte = new Date(fromDate);
            if (toDate) query.timestamp.$lte = new Date(toDate);
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const skip = (page - 1) * limit;
        
        const [records, totalCount] = await Promise.all([
            ChangeTracking.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            ChangeTracking.countDocuments(query)
        ]);

        return {
            records,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalRecords: totalCount,
                hasNext: page < Math.ceil(totalCount / limit),
                hasPrev: page > 1
            }
        };
    } catch (error) {
        console.error('Error fetching change history:', error);
        throw error;
    }
};

const getChangeBySerialNumber = async (serialNumber) => {
    try {
        const record = await ChangeTracking.findOne({ serialNumber }).lean();
        return record;
    } catch (error) {
        console.error('Error fetching change by serial number:', error);
        throw error;
    }
};

const getEmployeeChangeHistory = async (siteID, employeeID, options = {}) => {
    try {
        return await getChangeHistory({ siteID, employeeID }, options);
    } catch (error) {
        console.error('Error fetching employee change history:', error);
        throw error;
    }
};

/**
 * Get comprehensive change tracking statistics
 * @param {Object} filters - Optional filters for the statistics query
 * @returns {Object} Statistics summary including totals and breakdowns
 */
const getChangeTrackingStatistics = async (filters = {}) => {
    try {
        const stats = await ChangeTracking.getChangeStatistics(filters);
        return {
            success: true,
            statistics: stats[0] || {
                totalRecords: 0,
                totalChanges: 0,
                totalAdded: 0,
                totalModified: 0,
                totalRemoved: 0,
                uniqueEmployeeCount: 0,
                uniqueSiteCount: 0
            }
        };
    } catch (error) {
        console.error('Error fetching change tracking statistics:', error);
        throw error;
    }
};

/**
 * Get recent changes across all employees or for a specific site
 * @param {Number} limit - Maximum number of recent changes to fetch
 * @param {String} siteID - Optional site ID to filter by
 * @returns {Object} Array of recent changes with metadata
 */
const getRecentChanges = async (limit = 50, siteID = null) => {
    try {
        const filters = {};
        if (siteID) filters.siteID = siteID;
        
        const recentChanges = await ChangeTracking.find(filters)
            .sort({ serialNumber: -1 })
            .limit(limit)
            .select('serialNumber employeeID siteID correctionDate correctedBy remark summary')
            .lean();
        
        return {
            success: true,
            data: recentChanges
        };
    } catch (error) {
        console.error('Error fetching recent changes:', error);
        throw error;
    }
};

/**
 * Get aggregated change data for dashboard display
 * @param {String} siteID - Optional site ID to filter by
 * @param {Number} dateRange - Number of days to look back (default: 30)
 * @returns {Object} Dashboard data with daily aggregations
 */
const getChangeTrackingDashboard = async (siteID = null, dateRange = 30) => {
    try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - dateRange);
        
        const filters = {
            correctionDate: { $gte: fromDate }
        };
        
        if (siteID) filters.siteID = siteID;
        
        const pipeline = [
            { $match: filters },
            {
                $group: {
                    _id: {
                        year: '$correctionYear',
                        month: '$correctionMonth', 
                        day: { $dayOfMonth: '$correctionDate' }
                    },
                    dailyChanges: { $sum: '$summary.totalChanges' },
                    dailyRecords: { $sum: 1 },
                    uniqueEmployees: { $addToSet: '$employeeID' }
                }
            },
            {
                $project: {
                    date: {
                        $dateFromParts: {
                            year: '$_id.year',
                            month: '$_id.month',
                            day: '$_id.day'
                        }
                    },
                    dailyChanges: 1,
                    dailyRecords: 1,
                    uniqueEmployeeCount: { $size: '$uniqueEmployees' }
                }
            },
            { $sort: { date: 1 } }
        ];
        
        const dashboardData = await ChangeTracking.aggregate(pipeline);
        
        return {
            success: true,
            data: dashboardData,
            summary: {
                dateRange: dateRange,
                fromDate: fromDate,
                toDate: new Date()
            }
        };
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
    }
};

// New function to handle employee data updates with optimized change tracking and cascade marking
/**
 * Update employee data for a specific month with optimized change tracking
 * Only tracks the current month being edited, marks future months for recalculation
 * @param {String} siteID - Site identifier
 * @param {String} employeeID - Employee identifier  
 * @param {Number} month - Month being updated (1-12)
 * @param {Number} year - Year being updated
 * @param {Object} updateData - Data to update (partial or full employee data)
 * @param {String} correctedBy - User making the correction
 * @param {String} remark - Reason for the update
 * @returns {Object} Update result with tracking information
 */
const updateEmployeeData = async (siteID, employeeID, month, year, updateData, correctedBy, remark) => {
    try {
        // Import required modules
        const mongoose = require('mongoose');
        const { calculateEmployeeData } = require('./Jobs');
        
        // Validate input parameters
        if (!siteID || !employeeID || !month || !year || !updateData || !correctedBy) {
            throw new Error('Missing required parameters: siteID, employeeID, month, year, updateData, correctedBy');
        }
        
        if (month < 1 || month > 12) {
            throw new Error(`Invalid month: ${month}. Must be between 1-12`);
        }
        
        if (year < 2000 || year > 2100) {
            throw new Error(`Invalid year: ${year}. Must be between 2000-2100`);
        }

        console.log(`🔄 Starting employee data update for ${employeeID} - ${month}/${year}`);

        // Find the current employee record
        const currentEmployee = await mongoose.model('Employee').findOne({ 
            empid: employeeID, 
            siteID: siteID, 
            month: month, 
            year: year 
        });
        
        if (!currentEmployee) {
            throw new Error(`Employee ${employeeID} not found for ${month}/${year} at site ${siteID}`);
        }

        // Store original data for change tracking (deep clone)
        const originalData = JSON.parse(JSON.stringify(currentEmployee.toObject()));
          // Apply updates to the current record
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && updateData[key] !== null) {
                // Handle nested object updates
                if (typeof updateData[key] === 'object' && !Array.isArray(updateData[key])) {
                    if (!currentEmployee[key]) {
                        currentEmployee[key] = {};
                    }
                    Object.assign(currentEmployee[key], updateData[key]);
                } else if (key === 'payouts' && Array.isArray(updateData[key])) {
                    // Special handling for payouts array to preserve/add createdBy field
                    currentEmployee[key] = updateData[key].map(payout => ({
                        ...payout,
                        createdBy: payout.createdBy || correctedBy // Ensure createdBy is set
                    }));
                } else {
                    currentEmployee[key] = updateData[key];
                }
            }
        });

        // Recalculate the current month's closing balance
        try {
            const calculationResult = calculateEmployeeData(currentEmployee);
            currentEmployee.closing_balance = calculationResult.closing_balance;
            console.log(`💰 Recalculated closing balance: ${calculationResult.closing_balance}`);
        } catch (calcError) {
            console.warn(`⚠️  Could not recalculate closing balance: ${calcError.message}`);
        }

        // Mark current month as not needing recalculation (since we just updated it)
        currentEmployee.recalculationneeded = false;
        
        // Save the updated current month
        await currentEmployee.save();
        console.log(`✅ Updated employee ${employeeID} data for ${month}/${year}`);

        // Mark all future months as needing recalculation
        const futureMonthsMarked = await markFutureMonthsForRecalculation(siteID, employeeID, month, year);
        
        // Track changes for ONLY the current month being edited
        const updatedData = JSON.parse(JSON.stringify(currentEmployee.toObject()));
        const trackingResult = await TrackChanges(
            siteID, 
            employeeID, 
            month, 
            year, 
            new Date(),
            correctedBy, 
            remark,
            originalData, 
            updatedData
        );

        return {
            success: true,
            message: `Employee ${employeeID} updated successfully for ${month}/${year}`,
            data: {
                updatedEmployee: currentEmployee,
                changeTracking: trackingResult,
                futureMonthsMarked: futureMonthsMarked,
                recalculationTriggered: futureMonthsMarked > 0
            }
        };

    } catch (error) {
        console.error('❌ Error updating employee data:', error);
        throw error;
    }
};

/**
 * Mark all future months for an employee as needing recalculation
 * @param {String} siteID - Site identifier
 * @param {String} employeeID - Employee identifier
 * @param {Number} currentMonth - Current month being updated
 * @param {Number} currentYear - Current year being updated
 * @returns {Number} Number of future months marked for recalculation
 */
const markFutureMonthsForRecalculation = async (siteID, employeeID, currentMonth, currentYear) => {
    try {
        const mongoose = require('mongoose');
        
        // Build query for future months
        const futureQuery = {
            empid: employeeID,
            siteID: siteID,
            $or: [
                { year: { $gt: currentYear } },
                { 
                    year: currentYear, 
                    month: { $gt: currentMonth } 
                }
            ]
        };

        // Update all future months to need recalculation
        const updateResult = await mongoose.model('Employee').updateMany(
            futureQuery,
            { 
                $set: { 
                    recalculationneeded: true,
                    lastModified: new Date(),
                    modificationReason: `Cascade from ${currentMonth}/${currentYear} update`
                }
            }
        );

        console.log(`🔗 Marked ${updateResult.modifiedCount} future months for recalculation`);
        return updateResult.modifiedCount;

    } catch (error) {
        console.error('❌ Error marking future months for recalculation:', error);
        throw error;
    }
};


const latestEmpSerialNumber = async () => {
    try {
        // Find the latest employee by extracting number from empid (e.g., "EMP01" -> 1)
        const latestRecords = await EmployeeSchema.find({}, { empid: 1 }).sort({ empid: -1 });
        
        if (!latestRecords || latestRecords.length === 0) {
            return 0;
        }
        
        // Extract the highest numeric value from all empids
        let maxSerial = 0;
        latestRecords.forEach(record => {
            const match = record.empid.match(/EMP(\d+)/);
            if (match) {
                const serialNum = parseInt(match[1]);
                if (serialNum > maxSerial) {
                    maxSerial = serialNum;
                }
            }
        });
        
        return maxSerial;
    } catch (error) {
        console.error('Error fetching latest employee serial number:', error);
        throw error;
    }
};

module.exports = {
    ChangeTracking,
    TrackChanges,
    getChangeHistory,
    latestEmpSerialNumber,
    getChangeBySerialNumber,
    getEmployeeChangeHistory,
    getChangeTrackingStatistics,
    getRecentChanges,
    getChangeTrackingDashboard,
    latestEmpSerialNumber,
    // Utility functions
    getDataTypeDescription,
    formatValueForDisplay,
    findDeepDifferences,
    generateChecksum,
    updateEmployeeData,
    markFutureMonthsForRecalculation
};

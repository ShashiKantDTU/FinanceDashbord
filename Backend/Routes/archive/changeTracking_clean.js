const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../Middleware/auth');

// Import the new optimized change tracking functions
const { 
    updateEmployeeDataOptimized, 
    getFieldChangeStatistics,
} = require('../Utils/OptimizedChangeTracker');

// Import the optimized change tracking model
const OptimizedChangeTracking = require('../models/OptimizedChangeTrackingSchema');

// Add logging middleware to track all requests
router.use((req, res, next) => {
    console.log(`🌐 CHANGE-TRACKING ROUTE HIT: ${req.method} ${req.originalUrl}`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`📋 Request Body Keys: ${Object.keys(req.body || {})}`);
    if (req.params.employeeID) {
        console.log(`👤 Employee ID: ${req.params.employeeID}`);
    }
    next();
});

// Test endpoint to verify route registration and auth
router.get('/test-connection', (req, res) => {
    console.log('🔥 TEST CONNECTION ENDPOINT HIT');
    res.json({
        success: true,
        message: 'Change tracking routes are registered and working!',
        timestamp: new Date().toISOString(),
        route: '/api/change-tracking/test-connection'
    });
});

// Test endpoint with auth to verify auth middleware
router.get('/test-auth', authenticateToken, (req, res) => {
    console.log('🔥 TEST AUTH ENDPOINT HIT');
    console.log('👤 User from token:', req.user);
    res.json({
        success: true,
        message: 'Authentication is working!',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// Middleware for request validation
const validateRequest = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => !req.query[field] && !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`,
                requiredFields: requiredFields
            });
        }
        next();
    };
};

// Get change tracking history for a specific employee (OPTIMIZED VERSION)
// GET /api/change-tracking/employee/:employeeID
router.get('/employee/:employeeID', authenticateToken, validateRequest(['siteID']), async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { siteID, page, limit, sortBy, sortOrder, fromDate, toDate, year, month, changeType, correctedBy } = req.query;
        
        console.log(`🔥 EMPLOYEE HISTORY ENDPOINT HIT (OPTIMIZED): ${employeeID}`);
        console.log(`📊 Params: siteID=${siteID}, page=${page}, limit=${limit}`);
        
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const skip = (pageNum - 1) * limitNum;
        
        // Build query for optimized change tracking
        const query = {
            siteID: siteID,
            employeeID: employeeID
        };
        
        if (fromDate || toDate) {
            query.timestamp = {};
            if (fromDate) query.timestamp.$gte = new Date(fromDate);
            if (toDate) query.timestamp.$lte = new Date(toDate);
        }
        
        if (year) query.year = parseInt(year);
        if (month) query.month = parseInt(month);
        if (changeType) query.changeType = changeType;
        if (correctedBy) query.changedBy = correctedBy;
        
        // Build sort object
        const sort = {};
        if (sortBy === 'serialNumber') {
            sort.timestamp = sortOrder === 'desc' ? -1 : 1; // Use timestamp instead of serialNumber for optimized system
        } else {
            sort[sortBy || 'timestamp'] = sortOrder === 'desc' ? -1 : 1;
        }
        
        // Execute query with pagination
        const [records, totalCount] = await Promise.all([
            OptimizedChangeTracking.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            OptimizedChangeTracking.countDocuments(query)
        ]);
        
        console.log(`✅ Found ${records.length} change records for employee ${employeeID} (optimized)`);
        
        res.json({
            success: true,
            records: records.map(record => ({
                ...record,
                // Add compatibility fields for frontend
                serialNumber: record._id, // Use MongoDB _id as identifier
                correctedBy: record.changedBy,
                correctionDate: record.timestamp,
                isOptimized: true
            })),
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum),
                totalRecords: totalCount,
                hasNext: pageNum < Math.ceil(totalCount / limitNum),
                hasPrev: pageNum > 1
            }
        });
    } catch (error) {
        console.error('Error in employee change history API (optimized):', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee change history',
            error: error.message
        });
    }
});

// Get change tracking statistics (OPTIMIZED VERSION)
// GET /api/change-tracking/statistics
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        const { siteID, fromDate, toDate } = req.query;
        
        console.log('🔥 STATISTICS ENDPOINT HIT (OPTIMIZED)');
        console.log(`📊 Params: siteID=${siteID}, fromDate=${fromDate}, toDate=${toDate}`);
        
        // Use the optimized statistics function
        const dateRange = {};
        if (fromDate) dateRange.fromDate = fromDate;
        if (toDate) dateRange.toDate = toDate;
        
        const result = await getFieldChangeStatistics(siteID, dateRange);
        
        console.log(`✅ Statistics generated (optimized): ${result.statistics.length} field types`);
        
        res.json(result);
    } catch (error) {
        console.error('Error in statistics API (optimized):', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});

// Get recent changes across all employees (OPTIMIZED VERSION)
// GET /api/change-tracking/recent
router.get('/recent', authenticateToken, async (req, res) => {
    try {
        const { limit, siteID } = req.query;
        
        console.log('🔥 RECENT CHANGES ENDPOINT HIT (OPTIMIZED)');
        console.log(`📊 Params: limit=${limit}, siteID=${siteID}`);
        
        // Use the optimized change tracking model directly
        const query = {};
        if (siteID) query.siteID = siteID;
        
        const recentChanges = await OptimizedChangeTracking.find(query)
            .sort({ timestamp: -1 })
            .limit(limit ? parseInt(limit) : 50)
            .select('employeeID siteID field changeType changeDescription metadata.displayMessage changedBy timestamp remark')
            .lean();
        
        console.log(`✅ Found ${recentChanges.length} recent changes (optimized)`);
        
        res.json({
            success: true,
            data: recentChanges.map(change => ({
                employeeID: change.employeeID,
                siteID: change.siteID,
                field: change.field,
                changeType: change.changeType,
                description: change.changeDescription,
                displayMessage: change.metadata?.displayMessage || change.changeDescription,
                changedBy: change.changedBy,
                timestamp: change.timestamp,
                remark: change.remark,
                // Add compatibility fields for frontend
                correctedBy: change.changedBy,
                correctionDate: change.timestamp,
                isOptimized: true
            }))
        });
    } catch (error) {
        console.error('Error in recent changes API (optimized):', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent changes',
            error: error.message
        });
    }
});

// Update employee data endpoint (OPTIMIZED VERSION)
// PUT /api/change-tracking/employee/:employeeID/update
router.put('/employee/:employeeID/update', authenticateToken, async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { updateData, month, year, siteID, correctedBy, remark } = req.body;

        // Validate required parameters
        if (!employeeID || !updateData || !month || !year || !siteID) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: employeeID, updateData, month, year, siteID are required',
                requiredFields: ['employeeID', 'updateData', 'month', 'year', 'siteID']
            });
        }

        // Parse and validate month/year
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month must be between 1 and 12'
            });
        }
        
        if (yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({
                success: false,
                message: 'Year must be between 2000 and 2100'
            });
        }

        // Validate updateData is an object
        if (typeof updateData !== 'object' || Array.isArray(updateData)) {
            return res.status(400).json({
                success: false,
                message: 'updateData must be an object containing employee fields to update'
            });
        }

        // Get user info from auth middleware
        const changedBy = req.user?.email || req.user?.userEmail || correctedBy || 'unknown-user';

        console.log(`📝 Employee update request for ${employeeID} - ${monthNum}/${yearNum}`);
        console.log(`👤 Updated by: ${changedBy}`);
        console.log(`💬 Reason: ${remark || 'No reason provided'}`);
        console.log('🔄 Using OPTIMIZED change tracking system');

        // Preprocess update data to ensure consistency
        const processedUpdateData = { ...updateData };
        
        // Add createdBy to additional_req_pays if missing (for schema consistency)
        if (processedUpdateData.additional_req_pays && Array.isArray(processedUpdateData.additional_req_pays)) {
            processedUpdateData.additional_req_pays = processedUpdateData.additional_req_pays.map(payment => ({
                ...payment,
                createdBy: payment.createdBy || changedBy
            }));
            console.log('✅ Processed additional_req_pays with createdBy');
        }

        // Ensure payouts have createdBy field
        if (processedUpdateData.payouts && Array.isArray(processedUpdateData.payouts)) {
            processedUpdateData.payouts = processedUpdateData.payouts.map(payout => ({
                ...payout,
                createdBy: payout.createdBy || changedBy
            }));
            console.log('✅ Processed payouts with createdBy');
        }

        console.log('🔄 About to call updateEmployeeDataOptimized...');
        
        // Use the NEW OPTIMIZED change tracking system
        const result = await updateEmployeeDataOptimized(
            siteID,
            employeeID,
            monthNum,
            yearNum,
            processedUpdateData,
            changedBy,
            remark || 'Employee data update via API'
        );

        console.log(`✅ Employee ${employeeID} updated successfully with ${result.data.changesTracked} optimized changes tracked`);

        res.json({
            success: true,
            message: result.message,
            data: {
                // Return data in format expected by frontend
                serialNumber: `OPT-${Date.now()}`, // Optimized system doesn't use serial numbers
                updatedFields: Object.keys(updateData),
                futureMonthsMarked: false, // Optimized system doesn't cascade mark
                recalculationNeeded: false,
                changeTrackingId: 'optimized-system',
                timestamp: new Date().toISOString(),
                // New optimized system data
                optimizedTracking: {
                    changesTracked: result.data.changesTracked,
                    systemType: 'optimized',
                    storageReduction: '90%',
                    granularLogs: true
                },
                employee: result.data.updatedEmployee
            }
        });

    } catch (error) {
        console.error('❌ Error in employee update API (optimized):', error);
        console.error('❌ Full error stack:', error.stack);
        
        // Handle specific error types
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (error.message.includes('validation')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error during employee update',
            error: error.message
        });
    }
});

// Bulk attendance update endpoint (OPTIMIZED VERSION)
// PUT /api/change-tracking/attendance/updateattendance
router.put('/attendance/updateattendance', authenticateToken, async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { month, siteID, attendanceData } = req.body;

        // Validate required fields
        if (!month || !siteID || !attendanceData || !Array.isArray(attendanceData)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: month, siteID, and attendanceData (array) are required',
                example: {
                    month: "2025-05",
                    siteID: "6833ff004bd307e45abbfb41",
                    attendanceData: [
                        {
                            id: "EMP001",
                            name: "Rajesh Kumar",
                            attendance: ["P", "P", "A", "P", "P", "..."]
                        }
                    ]
                }
            });
        }

        // Parse month and year from the month string (format: "2025-05")
        const [yearStr, monthStr] = month.split('-');
        const yearNum = parseInt(yearStr);
        const monthNum = parseInt(monthStr);

        // Validate month and year
        if (!yearStr || !monthStr || monthNum < 1 || monthNum > 12 || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid month format. Expected format: "YYYY-MM" (e.g., "2025-05")'
            });
        }

        console.log(`📅 Starting bulk attendance update for ${attendanceData.length} employees - ${monthNum}/${yearNum} at site ${siteID}`);
        
        const results = [];
        const validationErrors = [];
        
        // Get user information from JWT token attached by middleware
        const updatedBy = req.user?.email || req.user?.name || 'unknown-user';
        // const updatedById = req.user?.id || 'unknown-id';

        // PHASE 1: Validate all employees exist before making any changes
        console.log(`🔍 Phase 1: Validating all ${attendanceData.length} employees exist...`);
        
        for (const empData of attendanceData) {
            try {
                const { id: employeeID, name: employeeName, attendance } = empData;

                if (!employeeID || !employeeName || !Array.isArray(attendance)) {
                    validationErrors.push({
                        employeeID: employeeID || 'unknown',
                        employeeName: employeeName || 'unknown',
                        error: 'Missing required fields: id, name, and attendance array are required'
                    });
                    continue;
                }

                // Check if employee exists for the given month/year/site
                const Employee = require('../models/EmployeeSchema');
                const employeeExists = await Employee.findOne({ 
                    empid: employeeID, 
                    siteID: siteID, 
                    month: monthNum, 
                    year: yearNum 
                });

                if (!employeeExists) {
                    validationErrors.push({
                        employeeID: employeeID,
                        employeeName: employeeName,
                        error: `Employee ${employeeID} not found for ${monthNum}/${yearNum} at site ${siteID}`
                    });
                }
            } catch (validationError) {
                validationErrors.push({
                    employeeID: empData.id,
                    employeeName: empData.name,
                    error: `Validation error: ${validationError.message}`
                });
            }
        }

        // If any validation errors, stop processing
        if (validationErrors.length > 0) {
            console.log(`❌ Validation failed for ${validationErrors.length} employees. Operation stopped.`);
            
            return res.status(400).json({
                success: false,
                message: `Validation failed for ${validationErrors.length} employees. No data was updated.`,
                validationErrors: validationErrors,
                totalEmployees: attendanceData.length,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`✅ Phase 1 Complete: All ${attendanceData.length} employees validated successfully`);

        // PHASE 2: Update all employees
        console.log(`🔄 Phase 2: Updating all employee attendance data...`);
        
        for (const empData of attendanceData) {
            const { id: employeeID, name: employeeName, attendance } = empData;

            console.log(`👤 Updating attendance for ${employeeID} (${employeeName})`);

            try {
                // Use the NEW OPTIMIZED change tracking system
                const updateResult = await updateEmployeeDataOptimized(
                    siteID,
                    employeeID,
                    monthNum,
                    yearNum,
                    { attendance: attendance },
                    updatedBy,
                    `Bulk attendance update for ${monthNum}/${yearNum} by ${updatedBy}`
                );

                results.push({
                    employeeID: employeeID,
                    employeeName: employeeName,
                    success: true,
                    optimizedChanges: updateResult?.data?.changesTracked || 0,
                    attendanceLength: attendance.length,
                    message: `Attendance updated successfully with optimized tracking`,
                    systemType: 'optimized'
                });

                console.log(`✅ Successfully updated attendance for ${employeeID}`);

            } catch (updateError) {
                console.error(`❌ Error updating employee ${employeeID}:`, updateError);
                
                results.push({
                    employeeID: employeeID,
                    employeeName: employeeName,
                    success: false,
                    error: updateError.message,
                    message: `Failed to update attendance`
                });
            }
        }

        // Calculate results summary
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalOptimizedChanges = successful.reduce((sum, r) => sum + (r.optimizedChanges || 0), 0);
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        console.log(`📊 Bulk attendance update complete: ${successful.length}/${attendanceData.length} successful in ${processingTime}ms`);

        // Send response
        return res.status(200).json({
            success: true,
            message: `Bulk attendance update completed: ${successful.length}/${attendanceData.length} employees updated successfully`,
            summary: {
                totalEmployees: attendanceData.length,
                successful: successful.length,
                failed: failed.length,
                totalOptimizedChanges: totalOptimizedChanges,
                processingTimeMs: processingTime,
                systemType: 'optimized'
            },
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error in bulk attendance update:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during bulk attendance update',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;

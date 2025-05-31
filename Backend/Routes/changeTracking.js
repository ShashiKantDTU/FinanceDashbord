const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../Middleware/auth');
const {
    getEmployeeChangeHistory,
    getChangeTrackingStatistics,
    getRecentChanges,
    getChangeBySerialNumber,
    getChangeTrackingDashboard,
    updateEmployeeData
} = require('../Utils/ChangeTracker');

// Middleware for request validation
const validateRequest = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => !req.query[field] && !req.params[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        next();
    };
};

// Get change tracking history for a specific employee
// GET /api/change-tracking/employee/:employeeID
router.get('/employee/:employeeID', authenticateToken, validateRequest(['siteID']), async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { siteID, page, limit, sortBy, sortOrder, fromDate, toDate, year, month, changeType, correctedBy } = req.query;
        
        const options = {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            sortBy: sortBy || 'serialNumber',
            sortOrder: sortOrder || 'desc',
            fromDate,
            toDate,
            year: year ? parseInt(year) : undefined,
            month: month ? parseInt(month) : undefined,
            changeType,
            correctedBy
        };
        
        const result = await getEmployeeChangeHistory(siteID, employeeID, options);
        res.json(result);
    } catch (error) {
        console.error('Error in employee change history API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee change history',
            error: error.message
        });
    }
});

// Get change tracking statistics
// GET /api/change-tracking/statistics
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        const { siteID, fromDate, toDate, year, month } = req.query;
        
        const filters = {};
        if (siteID) filters.siteID = siteID;
        if (fromDate || toDate) {
            filters.correctionDate = {};
            if (fromDate) filters.correctionDate.$gte = new Date(fromDate);
            if (toDate) filters.correctionDate.$lte = new Date(toDate);
        }
        if (year) filters.correctionYear = parseInt(year);
        if (month) filters.correctionMonth = parseInt(month);
        
        const result = await getChangeTrackingStatistics(filters);
        res.json(result);
    } catch (error) {
        console.error('Error in statistics API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});

// Get recent changes across all employees
// GET /api/change-tracking/recent
router.get('/recent', authenticateToken, async (req, res) => {
    try {
        const { limit, siteID } = req.query;
        
        const result = await getRecentChanges(
            limit ? parseInt(limit) : 50,
            siteID || null
        );
        res.json(result);
    } catch (error) {
        console.error('Error in recent changes API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent changes',
            error: error.message
        });
    }
});

// Get change tracking record by serial number
// GET /api/change-tracking/serial/:serialNumber
router.get('/serial/:serialNumber', authenticateToken, async (req, res) => {
    try {
        const { serialNumber } = req.params;
        
        if (!serialNumber || isNaN(serialNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid serial number provided'
            });
        }
        
        const result = await getChangeBySerialNumber(parseInt(serialNumber));
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error in serial number API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch change record',
            error: error.message
        });
    }
});

// Get dashboard data for change tracking
// GET /api/change-tracking/dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const { siteID, dateRange } = req.query;
        
        const result = await getChangeTrackingDashboard(
            siteID || null,
            dateRange ? parseInt(dateRange) : 30
        );
        res.json(result);
    } catch (error) {
        console.error('Error in dashboard API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
});

// Get all change tracking records with advanced filtering
// GET /api/change-tracking/all
router.get('/all', authenticateToken, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            siteID,
            employeeID,
            fromDate,
            toDate,
            year,
            month,
            correctedBy,
            changeType,
            sortBy = 'serialNumber',
            sortOrder = 'desc'
        } = req.query;
        
        const filters = {};
        if (siteID) filters.siteID = siteID;
        if (employeeID) filters.employeeID = employeeID;
        if (correctedBy) filters.correctedBy = new RegExp(correctedBy, 'i');
        if (year) filters.correctionYear = parseInt(year);
        if (month) filters.correctionMonth = parseInt(month);
        
        if (fromDate || toDate) {
            filters.correctionDate = {};
            if (fromDate) filters.correctionDate.$gte = new Date(fromDate);
            if (toDate) filters.correctionDate.$lte = new Date(toDate);
        }
        
        const ChangeTracking = require('../models/ChangeTrackingSchema');
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const [records, totalCount] = await Promise.all([
            ChangeTracking.find(filters)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ChangeTracking.countDocuments(filters)
        ]);
        
        // Filter by change type if specified
        let filteredRecords = records;
        if (changeType) {
            filteredRecords = records.filter(record => 
                record.changes.some(change => change.changeType === changeType)
            );
        }
        
        res.json({
            success: true,
            data: filteredRecords,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalRecords: totalCount,
                recordsPerPage: parseInt(limit),
                hasNextPage: parseInt(page) * parseInt(limit) < totalCount,
                hasPrevPage: parseInt(page) > 1
            },
            filters: {
                siteID,
                employeeID,
                fromDate,
                toDate,
                year,
                month,
                correctedBy,
                changeType
            }
        });
    } catch (error) {
        console.error('Error in all records API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch change tracking records',
            error: error.message
        });
    }
});

// Update employee data with change tracking and cascade marking
// PUT /api/change-tracking/employee/:employeeID/update
router.put('/employee/:employeeID/update', authenticateToken, async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { 
            siteID, 
            month, 
            year, 
            updateData, 
            correctedBy, 
            remark 
        } = req.body;

        // Validate required fields
        const requiredFields = ['siteID', 'month', 'year', 'updateData', 'correctedBy'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`,
                example: {
                    siteID: "SITE001",
                    month: 5,
                    year: 2025,
                    updateData: {
                        "additional_req_pays": [
                            { "description": "Bonus", "value": 5000 }
                        ],
                        "payouts": [
                            { "description": "Advance", "value": 2000 }
                        ]
                    },
                    correctedBy: "admin_user",
                    remark: "Monthly salary adjustment"
                }
            });
        }

        // Validate month and year
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

        console.log(`📝 Employee update request for ${employeeID} - ${monthNum}/${yearNum}`);
        console.log(`👤 Updated by: ${correctedBy}`);
        console.log(`💬 Reason: ${remark || 'No reason provided'}`);

        // Call the update function
        const result = await updateEmployeeData(
            siteID,
            employeeID,
            monthNum,
            yearNum,
            updateData,
            correctedBy,
            remark || 'Employee data update'
        );

        res.json({
            success: true,
            message: result.message,
            data: {
                serialNumber: result.data.changeTracking.serialNumber,
                updatedFields: Object.keys(updateData),
                futureMonthsMarked: result.data.futureMonthsMarked,
                recalculationNeeded: result.data.recalculationTriggered,
                changeTrackingId: result.data.changeTracking._id,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error in employee update API:', error);
        
        // Handle specific error types
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        if (error.message.includes('Invalid') || error.message.includes('Missing')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error during employee update',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Update employee attendance data with change tracking (Bulk update without transactions)
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

        console.log(`📅 Starting bulk attendance update for ${attendanceData.length} employees - ${monthNum}/${yearNum} at site ${siteID}`);        const results = [];
        const validationErrors = [];
        
        // Get user information from JWT token attached by middleware
        const updatedBy = req.user?.email || req.user?.name || 'unknown-user';
        const updatedById = req.user?.id || 'unknown-id';

        // PHASE 1: Validate all employees exist before making any changes
        console.log(`🔍 Phase 1: Validating all ${attendanceData.length} employees exist...`);
        
        for (const empData of attendanceData) {
            try {
                const { id: employeeID, name: employeeName } = empData;

                // Check if employee exists for this month/year/site
                const employeeExists = await mongoose.model('Employee').findOne({ 
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

        console.log(`✅ Phase 1 Complete: All ${attendanceData.length} employees validated successfully`);        // PHASE 2: Update all employees
        console.log(`🔄 Phase 2: Updating all employee attendance data...`);
        
        for (const empData of attendanceData) {
            const { id: employeeID, name: employeeName, attendance } = empData;

            console.log(`👤 Updating attendance for ${employeeID} (${employeeName})`);

            try {
                // Use the existing updateEmployeeData function
                const updateResult = await updateEmployeeData(
                    siteID,
                    employeeID,
                    monthNum,
                    yearNum,
                    { attendance: attendance },
                    updatedBy,                    `Bulk attendance update for ${monthNum}/${yearNum} by ${updatedBy}`,
                    {
                        userId: updatedById,
                        userName: req.user?.name || 'unknown',
                        userEmail: updatedBy,
                        ipAddress: req.ip || 'unknown',
                        userAgent: req.get('User-Agent') || 'unknown',
                        source: 'bulk-attendance-update',
                        batchOperation: true,
                        attendanceLength: attendance.length,
                        requestTimestamp: new Date().toISOString()
                    }
                );                results.push({
                    employeeID: employeeID,
                    employeeName: employeeName,
                    success: true,
                    serialNumber: updateResult?.data?.changeTracking?.serialNumber || 'no-changes',
                    attendanceLength: attendance.length,
                    message: `Attendance updated successfully`,
                    changesSummary: updateResult?.data?.changeTracking?.summary || null
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

        // PHASE 3: Prepare response
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const processingTime = Date.now() - startTime;

        console.log(`🎉 Phase 3 Complete: ${successful} successful, ${failed} failed updates. Processing time: ${processingTime}ms`);

        // Prepare response
        const response = {
            success: failed === 0,
            message: failed === 0 
                ? `All attendance data updated successfully. ${attendanceData.length} employees processed.`
                : `Partial success: ${successful} employees updated, ${failed} failed.`,
            summary: {
                totalEmployees: attendanceData.length,
                successful: successful,
                failed: failed,
                month: monthNum,
                year: yearNum,
                siteID: siteID,
                processingTimeMs: processingTime,
                mode: 'non-transactional'
            },
            results: results,
            timestamp: new Date().toISOString()
        };

        const statusCode = failed === 0 ? 200 : 207; // 207 = Multi-Status
        res.status(statusCode).json(response);

    } catch (error) {
        console.error('❌ Error in bulk attendance update:', error);
          res.status(500).json({
            success: false,
            message: 'Internal server error during attendance update',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            mode: 'non-transactional',
            timestamp: new Date().toISOString()
        });
    }
});




// Trigger correction for employees marked as needing recalculation
// POST /api/change-tracking/correct-calculations
router.post('/correct-calculations', authenticateToken, async (req, res) => {
    try {
        const { siteID, employeeID, forceAll = false } = req.body;

        // Import Jobs functions
        const { CorrectCalculations, CorrectAllEmployeeData } = require('../Utils/Jobs');

        if (!siteID) {
            return res.status(400).json({
                success: false,
                message: 'siteID is required'
            });
        }

        console.log(`🔧 Starting correction process for site ${siteID}`);

        let result;
        
        if (employeeID) {
            // Correct specific employee
            console.log(`👤 Correcting calculations for employee ${employeeID}`);
            await CorrectCalculations(siteID, employeeID);
            result = {
                type: 'single',
                employeeID: employeeID,
                message: `Corrections completed for employee ${employeeID}`
            };
        } else {
            // Correct all employees in site that need recalculation
            console.log(`🏢 Correcting calculations for all employees in site ${siteID}`);
            const batchResult = await CorrectAllEmployeeData(siteID);
            result = {
                type: 'batch',
                ...batchResult,
                message: `Batch correction completed. Success: ${batchResult.successfulCorrections}, Failed: ${batchResult.failedCorrections}`
            };
        }

        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error in correction API:', error);
        
        res.status(500).json({
            success: false,
            message: 'Error during correction process',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get employees needing recalculation
// GET /api/change-tracking/needs-recalculation
router.get('/needs-recalculation', authenticateToken, async (req, res) => {
    try {
        const { siteID, page = 1, limit = 50 } = req.query;

        if (!siteID) {
            return res.status(400).json({
                success: false,
                message: 'siteID is required'
            });
        }

        // Import mongoose to query directly
        const mongoose = require('mongoose');
        
        const query = {
            siteID: siteID,
            recalculationneeded: true
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [employees, totalCount] = await Promise.all([
            mongoose.model('Employee').find(query)
                .select('empid siteID month year lastModified modificationReason')
                .sort({ year: 1, month: 1, empid: 1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            mongoose.model('Employee').countDocuments(query)
        ]);

        // Group by employee ID for better organization
        const groupedEmployees = {};
        employees.forEach(emp => {
            if (!groupedEmployees[emp.empid]) {
                groupedEmployees[emp.empid] = [];
            }
            groupedEmployees[emp.empid].push({
                month: emp.month,
                year: emp.year,
                period: `${emp.month}/${emp.year}`,
                lastModified: emp.lastModified,
                reason: emp.modificationReason
            });
        });

        res.json({
            success: true,
            data: {
                employeesNeedingCorrection: Object.keys(groupedEmployees).length,
                totalRecordsNeedingCorrection: totalCount,
                details: groupedEmployees,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalRecords: totalCount,
                    hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching employees needing recalculation:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching recalculation data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;

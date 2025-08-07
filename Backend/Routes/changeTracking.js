const express = require('express');
const router = express.Router();
const { authenticateAndTrack } = require('../Middleware/usageTracker');
// switched email to name for Info message 

// Import the new optimized change tracking functions
const {
    updateEmployeeDataOptimized,
    getFieldChangeStatistics,
} = require('../Utils/OptimizedChangeTracker');

// Import markEmployeesForRecalculation once at the top
const { markEmployeesForRecalculation } = require('../Utils/Jobs');

// Import the optimized change tracking model
const OptimizedChangeTracking = require('../models/OptimizedChangeTrackingSchema');
const EmployeeSchema = require('../models/EmployeeSchema');

// New optimized patch attendance function
async function patchEmployeeAttendance(siteID, month, updates, user) {
    const [year, monthNum] = month.split('-').map(Number);
    const updatedBy = user?.name || user?.email || 'unknown-user';

    // This part remains the same: we still need to prepare the actual updates for the employee documents.
    const employeeIds = [...new Set(updates.map(u => u.employeeID))];
    const bulkWriteOps = [];
    let dayUpdated = null; // Assuming all updates in a patch are for the same day

    for (const update of updates) {
        const { employeeID, day, newValue } = update;
        if (!dayUpdated) dayUpdated = day; // Capture the day being updated
        const arrayIndex = day - 1;

        bulkWriteOps.push({
            updateOne: {
                filter: { siteID, empid: employeeID, year, month: monthNum },
                update: { $set: { [`attendance.${arrayIndex}`]: newValue } }
            }
        });
    }

    // --- NEW AGGREGATED LOGGING LOGIC ---
    // We create only ONE log entry for the entire operation.
    let aggregatedLogEntry = null;
    if (updates.length > 0) {
        // Create a formatted timestamp string ONCE.
        const now = new Date();
        const formattedTimestamp = now.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short'
        }); // Example output: "4 Aug 2025, 5:45 pm"

        const displayDate = dayUpdated ? `${dayUpdated}/${monthNum}/${year}` : `${monthNum}/${year}`;
        const displayMessage = `${updatedBy} marked attendance for ${updates.length} employees on ${displayDate}.`;

        aggregatedLogEntry = {
            siteID: siteID,
            employeeID: `${updates.length} employees`, // Frontend compatibility for batch updates
            month: monthNum,
            year: year,
            field: 'attendance',
            fieldDisplayName: 'Attendance',
            fieldType: 'array_string',
            changeType: 'modified', // Using 'modified' as it fits the schema
            changeDescription: `Attendance marked for ${updates.length} employees on ${displayDate}`,
            changeData: {
                employeeCount: updates.length,
                employeeIds: employeeIds, // Log all affected employee IDs for reference
                dayUpdated: dayUpdated
            },
            changedBy: updatedBy,
            // UPDATED REMARK
            remark: `Attendance updated for multiple employees on ${formattedTimestamp}`,
            timestamp: now, // The main timestamp field should still be a proper Date object
            metadata: {
                displayMessage: displayMessage, // The display message is already clean.
                isAttendanceChange: true,
                isPaymentChange: false,
                isRateChange: false,
                updateType: 'attendance-only', // This update type is in the schema
                complexity: 'high', // All bulk updates can be considered high complexity
                totalFieldsUpdated: 1,
                fieldsUpdated: 'attendance'
            }
        };
    }

    // --- DATABASE OPERATIONS ---
    // Execute the database updates and save the single log entry.
    let writeResult = {};
    if (bulkWriteOps.length > 0) {
        writeResult = await EmployeeSchema.bulkWrite(bulkWriteOps);
    }

    if (aggregatedLogEntry) {
        // Save the single aggregated log entry instead of using insertMany
        await new OptimizedChangeTracking(aggregatedLogEntry).save();
    }

    // Mark employees for recalculation (this part remains the same)
    await markEmployeesForRecalculation(siteID, employeeIds, monthNum, year, user);

    return {
        message: `Successfully processed attendance for ${updates.length} employees.`,
        summary: {
            employeesUpdated: writeResult.modifiedCount,
            changesLogged: aggregatedLogEntry ? 1 : 0, // We now only log 1 change
            // Frontend compatibility properties
            successful: writeResult.modifiedCount || updates.length,
            totalEmployees: updates.length
        }
    };
}

// Add logging middleware to track all requests
router.use((req, res, next) => {
    // console.log(`🌐 CHANGE-TRACKING ROUTE HIT: ${req.method} ${req.originalUrl}`);
    // console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    // console.log(`📋 Request Body Keys: ${Object.keys(req.body || {})}`);
    // if (req.params.employeeID) {
    //     console.log(`👤 Employee ID: ${req.params.employeeID}`);
    // }
    next();
});

// Test endpoint to verify route registration and auth
router.get('/test-connection', (req, res) => {
    // console.log('🔥 TEST CONNECTION ENDPOINT HIT');
    res.json({
        success: true,
        message: 'Change tracking routes are registered and working!',
        timestamp: new Date().toISOString(),
        route: '/api/change-tracking/test-connection'
    });
});

// Test endpoint with auth to verify auth middleware
router.get('/test-auth', authenticateAndTrack, (req, res) => {
    // console.log('🔥 TEST AUTH ENDPOINT HIT');
    // console.log('👤 User from token:', req.user);
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
router.get('/employee/:employeeID', authenticateAndTrack, validateRequest(['siteID']), async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { siteID, page, limit, sortBy, sortOrder, fromDate, toDate, year, month, changeType, correctedBy } = req.query;

        // console.log(`🔥 EMPLOYEE HISTORY ENDPOINT HIT (OPTIMIZED): ${employeeID}`);
        // console.log(`📊 Params: siteID=${siteID}, page=${page}, limit=${limit}`);

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

        // console.log(`✅ Found ${records.length} change records for employee ${employeeID} (optimized)`);

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
router.get('/statistics', authenticateAndTrack, async (req, res) => {
    try {
        const { siteID, fromDate, toDate } = req.query;

        // console.log('🔥 STATISTICS ENDPOINT HIT (OPTIMIZED)');
        // console.log(`📊 Params: siteID=${siteID}, fromDate=${fromDate}, toDate=${toDate}`);

        // Use the optimized statistics function
        const dateRange = {};
        if (fromDate) dateRange.fromDate = fromDate;
        if (toDate) dateRange.toDate = toDate;

        const result = await getFieldChangeStatistics(siteID, dateRange);

        // console.log(`✅ Statistics generated (optimized): ${result.statistics.length} field types`);

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
router.get('/recent', authenticateAndTrack, async (req, res) => {
    try {
        const { limit, siteID, field, changeType, changedBy } = req.query;

        // console.log('🔥 RECENT CHANGES ENDPOINT HIT (OPTIMIZED)');
        // console.log(`📊 Params: limit=${limit}, siteID=${siteID}, field=${field}, changeType=${changeType}, changedBy=${changedBy}`);

        // Use the optimized change tracking model directly
        const query = {};
        if (siteID) query.siteID = siteID;
        if (field && field !== 'all') query.field = field;
        if (changeType && changeType !== 'all') query.changeType = changeType;
        if (changedBy && changedBy !== 'all') query.changedBy = changedBy;

        const recentChanges = await OptimizedChangeTracking.find(query)
            .sort({ timestamp: -1 })
            .limit(limit ? parseInt(limit) : 50)
            .select('employeeID siteID field changeType changeDescription metadata.displayMessage changedBy timestamp remark')
            .lean();

        // console.log(`✅ Found ${recentChanges.length} recent changes (optimized)`);

        res.json({
            success: true,
            data: recentChanges.map(change => {
                // NEW LOGIC: Check if it's an aggregated log (no employeeID)
                const isAggregatedLog = !change.employeeID;

                return {
                    // If it's aggregated, the title IS the display message.
                    // Otherwise, build a title like before.
                    title: isAggregatedLog ? change.metadata?.displayMessage : `${change.field} modified for ${change.employeeID}`,
                    // The main description is always the display message.
                    displayMessage: change.metadata?.displayMessage || change.changeDescription,
                    // Pass the rest of the data
                    employeeID: change.employeeID,
                    siteID: change.siteID,
                    field: change.field,
                    changeType: change.changeType,
                    description: change.changeDescription,
                    changedBy: change.changedBy,
                    timestamp: change.timestamp,
                    remark: change.remark,
                    isAggregated: isAggregatedLog, // Add a flag for the frontend
                    // Add compatibility fields for frontend
                    correctedBy: change.changedBy,
                    correctionDate: change.timestamp,
                    isOptimized: true
                };
            })
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


// Route to update employee attendance FOR MOBILE APP
router.put('/employee/mobapi/attendance/update', authenticateAndTrack, async (req, res) => {
    try {

        const { employeeId, attendance, date, siteID } = req.body;
        // Validate required fields
        if (!employeeId || !attendance || !date || !siteID) {
            console.log('Missing required fields: employeeId, attendance, date, siteID are required');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: employeeId, attendance, date, siteID are required'
            });
        }
        // console.log(`📝 Updating attendance for employee ${employeeId} on ${date}`);
        // check if date is Today's date (in IST)
        const now = new Date();
        const nowIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

        // Generate valid dates for today, yesterday, and the day before yesterday (in IST)
        const validDates = [];
        for (let i = 0; i < 3; i++) {
            const d = new Date(nowIST);
            d.setDate(nowIST.getDate() - i);
            validDates.push({
                date: d.getDate().toString(),
                month: (d.getMonth() + 1).toString(), // Months are 0-based in JS
                year: d.getFullYear().toString()
            });
        }

        // Check if the provided date matches any of the valid dates
        const isValidDate = validDates.some(vd =>
            date.date.toString().trim() === vd.date &&
            date.month.toString().trim() === vd.month &&
            date.year.toString().trim() === vd.year
        );

        if (!isValidDate) {
            const validDatesStr = validDates.map(vd => `${vd.date}/${vd.month}/${vd.year}`).join(', ');
            // console.log(` Received date is not within the last three days!  received :  ${date.date}/${date.month}/${date.year} valid (IST): ${validDatesStr}` );
            return res.status(400).json({
                success: false,
                message: `Attendance can only be updated for the last three days (including today) in IST. Valid dates: ${validDatesStr}`
            });
        }
        const employee = await EmployeeSchema.findOne({ empid: employeeId, month: date.month, year: date.year, siteID: siteID });
        if (!employee) {
            // console.log(`❌ Employee with ID ${employeeId} not found for month ${date.month}/${date.year}`);
            return res.status(404).json({
                success: false,
                message: `Employee with ID ${employeeId} not found for month ${date.month}/${date.year}`
            });
        }
        // Update the employee attendance record
        employee.attendance[date.date - 1] = attendance; // currentDate is 1-based, array is 0-based
        await employee.save();

        const istTime = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const displayMessage = `Attendance Added by ${req.user.name || req.user.email || 'unknown-user'} for employee Name ${employee.name} & employeeId ${employeeId}  on ${date.date}/${date.month}/${date.year} marked as ${attendance} at ${istTime}`;

        // Record and save the change in the Detailed change tracking system
        try {
            const changeRecord = {
                siteID: siteID,
                employeeID: employeeId,
                month: currentMonth,
                year: currentYear,
                field: 'attendance',
                fieldDisplayName: 'Attendance',
                fieldType: 'array_string',
                changeType: 'added',
                changeDescription: `Daily attendance for employee ${employeeId} on ${date.date}/${date.month}/${date.year} marked as ${attendance}`,
                changeData: {
                    from: null, // No previous data for today's attendance
                    to: attendance,
                    item: attendance, // The attendance value being set
                    changedFields: [{
                        field: 'attendance',
                        from: null,
                        to: attendance
                    }],
                    position: currentDate - 1, // 0-based index for today's date
                    attendanceValue: attendance, // The actual attendance value (P, A, etc.)
                    difference: null, // No rate change for attendance
                    percentageChange: null, // No percentage change for attendance
                    dateInfo: {
                        day: date.date,
                        month: date.month,
                        year: date.year,
                        date: new Date(date.year, date.month - 1, date.date), // Create a Date object for the given date
                        dateString: `${date.year}-${date.month.toString().padStart(2, '0')}-${date.date.toString().padStart(2, '0')}`, // Format date as YYYY-MM-DD
                        dayName: new Date(date.year, date.month - 1, date.date).toLocaleString('default', { weekday: 'long' }), // Get day name from date
                        isValid: true // Mark as valid date
                    },
                    attendanceDate: `${date.date}/${date.month}/${date.year}`, // Quick access field for frontend
                    dayName: new Date(date.year, date.month - 1, date.date).toLocaleString('default', { weekday: 'long' }), // Get day name from date
                    date: `${date.date}/${date.month}/${date.year}` // Store as string for attendance dates

                },
                changedBy: req.user.name || req.user.email || 'unknown-user', // Use email from auth middleware (should be string, not object)
                remark: `Attendance updated via mobile app on ${new Date().toISOString()}`,
                timestamp: new Date(),
                metadata: {
                    displayMessage: displayMessage,
                    isAttendanceChange: true, // Mark this as an attendance change
                    isPaymentChange: false, // Mark this as not a payment change
                    isRateChange: false, // Mark this as not a rate change
                    updateType: 'attendance-only', // Specify this is an attendance-only update
                    complexity: 'simple', // Add required complexity field
                    totalFieldsUpdated: 1, // Add required totalFieldsUpdated field
                    fieldsUpdated: 'attendance' // Specify the field that was updated
                }
            }

            // Save the change record to the optimized change tracking system
            const changeTrackingRecord = new OptimizedChangeTracking(changeRecord);
            await changeTrackingRecord.save();

            // Mark all future months for recalculation
            await markEmployeesForRecalculation(siteID, employeeId, currentMonth, currentYear, req.user);
        } catch (changeTrackingError) {
            console.error('❌ Error saving change tracking record:', changeTrackingError);
            // Don't fail the request if change tracking fails, just log the error
            console.log('⚠️ Attendance update succeeded but change tracking failed');
        }
        // console.log(`✅ Attendance updated successfully for employee ${employeeId} on ${date}`);
        return res.status(200).json({
            success: true,
            message: 'Attendance updated successfully'
        });


    } catch (error) {
        console.error('Error updating employee attendance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update employee attendance',
            error: error.message
        });
    }


})



// Update employee data endpoint (OPTIMIZED VERSION)
// PUT /api/change-tracking/employee/:employeeID/update
router.put('/employee/:employeeID/update', authenticateAndTrack, async (req, res) => {
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
        const changedBy = req.user.name || req.user?.email || correctedBy || 'unknown-user';

        // console.log(`📝 Employee update request for ${employeeID} - ${monthNum}/${yearNum}`);
        // console.log(`👤 Updated by: ${changedBy}`);
        // console.log(`💬 Reason: ${remark || 'No reason provided'}`);
        // console.log('🔄 Using OPTIMIZED change tracking system');

        // Preprocess update data to ensure consistency
        const processedUpdateData = { ...updateData };

        // Add createdBy to additional_req_pays if missing (for schema consistency)
        if (processedUpdateData.additional_req_pays && Array.isArray(processedUpdateData.additional_req_pays)) {
            processedUpdateData.additional_req_pays = processedUpdateData.additional_req_pays.map(payment => ({
                ...payment,
                createdBy: payment.createdBy || changedBy
            }));
            // console.log('✅ Processed additional_req_pays with createdBy');
        }

        // Ensure payouts have createdBy field
        if (processedUpdateData.payouts && Array.isArray(processedUpdateData.payouts)) {
            processedUpdateData.payouts = processedUpdateData.payouts.map(payout => ({
                ...payout,
                createdBy: payout.createdBy || changedBy
            }));
            // console.log('✅ Processed payouts with createdBy');
        }

        // console.log('🔄 About to call updateEmployeeDataOptimized...');

        // Use the NEW OPTIMIZED change tracking system
        const result = await updateEmployeeDataOptimized(
            siteID,
            employeeID,
            monthNum,
            yearNum,
            processedUpdateData,
            changedBy,
            remark || 'Employee information updated'
        );

        // Mark all future months for recalculation
        await markEmployeesForRecalculation(siteID, employeeID, monthNum, yearNum, req.user);

        // console.log(`✅ Employee ${employeeID} updated successfully with ${result.data.changesTracked} optimized changes tracked`);

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


// UPDATE EMPLOYEE DATA ENDPOINT FOR MOBILE APP
router.put('/employee/mobapi/addpayout', authenticateAndTrack, async (req, res) => {
    try {
        // console.log('Mobile API to update payouts hit successfully')
        const { empid, updateData, month, year, siteID } = req.body;
        const changedBy = req.user.name || req.user?.email || 'unknown-user';

        // Validate required parameters
        if (!empid || !updateData || !month || !year || !siteID) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: employeeID, updateData, month, year, siteID are required',
                requiredFields: ['employeeID', 'updateData', 'month', 'year', 'siteID']
            });
        }

        // Validate updateData structure
        if (!updateData.value) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment amount. Please provide "value" field.',
                requiredFields: ['value', 'date', 'remark']
            });
        }

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (monthNum < 1 || monthNum > 12 || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({
                success: false,
                message: 'Month must be between 1 and 12 and year must be between 2000 and 2100'
            });
        }

        // Find employee record
        const employee = await EmployeeSchema.findOne({
            empid: empid,
            month: monthNum,
            year: yearNum,
            siteID: siteID
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: `Employee with ID ${empid} not found for month ${monthNum}/${yearNum}`
            });
        }

        // Create new payout with correct schema structure
        const newPayout = {
            value: updateData.value,
            date: new Date(updateData.date),
            remark: updateData.remark || 'Payment added via mobile app',
            createdBy: changedBy // Add required createdBy field
        };

        // Add new payout to existing payouts array
        employee.payouts.push(newPayout);

        // console.log(`✅ Payment prepared for employee ${empid}: ₹${newPayout.value}`);

        // Use updateEmployeeDataOptimized to handle both save and change tracking
        const result = await updateEmployeeDataOptimized(
            siteID,
            empid,
            monthNum,
            yearNum,
            { payouts: employee.payouts }, // Pass the updated payouts array
            changedBy,
            `Payment of ₹${newPayout.value} added via mobile app`
        );

        // Mark all future months for recalculation
        await markEmployeesForRecalculation(siteID, empid, monthNum, yearNum, req.user);

        // console.log(`✅ Payment added and change tracking completed: ${result.data.changesTracked} changes tracked`);

        res.json({
            success: true,
            message: `Payment of ₹${newPayout.value} added successfully for ${employee.name}`,
            data: {
                payment: newPayout,
                employee: {
                    empid: employee.empid,
                    name: employee.name,
                    totalPayouts: employee.payouts.length,
                    totalPayoutAmount: employee.payouts.reduce((sum, p) => sum + (p.value || 0), 0)
                },
                changeTracking: {
                    changesTracked: result.data.changesTracked,
                    systemType: 'optimized',
                    success: true
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error in mobile payout API:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during payment processing',
            error: error.message
        });
    }
})






// NEW PATCH UPDATE ENDPOINT - SIMPLER AND MORE PERFORMANT
// PUT /api/change-tracking/attendance/patch-update
router.put('/attendance/patch-update', authenticateAndTrack, async (req, res) => {
    try {
        let { month, siteID, updates } = req.body;

        // Handle common variations in property names
        if (!updates && req.body.update) {
            updates = req.body.update;
        }

        // Validate required fields
        if (!month || !siteID || !updates || !Array.isArray(updates)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: month, siteID, and updates (array) are required',

                example: {
                    month: "2025-05",
                    siteID: "6833ff004bd307e45abbfb41",
                    updates: [
                        {
                            employeeID: "EMP001",
                            day: 15,
                            newValue: "P"
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

        // Validate updates array
        for (const update of updates) {
            if (!update.employeeID || !update.day || update.newValue === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Each update must have employeeID, day, and newValue fields'
                });
            }

            if (update.day < 1 || update.day > 31) {
                return res.status(400).json({
                    success: false,
                    message: 'Day must be between 1 and 31'
                });
            }
        }

        // Call the new, optimized service function
        const result = await patchEmployeeAttendance(siteID, month, updates, req.user);

        res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Error in patch attendance update:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update attendance',
            error: error.message
        });
    }
});

// CURRENTLY BEING USED AT UPDATE EMPLOYEE ATTENDANCE WEB FRONTEND
// Bulk attendance update endpoint (OPTIMIZED VERSION)
// PUT /api/change-tracking/attendance/updateattendance
router.put('/attendance/updateattendance', authenticateAndTrack, async (req, res) => {
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

        // console.log(`📅 Starting bulk attendance update for ${attendanceData.length} employees - ${monthNum}/${yearNum} at site ${siteID}`);

        const results = [];
        const validationErrors = [];

        // Get user information from JWT token attached by middleware
        const updatedBy = req.user?.name || req.user?.email || 'unknown-user';

        // PHASE 1: Validate all employees exist before making any changes
        // console.log(`🔍 Phase 1: Validating all ${attendanceData.length} employees exist...`);

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
                    `Attendance updated for ${monthNum}/${yearNum} by ${updatedBy}`
                );

                // Mark all future months for recalculation
                await markEmployeesForRecalculation(siteID, employeeID, monthNum, yearNum, req.user);

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
            message: `Attendance updated successfully for ${successful.length} out of ${attendanceData.length} employees`,
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
            message: 'Failed to update attendance. Please try again.',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;

/**
 * Employee Data Calculation and Management Module
 * 
 * This module handles core employee data operations including:
 * - Monthly wage calculations
 * - Attendance processing
 * - Data corrections and recalculations
 * - Change tracking integration
 * - Employment gap handling for carry-forward calculations
 * 
 * Key Features:
 * - Automatic detection and handling of employment gaps
 * - Enhanced previous balance calculation that searches for the most recent available month
 * - Gap analysis and reporting functionality
 * - Robust error handling for missing employee data
 */

const mongoose = require('mongoose');
const employeeSchema = require('../models/EmployeeSchema');
const { trackOptimizedChanges } = require('./OptimizedChangeTracker');

/**
 * Calculate employee data for a given month
 * @param {Object} employee - Employee data object
 * @returns {Object} Updated employee object with all calculated fields
 */
const calculateEmployeeData = (employee, userdata) => {
    // Validate employee data structure
    if (!employee || !employee.additional_req_pays || !employee.payouts || !employee.attendance) {
        throw new Error('Invalid employee data structure - missing required fields');
    }

    // Calculate total additional required payments
    const totalAdditionalReqPays = employee.additional_req_pays.reduce((sum, pay) => {
        return sum + (pay.value || 0);
    }, 0);

    // Calculate total advances paid to employee in the month
    const totalAdvances = employee.payouts.reduce((sum, payout) => {
        return sum + (payout.value || 0);
    }, 0);    // Process attendance data and calculate working days and overtime
    const { totalDays, totalOvertime } = processAttendanceData(employee.attendance);
    // Calculate overtime days - different methods for different users
    let totalAttendance;

    if (userdata && userdata.calculationType === 'special') {
        // Special calculation for specific user
        // Convert overtime hours to days with floor + remainder/10 method
        const overtimeDays = Math.floor(totalOvertime / 8) + ((totalOvertime % 8) / 10);
        totalAttendance = totalDays + overtimeDays;
    } else {
        // Default calculation - simple division
        totalAttendance = totalDays + (totalOvertime / 8);
    }

    // Calculate total wage to be paid to employee
    const totalWage = employee.rate * totalAttendance;

    // Get carry forward amount
    const carryForward = employee.carry_forwarded ? employee.carry_forwarded.value : 0;

    // Calculate final closing balance
    const closing_balance = totalWage - totalAdvances + totalAdditionalReqPays + carryForward;

    // Update all calculated fields in the employee object
    employee.wage = totalWage;
    employee.closing_balance = closing_balance;

    // Convert to plain object if it's a Mongoose document, otherwise keep as is
    const updatedEmployee = employee.toObject ? employee.toObject() : { ...employee };

    // Ensure all calculated fields are included in the returned object
    updatedEmployee.wage = totalWage;
    updatedEmployee.closing_balance = closing_balance;

    // Calculate overtime days for metadata
    const overtimeDays = userdata && userdata.calculationType === 'special'
        ? Math.floor(totalOvertime / 8) + ((totalOvertime % 8) / 10)
        : totalOvertime / 8;

    // Add calculation metadata for reference
    updatedEmployee._calculationData = {
        totalAdvances,
        totalAdditionalReqPays,
        totalAttendance,
        totalDays,
        totalOvertime,
        overtimeDays,
        calculationMethod: userdata && userdata.calculationType === 'special' ? 'special' : 'default',
        calculatedAt: new Date()
    };

    return updatedEmployee;
};

/**
 * Process attendance data to calculate working days and overtime
 * @param {Array} attendance - Array of attendance entries
 * @returns {Object} Object containing totalDays and totalOvertime
 */
const processAttendanceData = (attendance) => {
    let totalDays = 0;
    let totalOvertime = 0;

    if (!Array.isArray(attendance)) {
        console.warn('Attendance data is not an array, returning zero values');
        return { totalDays: 0, totalOvertime: 0 };
    }
    attendance.forEach(att => {
        if (typeof att !== 'string') {
            if (att !== null) {
            console.warn(`Invalid attendance entry: ${att}. Skipping.`);
        }
            return;
        }

        // Check if employee was present (contains 'P')
        if (att.includes('P')) {
            totalDays += 1;
        }

        // Parse overtime hours if present (e.g., "P8" means present with 8 hours overtime, "A8" means absent but did 8 hours overtime)
        const overtimeMatch = att.match(/[PA](\d+)/);
        if (overtimeMatch) {
            const overtime = parseInt(overtimeMatch[1]);

            // Validate overtime hours (0-24 hours per day)
            if (!isNaN(overtime) && overtime >= 0 && overtime <= 24) {
                totalOvertime += overtime;
            } else {
                console.warn(`Invalid overtime hours: ${overtime}. Skipping.`);
            }
        }
    });


    return { totalDays, totalOvertime };
};

/**
 * Fetch the latest employee data for a given month and year
 * Automatically triggers recalculation if needed
 * @param {String} siteID - Site identifier
 * @param {String} EmpID - Employee identifier  
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 * @returns {Object} Employee data object
 */
const FetchlatestData = async (siteID, EmpID, month, year, userdata) => {
    try {
        // Validate input parameters
        validateBasicParams(siteID, EmpID, month, year);

        // Find employee record for the specified period
        const employee = await mongoose.model('Employee').findOne({
            empid: EmpID,
            siteID: siteID,
            month: month,
            year: year
        });

        if (!employee) {
            const error = new Error(`Employee ${EmpID} not found for ${month}/${year} at site ${siteID}`);
            error.status = 404;
            throw error;
        }

        // Check if recalculation is needed
        if (employee.recalculationneeded) {
            console.log(`Triggering recalculation for employee ${EmpID}`);
            await CorrectCalculations(siteID, EmpID, 0, 60, userdata);

            // Fetch the updated employee data
            const updatedEmployee = await mongoose.model('Employee').findOne({
                empid: EmpID,
                siteID: siteID,
                month: month,
                year: year
            });
            return updatedEmployee;
        }

        const calculationResult = calculateEmployeeData(employee, userdata);

        // Update employee record with calculated values
        Object.assign(employee, calculationResult);

        // Fix legacy data before saving
        fixLegacyData(employee);

        await employee.save();

        return employee;

    } catch (error) {
        console.error(`Error fetching latest data for employee ${EmpID}:`, error.message);
        throw error;
    }
};



/**
 * Correct calculations for an employee starting from the oldest month needing recalculation
 * Uses recursive approach to process all months in chronological order
 * @param {String} siteID - Site identifier
 * @param {String} EmpID - Employee identifier
 * @param {Number} recursionDepth - Current recursion depth (for safety)
 * @param {Number} maxRecursionDepth - Maximum allowed recursion depth
 */
const CorrectCalculations = async (siteID, EmpID, recursionDepth = 0, maxRecursionDepth = 60, userdata = null) => {
    try {
        // Prevent infinite recursion
        if (recursionDepth > maxRecursionDepth) {
            throw new Error(`Maximum recursion depth reached (${maxRecursionDepth}). Possible infinite loop detected.`);
        }

        // Find the oldest month that needs recalculation
        const oldestRecord = await findOldestRecalculationRecord(siteID, EmpID);

        if (!oldestRecord) {
            console.log(`No recalculation needed for employee ${EmpID}`);
            return;
        }

        const { month, year } = oldestRecord;
        // console.log(`Processing recalculation for employee ${EmpID} - ${month}/${year}`);

        // Get previous month's closing balance for carry forward
        const previousBalance = await getPreviousMonthBalance(siteID, EmpID, month, year);

        // Store original data for change tracking
        const originalData = oldestRecord.toObject();

        // Update carry forward and recalculate
        await updateEmployeeCalculations(oldestRecord, previousBalance, originalData, siteID, EmpID, month, year, userdata);

        // Process next month if it's not in the future
        const shouldContinue = shouldProcessNextMonth(month, year);
        if (shouldContinue) {
            await CorrectCalculations(siteID, EmpID, recursionDepth + 1, maxRecursionDepth, userdata);
        } else {
            console.log(`Recalculation completed for employee ${EmpID}`);
        }

    } catch (error) {
        console.error(`Error in CorrectCalculations for employee ${EmpID}:`, error.message);
        throw error;
    }
};

/**
 * Process all employees needing correction for a specific site and date range
 * @param {String} siteID - Site identifier
 * @param {Number} startYear - Optional start year filter
 * @param {Number} startMonth - Optional start month filter  
 * @param {Number} endYear - Optional end year filter
 * @param {Number} endMonth - Optional end month filter
 * @returns {Object} Processing results summary
 */
const CorrectAllEmployeeData = async (siteID, startYear = null, startMonth = null, endYear = null, endMonth = null, userdata = null) => {
    try {
        // console.log(`Starting batch correction for site ${siteID}`);

        // Build query for employees needing recalculation
        const query = buildRecalculationQuery(siteID, startYear, startMonth, endYear, endMonth);

        // Get unique employee IDs that need correction
        const employeesToCorrect = await mongoose.model('Employee').distinct('empid', query);

        // console.log(`Found ${employeesToCorrect.length} employees requiring correction`);

        // Process results tracking
        const results = {
            totalEmployees: employeesToCorrect.length,
            successfulCorrections: 0,
            failedCorrections: 0,
            errors: []
        };

        // Process each employee sequentially to avoid database conflicts
        for (const empID of employeesToCorrect) {
            try {
                // console.log(`Processing employee: ${empID}`);
                await CorrectCalculations(siteID, empID, 0, 60, userdata);
                results.successfulCorrections++;
            } catch (error) {
                console.error(`Failed to correct employee ${empID}:`, error.message);
                results.failedCorrections++;
                results.errors.push({
                    employeeID: empID,
                    error: error.message
                });
            }
        }

        console.log(`Batch correction completed. Success: ${results.successfulCorrections}, Failed: ${results.failedCorrections}`);
        return results;

    } catch (error) {
        console.error('Error in batch employee correction:', error.message);
        throw error;
    }
};

// === HELPER FUNCTIONS ===

/**
 * Fix legacy data by adding missing required fields
 * @param {Object} employeeRecord - Employee record to fix
 */
const fixLegacyData = (employeeRecord) => {
    // Fix additional_req_pays missing createdBy
    if (employeeRecord.additional_req_pays && Array.isArray(employeeRecord.additional_req_pays)) {
        employeeRecord.additional_req_pays.forEach(item => {
            if (!item.createdBy) {
                item.createdBy = 'legacy_system';
            }
        });
    }

    // Fix payouts missing createdBy
    if (employeeRecord.payouts && Array.isArray(employeeRecord.payouts)) {
        employeeRecord.payouts.forEach(item => {
            if (!item.createdBy) {
                item.createdBy = 'legacy_system';
            }
        });
    }
};

/**
 * Validate basic input parameters
 */
const validateBasicParams = (siteID, EmpID, month = null, year = null) => {
    if (!siteID || !EmpID) {
        throw new Error('siteID and EmpID are required parameters');
    }

    if (month !== null && (month < 1 || month > 12)) {
        throw new Error(`Invalid month: ${month}. Must be between 1-12`);
    }

    if (year !== null && (year < 2000 || year > 2100)) {
        throw new Error(`Invalid year: ${year}. Must be between 2000-2100`);
    }
};

/**
 * Find the oldest employee record that needs recalculation
 */
const findOldestRecalculationRecord = async (siteID, EmpID) => {
    return await mongoose.model('Employee').findOne({
        empid: EmpID,
        siteID: siteID,
        recalculationneeded: true
    }).sort({ year: 1, month: 1 });
};

/**
 * Get previous month's closing balance for carry forward calculation
 * Handles gaps in employment by finding the most recent month with data
 */
const getPreviousMonthBalance = async (siteID, EmpID, currentMonth, currentYear) => {
    try {
        // First, try to find the immediately previous month
        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        const immediatelyPreviousData = await mongoose.model('Employee').findOne({
            empid: EmpID,
            siteID: siteID,
            month: previousMonth,
            year: previousYear
        });

        // If immediately previous month exists, return its closing balance
        if (immediatelyPreviousData) {
            return immediatelyPreviousData.closing_balance || 0;
        }

        // If no immediate previous month, search for the most recent month with data
        // Create a date threshold for the current month
        const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);

        // Find the most recent employee record before the current month
        const mostRecentData = await mongoose.model('Employee').findOne({
            empid: EmpID,
            siteID: siteID,
            $or: [
                { year: { $lt: currentYear } },
                {
                    year: currentYear,
                    month: { $lt: currentMonth }
                }
            ]
        }).sort({ year: -1, month: -1 }); // Sort by most recent first

        if (mostRecentData) {
            // console.log(`Found gap in employment for ${EmpID}: Using balance from ${mostRecentData.month}/${mostRecentData.year} (${mostRecentData.closing_balance || 0}) for ${currentMonth}/${currentYear}`);
            return mostRecentData.closing_balance || 0;
        }

        // If no previous data found at all, return 0
        // console.log(`No previous employment data found for ${EmpID} before ${currentMonth}/${currentYear}`);
        return 0;

    } catch (error) {
        console.error(`Error getting previous month balance for ${EmpID}:`, error.message);
        return 0; // Return 0 as fallback to prevent calculation failures
    }
};

/**
 * Update employee calculations and save with change tracking
 */
const updateEmployeeCalculations = async (employeeRecord, previousBalance, originalData, siteID, EmpID, month, year, userdata = null) => {
    // Update carry forward value
    employeeRecord.carry_forwarded.value = previousBalance;

    // Recalculate employee data
    const calculationResult = calculateEmployeeData(employeeRecord, userdata);

    // Validate calculated values
    if (isNaN(calculationResult.closing_balance)) {
        throw new Error('Calculated closing balance is not a valid number');
    }

    // Update the record
    employeeRecord.closing_balance = calculationResult.closing_balance;
    employeeRecord.recalculationneeded = false;

    // Fix legacy data before saving
    fixLegacyData(employeeRecord);

    // Save to database
    await employeeRecord.save();
    // console.log(`✅ Successfully updated employee ${EmpID} for ${month}/${year}`);

    // Track changes using Optimized Change Tracker
    try {
        const updatedData = employeeRecord.toObject();
        await trackOptimizedChanges(
            siteID, EmpID, month, year,
            'System', 'Automatic recalculation of employee data',
            originalData, updatedData
        );
    } catch (trackingError) {
        console.warn(`Warning: Failed to track optimized changes for ${EmpID}:`, trackingError.message);
        // Don't throw here - tracking failure shouldn't break the main process
    }
};

/**
 * Check if we should process the next month (not in future)
 */
const shouldProcessNextMonth = (currentMonth, currentYear) => {
    const now = new Date();
    const thisMonth = now.getMonth() + 1; // getMonth() returns 0-11
    const thisYear = now.getFullYear();

    return currentYear < thisYear || (currentYear === thisYear && currentMonth < thisMonth);
};

/**
 * Build query for finding employees needing recalculation
 */
const buildRecalculationQuery = (siteID, startYear, startMonth, endYear, endMonth) => {
    const query = { siteID, recalculationneeded: true };

    // Add date range filtering if provided
    if (startYear && startMonth) {
        query.$or = [
            { year: { $gt: startYear } },
            { year: startYear, month: { $gte: startMonth } }
        ];
    }

    if (endYear && endMonth) {
        const endCondition = {
            $or: [
                { year: { $lt: endYear } },
                { year: endYear, month: { $lte: endMonth } }
            ]
        };

        if (query.$or) {
            query.$and = [{ $or: query.$or }, endCondition];
            delete query.$or;
        } else {
            Object.assign(query, endCondition);
        }
    } return query;
};

/**
 * Check if any employees in a site need recalculation
 * @param {String} siteID - Site identifier
 * @returns {Object} Summary of employees needing recalculation
 */
const getRecalculationStatus = async (siteID) => {
    try {
        const query = { siteID, recalculationneeded: true };

        const [totalCount, employeeStats] = await Promise.all([
            mongoose.model('Employee').countDocuments(query),
            mongoose.model('Employee').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$empid',
                        monthsNeedingCorrection: { $sum: 1 },
                        oldestMonth: { $min: { $concat: [{ $toString: '$year' }, '-', { $toString: '$month' }] } },
                        latestMonth: { $max: { $concat: [{ $toString: '$year' }, '-', { $toString: '$month' }] } }
                    }
                },
                {
                    $project: {
                        employeeID: '$_id',
                        monthsNeedingCorrection: 1,
                        oldestMonth: 1,
                        latestMonth: 1
                    }
                }
            ])
        ]);

        return {
            siteID,
            totalRecordsNeedingCorrection: totalCount,
            uniqueEmployeesNeedingCorrection: employeeStats.length,
            employeeDetails: employeeStats,
            needsCorrection: totalCount > 0
        };

    } catch (error) {
        console.error('Error checking recalculation status:', error);
        throw error;
    }
};

/**
 * Mark specific employee months as needing recalculation
 * Useful for bulk operations or external triggers
 * @param {String} siteID - Site identifier
 * @param {String} employeeID - Employee identifier (optional, if not provided affects all employees)
 * @param {Number} fromMonth - Starting month (optional)
 * @param {Number} fromYear - Starting year (optional)
 * @returns {Object} Update results
 */
const markEmployeesForRecalculation = async (siteID, employeeID = null, fromMonth = null, fromYear = null, userdata = null) => {
    try {
        const query = { siteID };

        if (employeeID) {
            query.empid = employeeID;
        }

        if (fromMonth && fromYear) {
            query.$or = [
                { year: { $gt: fromYear } },
                { year: fromYear, month: { $gte: fromMonth } }
            ];
        }

        const updateResult = await mongoose.model('Employee').updateMany(
            query,
            {
                $set: {
                    recalculationneeded: true,
                    lastModified: new Date(),
                    modificationReason: `Marked for recalculation${employeeID ? ` for employee ${employeeID}` : ''}`
                }
            }
        );

        // console.log(`🔄 Marked ${updateResult.modifiedCount} records for recalculation`);

        return {
            modifiedCount: updateResult.modifiedCount,
            matchedCount: updateResult.matchedCount,
            query: query
        };

    } catch (error) {
        console.error('Error marking employees for recalculation:', error);
        throw error;
    }
};

/**
 * Detect employment gaps for an employee within a date range
 * Useful for reporting and debugging purposes
 * @param {String} siteID - Site identifier
 * @param {String} EmpID - Employee identifier
 * @param {Number} startMonth - Start month for analysis
 * @param {Number} startYear - Start year for analysis
 * @param {Number} endMonth - End month for analysis
 * @param {Number} endYear - End year for analysis
 * @returns {Object} Gap analysis results
 */
const detectEmploymentGaps = async (siteID, EmpID, startMonth, startYear, endMonth, endYear) => {
    try {
        // Get all employee records within the date range
        const employeeRecords = await mongoose.model('Employee').find({
            empid: EmpID,
            siteID: siteID,
            $or: [
                { year: { $gt: startYear } },
                { year: startYear, month: { $gte: startMonth } }
            ],
            $and: [
                {
                    $or: [
                        { year: { $lt: endYear } },
                        { year: endYear, month: { $lte: endMonth } }
                    ]
                }
            ]
        }).sort({ year: 1, month: 1 });

        // Generate expected months array
        const expectedMonths = [];
        let currentMonth = startMonth;
        let currentYear = startYear;

        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
            expectedMonths.push({ month: currentMonth, year: currentYear });

            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        // Find gaps
        const existingMonths = employeeRecords.map(record => ({
            month: record.month,
            year: record.year
        }));

        const gaps = expectedMonths.filter(expected =>
            !existingMonths.some(existing =>
                existing.month === expected.month && existing.year === expected.year
            )
        );

        return {
            employeeID: EmpID,
            siteID: siteID,
            dateRange: {
                start: `${startMonth}/${startYear}`,
                end: `${endMonth}/${endYear}`
            },
            totalExpectedMonths: expectedMonths.length,
            totalExistingMonths: existingMonths.length,
            totalGaps: gaps.length,
            gaps: gaps.map(gap => `${gap.month}/${gap.year}`),
            hasGaps: gaps.length > 0,
            existingMonths: existingMonths.map(month => `${month.month}/${month.year}`)
        };

    } catch (error) {
        console.error(`Error detecting employment gaps for ${EmpID}:`, error.message);
        throw error;
    }
};

/**
 * Test function to demonstrate gap handling functionality
 * @param {String} siteID - Site identifier
 * @param {String} EmpID - Employee identifier
 * @param {Number} testMonth - Month to test
 * @param {Number} testYear - Year to test
 * @returns {Object} Test results showing gap handling
 */
const testGapHandling = async (siteID, EmpID, testMonth, testYear) => {
    try {
        // console.log(`\n=== Testing Gap Handling for Employee ${EmpID} ===`);

        // Test the enhanced getPreviousMonthBalance function
        const previousBalance = await getPreviousMonthBalance(siteID, EmpID, testMonth, testYear);

        // Detect gaps in the last 12 months
        const startMonth = testMonth === 12 ? 1 : testMonth + 1;
        const startYear = testMonth === 12 ? testYear : testYear - 1;

        const gapAnalysis = await detectEmploymentGaps(
            siteID, EmpID,
            startMonth, startYear,
            testMonth, testYear
        );

        return {
            testCase: {
                employee: EmpID,
                site: siteID,
                currentMonth: `${testMonth}/${testYear}`
            },
            previousBalance: {
                value: previousBalance,
                message: previousBalance === 0 ?
                    'No previous employment data found' :
                    `Found previous balance: ${previousBalance}`
            },
            gapAnalysis: gapAnalysis,
            recommendations: gapAnalysis.hasGaps ? [
                'Employee has employment gaps in the specified period',
                'Previous balance calculation will use the most recent available month',
                'Consider reviewing employment continuity for this employee'
            ] : [
                'No employment gaps detected',
                'Previous balance calculation is straightforward'
            ]
        };

    } catch (error) {
        console.error(`Error in gap handling test:`, error.message);
        throw error;
    }
};

// Export all functions for use in other modules
module.exports = {
    calculateEmployeeData,
    processAttendanceData,
    FetchlatestData,
    CorrectCalculations,
    CorrectAllEmployeeData,
    // Helper functions for external use
    fixLegacyData,
    validateBasicParams,
    findOldestRecalculationRecord,
    getPreviousMonthBalance,
    shouldProcessNextMonth,
    getRecalculationStatus,
    markEmployeesForRecalculation,
    detectEmploymentGaps,
    testGapHandling
};


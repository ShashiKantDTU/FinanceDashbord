/**
 * Employee Data Calculation and Management Module
 * 
 * This module handles core employee data operations including:
 * - Monthly wage calculations
 * - Attendance processing
 * - Data corrections and recalculations
 * - Change tracking integration
 */

const mongoose = require('mongoose');
const employeeSchema = require('../models/EmployeeSchema'); 
const { TrackChanges } = require('./ChangeTracker');

/**
 * Calculate employee data for a given month
 * @param {Object} employee - Employee data object
 * @returns {Object} Updated employee object with all calculated fields
 */
const calculateEmployeeData = (employee) => {
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
      // Convert overtime hours to days (8 hours = 1 day)
    const overtimeDays = Math.floor(totalOvertime / 8) + ((totalOvertime % 8) / 10);
    const totalAttendance = totalDays + overtimeDays;
    
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
    
    // Add calculation metadata for reference
    updatedEmployee._calculationData = {
        totalAdvances,
        totalAdditionalReqPays,
        totalAttendance,
        totalDays,
        totalOvertime,
        overtimeDays,
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
            console.warn(`Invalid attendance entry: ${att}. Skipping.`);
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
const FetchlatestData = async (siteID, EmpID, month, year) => {
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
            throw new Error(`Employee ${EmpID} not found for ${month}/${year} at site ${siteID}`);
        }

        // Check if recalculation is needed
        if (employee.recalculationneeded) {
            console.log(`Triggering recalculation for employee ${EmpID}`);
            await CorrectCalculations(siteID, EmpID);
            
            // Fetch the updated employee data
            const updatedEmployee = await mongoose.model('Employee').findOne({ 
                empid: EmpID, 
                siteID: siteID, 
                month: month, 
                year: year 
            });
            return updatedEmployee;
        }

        const calculationResult = calculateEmployeeData(employee);

        // Update employee record with calculated values
        Object.assign(employee, calculationResult);
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
const CorrectCalculations = async (siteID, EmpID, recursionDepth = 0, maxRecursionDepth = 50) => {
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
        console.log(`Processing recalculation for employee ${EmpID} - ${month}/${year}`);

        // Get previous month's closing balance for carry forward
        const previousBalance = await getPreviousMonthBalance(siteID, EmpID, month, year);
        
        // Store original data for change tracking
        const originalData = oldestRecord.toObject();

        // Update carry forward and recalculate
        await updateEmployeeCalculations(oldestRecord, previousBalance, originalData, siteID, EmpID, month, year);

        // Process next month if it's not in the future
        const shouldContinue = shouldProcessNextMonth(month, year);
        if (shouldContinue) {
            await CorrectCalculations(siteID, EmpID, recursionDepth + 1, maxRecursionDepth);
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
const CorrectAllEmployeeData = async (siteID, startYear = null, startMonth = null, endYear = null, endMonth = null) => {
    try {
        console.log(`Starting batch correction for site ${siteID}`);
        
        // Build query for employees needing recalculation
        const query = buildRecalculationQuery(siteID, startYear, startMonth, endYear, endMonth);
        
        // Get unique employee IDs that need correction
        const employeesToCorrect = await mongoose.model('Employee').distinct('empid', query);
        
        console.log(`Found ${employeesToCorrect.length} employees requiring correction`);

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
                console.log(`Processing employee: ${empID}`);
                await CorrectCalculations(siteID, empID);
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
 */
const getPreviousMonthBalance = async (siteID, EmpID, currentMonth, currentYear) => {
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const previousMonthData = await mongoose.model('Employee').findOne({ 
        empid: EmpID, 
        siteID: siteID, 
        month: previousMonth, 
        year: previousYear 
    });
    
    return previousMonthData ? previousMonthData.closing_balance : 0;
};

/**
 * Update employee calculations and save with change tracking
 */
const updateEmployeeCalculations = async (employeeRecord, previousBalance, originalData, siteID, EmpID, month, year) => {
    // Update carry forward value
    employeeRecord.carry_forwarded.value = previousBalance;

    // Recalculate employee data
    const calculationResult = calculateEmployeeData(employeeRecord);
    
    // Validate calculated values
    if (isNaN(calculationResult.closing_balance)) {
        throw new Error('Calculated closing balance is not a valid number');
    }

    // Update the record
    employeeRecord.closing_balance = calculationResult.closing_balance;
    employeeRecord.recalculationneeded = false;

    // Save to database
    await employeeRecord.save();
    console.log(`✅ Successfully updated employee ${EmpID} for ${month}/${year}`);

    // Track changes
    try {
        const updatedData = employeeRecord.toObject();
        await TrackChanges(
            siteID, EmpID, month, year, new Date(),
            'System', 'Automatic recalculation of employee data',
            originalData, updatedData
        );
    } catch (trackingError) {
        console.warn(`Warning: Failed to track changes for ${EmpID}:`, trackingError.message);
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
    }    return query;
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
const markEmployeesForRecalculation = async (siteID, employeeID = null, fromMonth = null, fromYear = null) => {
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

        console.log(`🔄 Marked ${updateResult.modifiedCount} records for recalculation`);
        
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

// Export all functions for use in other modules
module.exports = {
    calculateEmployeeData,
    processAttendanceData,
    FetchlatestData,
    CorrectCalculations,
    CorrectAllEmployeeData,
    // Helper functions for external use
    validateBasicParams,
    findOldestRecalculationRecord,
    getPreviousMonthBalance,
    shouldProcessNextMonth,
    getRecalculationStatus,
    markEmployeesForRecalculation
};


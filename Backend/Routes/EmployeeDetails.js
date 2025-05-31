const express = require('express');
const employeeSchema = require('../models/EmployeeSchema'); // Assuming you have an EmployeeSchema model
const { FetchlatestData, calculateEmployeeData } = require('../Utils/Jobs');
const { TrackChanges, latestEmpSerialNumber } = require('../Utils/ChangeTracker');
const {authenticateToken} = require('../Middleware/auth');
const router = express.Router();



// Create new employee endpoint (requires name, siteID, and wage)
router.post('/addemployee', authenticateToken, async (req, res) => {
    try {
        console.log('📝 Creating new employee:', req.body);

        const { name, siteID, wage: rate, month, year } = req.body;
        // If month and year are not provided, use current month/year
        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Employee name is required and cannot be empty.'
            });
        }
        
        if (!siteID || siteID.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Site ID is required and cannot be empty.'
            });
        }
        
        if (!rate || rate <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Wage must be provided and must be greater than 0.'
            });
        }

        if (!month || !year) {
            console.log('No month/year provided, using current month/year');
        }
        
        // Set default values for other required fields
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
        const currentYear = currentDate.getFullYear();
        
        // Get user info from auth middleware (JWT contains email)
        const createdBy = req.user?.email || req.user?.userEmail || 'unknown-user';
        
        // Get the latest employee serial number
        const latestSerial = await latestEmpSerialNumber();
        const newSerial = latestSerial + 1;
        const newEmpId = `EMP${newSerial.toString().padStart(3, '0')}`;        
        console.log(`🆔 Assigning new employee ID: ${newEmpId} (latest serial: ${latestSerial})`);
        console.log(`👤 Created by: ${createdBy}`);
        
        // Check if employee already exists for this month/year
        const existingEmployee = await employeeSchema.findOne({
            empid: newEmpId,
            month: currentMonth,
            year: currentYear
        });
        
        if (existingEmployee) {
            return res.status(409).json({
                success: false,
                error: `Employee ${newEmpId} already exists for ${currentMonth}/${currentYear}.`
            });
        }
        
        // Create new employee object with provided and default values
        const newEmployeeData = {
            name: name.trim(),
            empid: newEmpId,
            rate: parseFloat(rate),
            month: currentMonth,
            year: currentYear,
            siteID: siteID.trim(),
            payouts: [],
            wage: 0,
            additional_req_pays: [],
            attendance: [],
            closing_balance: 0,
            carry_forwarded: {
                value: 0,
                remark: 'Initial setup - new employee',
                date: new Date()
            },
            createdBy: createdBy,
            attendanceHistory: {},
            recalculationneeded: false
        };
        
        // Save the new employee
        const newEmployee = new employeeSchema(newEmployeeData);
        const savedEmployee = await newEmployee.save();
        
        console.log(`✅ Employee ${newEmpId} created successfully`);
          // Track the addition of the new employee using ChangeTracker
        try {
            const changeTrackingResult = await TrackChanges(
                siteID.trim(),
                newEmpId,
                currentMonth,
                currentYear,
                new Date(),
                createdBy,
                `New employee "${name}" added to the system by ${createdBy}`,
                {}, // oldEmployeeData (empty for new employee)
                savedEmployee.toObject(), // newEmployeeData
                {
                    ipAddress: req.ip || 'unknown',
                    userAgent: req.get('User-Agent') || 'unknown',
                    sessionId: req.session?.id || 'unknown',
                    applicationVersion: '1.0.0',
                    creationType: 'api_creation',
                    createdByUser: createdBy
                }
            );
            
            console.log(`📊 Change tracking recorded with serial: ${changeTrackingResult.serialNumber}`);
            
            return res.status(201).json({
                success: true,
                data: {
                    employee: savedEmployee,
                    changeTracking: {
                        serialNumber: changeTrackingResult.serialNumber,
                        changesRecorded: changeTrackingResult.changes?.length || 0
                    },
                    metadata: {
                        month: currentMonth,
                        year: currentYear,
                        rate: parseFloat(rate),
                        siteID: siteID.trim(),
                        createdBy: createdBy
                    }
                },
                message: `Employee ${name} (${newEmpId}) created successfully for ${currentMonth}/${currentYear} by ${createdBy}`
            });
              } catch (trackingError) {
            console.warn('⚠️ Employee created but change tracking failed:', trackingError.message);
            // Employee was created successfully, but change tracking failed
            return res.status(201).json({
                success: true,
                data: {
                    employee: savedEmployee,
                    changeTracking: {
                        error: 'Change tracking failed but employee was created',
                        details: trackingError.message
                    },
                    metadata: {
                        month: currentMonth,
                        year: currentYear,
                        rate: parseFloat(rate),
                        siteID: siteID.trim(),
                        createdBy: createdBy
                    }
                },
                message: `Employee ${name} (${newEmpId}) created successfully for ${currentMonth}/${currentYear} by ${createdBy} (change tracking failed)`
            });
        }
        
    } catch (error) {
        console.error('❌ Error creating employee:', error);
        
        // Handle specific MongoDB errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'Employee with this ID already exists for the specified month/year.',
                details: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Error creating employee.',
            message: error.message
        });
    }
});


// Delete employee endpoint with ChangeTracker integration
router.delete('/deleteemployee', authenticateToken, async (req, res) => {
    try {
        console.log('🗑️ Delete employee request:', req.body);

        const { empid, name, month, year, deletePreviousMonth } = req.body;
        
        // Validate required fields
        if (!empid || empid.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Employee ID is required and cannot be empty.'
            });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Employee name is required and cannot be empty.'
            });
        }
        
        if (!month || !year) {
            return res.status(400).json({
                success: false,
                error: 'Month and year are required.'
            });
        }

        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                error: 'Month must be between 1 and 12.'
            });
        }

        if (year < 2000 || year > 2100) {
            return res.status(400).json({
                success: false,
                error: 'Year must be between 2000 and 2100.'
            });
        }

        // Get user info from auth middleware
        const deletedBy = req.user?.email || req.user?.userEmail || 'unknown-user';
        
        console.log(`🔍 Looking for employee ${empid} for deletion by ${deletedBy}`);

        let deletedEmployees = [];
        let changeTrackingResults = [];

        if (deletePreviousMonth) {
            // Delete all records for this employee across all months and years
            console.log(`🗑️ Deleting ALL records for employee ${empid} (including previous months)`);
            
            // Find all employee records
            const allEmployeeRecords = await employeeSchema.find({ empid: empid.trim() });
            
            if (!allEmployeeRecords || allEmployeeRecords.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: `No records found for employee ${empid}.`
                });
            }

            console.log(`📊 Found ${allEmployeeRecords.length} records for employee ${empid}`);

            // Process each record for change tracking before deletion
            for (const employeeRecord of allEmployeeRecords) {
                try {
                    // Store original data for change tracking
                    const originalData = employeeRecord.toObject();
                    
                    // Track the deletion using ChangeTracker
                    const changeTrackingResult = await TrackChanges(
                        employeeRecord.siteID,
                        empid.trim(),
                        employeeRecord.month,
                        employeeRecord.year,
                        new Date(),
                        deletedBy,
                        `Employee "${name}" completely deleted from the system (including all historical data) by ${deletedBy}. Reason: Delete previous month data option was selected.`,
                        originalData, // oldEmployeeData
                        {}, // newEmployeeData (empty for deletion)
                        {
                            ipAddress: req.ip || 'unknown',
                            userAgent: req.get('User-Agent') || 'unknown',
                            sessionId: req.session?.id || 'unknown',
                            applicationVersion: '1.0.0',
                            deletionType: 'complete_deletion',
                            deletedByUser: deletedBy,
                            deletePreviousMonth: true,
                            targetMonth: month,
                            targetYear: year
                        }
                    );
                    
                    changeTrackingResults.push({
                        month: employeeRecord.month,
                        year: employeeRecord.year,
                        serialNumber: changeTrackingResult.serialNumber,
                        siteID: employeeRecord.siteID
                    });
                    
                    console.log(`📊 Change tracking recorded for ${employeeRecord.month}/${employeeRecord.year} with serial: ${changeTrackingResult.serialNumber}`);
                    
                } catch (trackingError) {
                    console.warn(`⚠️ Change tracking failed for ${employeeRecord.month}/${employeeRecord.year}:`, trackingError.message);
                    changeTrackingResults.push({
                        month: employeeRecord.month,
                        year: employeeRecord.year,
                        error: trackingError.message,
                        siteID: employeeRecord.siteID
                    });
                }
            }

            // Delete all records
            const deleteResult = await employeeSchema.deleteMany({ empid: empid.trim() });
            deletedEmployees = allEmployeeRecords.map(emp => ({
                empid: emp.empid,
                name: emp.name,
                month: emp.month,
                year: emp.year,
                siteID: emp.siteID
            }));

            console.log(`✅ Deleted ${deleteResult.deletedCount} records for employee ${empid}`);

        } else {
            // Delete only the specific month/year record
            console.log(`🗑️ Deleting specific record: ${empid} for ${month}/${year}`);
            
            // Find the specific employee record
            const employeeRecord = await employeeSchema.findOne({
                empid: empid.trim(),
                month: parseInt(month),
                year: parseInt(year)
            });
            
            if (!employeeRecord) {
                return res.status(404).json({
                    success: false,
                    error: `Employee ${empid} not found for ${month}/${year}.`
                });
            }

            // Store original data for change tracking
            const originalData = employeeRecord.toObject();
            
            try {
                // Track the deletion using ChangeTracker
                const changeTrackingResult = await TrackChanges(
                    employeeRecord.siteID,
                    empid.trim(),
                    parseInt(month),
                    parseInt(year),
                    new Date(),
                    deletedBy,
                    `Employee "${name}" deleted from ${month}/${year} by ${deletedBy}. Only current month data was deleted.`,
                    originalData, // oldEmployeeData
                    {}, // newEmployeeData (empty for deletion)
                    {
                        ipAddress: req.ip || 'unknown',
                        userAgent: req.get('User-Agent') || 'unknown',
                        sessionId: req.session?.id || 'unknown',
                        applicationVersion: '1.0.0',
                        deletionType: 'single_month_deletion',
                        deletedByUser: deletedBy,
                        deletePreviousMonth: false,
                        targetMonth: month,
                        targetYear: year
                    }
                );
                
                changeTrackingResults.push({
                    month: parseInt(month),
                    year: parseInt(year),
                    serialNumber: changeTrackingResult.serialNumber,
                    siteID: employeeRecord.siteID
                });
                
                console.log(`📊 Change tracking recorded with serial: ${changeTrackingResult.serialNumber}`);
                
            } catch (trackingError) {
                console.warn('⚠️ Change tracking failed:', trackingError.message);
                changeTrackingResults.push({
                    month: parseInt(month),
                    year: parseInt(year),
                    error: trackingError.message,
                    siteID: employeeRecord.siteID
                });
            }

            // Delete the specific record
            await employeeSchema.findByIdAndDelete(employeeRecord._id);
            deletedEmployees = [{
                empid: employeeRecord.empid,
                name: employeeRecord.name,
                month: employeeRecord.month,
                year: employeeRecord.year,
                siteID: employeeRecord.siteID
            }];

            console.log(`✅ Deleted employee ${empid} for ${month}/${year}`);
        }

        // Prepare response
        const deletionSummary = {
            success: true,
            data: {
                deletedEmployees: deletedEmployees,
                changeTracking: changeTrackingResults,
                deletionMetadata: {
                    empid: empid.trim(),
                    name: name.trim(),
                    targetMonth: parseInt(month),
                    targetYear: parseInt(year),
                    deletePreviousMonth: deletePreviousMonth,
                    deletedBy: deletedBy,
                    deletionDate: new Date(),
                    totalRecordsDeleted: deletedEmployees.length
                }
            },
            message: deletePreviousMonth 
                ? `Employee ${name} (${empid}) completely deleted from the system including all historical data. ${deletedEmployees.length} records deleted.`
                : `Employee ${name} (${empid}) deleted for ${month}/${year}. 1 record deleted.`
        };

        // Check if any change tracking failed
        const failedTrackings = changeTrackingResults.filter(result => result.error);
        if (failedTrackings.length > 0) {
            deletionSummary.warnings = {
                message: 'Employee deleted successfully but some change tracking entries failed',
                failedTrackings: failedTrackings
            };
        }

        return res.status(200).json(deletionSummary);
        
    } catch (error) {
        console.error('❌ Error deleting employee:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Error deleting employee.',
            message: error.message,
            details: {
                empid: req.body.empid,
                month: req.body.month,
                year: req.body.year,
                deletePreviousMonth: req.body.deletePreviousMonth
            }
        });
    }
});


// Import employee from previous month 
router.post('/importemployees', authenticateToken, async (req, res) => {
    try {
        console.log('📥 Import employees from previous month request:', req.body);

        const { 
            sourceMonth, 
            sourceYear, 
            targetMonth, 
            targetYear, 
            siteID, 
            employeeIds = [], // Optional: specific employee IDs to import, if empty imports all
            preserveCarryForward = true, // Whether to carry forward balance from previous month
            preserveAdditionalPays = false // Whether to carry forward additional payments
        } = req.body;

        // Validate required fields
        if (!sourceMonth || !sourceYear || !targetMonth || !targetYear) {
            return res.status(400).json({
                success: false,
                error: 'Source month/year and target month/year are required.'
            });
        }

        if (!siteID || siteID.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Site ID is required and cannot be empty.'
            });
        }

        // Validate month and year ranges
        if (sourceMonth < 1 || sourceMonth > 12 || targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({
                success: false,
                error: 'Month must be between 1 and 12.'
            });
        }

        if (sourceYear < 2000 || sourceYear > 2100 || targetYear < 2000 || targetYear > 2100) {
            return res.status(400).json({
                success: false,
                error: 'Year must be between 2000 and 2100.'
            });
        }

        // Prevent importing to the same month/year
        if (sourceMonth === targetMonth && sourceYear === targetYear) {
            return res.status(400).json({
                success: false,
                error: 'Source and target month/year cannot be the same.'
            });
        }

        // Get user info from auth middleware
        const importedBy = req.user?.email || req.user?.userEmail || 'unknown-user';
        
        console.log(`🔍 Importing employees from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear} for site ${siteID}`);

        // Build query for source employees
        let sourceQuery = {
            month: parseInt(sourceMonth),
            year: parseInt(sourceYear),
            siteID: siteID.trim()
        };

        // If specific employee IDs are provided, filter by them
        if (employeeIds.length > 0) {
            sourceQuery.empid = { $in: employeeIds };
            console.log(`🎯 Importing specific employees: ${employeeIds.join(', ')}`);
        }

        // Find employees from source month/year
        const sourceEmployees = await employeeSchema.find(sourceQuery);

        if (!sourceEmployees || sourceEmployees.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No employees found for ${sourceMonth}/${sourceYear} at site ${siteID}${employeeIds.length > 0 ? ` with specified IDs` : ''}.`
            });
        }

        console.log(`📊 Found ${sourceEmployees.length} employees to import`);

        // Check if any employees already exist in target month/year
        const existingTargetEmployees = await employeeSchema.find({
            month: parseInt(targetMonth),
            year: parseInt(targetYear),
            siteID: siteID.trim(),
            empid: { $in: sourceEmployees.map(emp => emp.empid) }
        });

        if (existingTargetEmployees.length > 0) {
            const existingIds = existingTargetEmployees.map(emp => emp.empid);
            console.log(`⚠️ Found ${existingTargetEmployees.length} employees already exist in target month:`, existingIds);
            
            return res.status(409).json({
                success: false,
                error: `Some employees already exist in ${targetMonth}/${targetYear}`,
                details: {
                    existingEmployeeIds: existingIds,
                    message: `Please remove existing employees first or choose different employee IDs to import.`
                }
            });
        }

        // Process each source employee for import
        const importResults = [];
        const changeTrackingResults = [];

        for (const sourceEmployee of sourceEmployees) {
            try {
                console.log(`🔄 Processing employee ${sourceEmployee.empid} (${sourceEmployee.name})`);

                // Calculate carry forward amount from source employee's closing balance
                const carryForwardAmount = preserveCarryForward ? (sourceEmployee.closing_balance || 0) : 0;
                
                // Prepare new employee data for target month/year
                const newEmployeeData = {
                    name: sourceEmployee.name,
                    empid: sourceEmployee.empid, // Preserve the same employee ID
                    rate: sourceEmployee.rate, // Keep the same rate
                    month: parseInt(targetMonth),
                    year: parseInt(targetYear),
                    siteID: sourceEmployee.siteID,
                    payouts: [], // Start with empty payouts for new month
                    wage: 0, // Will be calculated based on attendance
                    additional_req_pays: preserveAdditionalPays ? [...(sourceEmployee.additional_req_pays || [])] : [],
                    attendance: [], // Start with empty attendance for new month
                    closing_balance: carryForwardAmount, // Set initial balance to carry forward amount
                    carry_forwarded: {
                        value: carryForwardAmount,
                        remark: carryForwardAmount > 0 
                            ? `Carried forward from ${sourceMonth}/${sourceYear} - Previous balance: ${carryForwardAmount}`
                            : `New month import from ${sourceMonth}/${sourceYear} - No carry forward`,
                        date: new Date()
                    },
                    createdBy: importedBy,
                    attendanceHistory: {},
                    recalculationneeded: false
                };

                // Create and save new employee record
                const newEmployee = new employeeSchema(newEmployeeData);
                const savedEmployee = await newEmployee.save();

                console.log(`✅ Employee ${sourceEmployee.empid} imported successfully`);

                // Track the import using ChangeTracker
                try {
                    const changeTrackingResult = await TrackChanges(
                        siteID.trim(),
                        sourceEmployee.empid,
                        parseInt(targetMonth),
                        parseInt(targetYear),
                        new Date(),
                        importedBy,
                        `Employee "${sourceEmployee.name}" imported from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear} by ${importedBy}. Carry forward: ${carryForwardAmount}`,
                        {}, // oldEmployeeData (empty for import)
                        savedEmployee.toObject(), // newEmployeeData
                        {
                            ipAddress: req.ip || 'unknown',
                            userAgent: req.get('User-Agent') || 'unknown',
                            sessionId: req.session?.id || 'unknown',
                            applicationVersion: '1.0.0',
                            operationType: 'employee_import',
                            importedByUser: importedBy,
                            sourceMonth: parseInt(sourceMonth),
                            sourceYear: parseInt(sourceYear),
                            targetMonth: parseInt(targetMonth),
                            targetYear: parseInt(targetYear),
                            carryForwardAmount: carryForwardAmount,
                            preserveCarryForward: preserveCarryForward,
                            preserveAdditionalPays: preserveAdditionalPays
                        }
                    );
                    
                    changeTrackingResults.push({
                        empid: sourceEmployee.empid,
                        serialNumber: changeTrackingResult.serialNumber,
                        success: true
                    });
                    
                    console.log(`📊 Change tracking recorded for ${sourceEmployee.empid} with serial: ${changeTrackingResult.serialNumber}`);
                    
                } catch (trackingError) {
                    console.warn(`⚠️ Change tracking failed for ${sourceEmployee.empid}:`, trackingError.message);
                    changeTrackingResults.push({
                        empid: sourceEmployee.empid,
                        error: trackingError.message,
                        success: false
                    });
                }

                // Add to results
                importResults.push({
                    empid: sourceEmployee.empid,
                    name: sourceEmployee.name,
                    sourceMonth: parseInt(sourceMonth),
                    sourceYear: parseInt(sourceYear),
                    targetMonth: parseInt(targetMonth),
                    targetYear: parseInt(targetYear),
                    carryForwardAmount: carryForwardAmount,
                    rate: sourceEmployee.rate,
                    success: true
                });

            } catch (employeeError) {
                console.error(`❌ Error importing employee ${sourceEmployee.empid}:`, employeeError.message);
                
                importResults.push({
                    empid: sourceEmployee.empid,
                    name: sourceEmployee.name,
                    error: employeeError.message,
                    success: false
                });
            }
        }

        // Prepare response summary
        const successfulImports = importResults.filter(result => result.success);
        const failedImports = importResults.filter(result => !result.success);
        const totalCarryForward = successfulImports.reduce((sum, emp) => sum + (emp.carryForwardAmount || 0), 0);

        console.log(`✅ Import completed: ${successfulImports.length} successful, ${failedImports.length} failed`);

        const response = {
            success: true,
            data: {
                importResults: importResults,
                changeTracking: changeTrackingResults,
                summary: {
                    totalEmployeesProcessed: importResults.length,
                    successfulImports: successfulImports.length,
                    failedImports: failedImports.length,
                    totalCarryForwardAmount: totalCarryForward,
                    sourceMonth: parseInt(sourceMonth),
                    sourceYear: parseInt(sourceYear),
                    targetMonth: parseInt(targetMonth),
                    targetYear: parseInt(targetYear),
                    siteID: siteID.trim(),
                    importedBy: importedBy,
                    importDate: new Date(),
                    preserveCarryForward: preserveCarryForward,
                    preserveAdditionalPays: preserveAdditionalPays
                }
            },
            message: `Successfully imported ${successfulImports.length} employees from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear}${failedImports.length > 0 ? `. ${failedImports.length} imports failed.` : ''}`
        };

        // Add warnings if any imports failed
        if (failedImports.length > 0) {
            response.warnings = {
                message: 'Some employee imports failed',
                failedImports: failedImports
            };
        }

        // Add change tracking warnings if any failed
        const failedTrackings = changeTrackingResults.filter(result => !result.success);
        if (failedTrackings.length > 0) {
            response.warnings = response.warnings || {};
            response.warnings.changeTrackingIssues = {
                message: 'Some change tracking entries failed',
                failedTrackings: failedTrackings
            };
        }

        return res.status(201).json(response);
        
    } catch (error) {
        console.error('❌ Error importing employees:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Error importing employees from previous month.',
            message: error.message,
            details: {
                sourceMonth: req.body.sourceMonth,
                sourceYear: req.body.sourceYear,
                targetMonth: req.body.targetMonth,
                targetYear: req.body.targetYear,
                siteID: req.body.siteID
            }
        });
    }
});

// Get employee details with pending payoutes in month
router.get('/employeewithpendingpayouts', authenticateToken, async (req, res) => {
    // Required query parameters: month, year, and siteID
    console.log('Query Parameters:', req.query);
    const { month, year, siteID } = req.query;
    
    // Validate required parameters
    if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required.' });
    }
    
    if (!siteID) {
        return res.status(400).json({ error: 'Site ID is required.' });
    }

    try {
        console.log(`🔍 Fetching employees for site ${siteID} - ${month}/${year}`);
        
        // First get all employees for the specified month/year/site
        const employees = await employeeSchema.find({
            month: parseInt(month),
            year: parseInt(year),
            siteID: siteID
        }).populate('siteID', 'sitename');

        if (!employees || employees.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: `No employees found for ${month}/${year} at site ${siteID}`
            });
        }

        console.log(`📊 Processing ${employees.length} employees`);

        // Process each employee using the Jobs utility
        const employeeDetails = await Promise.all(employees.map(async (employee) => {
            try {
                // Use FetchlatestData to get updated employee data (handles recalculation if needed)
                const latestEmployeeData = await FetchlatestData(siteID, employee.empid, parseInt(month), parseInt(year));
                
                // Calculate additional data using Jobs utility
                const calculationResult = calculateEmployeeData(latestEmployeeData);
                console.log(`🔢 Calculated data for employee ${employee.empid}:`, calculationResult);
                
                // Get additional fields for frontend compatibility
                const totalAdditionalReqPays = latestEmployeeData.additional_req_pays?.reduce((sum, pay) => sum + (pay.value || 0), 0) || 0;
                const totalPayouts = latestEmployeeData.payouts?.reduce((sum, payout) => sum + (payout.value || 0), 0) || 0;
                const carryForward = latestEmployeeData.carry_forwarded?.value || 0;
                
                // Return employee data with calculated values only if closing balance is not zero
                if (calculationResult.closing_balance === 0) {
                    return null; // Skip this employee if closing balance is zero
                }

                // Return in the same format as before for frontend compatibility
                return {
                    ...latestEmployeeData.toObject(),
                    totalWage: calculationResult.totalWage,
                    totalPayouts: totalPayouts,
                    carryForward: carryForward,
                    closing_balance: calculationResult.closing_balance,
                    totalAttendance: calculationResult.totalAttendance,
                    totalDays: calculationResult.totalDays,
                    totalovertime: calculationResult.totalOvertime,
                    // Additional useful fields from calculation
                    overtimeDays: calculationResult.overtimeDays,
                    totalAdditionalReqPays: totalAdditionalReqPays
                };

            } catch (employeeError) {
                console.warn(`⚠️  Error processing employee ${employee.empid}: ${employeeError.message}`);
                return null; // Skip problematic employees
            }
        }));

        // Filter out null values (employees with zero balance or errors)
        const validEmployeeDetails = employeeDetails.filter(emp => emp !== null);

        console.log(`✅ Successfully processed ${validEmployeeDetails.length} employees with pending payouts`);

        // Send the response with calculated employee details
        return res.status(200).json({
            success: true,
            data: validEmployeeDetails,
            message: `Found ${validEmployeeDetails.length} employees with pending payouts for ${month}/${year}`,
            totalProcessed: employees.length,
            withPendingPayouts: validEmployeeDetails.length
        });    } catch (error) {
        console.error('❌ Error fetching employee details:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Error fetching employee details.',
            message: error.message 
        });
    }
});


// Get all employee details for a month (including zero balance employees)
// Useful for administrative purposes and data verification
router.get('/allemployees', authenticateToken, async (req, res) => {
    const { month, year, siteID } = req.query;
    
    // Validate required parameters
    if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required.' });
    }
    
    if (!siteID) {
        return res.status(400).json({ error: 'Site ID is required.' });
    }

    try {
        console.log(`🔍 Fetching ALL employees for site ${siteID} - ${month}/${year}`);
        
        // Get all employees for the specified month/year/site
        const employees = await employeeSchema.find({
            month: parseInt(month),
            year: parseInt(year),
            siteID: siteID
        }).populate('siteID', 'sitename');

        if (!employees || employees.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: `No employees found for ${month}/${year} at site ${siteID}`
            });
        }

        console.log(`📊 Processing ${employees.length} employees (including zero balance)`);

        // Process each employee using the Jobs utility
        const employeeDetails = await Promise.all(employees.map(async (employee) => {
            try {
                // Use FetchlatestData to get updated employee data
                const latestEmployeeData = await FetchlatestData(siteID, employee.empid, parseInt(month), parseInt(year));
                // Calculate additional data using Jobs utility
                const calculationResult = calculateEmployeeData(latestEmployeeData);
         
                // Get additional fields for frontend compatibility
                const totalAdditionalReqPays = latestEmployeeData.additional_req_pays?.reduce((sum, pay) => sum + (pay.value || 0), 0) || 0;
                const totalPayouts = latestEmployeeData.payouts?.reduce((sum, payout) => sum + (payout.value || 0), 0) || 0;
                const carryForward = latestEmployeeData.carry_forwarded?.value || 0;

                // Return all employees (including zero balance)
                return {
                    ...latestEmployeeData.toObject(),
                    totalWage: calculationResult.totalWage,
                    totalPayouts: totalPayouts,
                    carryForward: carryForward,
                    closing_balance: calculationResult.closing_balance,
                    totalAttendance: calculationResult.totalAttendance,
                    totalDays: calculationResult.totalDays,
                    totalovertime: calculationResult.totalOvertime,
                    overtimeDays: calculationResult.overtimeDays,
                    totalAdditionalReqPays: totalAdditionalReqPays,
                    // Additional status fields
                    hasPendingPayouts: calculationResult.closing_balance !== 0,
                    needsRecalculation: latestEmployeeData.recalculationneeded || false
                };

            } catch (employeeError) {
                console.warn(`⚠️  Error processing employee ${employee.empid}: ${employeeError.message}`);
                // Return basic employee data with error flag
                return {
                    ...employee.toObject(),
                    error: true,
                    errorMessage: employeeError.message,
                    closing_balance: 0,
                    hasPendingPayouts: false
                };
            }
        }));

        // Separate employees with and without pending payouts
        const withPendingPayouts = employeeDetails.filter(emp => emp.closing_balance !== 0 && !emp.error);
        const withZeroBalance = employeeDetails.filter(emp => emp.closing_balance === 0 && !emp.error);
        const withErrors = employeeDetails.filter(emp => emp.error);

        console.log(`✅ Processed: ${withPendingPayouts.length} with payouts, ${withZeroBalance.length} with zero balance, ${withErrors.length} with errors`);

        return res.status(200).json({
            success: true,
            data: employeeDetails,
            summary: {
                total: employeeDetails.length,
                withPendingPayouts: withPendingPayouts.length,
                withZeroBalance: withZeroBalance.length,
                withErrors: withErrors.length
            },            message: `Found ${employeeDetails.length} employees for ${month}/${year}`
        });
    } catch (error) {
        console.error('❌ Error fetching all employee details:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Error fetching employee details.',
            message: error.message 
        });
    }
});

// Get available employees for import from specific month/year
router.get('/availableforimport', authenticateToken, async (req, res) => {
    try {
        const { sourceMonth, sourceYear, targetMonth, targetYear, siteID } = req.query;
        
        // Validate required parameters
        if (!sourceMonth || !sourceYear || !siteID) {
            return res.status(400).json({
                success: false,
                error: 'Source month, year, and site ID are required.'
            });
        }

        console.log(`🔍 Finding available employees for import from ${sourceMonth}/${sourceYear} for site ${siteID}`);

        // Get all employees from source month/year
        const sourceEmployees = await employeeSchema.find({
            month: parseInt(sourceMonth),
            year: parseInt(sourceYear),
            siteID: siteID.trim()
        }).select('empid name rate closing_balance createdBy');

        if (!sourceEmployees || sourceEmployees.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: `No employees found for ${sourceMonth}/${sourceYear} at site ${siteID}`
            });
        }

        // If target month/year provided, check which employees already exist there
        let unavailableEmployeeIds = [];
        if (targetMonth && targetYear) {
            const existingTargetEmployees = await employeeSchema.find({
                month: parseInt(targetMonth),
                year: parseInt(targetYear),
                siteID: siteID.trim(),
                empid: { $in: sourceEmployees.map(emp => emp.empid) }
            }).select('empid');

            unavailableEmployeeIds = existingTargetEmployees.map(emp => emp.empid);
            console.log(`⚠️ Found ${unavailableEmployeeIds.length} employees already exist in target month`);
        }

        // Prepare employee list with availability status
        const availableEmployees = sourceEmployees.map(employee => ({
            empid: employee.empid,
            name: employee.name,
            rate: employee.rate,
            closing_balance: employee.closing_balance || 0,
            createdBy: employee.createdBy,
            availableForImport: !unavailableEmployeeIds.includes(employee.empid),
            alreadyExistsInTarget: unavailableEmployeeIds.includes(employee.empid)
        }));

        const availableCount = availableEmployees.filter(emp => emp.availableForImport).length;
        const unavailableCount = availableEmployees.length - availableCount;

        console.log(`✅ Found ${availableEmployees.length} employees: ${availableCount} available, ${unavailableCount} already exist in target`);

        return res.status(200).json({
            success: true,
            data: availableEmployees,
            summary: {
                totalEmployees: availableEmployees.length,
                availableForImport: availableCount,
                alreadyExistInTarget: unavailableCount,
                sourceMonth: parseInt(sourceMonth),
                sourceYear: parseInt(sourceYear),
                targetMonth: targetMonth ? parseInt(targetMonth) : null,
                targetYear: targetYear ? parseInt(targetYear) : null,
                siteID: siteID.trim()
            },
            message: `Found ${availableEmployees.length} employees from ${sourceMonth}/${sourceYear}${targetMonth && targetYear ? `. ${availableCount} available for import to ${targetMonth}/${targetYear}` : ''}`
        });
        
    } catch (error) {
        console.error('❌ Error fetching available employees for import:', error);
        return res.status(500).json({
            success: false,
            error: 'Error fetching available employees for import.',
            message: error.message
        });
    }
});



module.exports = router;
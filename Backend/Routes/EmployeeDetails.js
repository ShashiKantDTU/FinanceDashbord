const express = require("express");
const mongoose = require("mongoose");
const employeeSchema = require("../models/EmployeeSchema");
const User = require("../models/Userschema");
const {
  FetchlatestData,
  calculateEmployeeData,
  validateBasicParams,
} = require("../Utils/Jobs");
const { trackOptimizedChanges } = require("../Utils/OptimizedChangeTracker");
const { latestEmpSerialNumber } = require("../Utils/EmployeeUtils");
const { authenticateAndTrack } = require("../Middleware/usageTracker");
const { pendingAttendance } = require("../Utils/EmployeeUtils");
const { markEmployeesForRecalculation } = require("../Utils/Jobs");
const router = express.Router();



/**
 * Helper function to mark future months for recalculation after employee deletion
 * @param {String} siteID - Site identifier
 * @param {String} empid - Employee identifier
 * @param {Number} month - Month that was deleted
 * @param {Number} year - Year that was deleted
 * @param {String} deletedBy - User who performed the deletion
 * @returns {Object} Recalculation result with success/error info
 */
const handleRecalculationMarking = async (siteID, empid, month, year, deletedBy, userdata = null) => {
  try {
    // Calculate the next month after the deleted month
    let nextMonth = parseInt(month) + 1;
    let nextYear = parseInt(year);

    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    // Only mark future months if the next month is not in the future
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Check if there are any future months to mark
    if (nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth)) {
      // console.log(`📅 No future months to mark for recalculation - deleted month ${month}/${year} is current or future`);
      return {
        success: true,
        recalculationMarked: {
          futureRecordsMarked: 0,
          reason: "No future months exist after the deleted month",
          markedBy: deletedBy,
          markedAt: new Date()
        }
      };
    }

    // console.log(`🔄 Marking future months for recalculation for employee ${empid} starting from ${nextMonth}/${nextYear}`);

    const recalculationResult = await markEmployeesForRecalculation(
      siteID,
      empid,
      nextMonth,
      nextYear,
      userdata
    );

    // console.log(`📊 Marked ${recalculationResult.modifiedCount} future records for recalculation`);

    return {
      success: true,
      recalculationMarked: {
        futureRecordsMarked: recalculationResult.modifiedCount,
        startingFromMonth: `${nextMonth}/${nextYear}`,
        reason: "Employee deletion affects carry-forward calculations for future months",
        markedBy: deletedBy,
        markedAt: new Date()
      }
    };
  } catch (recalculationError) {
    console.warn("⚠️ Failed to mark future months for recalculation:", recalculationError.message);

    return {
      success: false,
      recalculationWarning: {
        error: "Failed to mark future months for recalculation",
        details: recalculationError.message,
        impact: "Future months may have incorrect carry-forward balances until manually recalculated",
        recommendation: "Manually trigger recalculation for this employee's future months"
      }
    };
  }
};

// Create new employee endpoint (requires name, siteID, and wage)
router.post("/addemployee", authenticateAndTrack, async (req, res) => {
  try {
    // console.log("📝 Creating new employee:", req.body);

    const { name, siteID, wage: rate, month, year } = req.body;
    // If month and year are not provided, use current month/year
    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Employee name is required and cannot be empty.",
      });
    }

    if (!siteID || siteID.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Site ID is required and cannot be empty.",
      });
    }

    if (!rate || rate <= 0) {
      return res.status(400).json({
        success: false,
        error: "Wage must be provided and must be greater than 0.",
      });
    }

    if (!month || !year) {
      // console.log("No month/year provided, using current month/year");
    }

    // // Set default values for other required fields
    // const currentDate = new Date();
    // const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
    // const currentYear = currentDate.getFullYear();

    // Get user info from auth middleware (JWT contains email)
    const createdBy = req.user.name || req.user?.email || "unknown-user";

    // Get the latest employee serial number
    const latestSerial = await latestEmpSerialNumber();
    const newSerial = latestSerial + 1;
    const newEmpId = `EMP${newSerial.toString().padStart(3, "0")}`;
    // console.log(
    //   `🆔 Assigning new employee ID: ${newEmpId} (latest serial: ${latestSerial})`
    // );
    // console.log(`👤 Created by: ${createdBy}`);

    let plan = req.user.plan || "free";
    if (plan === 'free') {
      // get already total employees in the month
      const totalEmployees = await employeeSchema.countDocuments({
        siteID: siteID.trim(),
        month: month,
        year: year,
      });
      if (totalEmployees >= 20) {
        return res.status(403).json({
          success: false,
          message: "You have reached the maximum limit of 20 employees for this month. Please upgrade to contractor pro or Haazri Automate to add more employees.",
        });
      }
    }

    // Check if employee already exists for this month/year
    const existingEmployee = await employeeSchema.findOne({
      empid: newEmpId,
      month: month,
      year: year,
    });

    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        error: `Employee ${newEmpId} already exists for ${month}/${year}.`,
      });
    }

    // Create new employee object with provided and default values
    const newEmployeeData = {
      name: name.trim(),
      empid: newEmpId,
      rate: parseFloat(rate),
      month: month,
      year: year,
      siteID: siteID.trim(),
      payouts: [],
      wage: 0,
      additional_req_pays: [],
      attendance: [],
      closing_balance: 0,
      carry_forwarded: {
        value: 0,
        remark: "Initial setup - new employee",
        date: new Date(),
      },
      createdBy: createdBy,
      attendanceHistory: {},
      recalculationneeded: false,
    };

    // Save the new employee
    const newEmployee = new employeeSchema(newEmployeeData);
    const savedEmployee = await newEmployee.save();

    // console.log(`✅ Employee ${newEmpId} created successfully`);
    // Track the addition of the new employee using Optimized Change Tracker
    try {
      const changeTrackingResult = await trackOptimizedChanges(
        siteID.trim(),
        newEmpId,
        month,
        year,
        createdBy,
        `New employee "${name}" added to the system by ${createdBy}`,
        {}, // oldEmployeeData (empty for new employee)
        savedEmployee.toObject() // newEmployeeData
      );

      // console.log(
      //   `📊 Optimized change tracking recorded: ${changeTrackingResult.length} changes logged`
      // );

      return res.status(201).json({
        success: true,
        data: {
          employee: savedEmployee,
          changeTracking: {
            optimized: true,
            changeLogEntries: changeTrackingResult.length,
            changesRecorded: changeTrackingResult.length,
          },
          metadata: {
            month: month,
            year: year,
            rate: parseFloat(rate),
            siteID: siteID.trim(),
            createdBy: createdBy,
          },
        },
        message: `Employee ${name} (${newEmpId}) created successfully for ${month}/${year} by ${createdBy}`,
      });
    } catch (trackingError) {
      console.warn(
        "⚠️ Employee created but optimized change tracking failed:",
        trackingError.message
      );
      // Employee was created successfully, but change tracking failed
      return res.status(201).json({
        success: true,
        data: {
          employee: savedEmployee,
          changeTracking: {
            optimized: true,
            error: "Optimized change tracking failed but employee was created",
            details: trackingError.message,
          },
          metadata: {
            month: month,
            year: year,
            rate: parseFloat(rate),
            siteID: siteID.trim(),
            createdBy: createdBy,
          },
        },
        message: `Employee ${name} (${newEmpId}) created successfully for ${month}/${year} by ${createdBy} (change tracking failed)`,
      });
    }
  } catch (error) {
    console.error("❌ Error creating employee:", error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error:
          "Employee with this ID already exists for the specified month/year.",
        details: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error creating employee.",
      message: error.message,
    });
  }
});

// Delete employee endpoint with ChangeTracker integration and recalculation marking
// When deleting a specific month, all future months need recalculation due to carry-forward impact
router.delete("/deleteemployee", authenticateAndTrack, async (req, res) => {
  try {
    // console.log("🗑️ Delete employee request:", req.body);

    const { empid, name, month, year, deletePreviousMonth = false } = req.body;

    // Validate required fields
    if (!empid || empid.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Employee ID is required and cannot be empty.",
      });
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Employee name is required and cannot be empty.",
      });
    }

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: "Month and year are required.",
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: "Month must be between 1 and 12.",
      });
    }

    if (year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: "Year must be between 2000 and 2100.",
      });
    }

    // Get user info from auth middleware
    const deletedBy = req.user.name || req.user?.email || "unknown-user";

    // console.log(
    //   `🔍 Looking for employee ${empid} for deletion by ${deletedBy}`
    // );

    let deletedEmployees = [];
    let changeTrackingResults = [];

    if (deletePreviousMonth) {
      // Delete all records for this employee across all months and years
      // console.log(
      //   `🗑️ Deleting ALL records for employee ${empid} (including previous months)`
      // );

      // Find all employee records
      const allEmployeeRecords = await employeeSchema.find({
        empid: empid.trim(),
      });

      if (!allEmployeeRecords || allEmployeeRecords.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No records found for employee ${empid}.`,
        });
      }

      // console.log(
      //   `📊 Found ${allEmployeeRecords.length} records for employee ${empid}`
      // );

      // Process each record for change tracking before deletion
      for (const employeeRecord of allEmployeeRecords) {
        try {
          // Store original data for change tracking
          const originalData = employeeRecord.toObject();

          // Track the deletion using Optimized Change Tracker
          const changeTrackingResult = await trackOptimizedChanges(
            employeeRecord.siteID,
            empid.trim(),
            employeeRecord.month,
            employeeRecord.year,
            deletedBy,
            `Employee "${name}" completely deleted from the system (including all historical data) by ${deletedBy}. Reason: Delete previous month data option was selected.`,
            originalData, // oldEmployeeData
            {} // newEmployeeData (empty for deletion)
          );

          changeTrackingResults.push({
            month: employeeRecord.month,
            year: employeeRecord.year,
            optimized: true,
            changeLogEntries: changeTrackingResult.length,
            siteID: employeeRecord.siteID,
          });

          // console.log(
          //   `📊 Optimized change tracking recorded for ${employeeRecord.month}/${employeeRecord.year}: ${changeTrackingResult.length} changes`
          // );
        } catch (trackingError) {
          console.warn(
            `⚠️ Optimized change tracking failed for ${employeeRecord.month}/${employeeRecord.year}:`,
            trackingError.message
          );
          changeTrackingResults.push({
            month: employeeRecord.month,
            year: employeeRecord.year,
            optimized: true,
            error: trackingError.message,
            siteID: employeeRecord.siteID,
          });
        }
      }

      // Delete all records
      const deleteResult = await employeeSchema.deleteMany({
        empid: empid.trim(),
      });
      deletedEmployees = allEmployeeRecords.map((emp) => ({
        empid: emp.empid,
        name: emp.name,
        month: emp.month,
        year: emp.year,
        siteID: emp.siteID,
      }));

      // console.log(
      //   `✅ Deleted ${deleteResult.deletedCount} records for employee ${empid}`
      // );

      // Note: No need to mark future months for recalculation when deleting all records
      // since there are no future records to recalculate
    } else {
      // Delete only the specific month/year record
      // console.log(`🗑️ Deleting specific record: ${empid} for ${month}/${year}`);

      // Find the specific employee record
      const employeeRecord = await employeeSchema.findOne({
        empid: empid.trim(),
        month: parseInt(month),
        year: parseInt(year),
      });

      if (!employeeRecord) {
        return res.status(404).json({
          success: false,
          error: `Employee ${empid} not found for ${month}/${year}.`,
        });
      }

      // Store original data for change tracking
      const originalData = employeeRecord.toObject();

      try {
        // Track the deletion using Optimized Change Tracker
        const changeTrackingResult = await trackOptimizedChanges(
          employeeRecord.siteID,
          empid.trim(),
          parseInt(month),
          parseInt(year),
          deletedBy,
          `Employee "${name}" deleted from ${month}/${year} by ${deletedBy}. Only current month data was deleted.`,
          originalData, // oldEmployeeData
          {} // newEmployeeData (empty for deletion)
        );

        changeTrackingResults.push({
          month: parseInt(month),
          year: parseInt(year),
          optimized: true,
          changeLogEntries: changeTrackingResult.length,
          siteID: employeeRecord.siteID,
        });

        // console.log(
        //   `📊 Optimized change tracking recorded: ${changeTrackingResult.length} changes`
        // );
      } catch (trackingError) {
        console.warn(
          "⚠️ Optimized change tracking failed:",
          trackingError.message
        );
        changeTrackingResults.push({
          month: parseInt(month),
          year: parseInt(year),
          optimized: true,
          error: trackingError.message,
          siteID: employeeRecord.siteID,
        });
      }

      // Delete the specific record
      await employeeSchema.findByIdAndDelete(employeeRecord._id);
      deletedEmployees = [
        {
          empid: employeeRecord.empid,
          name: employeeRecord.name,
          month: employeeRecord.month,
          year: employeeRecord.year,
          siteID: employeeRecord.siteID,
        },
      ];

      // console.log(`✅ Deleted employee ${empid} for ${month}/${year}`);

      // Mark all future months for recalculation since deleting this month affects carry-forward calculations
      const recalculationResult = await handleRecalculationMarking(
        employeeRecord.siteID,
        empid.trim(),
        parseInt(month),
        parseInt(year),
        deletedBy,
        req.user
      );

      // Add recalculation info to the change tracking results
      const lastChangeTrackingIndex = changeTrackingResults.length - 1;
      if (lastChangeTrackingIndex >= 0) {
        if (recalculationResult.success) {
          changeTrackingResults[lastChangeTrackingIndex].recalculationMarked = recalculationResult.recalculationMarked;
        } else {
          changeTrackingResults[lastChangeTrackingIndex].recalculationWarning = recalculationResult.recalculationWarning;
        }
      }
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
          totalRecordsDeleted: deletedEmployees.length,
        },
      },
      message: deletePreviousMonth
        ? `Employee ${name} (${empid}) completely deleted from the system including all historical data. ${deletedEmployees.length} records deleted.`
        : `Employee ${name} (${empid}) deleted for ${month}/${year}. Future months marked for recalculation to update carry-forward balances.`,
    };

    // Check if any change tracking failed
    const failedTrackings = changeTrackingResults.filter(
      (result) => result.error
    );
    if (failedTrackings.length > 0) {
      deletionSummary.warnings = {
        message:
          "Employee deleted successfully but some change tracking entries failed",
        failedTrackings: failedTrackings,
      };
    }

    // Check for recalculation warnings (only for specific month deletion)
    if (!deletePreviousMonth) {
      const recalculationWarnings = changeTrackingResults.filter(
        (result) => result.recalculationWarning
      );
      if (recalculationWarnings.length > 0) {
        deletionSummary.warnings = deletionSummary.warnings || {};
        deletionSummary.warnings.recalculationIssues = {
          message: "Employee deleted but future month recalculation marking failed",
          details: recalculationWarnings.map(w => w.recalculationWarning),
          recommendation: "Manually trigger recalculation for this employee's future months"
        };
      }

      // Add recalculation success info
      const recalculationSuccess = changeTrackingResults.filter(
        (result) => result.recalculationMarked
      );
      if (recalculationSuccess.length > 0) {
        deletionSummary.data.recalculationInfo = {
          futureMonthsMarked: recalculationSuccess[0].recalculationMarked.futureRecordsMarked,
          reason: recalculationSuccess[0].recalculationMarked.reason,
          note: "Future months will be automatically recalculated when accessed to ensure correct carry-forward balances"
        };
      }
    }

    return res.status(200).json(deletionSummary);
  } catch (error) {
    console.error("❌ Error deleting employee:", error);

    return res.status(500).json({
      success: false,
      error: "Error deleting employee.",
      message: error.message,
      details: {
        empid: req.body.empid,
        month: req.body.month,
        year: req.body.year,
        deletePreviousMonth: req.body.deletePreviousMonth,
      },
    });
  }
});

// Import employee from previous month
router.post("/importemployees", authenticateAndTrack, async (req, res) => {
  try {
    // console.log("📥 Import employees from previous month request:", req.body);

    const {
      sourceMonth,
      sourceYear,
      targetMonth,
      targetYear,
      siteID,
      employeeIds = [], // Optional: specific employee IDs to import, if empty imports all
      preserveCarryForward = true, // Whether to carry forward balance from previous month
      preserveAdditionalPays = false, // Whether to carry forward additional payments
    } = req.body;

    // Validate required fields
    if (!sourceMonth || !sourceYear || !targetMonth || !targetYear) {
      return res.status(400).json({
        success: false,
        error: "Source month/year and target month/year are required.",
      });
    }

    if (!siteID || siteID.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Site ID is required and cannot be empty.",
      });
    }

    // Validate month and year ranges
    if (
      sourceMonth < 1 ||
      sourceMonth > 12 ||
      targetMonth < 1 ||
      targetMonth > 12
    ) {
      return res.status(400).json({
        success: false,
        error: "Month must be between 1 and 12.",
      });
    }

    if (
      sourceYear < 2000 ||
      sourceYear > 2100 ||
      targetYear < 2000 ||
      targetYear > 2100
    ) {
      return res.status(400).json({
        success: false,
        error: "Year must be between 2000 and 2100.",
      });
    }

    // Prevent importing to the same month/year
    if (sourceMonth === targetMonth && sourceYear === targetYear) {
      return res.status(400).json({
        success: false,
        error: "Source and target month/year cannot be the same.",
      });
    }

    // Get user info from auth middleware
    const importedBy = req.user.name || req.user?.email || "unknown-user";

    let plan = req.user.plan || "free";
    if (plan === 'free') {
      // get already total employees in the month
      const totalEmployees = await employeeSchema.countDocuments({
        siteID: siteID.trim(),
        month: targetMonth,
        year: targetYear,
      });
      if (totalEmployees >= 20 || employeeIds.length + totalEmployees > 20) {
        return res.status(403).json({
          success: false,
          message: "You have the maximum limit of 20 employees for this month. Please upgrade to contractor pro or Haazri Automate to add more employees.",
        });
      }
    }



    // console.log(
    //   `🔍 Importing employees from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear} for site ${siteID}`
    // );

    // Build query for source employees
    let sourceQuery = {
      month: parseInt(sourceMonth),
      year: parseInt(sourceYear),
      siteID: siteID.trim(),
    };

    // If specific employee IDs are provided, filter by them
    if (employeeIds.length > 0) {
      sourceQuery.empid = { $in: employeeIds };
      // console.log(`🎯 Importing specific employees: ${employeeIds.join(", ")}`);
    }

    // Find employees from source month/year
    const sourceEmployees = await employeeSchema.find(sourceQuery);

    if (!sourceEmployees || sourceEmployees.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No employees found for ${sourceMonth}/${sourceYear} at site ${siteID}${employeeIds.length > 0 ? ` with specified IDs` : ""
          }.`,
      });
    }

    // console.log(`📊 Found ${sourceEmployees.length} employees to import`);

    // Check if any employees already exist in target month/year
    const existingTargetEmployees = await employeeSchema.find({
      month: parseInt(targetMonth),
      year: parseInt(targetYear),
      siteID: siteID.trim(),
      empid: { $in: sourceEmployees.map((emp) => emp.empid) },
    });

    if (existingTargetEmployees.length > 0) {
      const existingIds = existingTargetEmployees.map((emp) => emp.empid);
      // console.log(
      //   `⚠️ Found ${existingTargetEmployees.length} employees already exist in target month:`,
      //   existingIds
      // );

      return res.status(409).json({
        success: false,
        error: `Some employees already exist in ${targetMonth}/${targetYear}`,
        details: {
          existingEmployeeIds: existingIds,
          message: `Please remove existing employees first or choose different employee IDs to import.`,
        },
      });
    }

    // Process each source employee for import
    const importResults = [];
    const changeTrackingResults = [];

    for (const sourceEmployee of sourceEmployees) {
      try {
        // console.log(
        //   `🔄 Processing employee ${sourceEmployee.empid} (${sourceEmployee.name})`
        // );

        // Calculate carry forward amount from source employee's closing balance
        const carryForwardAmount = preserveCarryForward
          ? sourceEmployee.closing_balance || 0
          : 0;

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
          additional_req_pays: preserveAdditionalPays
            ? [...(sourceEmployee.additional_req_pays || [])]
            : [],
          attendance: [], // Start with empty attendance for new month
          closing_balance: carryForwardAmount, // Set initial balance to carry forward amount
          carry_forwarded: {
            value: carryForwardAmount,
            remark:
              carryForwardAmount > 0
                ? `Carried forward from ${sourceMonth}/${sourceYear} - Previous balance: ${carryForwardAmount}`
                : `New month import from ${sourceMonth}/${sourceYear} - No carry forward`,
            date: new Date(),
          },
          createdBy: importedBy,
          attendanceHistory: {},
          recalculationneeded: false,
        };

        // Create and save new employee record
        const newEmployee = new employeeSchema(newEmployeeData);
        const savedEmployee = await newEmployee.save();

        // console.log(
        //   `✅ Employee ${sourceEmployee.empid} imported successfully`
        // );

        // Track the import using Optimized Change Tracker
        try {
          const changeTrackingResult = await trackOptimizedChanges(
            siteID.trim(),
            sourceEmployee.empid,
            parseInt(targetMonth),
            parseInt(targetYear),
            importedBy,
            `Employee "${sourceEmployee.name}" imported from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear} by ${importedBy}. Carry forward: ${carryForwardAmount}`,
            {}, // oldEmployeeData (empty for import)
            savedEmployee.toObject() // newEmployeeData
          );

          changeTrackingResults.push({
            empid: sourceEmployee.empid,
            optimized: true,
            changeLogEntries: changeTrackingResult.length,
            success: true,
          });

          // console.log(
          //   `📊 Optimized change tracking recorded for ${sourceEmployee.empid}: ${changeTrackingResult.length} changes`
          // );
        } catch (trackingError) {
          console.warn(
            `⚠️ Optimized change tracking failed for ${sourceEmployee.empid}:`,
            trackingError.message
          );
          changeTrackingResults.push({
            empid: sourceEmployee.empid,
            optimized: true,
            error: trackingError.message,
            success: false,
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
          success: true,
        });
      } catch (employeeError) {
        console.error(
          `❌ Error importing employee ${sourceEmployee.empid}:`,
          employeeError.message
        );

        importResults.push({
          empid: sourceEmployee.empid,
          name: sourceEmployee.name,
          error: employeeError.message,
          success: false,
        });
      }
    }

    // Prepare response summary
    const successfulImports = importResults.filter((result) => result.success);
    const failedImports = importResults.filter((result) => !result.success);
    const totalCarryForward = successfulImports.reduce(
      (sum, emp) => sum + (emp.carryForwardAmount || 0),
      0
    );

    // console.log(
    //   `✅ Import completed: ${successfulImports.length} successful, ${failedImports.length} failed`
    // );

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
          preserveAdditionalPays: preserveAdditionalPays,
        },
      },
      message: `Successfully imported ${successfulImports.length
        } employees from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear}${failedImports.length > 0
          ? `. ${failedImports.length} imports failed.`
          : ""
        }`,
    };

    // Add warnings if any imports failed
    if (failedImports.length > 0) {
      response.warnings = {
        message: "Some employee imports failed",
        failedImports: failedImports,
      };
    }

    // Add change tracking warnings if any failed
    const failedTrackings = changeTrackingResults.filter(
      (result) => !result.success
    );
    if (failedTrackings.length > 0) {
      response.warnings = response.warnings || {};
      response.warnings.changeTrackingIssues = {
        message: "Some change tracking entries failed",
        failedTrackings: failedTrackings,
      };
    }

    return res.status(201).json(response);
  } catch (error) {
    console.error("❌ Error importing employees:", error);

    return res.status(500).json({
      success: false,
      error: "Error importing employees from previous month.",
      message: error.message,
      details: {
        sourceMonth: req.body.sourceMonth,
        sourceYear: req.body.sourceYear,
        targetMonth: req.body.targetMonth,
        targetYear: req.body.targetYear,
        siteID: req.body.siteID,
      },
    });
  }
});

// Get employee details with pending payoutes in month
router.get("/employeewithpendingpayouts",
  authenticateAndTrack,
  async (req, res) => {
    // Required query parameters: month, year, and siteID
    // console.log("Query Parameters:", req.query);
    const { month, year, siteID } = req.query;

    // Validate required parameters
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required." });
    }

    if (!siteID) {
      return res.status(400).json({ error: "Site ID is required." });
    }

    try {
      // console.log(
      //   `🔍 Fetching employees for site ${siteID} - ${month}/${year}`
      // );

      // First get all employees for the specified month/year/site
      const employees = await employeeSchema
        .find({
          month: parseInt(month),
          year: parseInt(year),
          siteID: siteID,
        })
        .populate("siteID", "sitename");

      if (!employees || employees.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: `No employees found for ${month}/${year} at site ${siteID}`,
        });
      }

      // console.log(`📊 Processing ${employees.length} employees`);

      // Process each employee using the Jobs utility
      const employeeDetails = await Promise.all(
        employees.map(async (employee) => {
          try {
            // Use FetchlatestData to get updated employee data (handles recalculation if needed)
            const latestEmployeeData = await FetchlatestData(
              siteID,
              employee.empid,
              parseInt(month),
              parseInt(year),
              req.user
            );

            // Calculate additional data using Jobs utility
            const calculationResult = calculateEmployeeData(latestEmployeeData, req.user);
            // console.log(
            //   `🔢 Calculated data for employee ${employee.empid}:`,
            //   calculationResult
            // );

            // Get additional fields for frontend compatibility
            const totalAdditionalReqPays =
              latestEmployeeData.additional_req_pays?.reduce(
                (sum, pay) => sum + (pay.value || 0),
                0
              ) || 0;
            const totalPayouts =
              latestEmployeeData.payouts?.reduce(
                (sum, payout) => sum + (payout.value || 0),
                0
              ) || 0;
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
              totalAdditionalReqPays: totalAdditionalReqPays,
            };
          } catch (employeeError) {
            console.warn(
              `⚠️  Error processing employee ${employee.empid}: ${employeeError.message}`
            );
            return null; // Skip problematic employees
          }
        })
      );

      // Filter out null values (employees with zero balance or errors)
      const validEmployeeDetails = employeeDetails.filter(
        (emp) => emp !== null
      );

      // console.log(
      //   `✅ Successfully processed ${validEmployeeDetails.length} employees with pending payouts`
      // );

      // Send the response with calculated employee details
      return res.status(200).json({
        success: true,
        data: validEmployeeDetails,
        message: `Found ${validEmployeeDetails.length} employees with pending payouts for ${month}/${year}`,
        totalProcessed: employees.length,
        withPendingPayouts: validEmployeeDetails.length,
      });
    } catch (error) {
      console.error("❌ Error fetching employee details:", error);
      return res.status(500).json({
        success: false,
        error: "Error fetching employee details.",
        message: error.message,
      });
    }
  }
);

// Get all employee details for a month (including zero balance employees)
// Useful for administrative purposes and data verification
router.get("/allemployees", authenticateAndTrack, async (req, res) => {
  const { month, year, siteID } = req.query;

  // Validate required parameters
  if (!month || !year) {
    return res.status(400).json({ error: "Month and year are required." });
  }

  if (!siteID) {
    return res.status(400).json({ error: "Site ID is required." });
  }

  try {
    // console.log(
    //   `🔍 Fetching ALL employees for site ${siteID} - ${month}/${year}`
    // );

    // Get all employees for the specified month/year/site
    const employees = await employeeSchema
      .find({
        month: parseInt(month),
        year: parseInt(year),
        siteID: siteID,
      })
      .populate("siteID", "sitename");

    if (!employees || employees.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: `No employees found for ${month}/${year} at site ${siteID}`,
      });
    }

    // console.log(
    //   `📊 Processing ${employees.length} employees (including zero balance)`
    // );

    // Process each employee using the Jobs utility
    const employeeDetails = await Promise.all(
      employees.map(async (employee) => {
        try {
          // Use FetchlatestData to get updated employee data
          const latestEmployeeData = await FetchlatestData(
            siteID,
            employee.empid,
            parseInt(month),
            parseInt(year),
            req.user
          );
          // Calculate additional data using Jobs utility
          const calculationResult = calculateEmployeeData(latestEmployeeData, req.user);

          // Get additional fields for frontend compatibility
          const totalAdditionalReqPays =
            latestEmployeeData.additional_req_pays?.reduce(
              (sum, pay) => sum + (pay.value || 0),
              0
            ) || 0;
          const totalPayouts =
            latestEmployeeData.payouts?.reduce(
              (sum, payout) => sum + (payout.value || 0),
              0
            ) || 0;
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
            needsRecalculation: latestEmployeeData.recalculationneeded || false,
          };
        } catch (employeeError) {
          console.warn(
            `⚠️  Error processing employee ${employee.empid}: ${employeeError.message}`
          );
          // Return basic employee data with error flag
          return {
            ...employee.toObject(),
            error: true,
            errorMessage: employeeError.message,
            closing_balance: 0,
            hasPendingPayouts: false,
          };
        }
      })
    );

    // Separate employees with and without pending payouts
    const withPendingPayouts = employeeDetails.filter(
      (emp) => emp.closing_balance !== 0 && !emp.error
    );
    const withZeroBalance = employeeDetails.filter(
      (emp) => emp.closing_balance === 0 && !emp.error
    );
    const withErrors = employeeDetails.filter((emp) => emp.error);

    // console.log(
    //   `✅ Processed: ${withPendingPayouts.length} with payouts, ${withZeroBalance.length} with zero balance, ${withErrors.length} with errors`
    // );

    return res.status(200).json({
      success: true,
      data: employeeDetails,
      summary: {
        total: employeeDetails.length,
        withPendingPayouts: withPendingPayouts.length,
        withZeroBalance: withZeroBalance.length,
        withErrors: withErrors.length,
      },
      message: `Found ${employeeDetails.length} employees for ${month}/${year}`,
    });
  } catch (error) {
    console.error("❌ Error fetching all employee details:", error);
    return res.status(500).json({
      success: false,
      error: "Error fetching employee details.",
      message: error.message,
    });
  }
});

// This new route replaces the old "/allemployees" logic.
// It uses a single aggregation pipeline for maximum efficiency.
router.get("/allemployees-optimized", authenticateAndTrack, async (req, res) => {
  const { month, year, siteID } = req.query;

  // 1. Validate Input Parameters
  if (!month || !year || !siteID) {
    return res.status(400).json({ success: false, error: "Month, year, and siteID are required." });
  }

  try {
    // Get the user's specific calculation type from the authenticated token
    const calculationType = req.user?.calculationType || 'default';

    // 2. Define the Aggregation Pipeline
    // This pipeline will perform all calculations in the database.
    const pipeline = [
      // ====== Stage 1: Filter Documents ======
      // Find only the employees for the requested site, month, and year.
      // This is the most important step for performance. Use an index here.
      {
        $match: {
          siteID: new mongoose.Types.ObjectId(siteID), // Assuming siteID is stored as a String. If it's an ObjectId, use: mongoose.Types.ObjectId(siteID),
          month: parseInt(month),
          year: parseInt(year)
        }
      },

      // ====== Stage 2: Perform Initial Calculations ======
      // Calculate sums and totals from arrays, similar to your .reduce() calls.
      {
        $addFields: {
          totalPayouts: { $sum: "$payouts.value" },
          totalAdditionalReqPays: { $sum: "$additional_req_pays.value" },
          carryForward: { $ifNull: ["$carry_forwarded.value", 0] },

          // Process attendance data to find total present days and overtime hours
          totalDays: {
            $size: {
              $filter: {
                input: "$attendance",
                as: "att",
                cond: { $regexMatch: { input: "$$att", regex: /^P/ } } // Count if string starts with 'P'
              }
            }
          },
          totalovertime: {
            $sum: {
              $map: {
                input: "$attendance",
                as: "att",
                in: { // For each attendance string...
                  $let: {
                    vars: {
                      // Find the numeric part of the string (e.g., '8' from 'P8')
                      overtimeStr: { $arrayElemAt: [{ $regexFindAll: { input: "$$att", regex: /\d+/ } }, 0] }
                    },
                    // Convert to integer, or default to 0 if no number found
                    in: { $ifNull: [{ $toInt: "$$overtimeStr.match" }, 0] }
                  }
                }
              }
            }
          }
        }
      },

      // ====== Stage 3: Perform Final Calculations ======
      // Use the results from Stage 2 to calculate wages and balances.
      {
        $addFields: {
          // This part handles the conditional overtime logic from your original code
          overtimeDays: {
            $cond: {
              if: { $eq: [calculationType, 'special'] },
              then: { // special calculation: Math.floor(totalOvertime / 8) + ((totalOvertime % 8) / 10)
                $add: [
                  { $floor: { $divide: ["$totalovertime", 8] } },
                  { $divide: [{ $mod: ["$totalovertime", 8] }, 10] }
                ]
              },
              else: { // default calculation: totalOvertime / 8
                $divide: ["$totalovertime", 8]
              }
            }
          }
        }
      },

      // ====== Stage 4: Calculate Final Values ======
      // Now calculate totalAttendance, totalWage, and closing_balance
      {
        $addFields: {
          totalAttendance: { $add: ["$totalDays", "$overtimeDays"] },
          totalWage: { $multiply: ["$rate", { $add: ["$totalDays", "$overtimeDays"] }] },
          closing_balance: {
            $subtract: [
              {
                $add: [
                  { $multiply: ["$rate", { $add: ["$totalDays", "$overtimeDays"] }] }, // totalWage
                  "$totalAdditionalReqPays",
                  "$carryForward"
                ]
              },
              "$totalPayouts"
            ]
          }
        }
      },

      // ====== Stage 5: Final Projection ======
      // Shape the output to match your original API response.
      {
        $project: {
          // Include original fields
          _id: 1,
          name: 1,
          empid: 1,
          rate: 1,
          month: 1,
          year: 1,
          siteID: 1,
          payouts: 1,
          additional_req_pays: 1,
          attendance: 1,
          carry_forwarded: 1,
          recalculationneeded: 1,
          // Include all our newly calculated fields
          totalWage: 1,
          totalPayouts: 1,
          carryForward: 1,
          closing_balance: 1,
          totalAttendance: 1,
          totalDays: 1,
          totalovertime: 1,
          overtimeDays: 1,
          totalAdditionalReqPays: 1,
          // Add extra status fields for convenience
          hasPendingPayouts: { $ne: ["$closing_balance", 0] },
        }
      }
    ];

    // 3. Execute the Aggregation
    const employeeDetails = await employeeSchema.aggregate(pipeline);

    if (!employeeDetails) {
      return res.status(404).json({ success: false, message: "Could not retrieve employee data." });
    }

    // 4. Send the Response
    const withPendingPayouts = employeeDetails.filter(emp => emp.hasPendingPayouts);
    const withZeroBalance = employeeDetails.filter(emp => !emp.hasPendingPayouts);

    return res.status(200).json({
      success: true,
      data: employeeDetails,
      summary: {
        total: employeeDetails.length,
        withPendingPayouts: withPendingPayouts.length,
        withZeroBalance: withZeroBalance.length,
      },
      message: `Found ${employeeDetails.length} employees for ${month}/${year}`,
    });

  } catch (error) {
    console.error("❌ Error in optimized /allemployees route:", error);
    return res.status(500).json({
      success: false,
      error: "Error fetching employee details.",
      message: error.message,
    });
  }
});


// Route to get employee with pending attendance on a specific date
router.get("/employeewithpendingattendance",
  authenticateAndTrack,
  async (req, res) => {
    // check for required query parameters
    const dateStr = req.query.date?.toString().trim();
    const monthStr = req.query.month?.toString().trim();
    const yearStr = req.query.year?.toString().trim();
    const siteID = req.query.siteID?.toString().trim();
    if (!dateStr || !monthStr || !yearStr || !siteID) {
      return res.status(400).json({
        success: false,
        error: "Date, month, year, and siteID are required.",
      });
    }
    // Convert to numbers for validation
    const date = Number(dateStr);
    const month = Number(monthStr);
    const year = Number(yearStr);
    if (isNaN(date) || isNaN(month) || isNaN(year)) {
      return res.status(400).json({
        success: false,
        error: "Invalid date, month, or year.",
      });
    }
    if (date < 1 || date > 31) {
      return res.status(400).json({
        success: false,
        error: "Invalid date. Date must be between 1 and 31.",
      });
    }
    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: "Invalid month. Month must be between 1 and 12.",
      });
    }
    if (year < 2000 || year > new Date().getFullYear()) {
      return res.status(400).json({
        success: false,
        error: "Invalid year. Year must be between 2000 and the current year.",
      });
    }

    // Get current date in IST
    const now = new Date();
    const nowIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentDay = nowIST.getDate().toString().trim();
    const currentMonth = (nowIST.getMonth() + 1).toString().trim();
    const currentYear = nowIST.getFullYear().toString().trim();

    // console.log(
    //   `🔍 Fetching employees with pending attendance for ${date}/${month}/${year} at site ${siteID}`
    // );
    // console.log(`Current IST date is ${currentDay}/${currentMonth}/${currentYear}`);

    // Requested date should be within the last three days (including today) in IST
    // Generate valid dates for today, yesterday, and the day before yesterday (in IST)
    const validDates = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(nowIST);
      d.setDate(nowIST.getDate() - i);
      validDates.push({
        date: d.getDate().toString(),
        month: (d.getMonth() + 1).toString(),
        year: d.getFullYear().toString()
      });
    }

    // Check if the provided date matches any of the valid dates
    const isValidDate = validDates.some(vd =>
      dateStr === vd.date &&
      monthStr === vd.month &&
      yearStr === vd.year
    );

    if (!isValidDate) {
      const validDatesStr = validDates.map(vd => `${vd.date}/${vd.month}/${vd.year}`).join(', ');
      return res.status(400).json({
        success: false,
        error: `Requested date must be within the last three days (including today) in IST. Valid dates: ${validDatesStr}`,
      });
    }

    // Check if siteID is valid
    if (!siteID || siteID.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Invalid siteID.",
      });
    }

    // check if site belongs to requested user
    const role = req.user?.role?.toLowerCase();

    if (role === "supervisor") {
      const supervisorsite = req.user.site[0]?.toString().trim();
      if (supervisorsite !== siteID) {
        return res.status(403).json({
          success: false,
          error: "Forbidden. You do not have access to this site.",
        });
      }
      // list of all employees with pending attendance for the given date, month, year and siteID
      // console.log(
      //   `🔍 Fetching employees with pending attendance for ${date}/${month}/${year} at site ${siteID}`
      // );
      const { pendingEmployees, markedEmployees } = await pendingAttendance(
        date,
        month,
        year,
        siteID
      );
      return res.status(200).json({
        success: true,
        data: {
          pendingEmployees,
          markedEmployees,
        },
      });
    } else if (role === "admin") {
      // Ensure siteID is ObjectId for admin site access check
      const mongoose = require("mongoose");
      let siteObjectId;
      try {
        siteObjectId = new mongoose.Types.ObjectId(siteID);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "Invalid siteID format.",
        });
      }
      // check if admin has access to the site
      const Adminuser = await User.findOne({
        _id: req.user.id,
        site: siteObjectId,
      });
      if (!Adminuser) {
        return res.status(403).json({
          success: false,
          error: "Forbidden. You do not have access to this site.",
        });
      }
      // list of all employees with pending attendance for the given date, month, year and siteID
      // console.log(
      //   `🔍 Fetching employees with pending attendance for ${date}/${month}/${year} at site ${siteID}`
      // );
      const { pendingEmployees, markedEmployees } = await pendingAttendance(
        date,
        month,
        year,
        siteID
      );
      return res.status(200).json({
        success: true,
        data: {
          pendingEmployees,
          markedEmployees,
        },
      });
    } else {
      return res.status(403).json({
        success: false,
        error: "Forbidden. You do not have access to this resource.",
      });
    }
  }
);

// Get all a single employee's details

// Get available employees for import from specific month/year
router.get("/availableforimport", authenticateAndTrack, async (req, res) => {
  try {
    const { sourceMonth, sourceYear, targetMonth, targetYear, siteID } =
      req.query;

    // Validate required parameters
    if (!sourceMonth || !sourceYear || !siteID) {
      return res.status(400).json({
        success: false,
        error: "Source month, year, and site ID are required.",
      });
    }

    // console.log(
    //   `🔍 Finding available employees for import from ${sourceMonth}/${sourceYear} for site ${siteID}`
    // );

    // Get all employees from source month/year
    const rawSourceEmployees = await employeeSchema
      .find({
        month: parseInt(sourceMonth),
        year: parseInt(sourceYear),
        siteID: siteID.trim(),
      })
      .select("empid name rate closing_balance createdBy");

    // Use FetchlatestData for each employee to get the latest data
    const sourceEmployees = await Promise.all(
      rawSourceEmployees.map(async (emp) => {
        try {
          const latestData = await FetchlatestData(
            siteID.trim(),
            emp.empid,
            parseInt(sourceMonth),
            parseInt(sourceYear),
            req.user
          );
          return {
            empid: emp.empid,
            name: emp.name,
            rate: emp.rate,
            closing_balance: latestData.closing_balance,
            createdBy: emp.createdBy,
            // ...add any other fields you need
          };
        } catch (err) {
          // If FetchlatestData fails, fallback to raw data
          return {
            empid: emp.empid,
            name: emp.name,
            rate: emp.rate,
            closing_balance: emp.closing_balance,
            createdBy: emp.createdBy,
            fetchError: true,
            fetchErrorMessage: err.message,
          };
        }
      })
    );

    if (!sourceEmployees || sourceEmployees.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: `No employees found for ${sourceMonth}/${sourceYear} at site ${siteID}`,
      });
    }

    // If target month/year provided, check which employees already exist there
    let unavailableEmployeeIds = [];
    if (targetMonth && targetYear) {
      const existingTargetEmployees = await employeeSchema
        .find({
          month: parseInt(targetMonth),
          year: parseInt(targetYear),
          siteID: siteID.trim(),
          empid: { $in: sourceEmployees.map((emp) => emp.empid) },
        })
        .select("empid");

      unavailableEmployeeIds = existingTargetEmployees.map((emp) => emp.empid);
      // console.log(
      //   `⚠️ Found ${unavailableEmployeeIds.length} employees already exist in target month`
      // );
    }

    // Prepare employee list with availability status
    const availableEmployees = sourceEmployees.map((employee) => ({
      empid: employee.empid,
      name: employee.name,
      rate: employee.rate,
      closing_balance: employee.closing_balance || 0,
      createdBy: employee.createdBy,
      availableForImport: !unavailableEmployeeIds.includes(employee.empid),
      alreadyExistsInTarget: unavailableEmployeeIds.includes(employee.empid),
      fetchError: employee.fetchError || false,
      fetchErrorMessage: employee.fetchErrorMessage || undefined,
    }));

    const availableCount = availableEmployees.filter(
      (emp) => emp.availableForImport
    ).length;
    const unavailableCount = availableEmployees.length - availableCount;

    // console.log(
    //   `✅ Found ${availableEmployees.length} employees: ${availableCount} available, ${unavailableCount} already exist in target`
    // );

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
        siteID: siteID.trim(),
      },
      message: `Found ${availableEmployees.length
        } employees from ${sourceMonth}/${sourceYear}${targetMonth && targetYear
          ? `. ${availableCount} available for import to ${targetMonth}/${targetYear}`
          : ""
        }`,
    });
  } catch (error) {
    console.error("❌ Error fetching available employees for import:", error);
    return res.status(500).json({
      success: false,
      error: "Error fetching available employees for import.",
      message: error.message,
    });
  }
});


// Fetch all employee list for a specific month and year
router.get("/allemployeelist", authenticateAndTrack, async (req, res) => {
  const { month, year, siteID } = req.query;

  // Validate input parameters
  if (!month || !year || !siteID) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters.",
      message: "Please provide month, year, and siteID.",
    });
  }

  try {
    // Fetch employee list from the database
    const employeeList = await employeeSchema
      .find({
        month: parseInt(month),
        year: parseInt(year),
        siteID: siteID.trim(),
      })
      .select("empid name month year siteID payouts");

    return res.status(200).json({
      success: true,
      data: employeeList,
      message: `Fetched employee list for ${month}/${year} at site ${siteID}`,
    });
  } catch (error) {
    console.error("❌ Error fetching employee list:", error);
    return res.status(500).json({
      success: false,
      error: "Error fetching employee list.",
      message: error.message,
    });
  }
});

// Fetch employee details by ID, month, and year

router.get("/employee/:siteID/:empid/:month/:year",
  authenticateAndTrack,
  async (req, res) => {
    const { empid, month, year, siteID } = req.params;
    // console.log(
    //   `🔍 Fetching employee details for ${empid} - ${month}/${year} at site ${siteID}`
    // );
    validateBasicParams(siteID, empid, month, year);

    // Check subscription-based time restrictions for free plan users
    const userPlan = req.user.plan || 'free';
    if (userPlan === 'free') {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // Convert to 1-12
      const currentYear = currentDate.getFullYear();

      const requestedMonth = parseInt(month);
      const requestedYear = parseInt(year);

      // Calculate previous month
      let previousMonth = currentMonth - 1;
      let previousYear = currentYear;
      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear = currentYear - 1;
      }

      // Allow only current month and previous month
      const isCurrentMonth = (requestedMonth === currentMonth && requestedYear === currentYear);
      const isPreviousMonth = (requestedMonth === previousMonth && requestedYear === previousYear);

      if (!isCurrentMonth && !isPreviousMonth) {
        return res.status(403).json({
          success: false,
          message: "Free plan users can only access data from the current and previous month. Please upgrade to Contractor Pro or Haazri Automate to view unlimited historical data.",
          error: "Historical data access restricted",
          details: {
            requestedMonth: `${month}/${year}`,
            allowedRange: "Current and previous month only",
            upgradeRequired: true
          }
        });
      }
    }

    try {
      // Use FetchlatestData to get updated employee data
      const latestEmployeeData = await FetchlatestData(
        siteID,
        empid,
        parseInt(month),
        parseInt(year),
        req.user
      );
      if (!latestEmployeeData) {
        console.warn(`⚠️  No data found for employee ${empid}`);
        return res.status(404).json({
          success: false,
          error: "No data found.",
          message: `No data found for employee ${empid} - ${month}/${year} at site ${siteID}`,
        });
      }

      console.log(
        "Step 1 out of 2: Fetched latest employee data:",
        latestEmployeeData
      );
      // Calculate additional data using Jobs utility
      const calculationResult = calculateEmployeeData(latestEmployeeData, req.user);

      // Extract calculation fields from _calculationData
      const {
        totalAttendance,
        totalDays,
        totalOvertime,
        overtimeDays
      } = calculationResult._calculationData || {};

      // Get additional fields for frontend compatibility
      const totalAdditionalReqPays =
        latestEmployeeData.additional_req_pays?.reduce(
          (sum, pay) => sum + (pay.value || 0),
          0
        ) || 0;
      const totalPayouts =
        latestEmployeeData.payouts?.reduce(
          (sum, payout) => sum + (payout.value || 0),
          0
        ) || 0;
      const carryForward = latestEmployeeData.carry_forwarded?.value || 0;

      // Return all employees (including zero balance)

      return res.status(200).json({
        ...latestEmployeeData.toObject(),
        totalWage: calculationResult.totalWage,
        totalPayouts: totalPayouts,
        carryForward: carryForward,
        closing_balance: calculationResult.closing_balance,
        totalAttendance: totalAttendance,
        totalDays: totalDays,
        totalovertime: totalOvertime,
        overtimeDays: overtimeDays,
        totalAdditionalReqPays: totalAdditionalReqPays,
        // Additional status fields
        hasPendingPayouts: calculationResult.closing_balance !== 0,
        needsRecalculation: latestEmployeeData.recalculationneeded || false,
      });

    } catch (employeeError) {
      console.warn(
        `⚠️  Error processing employee ${empid}: ${employeeError.message}`
      );

      // Check if it's a 404 error (employee not found)
      if (employeeError.status === 404) {
        return res.status(404).json({
          success: false,
          error: "Employee not found.",
          message: employeeError.message,
        });
      }

      // Return other errors as 500
      return res.status(500).json({
        success: false,
        error: "Error fetching employee data.",
        message: employeeError.message,
      });
    }
  }
);

module.exports = router;

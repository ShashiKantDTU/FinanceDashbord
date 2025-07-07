/**
 * Employee Utilities Module
 *
 * This module contains utility functions for employee management.
 *
 * Remaining Legacy Functions:
 * - latestEmpSerialNumber: Used for generating new employee IDs
 */

const EmployeeSchema = require("../models/EmployeeSchema");

/**
 * Get the latest employee serial number for generating new employee IDs
 * @returns {Number} Latest serial number from existing employee IDs
 */
const latestEmpSerialNumber = async () => {
  try {
    // Find the latest employee by extracting number from empid (e.g., "EMP01" -> 1)
    const latestRecords = await EmployeeSchema.find({}, { empid: 1 }).sort({
      empid: -1,
    });

    if (!latestRecords || latestRecords.length === 0) {
      return 0;
    }

    // Extract the highest numeric value from all empids
    let maxSerial = 0;
    latestRecords.forEach((record) => {
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
    console.error("Error fetching latest employee serial number:", error);
    throw error;
  }
};

// get employees with pending attendance

/**
 * Fetch employees with pending attendance for a specific date, month, year, and site ID
 * @param {Number} date - The specific date to check for attendance
 * @param {Number} month - The month to check for attendance
 * @param {Number} year - The year to check for attendance
 * @param {String} siteID - The site ID to filter employees
 * @returns {Array} - List of employees with pending attendance
 */
const pendingAttendance = async (date, month, year, siteID) => {
  try {
    const employees = await EmployeeSchema.find({
      month: parseInt(month),
      year: parseInt(year),
      siteID: siteID.trim(),
    });

    const modifiedEmployees = [];
    const pendingEmployees = [];

    // Identify only those employees missing attendance on the given date
    employees.forEach((emp) => {
      const dayAttendance = emp.attendance[date - 1];
      if (dayAttendance === undefined || dayAttendance === null || dayAttendance === "") {
        // Check if attendance is complete till the previous day
        if (emp.attendance.length !== date - 1) {
          // Fill missing days before this date with null (absent)
          const pendingDays = (date - 1) - emp.attendance.length;
          for (let i = 0; i < pendingDays; i++) {
            emp.attendance.push(null);
          }
          modifiedEmployees.push(emp);
        }
        // Mark this employee as pending for today's attendance
        pendingEmployees.push(emp);
      }
    });

    // Save all modified employees to database
    if (modifiedEmployees.length > 0) {
      console.log(`📅 Saving ${modifiedEmployees.length} employees with updated attendance to database`);
      
      const savePromises = modifiedEmployees.map(async (emp) => {
        try {
          await emp.save();
          return { empid: emp.empid, success: true };
        } catch (saveError) {
          console.error(`❌ Failed to save attendance for employee ${emp.empid}:`, saveError);
          return { empid: emp.empid, success: false, error: saveError.message };
        }
      });
      
      const saveResults = await Promise.all(savePromises);
      const successCount = saveResults.filter(result => result.success).length;
      const failureCount = saveResults.filter(result => !result.success).length;
      
      console.log(`📊 Attendance save summary: ${successCount} successful, ${failureCount} failed`);
      
      if (failureCount > 0) {
        const failedEmployees = saveResults.filter(result => !result.success);
        console.warn(`⚠️ Failed to save attendance for employees:`, failedEmployees);
      }
    } else {
      console.log(`ℹ️ No employees required attendance updates for ${date}/${month}/${year}`);
    }

    return pendingEmployees.filter(emp => emp !== undefined); // Remove undefined entries
  } catch (error) {
    console.error("Error fetching pending attendance:", error);
    throw new Error("Error fetching pending attendance");
  }
};

module.exports = {
  latestEmpSerialNumber,
  pendingAttendance,
};

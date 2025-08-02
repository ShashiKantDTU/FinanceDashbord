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
 * Get the latest employee serial number for a specific site.
 * @param {String} siteID - The identifier of the site to scope the search.
 * @returns {Number} Latest serial number from existing employee IDs for the given site.
 */
const latestEmpSerialNumber = async (siteID) => {
  try {
    // Find the latest employee for the specific site by sorting empid.
    // This is more efficient than fetching all records.
    const latestEmployee = await EmployeeSchema.findOne(
      { siteID: siteID },
      { empid: 1 }
    ).sort({ createdAt: -1 }); // Sort by creation date to likely get the latest ID

    if (!latestEmployee) {
      // No employees exist for this site yet.
      return 0;
    }

    // To be absolutely sure, we'll scan all employees of that site to find the max serial.
    // This handles cases where an older employee might have a higher number due to manual entries or deletions.
    const allEmployeesForSite = await EmployeeSchema.find(
        { siteID: siteID },
        { empid: 1 }
    );
    
    let maxSerial = 0;
    allEmployeesForSite.forEach((record) => {
      // Regex to extract the numeric part of the empid, e.g., "EMP123" -> 123
      const match = record.empid.match(/\d+$/);
      if (match) {
        const serialNum = parseInt(match[0], 10);
        if (serialNum > maxSerial) {
          maxSerial = serialNum;
        }
      }
    });


    return maxSerial;
  } catch (error) {
    console.error("Error fetching latest employee serial number for site:", error);
    throw error; // Re-throw the error to be handled by the calling route.
  }
};



// get employees with pending attendance

/**
 * Fetch employees with pending attendance for a specific date, month, year, and site ID
 * @param {Number} date - The specific date to check for attendance
 * @param {Number} month - The month to check for attendance
 * @param {Number} year - The year to check for attendance
 * @param {String} siteID - The site ID to filter employees
 * @returns {Object} - { pendingEmployees: [...], markedEmployees: [...] }
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
    const markedEmployees = [];

    // Identify employees with and without attendance on the given date
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
      } else {
        // Employee has marked attendance for this date
        markedEmployees.push(emp);
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

    return {
      pendingEmployees: pendingEmployees.filter(emp => emp !== undefined),
      markedEmployees: markedEmployees.filter(emp => emp !== undefined),
    };
  } catch (error) {
    console.error("Error fetching pending attendance:", error);
    throw new Error("Error fetching pending attendance");
  }
};

module.exports = {
  latestEmpSerialNumber,
  pendingAttendance,
};
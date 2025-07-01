/**
 * Employee Utilities Module
 * 
 * This module contains utility functions for employee management.
 * 
 * Remaining Legacy Functions:
 * - latestEmpSerialNumber: Used for generating new employee IDs
 */

const EmployeeSchema = require('../models/EmployeeSchema');

/**
 * Get the latest employee serial number for generating new employee IDs
 * @returns {Number} Latest serial number from existing employee IDs
 */
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
    latestEmpSerialNumber
};

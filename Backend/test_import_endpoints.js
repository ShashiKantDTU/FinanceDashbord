/**
 * Test script for Employee Import Endpoints
 * 
 * This script demonstrates how to use the new employee import endpoints.
 * Make sure to replace the placeholder values with actual data from your system.
 */

const BASE_URL = 'http://localhost:5000/api';

// Replace with actual JWT token after login
const JWT_TOKEN = 'your_jwt_token_here';

// Replace with actual site ID from your database
const SITE_ID = 'your_site_object_id_here';

/**
 * Example 1: Get available employees for import
 */
async function getAvailableEmployees() {
    try {
        const params = new URLSearchParams({
            sourceMonth: '11',
            sourceYear: '2024',
            targetMonth: '12',
            targetYear: '2024',
            siteID: SITE_ID
        });

        const response = await fetch(`${BASE_URL}/employee/availableforimport?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log('Available employees:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Error fetching available employees:', error);
    }
}

/**
 * Example 2: Import all employees from previous month
 */
async function importAllEmployees() {
    try {
        const requestBody = {
            sourceMonth: 11,
            sourceYear: 2024,
            targetMonth: 12,
            targetYear: 2024,
            siteID: SITE_ID,
            preserveCarryForward: true,
            preserveAdditionalPays: false
        };

        const response = await fetch(`${BASE_URL}/employee/importemployees`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log('Import all employees result:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Error importing all employees:', error);
    }
}

/**
 * Example 3: Import specific employees
 */
async function importSpecificEmployees() {
    try {
        const requestBody = {
            sourceMonth: 11,
            sourceYear: 2024,
            targetMonth: 12,
            targetYear: 2024,
            siteID: SITE_ID,
            employeeIds: ['EMP001', 'EMP002', 'EMP003'], // Replace with actual employee IDs
            preserveCarryForward: true,
            preserveAdditionalPays: true
        };

        const response = await fetch(`${BASE_URL}/employee/importemployees`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log('Import specific employees result:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Error importing specific employees:', error);
    }
}

/**
 * Example 4: Complete workflow - check availability then import
 */
async function completeImportWorkflow() {
    console.log('Starting complete import workflow...\n');

    // Step 1: Check available employees
    console.log('Step 1: Checking available employees...');
    const availableEmployees = await getAvailableEmployees();
    
    if (!availableEmployees || !availableEmployees.success) {
        console.log('No employees available for import or error occurred.');
        return;
    }

    const availableIds = availableEmployees.data
        .filter(emp => emp.availableForImport)
        .map(emp => emp.empid);

    console.log(`Found ${availableIds.length} employees available for import:`, availableIds);

    if (availableIds.length === 0) {
        console.log('No employees available for import.');
        return;
    }

    // Step 2: Import available employees
    console.log('\nStep 2: Importing available employees...');
    await importSpecificEmployees();
}

/**
 * Example with error handling
 */
async function exampleWithErrorHandling() {
    try {
        // This example shows how to handle errors
        const requestBody = {
            sourceMonth: 13, // Invalid month - will cause error
            sourceYear: 2024,
            targetMonth: 12,
            targetYear: 2024,
            siteID: SITE_ID
        };

        const response = await fetch(`${BASE_URL}/employee/importemployees`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (!data.success) {
            console.log('Import failed:', data.error);
            if (data.details) {
                console.log('Error details:', data.details);
            }
        } else {
            console.log('Import successful:', data.message);
        }
    } catch (error) {
        console.error('Network or parsing error:', error);
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getAvailableEmployees,
        importAllEmployees,
        importSpecificEmployees,
        completeImportWorkflow,
        exampleWithErrorHandling
    };
}

// If running this script directly
if (typeof window === 'undefined' && require.main === module) {
    console.log('Employee Import Test Script');
    console.log('Update JWT_TOKEN and SITE_ID variables before running');
    console.log('Available functions:');
    console.log('- getAvailableEmployees()');
    console.log('- importAllEmployees()');
    console.log('- importSpecificEmployees()');
    console.log('- completeImportWorkflow()');
    console.log('- exampleWithErrorHandling()');
}

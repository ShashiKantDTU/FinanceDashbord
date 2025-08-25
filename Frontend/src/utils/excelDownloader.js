/**
 * Modern Excel Download Utility
 * 
 * This utility provides a clean, modern approach for downloading Excel reports
 * from the server-side Excel generation endpoint.
 */

// Get auth token from localStorage
const getAuthToken = () => {
    return localStorage.getItem('token');
};

/**
 * Downloads an Excel report from the server
 * @param {Object} params - Parameters for Excel generation
 * @param {string} params.siteID - Site identifier
 * @param {number} params.month - Month number (1-12)
 * @param {number} params.year - Year number
 * @param {string} params.calculationType - Calculation type ('default' or 'special')
 * @param {Function} params.onSuccess - Success callback
 * @param {Function} params.onError - Error callback
 * @param {Function} params.onProgress - Progress callback (optional)
 */
export const downloadExcelReport = async ({
    siteID,
    month,
    year,
    calculationType = 'default',
    onSuccess,
    onError,
    onProgress
}) => {
    try {
        // Notify progress
        if (onProgress) onProgress('Generating Excel report...');

        // Get API base URL and auth token
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const token = getAuthToken();

        // Make direct fetch request to handle blob response properly
        const response = await fetch(`${API_BASE_URL}/api/reports/generate-excel-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
            },
            body: JSON.stringify({
                siteID,
                month,
                year,
                calculationType
            })
        });

        // Handle authentication errors
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            // Try to parse error as JSON, fallback to status text
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || 'Failed to generate Excel report';
            } catch {
                errorMessage = `Server error: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        // Notify progress
        if (onProgress) onProgress('Processing Excel data...');

        // Get Excel blob from response
        const blob = await response.blob();
        
        // Verify it's actually an Excel file
        const expectedMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (blob.type !== expectedMimeType) {
            console.warn(`Expected MIME type: ${expectedMimeType}, got: ${blob.type}`);
            // Don't throw error as some servers might not set the correct MIME type
        }

        // Create blob URL for Excel download
        const url = window.URL.createObjectURL(blob);
        
        // Generate filename with current month/year and timestamp
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[month - 1];
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
        const filename = `Employee_Payment_Report_${monthName}_${year}_${timestamp}.xlsx`;
        
        // Create temporary download link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        
        // Add to DOM, click, and remove (required for some browsers)
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup blob URL
        window.URL.revokeObjectURL(url);
        
        // Success callback
        if (onSuccess) onSuccess(filename);
    } catch (error) {
        console.error('Error downloading Excel:', error);
        
        // Determine error type and call error callback
        let errorMessage = 'Failed to generate Excel report. Please try again.';
        
        if (error.message) {
            errorMessage = error.message;
        }
        
        if (onError) onError(errorMessage);
    }
};

/**
 * Checks if Excel generation is supported by the browser
 * @returns {boolean} True if supported, false otherwise
 */
export const isExcelDownloadSupported = () => {
    return !!(window.Blob && window.URL && window.URL.createObjectURL);
};

/**
 * Gets the estimated size of an Excel report (for display purposes)
 * @param {number} employeeCount - Number of employees in the report
 * @returns {string} Estimated file size as a string
 */
export const getEstimatedExcelSize = (employeeCount) => {
    // Rough estimation: ~10KB base + ~2KB per employee (Excel is more compact than PDF)
    const estimatedBytes = 10000 + (employeeCount * 2000);
    
    if (estimatedBytes < 1024 * 1024) {
        return `~${Math.round(estimatedBytes / 1024)}KB`;
    } else {
        return `~${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB`;
    }
};


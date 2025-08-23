/**
 * Modern PDF Download Utility
 * 
 * This utility provides a clean, modern approach for downloading PDF reports
 * from the server-side PDF generation endpoint.
 */

// Get auth token from localStorage
const getAuthToken = () => {
    return localStorage.getItem('token');
};

/**
 * Downloads a PDF report from the server
 * @param {Object} params - Parameters for PDF generation
 * @param {string} params.siteID - Site identifier
 * @param {number} params.month - Month number (1-12)
 * @param {number} params.year - Year number
 * @param {Function} params.onSuccess - Success callback
 * @param {Function} params.onError - Error callback
 * @param {Function} params.onProgress - Progress callback (optional)
 */
export const downloadPDFReport = async ({
    siteID,
    month,
    year,
    onSuccess,
    onError,
    onProgress
}) => {
    try {
        // Notify progress
        if (onProgress) onProgress('Generating PDF report...');

        // Get API base URL and auth token
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const token = getAuthToken();

        // Make direct fetch request to handle blob response properly
        const response = await fetch(`${API_BASE_URL}/api/reports/generate-payment-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
            },
            body: JSON.stringify({
                siteID,
                month,
                year
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
                errorMessage = errorData.message || errorData.error || 'Failed to generate PDF report';
            } catch {
                errorMessage = `Server error: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        // Notify progress
        if (onProgress) onProgress('Processing PDF data...');

        // Get PDF blob from response
        const blob = await response.blob();
        
        // Verify it's actually a PDF
        if (blob.type !== 'application/pdf') {
            throw new Error('Invalid response format. Expected PDF file.');
        }

        // Create blob URL for PDF download
        const url = window.URL.createObjectURL(blob);
        
        // Generate filename with current month/year and timestamp
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[month - 1];
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Employee_Payment_Report_${monthName}_${year}_${timestamp}.pdf`;
        
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
        console.error('Error downloading PDF:', error);
        
        // Determine error type and call error callback
        let errorMessage = 'Failed to generate PDF report. Please try again.';
        
        if (error.message) {
            errorMessage = error.message;
        }
        
        if (onError) onError(errorMessage);
    }
};

/**
 * Checks if PDF generation is supported by the browser
 * @returns {boolean} True if supported, false otherwise
 */
export const isPDFDownloadSupported = () => {
    return !!(window.Blob && window.URL && window.URL.createObjectURL);
};

/**
 * Gets the estimated size of a PDF report (for display purposes)
 * @param {number} employeeCount - Number of employees in the report
 * @returns {string} Estimated file size as a string
 */
export const getEstimatedPDFSize = (employeeCount) => {
    // Rough estimation: ~50KB base + ~15KB per employee
    const estimatedBytes = 50000 + (employeeCount * 15000);
    
    if (estimatedBytes < 1024 * 1024) {
        return `~${Math.round(estimatedBytes / 1024)}KB`;
    } else {
        return `~${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB`;
    }
};

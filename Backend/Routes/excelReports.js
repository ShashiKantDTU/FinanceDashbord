const express = require("express");
const { authenticateAndTrack } = require("../Middleware/usageTracker");
const { generateFullPayrollReportWithRealData } = require("../Utils/generatePayrollWithRealData");

// Router for Excel report generation
// Generates actual Excel files with payroll data using ExcelJS
const router = express.Router();

/**
 * Validate basic required params (mirrors PDF endpoint so future parity is easy)
 * @param {object} body
 * @returns {string|null} error message or null if valid
 */
function validateRequest(body) {
  const { siteID, month, year } = body;
  if (!siteID || !month || !year) return "siteID, month, and year are required.";
  if (month < 1 || month > 12) return "Month must be between 1 and 12.";
  if (year < 2020 || year > 2030) return "Year must be between 2020 and 2030.";
  return null;
}

/**
 * Generate Excel payroll report with real data from database
 * @param {object} params - Report parameters
 * @param {string} params.siteID - Site identifier
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @param {string} params.calculationType - Calculation type ('default' or 'special')
 * @returns {Promise<{buffer: Buffer, filename: string, mimetype: string}>}
 */
async function generateAndSendExcel(params) {
  const { siteID, month, year, calculationType = 'default' } = params;
  
  // Generate the Excel buffer using real data from database
  const buffer = await generateFullPayrollReportWithRealData({ 
    siteID, 
    month, 
    year, 
    calculationType 
  });
  
  // Create filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
  const monthName = getMonthName(month);
  const filename = `Payroll_Report_${siteID}_${monthName}_${year}_${timestamp}.xlsx`;
  
  return { 
    buffer, 
    filename, 
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };
}

/**
 * Helper function to get month name
 */
function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}

// POST /api/reports/generate-excel-report
// Generates actual Excel payroll reports with mock data
router.post("/generate-excel-report", authenticateAndTrack, async (req, res) => {
  try {
    // Basic param validation
    const validationError = validateRequest(req.body || {});
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    // Role based access check
    const userRole = req.user?.role?.toLowerCase();
    if (!userRole || !["supervisor", "admin"].includes(userRole)) {
      return res.status(403).json({ success: false, error: "Forbidden. You do not have access to this resource." });
    }

    console.log(`📊 Generating Excel report for ${req.body.siteID} - ${req.body.month}/${req.body.year}`);

    const result = await generateAndSendExcel(req.body);

    // Set headers for Excel file download
    res.setHeader("Content-Type", result.mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("Cache-Control", "no-store");

    console.log(`✅ Excel report generated successfully: ${result.filename}`);
    return res.send(result.buffer);
  } catch (err) {
    console.error("❌ Error generating Excel report:", err);
    return res.status(500).json({
      success: false,
      error: "Error generating Excel report.",
      message: err.message
    });
  }
});

module.exports = router;

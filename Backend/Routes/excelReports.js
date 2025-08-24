const express = require("express");
const path = require("path");
const fs = require("fs");
const { authenticateAndTrack } = require("../Middleware/usageTracker");

// Router for Excel (future) report generation
// NOTE: This is a placeholder implementation that currently returns a static PDF file
// so the frontend can integrate an "Excel" download workflow now. When real Excel
// generation is implemented, replace the placeholder logic inside generateAndSendExcel.
// Existing code elsewhere is intentionally untouched per project instructions.
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
 * Placeholder for future Excel workbook creation.
 * When implementing, build a workbook (e.g. with exceljs) and return a Buffer.
 * For now, we simply read and return the existing sample PDF file as a stand‑in.
 * @param {object} params
 * @returns {Promise<{buffer: Buffer, filename: string, mimetype: string, isPlaceholder: boolean}>}
 */
async function generateAndSendExcel(params) {
  // FUTURE IMPLEMENTATION PLAN (summary):
  // 1. Fetch employees & site info (reuse logic from pdfReports via refactor into shared util if permitted).
  // 2. Build workbook with summary sheet + per-employee or pivot sheet.
  // 3. Stream workbook to response to avoid large memory usage.
  // 4. Apply consistent auth & usage tracking (already in place on the route).

  // CURRENT PLACEHOLDER: return the static PDF file to unblock frontend integration.
  const samplePdfPath = path.join(__dirname, "..", "Main_Office_20250823_183252.pdf");
  if (!fs.existsSync(samplePdfPath)) {
    throw new Error("Placeholder PDF file not found on server.");
  }
  const buffer = fs.readFileSync(samplePdfPath);
  
  // Use consistent naming pattern: sitename_month_year_timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5); // Format: YYYY-MM-DD_HH-MM-SS
  const filename = `Excel_Report_Placeholder_${timestamp}.pdf`; // Keep pdf extension to avoid misleading clients
  return { buffer, filename, mimetype: "application/pdf", isPlaceholder: true };
}

// POST /api/reports/generate-excel-report
// Mirrors the PDF route signature so frontend can swap endpoints easily later.
router.post("/generate-excel-report", authenticateAndTrack, async (req, res) => {
  try {
    // Basic param validation (even though they are unused right now)
    const validationError = validateRequest(req.body || {});
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    // Role based access check (copied in simplified form for parity & future expansion)
    const userRole = req.user?.role?.toLowerCase();
    if (!userRole || !["supervisor", "admin"].includes(userRole)) {
      return res.status(403).json({ success: false, error: "Forbidden. You do not have access to this resource." });
    }

    // NOTE: For supervisors / admins we could replicate site access checks here.
    // To keep this placeholder light and non-invasive, we *optionally* enforce the same
    // check pattern later when real data access is added.

    const result = await generateAndSendExcel(req.body);

    // Set headers (include a custom header so clients know it's a placeholder)
    res.setHeader("Content-Type", result.mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    if (result.isPlaceholder) res.setHeader("X-Placeholder-Report", "true");
    res.setHeader("Cache-Control", "no-store");

    return res.send(result.buffer);
  } catch (err) {
    console.error("❌ Error generating Excel (placeholder) report:", err);
    return res.status(500).json({
      success: false,
      error: "Error generating Excel report (placeholder).",
      message: err.message
    });
  }
});

module.exports = router;

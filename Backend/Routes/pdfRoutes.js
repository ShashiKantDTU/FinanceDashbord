const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../Middleware/auth');

/**
 * @route GET /api/pdf/employee-report
 * @desc Get employee PDF report
 * @access Private
 * @params employeeId, month, year, siteId
 */
router.get('/employee-report', authenticateToken, async (req, res) => {
    try {
        const { employeeId, month, year, siteId } = req.query;

        // Validate required parameters
        if (!employeeId || !month || !year || !siteId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: employeeId, month, year, siteId'
            });
        }

        // Validate parameter formats
        if (isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Invalid month. Must be between 1-12'
            });
        }

        if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid year'
            });
        }

        // Log the request for debugging
        console.log(`📄 PDF Request: Employee ${employeeId}, Site ${siteId}, ${month}/${year}`);

        // For now, send the sample PDF
        const pdfPath = path.join(__dirname, 'pdf.pdf');

        // Check if sample PDF exists
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({
                success: false,
                message: 'Sample PDF not found'
            });
        }

        // Get file stats for proper headers
        const stats = fs.statSync(pdfPath);

        // Set appropriate headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `attachment; filename="employee_${employeeId}_${month}_${year}.pdf"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Create read stream and pipe to response
        const fileStream = fs.createReadStream(pdfPath);

        fileStream.on('error', (error) => {
            console.error('Error reading PDF file:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Error reading PDF file'
                });
            }
        });

        fileStream.pipe(res);

        // Log successful response
        console.log(`✅ PDF sent successfully for Employee ${employeeId}`);

    } catch (error) {
        console.error('Error in PDF route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/pdf/test
 * @desc Test PDF endpoint
 * @access Private
 */
router.get('/test', async (req, res) => {
    try {
        const pdfPath = path.join(__dirname, 'pdf.pdf');

        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({
                success: false,
                message: 'Sample PDF not found at: ' + pdfPath
            });
        }

        const stats = fs.statSync(pdfPath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', 'attachment; filename="test.pdf"');

        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);

        console.log('✅ Test PDF sent successfully');

    } catch (error) {
        console.error('Error in test PDF route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route GET /api/pdf/info
 * @desc Get PDF service info
 * @access Private
 */
router.get('/info', authenticateToken, async (req, res) => {
    try {
        const pdfPath = path.join(__dirname, 'pdf.pdf');
        const pdfExists = fs.existsSync(pdfPath);

        res.json({
            success: true,
            message: 'PDF service is running',
            samplePdfExists: pdfExists,
            samplePdfPath: pdfPath,
            endpoints: {
                employeeReport: '/api/pdf/employee-report?employeeId=123&month=1&year=2025&siteId=abc123',
                test: '/api/pdf/test',
                info: '/api/pdf/info'
            }
        });
    } catch (error) {
        console.error('Error in PDF info route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;
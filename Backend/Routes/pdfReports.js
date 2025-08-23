const express = require("express");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const employeeSchema = require("../models/EmployeeSchema");
const siteSchema = require("../models/Siteschema");
const { authenticateAndTrack } = require("../Middleware/usageTracker");

const router = express.Router();

/**
 * Fetch employee data using the optimized aggregation pipeline
 * @param {string} siteID - Site identifier
 * @param {number} month - Month number
 * @param {number} year - Year number
 * @param {string} calculationType - Calculation type from user
 * @returns {Array} Employee data array
 */
async function fetchEmployeeData(siteID, month, year, calculationType = 'default') {
    try {
        const pipeline = [
            // Stage 1: Filter Documents
            {
                $match: {
                    siteID: new mongoose.Types.ObjectId(siteID),
                    month: parseInt(month),
                    year: parseInt(year)
                }
            },
            
            // Stage 2: Perform Initial Calculations
            {
                $addFields: {
                    totalPayouts: { $sum: "$payouts.value" },
                    totalAdditionalReqPays: { $sum: "$additional_req_pays.value" },
                    carryForward: { $ifNull: ["$carry_forwarded.value", 0] },
                    
                    totalDays: {
                        $size: {
                            $filter: {
                                input: "$attendance",
                                as: "att",
                                cond: { $regexMatch: { input: "$$att", regex: /^P/ } }
                            }
                        }
                    },
                    totalovertime: {
                        $sum: {
                            $map: {
                                input: "$attendance",
                                as: "att",
                                in: {
                                    $let: {
                                        vars: {
                                            overtimeStr: { $arrayElemAt: [{ $regexFindAll: { input: "$$att", regex: /\d+/ } }, 0] }
                                        },
                                        in: { $ifNull: [{ $toInt: "$$overtimeStr.match" }, 0] }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            
            // Stage 3: Calculate overtime days
            {
                $addFields: {
                    overtimeDays: {
                        $cond: {
                            if: { $eq: [calculationType, 'special'] },
                            then: {
                                $add: [
                                    { $floor: { $divide: ["$totalovertime", 8] } },
                                    { $divide: [{ $mod: ["$totalovertime", 8] }, 10] }
                                ]
                            },
                            else: { $divide: ["$totalovertime", 8] }
                        }
                    }
                }
            },
            
            // Stage 4: Calculate final values
            {
                $addFields: {
                    totalAttendance: { $add: ["$totalDays", "$overtimeDays"] },
                    totalWage: { $multiply: ["$rate", { $add: ["$totalDays", "$overtimeDays"] }] },
                    closing_balance: {
                        $subtract: [
                            {
                                $add: [
                                    { $multiply: ["$rate", { $add: ["$totalDays", "$overtimeDays"] }] },
                                    "$totalAdditionalReqPays",
                                    "$carryForward"
                                ]
                            },
                            "$totalPayouts"
                        ]
                    }
                }
            }
        ];

        const employeeDetails = await employeeSchema.aggregate(pipeline);
        return employeeDetails || [];
    } catch (error) {
        console.error('❌ Error fetching employee data:', error);
        return [];
    }
}

/**
 * Fetch site information
 * @param {string} siteID - Site identifier
 * @returns {Object} Site information
 */
async function fetchSiteInfo(siteID) {
    try {
        const site = await siteSchema.findById(siteID);
        return site ? { sitename: site.sitename } : { sitename: 'Unknown Site' };
    } catch (error) {
        console.error('❌ Error fetching site info:', error);
        return { sitename: 'Unknown Site' };
    }
}

/**
 * Helper function to convert month number to month name
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name
 */
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
}

/**
 * Formats a number as a currency string.
 * @param {number} value - The number to format.
 * @returns {string} - The formatted currency string.
 */
function formatCurrency(value) {
    return `Rs. ${value.toFixed(2)}`;
}

/**
 * Generates the main header of the report.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing month and site name.
 */
function generateHeader(doc, reportData) {
    // Professional header with site name as main title
    doc.fillColor('#1a365d')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(reportData.siteName.toUpperCase(), 30, 25);
    
    // Subtitle - Employee Payment Report
    doc.fillColor('#2d3748')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('EMPLOYEE PAYMENT REPORT', 30, 50);
    
    // Report metadata in right column
    doc.fillColor('#4a5568')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('REPORT DETAILS', 600, 25, { align: 'right' })
        .fillColor('#718096')
        .fontSize(10)
        .font('Helvetica')
        .text(`Period: ${reportData.month}`, 600, 42, { align: 'right' })
        .text(`Generated: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN', { hour12: false })}`, 600, 55, { align: 'right' })
        .text(`Total Employees: ${reportData.employees.length}`, 600, 68, { align: 'right' });

    // Professional separator with gradient effect
    doc.fillColor('#2b6cb0')
       .rect(30, 90, 810, 2)
       .fill()
       .fillColor('#3182ce')
       .rect(30, 92, 810, 1)
       .fill()
       .fillColor('#63b3ed')
       .rect(30, 93, 810, 0.5)
       .fill();
}

/**
 * Generates the employee data table with dynamic rows and page breaks.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing the list of employees.
 */
function generateEmployeeTable(doc, reportData) {
    let tableTop = 105;
    generateTableHeader(doc, tableTop);
    let position = tableTop + 30;
    let serialNumber = 1; // Initialize serial number counter

    for (const employee of reportData.employees) {
        const rowHeight = 45;

        if (position + rowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            generateHeader(doc, reportData);
            tableTop = 105;
            generateTableHeader(doc, tableTop);
            position = tableTop + 30;
        }

        generateTableRow(doc, position, employee, serialNumber);
        position += rowHeight;
        serialNumber++; // Increment serial number for next employee
    }
}

/**
 * Generates the header row for the employee table.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {number} y - The Y position to draw the header at.
 */
function generateTableHeader(doc, y) {
    doc.fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .fontSize(9)
       .text('S.No', 30, y, { width: 30, align: 'center' })
       .text('EMP ID', 65, y, { width: 50 })
       .text('Employee Name', 120, y, { width: 140 })
       .text('P', 265, y, { width: 25, align: 'center' })
       .text('OT', 295, y, { width: 25, align: 'center' })
       .text('Rate', 325, y, { width: 45, align: 'right' })
       .text('Gross Payment', 375, y, { width: 80, align: 'right' })
       .text('Advances', 460, y, { width: 75, align: 'right' })
       .text('Bonus', 540, y, { width: 60, align: 'right' })
       .text('Prev Balance', 605, y, { width: 75, align: 'right' })
       .text('Final Payment', 685, y, { width: 80, align: 'right' });
    
    generateHr(doc, y + 18);
}

/**
 * Generates a single row in the employee table.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {number} y - The Y position to draw the row at.
 * @param {object} emp - The employee data object for the row.
 * @param {number} serialNumber - The serial number for this row.
 */
function generateTableRow(doc, y, emp, serialNumber) {
    const isEvenRow = Math.floor((y - 140) / 45) % 2 === 0;
    if (isEvenRow) {
        doc.fillColor('#f8f9fa')
           .rect(25, y - 5, 745, 40)
           .fill();
    }
    
    doc.fillColor('#34495e')
       .font('Helvetica')
       .fontSize(8)
       .text(serialNumber.toString(), 30, y, { width: 30, align: 'center' })
       .text(emp.id, 65, y, { width: 50 })
       .text(emp.name, 120, y, { width: 140 })
       .text(emp.present.toString(), 265, y, { width: 25, align: 'center' })
       .text(emp.overtime.toString(), 295, y, { width: 25, align: 'center' })
       .fillColor('#16a085')
       .text(formatCurrency(emp.dailyRate), 325, y, { width: 45, align: 'right' })
       .fillColor('#2980b9')
       .text(formatCurrency(emp.grossPayment), 375, y, { width: 80, align: 'right' })
       .fillColor('#e74c3c')
       .text(formatCurrency(emp.advances), 460, y, { width: 75, align: 'right' })
       .fillColor('#27ae60')
       .text(formatCurrency(emp.bonus), 540, y, { width: 60, align: 'right' })
       .fillColor(emp.prevBalance >= 0 ? '#27ae60' : '#e74c3c')
       .text(formatCurrency(emp.prevBalance), 605, y, { width: 75, align: 'right' })
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .fontSize(9)
       .text(formatCurrency(emp.finalPayment), 685, y, { width: 80, align: 'right' });

    generateHr(doc, y + 35);
}

/**
 * Draws a horizontal line.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {number} y - The Y position of the line.
 */
function generateHr(doc, y) {
    doc.strokeColor("#bdc3c7")
       .lineWidth(0.5)
       .moveTo(30, y)
       .lineTo(790, y)
       .stroke();
}

/**
 * Generates individual employee detail pages with intelligent page breaks.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing the list of employees.
 */
function generateIndividualEmployeeDetails(doc, reportData) {
    doc.addPage({ layout: 'landscape', margin: 20 });
    generateHeader(doc, reportData); // Re-add header for the new section
    
    let y = 105; // Starting Y position
    const pageBottom = doc.page.height - doc.page.margins.bottom;

    doc.fillColor('#2d3748')
       .font('Helvetica-Bold')
       .fontSize(16)
       .text('INDIVIDUAL EMPLOYEE DETAILS', 30, y);
    
    y += 40; // Space after the section title
    
    for (const employee of reportData.employees) {
        // --- Smart Page Break Logic ---
        // Calculate the height of the upcoming employee section
        const sectionHeight = calculateEmployeeDetailSectionHeight(employee);
        
        // If the section doesn't fit on the current page, create a new one
        if (y + sectionHeight > pageBottom) {
            doc.addPage({ layout: 'landscape', margin: 20 });
            generateHeader(doc, reportData);
            y = 105; // Reset Y position for the new page
        }
        
        // Draw the section and update the Y position
        y = generateEmployeeDetailSection(doc, employee, y);
        y += 25; // Add consistent spacing between employee blocks
    }
}

/**
 * Calculates the required height for an employee detail section without drawing it.
 * This allows for intelligent page break decisions.
 * @param {object} employee - The employee data object.
 * @returns {number} - The calculated height in PDF units.
 */
function calculateEmployeeDetailSectionHeight(employee) {
    let height = 0;
    
    // Header and Summary section heights (fixed)
    height += 35; // Employee Header
    height += 45; // Spacing
    height += 50; // Summary Box
    height += 65; // Spacing
    
    // Calculate heights of the three columns
    let col1Height = 47; // Title height
    if (employee.payouts && employee.payouts.length > 0) {
        col1Height += 23; // Table header
        col1Height += employee.payouts.length * 12; // Each payout row
        col1Height += 28; // Total and spacing
    } else {
        col1Height += 25; // "No advances" text
    }

    let col2Height = 47; // Title height
    if (employee.additional_req_pays && employee.additional_req_pays.length > 0) {
        col2Height += 23; // Table header
        col2Height += employee.additional_req_pays.length * 12; // Each payment row
        col2Height += 28; // Total and spacing
    } else {
        col2Height += 25; // "No bonus" text
    }
    
    let col3Height = 47; // Title height
    col3Height += 3 * 14; // Attendance info lines
    col3Height += 10; // Spacing
    if (employee.carry_forwarded && employee.carry_forwarded.value !== 0) {
        col3Height += 18; // Header
        col3Height += 40; // Balance details
    } else {
        col3Height += 20; // "No previous balance" text
    }
    
    // The total height is determined by the tallest of the three columns
    height += Math.max(col1Height, col2Height, col3Height);
    height += 15; // Bottom separator line buffer
    
    return height;
}

/**
 * Generates a detailed, professionally styled section for a single employee.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} employee - The employee data object.
 * @param {number} startY - The Y position to start drawing at.
 * @returns {number} - The Y position after this section has been drawn.
 */
function generateEmployeeDetailSection(doc, employee, startY) {
    let y = startY;
    const sectionStartX = 30;
    const sectionWidth = 780;

    // --- Employee Header ---
    doc.fillColor('#1a365d').rect(sectionStartX, y, sectionWidth, 35).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
       // FIXED: Added a width to the employee name to prevent overflow.
       .text(employee.name, sectionStartX + 10, y + 10, { width: 500 });
    doc.fillColor('#e2e8f0').font('Helvetica').fontSize(11)
       // Adjusted: shift Employee ID left so it doesn't hug page edge (adds an intentional right margin).
       .text(`Employee ID: ${employee.id}`, sectionStartX + 260, y + 12, { width: sectionWidth - 320, align: 'right' });
    y += 50;

    // --- Payment Summary Box ---
    doc.roundedRect(sectionStartX, y, sectionWidth, 60, 5).fillAndStroke('#f7fafc', '#e2e8f0');
    const summaryY = y + 15;
    const summaryCol1 = 45, summaryCol2 = 240, summaryCol3 = 430, summaryCol4 = 600;
    const summaryColumnWidth = 180; // Define a width for summary columns
    const summaryFinalWidth = 170; // Constrain FINAL PAYMENT box so it respects right margin

    doc.fillColor('#2d3748').font('Helvetica-Bold').fontSize(10);
    // FIXED: Added width to all summary text blocks.
    doc.text(`Gross Payment: ${formatCurrency(employee.grossPayment)}`, summaryCol1, summaryY, { width: summaryColumnWidth });
    doc.text(`Total Advances: ${formatCurrency(employee.advances)}`, summaryCol2, summaryY, { width: summaryColumnWidth });
    doc.text(`Bonus/Additional: ${formatCurrency(employee.bonus)}`, summaryCol3, summaryY, { width: summaryColumnWidth });
    
    doc.fillColor(employee.prevBalance >= 0 ? '#2d3748' : '#c53030')
       .text(`Previous Balance: ${formatCurrency(employee.prevBalance)}`, summaryCol1, summaryY + 25, { width: summaryColumnWidth });
       
    doc.fillColor(employee.finalPayment >= 0 ? '#22543d' : '#c53030').font('Helvetica-Bold').fontSize(12)
       .text(`FINAL PAYMENT: ${formatCurrency(employee.finalPayment)}`, summaryCol4, summaryY + 12, { width: summaryFinalWidth, align: 'right' });
    y += 80;

    // --- Three-Column Layout ---
    // Shift column 3 slightly left and reduce width to avoid touching page edge (was 570 + 240 = 810 exactly)
    const col1X = 30, col2X = 300, col3X = 560;
    const colWidth = 220; // Reduced from 240 to create breathing room at right margin
    let contentY = y + 25; // Shared baseline for all column content
    let finalY = y; // This will track the final height of the tallest column

    // Draw Column Titles
    doc.fillColor('#2d3748').font('Helvetica-Bold').fontSize(11);
    doc.text('ADVANCES & PAYOUTS', col1X, y);
    doc.text('BONUS & ADDITIONAL', col2X, y);
    doc.text('ATTENDANCE & BALANCE', col3X, y);
    doc.strokeColor("#bdc3c7").lineWidth(0.5).moveTo(sectionStartX, y + 20).lineTo(sectionStartX + sectionWidth, y + 20).stroke();

    // --- Column 1: Payouts (No changes needed here, widths were already defined) ---
    let col1Y = contentY;
    if (employee.payouts && employee.payouts.length > 0) {
        employee.payouts.forEach(payout => {
            const date = payout.date ? new Date(payout.date).toLocaleDateString('en-IN') : 'N/A';
            const amount = formatCurrency(payout.value || 0);
            doc.font('Helvetica').fontSize(8).fillColor('#4a5568').text(date, col1X, col1Y, { width: 70 });
            doc.text(amount, col1X + 80, col1Y, { width: 70, align: 'right' });
            col1Y += 12;
        });
        col1Y += 8;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#c53030').text(`Total: ${formatCurrency(employee.advances)}`, col1X, col1Y, { width: 150, align: 'right' });
    } else {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#718096').text('No advances recorded.', col1X, col1Y);
    }

    // --- Column 2: Bonus (No changes needed here, widths were already defined) ---
    let col2Y = contentY;
    // ... (code for column 2 remains the same)
    if (employee.additional_req_pays && employee.additional_req_pays.length > 0) {
        employee.additional_req_pays.forEach(payment => {
            const date = payment.date ? new Date(payment.date).toLocaleDateString('en-IN') : 'N/A';
            const amount = formatCurrency(payment.value || 0);
            doc.font('Helvetica').fontSize(8).fillColor('#4a5568').text(date, col2X, col2Y, { width: 70 });
            doc.text(amount, col2X + 80, col2Y, { width: 70, align: 'right' });
            col2Y += 12;
        });
        col2Y += 8;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#2f855a').text(`Total: ${formatCurrency(employee.bonus)}`, col2X, col2Y, { width: 150, align: 'right' });
    } else {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#718096').text('No bonus payments recorded.', col2X, col2Y);
    }
    
    // --- Column 3: Attendance & Balance ---
    let col3Y = contentY;
    doc.font('Helvetica').fontSize(9).fillColor('#4a5568');
    // FIXED: Added width to attendance details to keep them inside their column.
    doc.text(`• Total Present Days: ${employee.present}`, col3X, col3Y, { width: colWidth }); col3Y += 14;
    doc.text(`• Overtime Hours: ${employee.overtime}`, col3X, col3Y, { width: colWidth }); col3Y += 14;
    doc.text(`• Equivalent Work Days: ${(employee.present + (employee.overtime / 8)).toFixed(1)}`, col3X, col3Y, { width: colWidth }); col3Y += 20;

    if (employee.carry_forwarded && employee.carry_forwarded.value !== 0) {
        doc.font('Helvetica-Bold').text('Previous Balance:', col3X, col3Y, { width: colWidth }); col3Y += 14;
        let carryValue = formatCurrency(employee.carry_forwarded.value || 0);
        // Safety: truncate very long numeric strings to prevent overflow
        if (carryValue.length > 24) {
            carryValue = carryValue.slice(0, 21) + '...';
        }
        doc.font('Helvetica').fontSize(8).text(carryValue, col3X, col3Y, { width: colWidth, align: 'right'});
    } else {
        doc.font('Helvetica-Oblique').fontSize(9).text('No previous balance.', col3X, col3Y, { width: colWidth });
    }

    // --- Finalize Section ---
    finalY = Math.max(col1Y, col2Y, col3Y, y + 60); // Ensure a minimum height
    doc.strokeColor("#cbd5e0").lineWidth(1).moveTo(sectionStartX, finalY + 10).lineTo(sectionStartX + sectionWidth, finalY + 10).stroke();

    return finalY; // Return the final Y position
}

// POST endpoint to generate employee payment report PDF
router.post("/generate-payment-report", authenticateAndTrack, async (req, res) => {
    try {
        const { siteID, month, year } = req.body;
        
        // Validate required parameters
        if (!siteID || !month || !year) {
            return res.status(400).json({
                success: false,
                error: "siteID, month, and year are required.",
            });
        }
        
        // Validate month and year ranges
        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                error: "Month must be between 1 and 12.",
            });
        }
        
        if (year < 2020 || year > 2030) {
            return res.status(400).json({
                success: false,
                error: "Year must be between 2020 and 2030.",
            });
        }
        
        // Check if user has access to the site
        const userRole = req.user?.role?.toLowerCase();
        if (userRole === "supervisor") {
            const supervisorSite = req.user.site[0]?.toString().trim();
            if (supervisorSite !== siteID) {
                return res.status(403).json({
                    success: false,
                    error: "Forbidden. You do not have access to this site.",
                });
            }
        } else if (userRole === "admin") {
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
            
            const User = require("../models/Userschema");
            const adminUser = await User.findOne({
                _id: req.user.id,
                site: siteObjectId,
            });
            
            if (!adminUser) {
                return res.status(403).json({
                    success: false,
                    error: "Forbidden. You do not have access to this site.",
                });
            }
        } else {
            return res.status(403).json({
                success: false,
                error: "Forbidden. You do not have access to this resource.",
            });
        }
        
        console.log(`🔍 Generating PDF report for site ${siteID}, ${month}/${year}...`);
        
        // Fetch data from database
        const calculationType = req.user?.calculationType || 'default';
        const employees = await fetchEmployeeData(siteID, month, year, calculationType);
        const siteInfo = await fetchSiteInfo(siteID);
        
        if (!employees || employees.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No employees found for ${month}/${year} at site ${siteInfo.sitename}`,
            });
        }
        
        console.log(`📊 Found ${employees.length} employees`);
        
        // Create report data object
        const reportData = {
            month: getMonthName(month) + ' ' + year,
            siteName: siteInfo.sitename,
            siteID: siteID,
            employees: employees.map(emp => ({
                id: emp.empid,
                name: emp.name,
                present: emp.totalDays || 0,
                overtime: emp.totalovertime || 0,
                dailyRate: emp.rate || 0,
                grossPayment: emp.totalWage || 0,
                advances: emp.totalPayouts || 0,
                bonus: emp.totalAdditionalReqPays || 0,
                prevBalance: emp.carryForward || 0,
                finalPayment: emp.closing_balance || 0,
                payouts: emp.payouts || [],
                additional_req_pays: emp.additional_req_pays || [],
                attendance: emp.attendance || [],
                carry_forwarded: emp.carry_forwarded || {}
            }))
        };
        
        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `Employee_Payment_Report_${siteInfo.sitename.replace(/\s+/g, '_')}_${month}_${year}_${timestamp}.pdf`;
        const filepath = path.join(__dirname, '../temp', filename);
        
        // Ensure temp directory exists
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create PDF document
        const doc = new PDFDocument({ 
            size: 'A4',
            layout: 'landscape',
            margin: 20
        });
        
        // Pipe to file
        const writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);
        
        // Generate PDF content
        generateHeader(doc, reportData);
        generateEmployeeTable(doc, reportData);
        generateIndividualEmployeeDetails(doc, reportData);
        
        // Finalize PDF
        doc.end();
        
        // Wait for PDF to be written
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
        
        console.log(`✅ PDF report generated successfully: ${filename}`);
        
        // Send PDF as response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const pdfBuffer = fs.readFileSync(filepath);
        
        // Clean up temp file
        fs.unlinkSync(filepath);
        
        return res.send(pdfBuffer);
        
    } catch (error) {
        console.error("❌ Error generating PDF report:", error);
        return res.status(500).json({
            success: false,
            error: "Error generating PDF report.",
            message: error.message,
        });
    }
});

module.exports = router;

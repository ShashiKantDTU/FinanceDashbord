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
 * Generates individual employee detail pages
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing the list of employees.
 */
function generateIndividualEmployeeDetails(doc, reportData) {
    doc.addPage({ layout: 'landscape', margin: 20 });
    generateHeader(doc, reportData);
    
    let yPosition = 105;
    
    doc.fillColor('#2d3748')
       .font('Helvetica-Bold')
       .fontSize(16)
       .text('INDIVIDUAL EMPLOYEE DETAILS', 30, yPosition);
    
    yPosition += 30;
    
    reportData.employees.forEach((employee, index) => {
        if (yPosition > 500) {
            doc.addPage({ layout: 'landscape', margin: 20 });
            generateHeader(doc, reportData);
            yPosition = 105;
        }
        
        yPosition = generateEmployeeDetailSection(doc, employee, yPosition, reportData.month);
        yPosition += 20;
    });
}

/**
 * Generates detailed section for a single employee
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} employee - The employee data object.
 * @param {number} startY - Starting Y position.
 * @param {string} month - Month and year string.
 * @returns {number} New Y position after the section.
 */
function generateEmployeeDetailSection(doc, employee, startY, month) {
    let yPos = startY;
    
    doc.fillColor('#3498db')
       .rect(30, yPos, 750, 25)
       .fill()
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text(`${employee.name} (${employee.id})`, 40, yPos + 7);
    
    yPos += 35;
    
    // Split into two columns for better landscape layout
    const leftColumnX = 30;
    const rightColumnX = 420;
    const columnWidth = 350;
    
    // Left column - Basic Information
    doc.fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .fontSize(10)
       .text('Basic Information:', leftColumnX, yPos);
    
    let leftYPos = yPos + 15;
    
    const basicInfo = [
        `Daily Rate: ${formatCurrency(employee.dailyRate)}`,
        `Present Days: ${employee.present}`,
        `Overtime Hours: ${employee.overtime}`,
        `Total Wage: ${formatCurrency(employee.grossPayment)}`,
        `Final Payment: ${formatCurrency(employee.finalPayment)}`
    ];
    
    doc.fillColor('#34495e')
       .font('Helvetica')
       .fontSize(9);
    
    basicInfo.forEach(info => {
        doc.text(`• ${info}`, leftColumnX + 10, leftYPos);
        leftYPos += 12;
    });
    
    // Right column - Advances/Payouts
    let rightYPos = yPos + 15;
    
    if (employee.payouts && employee.payouts.length > 0) {
        doc.fillColor('#e74c3c')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Advances/Payouts:', rightColumnX, yPos);
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8);
        
        employee.payouts.forEach(payout => {
            if (rightYPos > 480) return; // Prevent overflow
            const date = payout.date ? new Date(payout.date).toLocaleDateString() : 'N/A';
            const remark = payout.remark || 'No remark';
            const value = formatCurrency(payout.value || 0);
            
            doc.text(`• ${date} - ${value}`, rightColumnX + 10, rightYPos, { width: columnWidth - 20 });
            rightYPos += 10;
            doc.text(`  ${remark}`, rightColumnX + 15, rightYPos, { width: columnWidth - 25 });
            rightYPos += 12;
        });
    }
    
    // Move to next row for additional sections
    yPos = Math.max(leftYPos, rightYPos) + 15;
    
    // Additional payments section (left column)
    if (employee.additional_req_pays && employee.additional_req_pays.length > 0) {
        doc.fillColor('#27ae60')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Additional Payments/Bonus:', leftColumnX, yPos);
        
        yPos += 15;
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8);
        
        employee.additional_req_pays.forEach(payment => {
            if (yPos > 480) return; // Prevent overflow
            const date = payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A';
            const remark = payment.remark || 'No remark';
            const value = formatCurrency(payment.value || 0);
            
            doc.text(`• ${date} - ${value} - ${remark}`, leftColumnX + 10, yPos, { width: columnWidth - 20 });
            yPos += 12;
        });
        
        yPos += 5;
    }
    
    // Carry forward information (right column if space available)
    if (employee.carry_forwarded && employee.carry_forwarded.value !== 0) {
        doc.fillColor('#f39c12')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Carry Forward:', rightColumnX, yPos);
        
        const carryDate = employee.carry_forwarded.date ? 
            new Date(employee.carry_forwarded.date).toLocaleDateString() : 'N/A';
        const carryRemark = employee.carry_forwarded.remark || 'No remark';
        const carryValue = formatCurrency(employee.carry_forwarded.value || 0);
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8)
           .text(`• ${carryDate} - ${carryValue}`, rightColumnX + 10, yPos + 15, { width: columnWidth - 20 });
        doc.text(`  ${carryRemark}`, rightColumnX + 15, yPos + 27, { width: columnWidth - 25 });
        
        yPos += 45;
    }
    
    // Attendance summary
    if (employee.attendance && employee.attendance.length > 0) {
        doc.fillColor('#9b59b6')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Attendance Summary:', leftColumnX, yPos);
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8)
           .text(`Total attendance entries: ${employee.attendance.length}`, leftColumnX + 10, yPos + 15);
        
        yPos += 30;
    }
    
    // Add separator line
    doc.strokeColor("#bdc3c7")
       .lineWidth(1)
       .moveTo(30, yPos)
       .lineTo(780, yPos)
       .stroke();
    
    return yPos + 10;
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

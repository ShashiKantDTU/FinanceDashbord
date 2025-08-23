// Import necessary libraries
const PDFDocument = require('pdfkit');
const fs = require('fs');
const mongoose = require('mongoose');

// Import required models and schemas
const employeeSchema = require('../models/EmployeeSchema');
const siteSchema = require('../models/Siteschema');

// MongoDB connection string - will be loaded from environment or server config
let MONGODB_URI;
try {
    // Try to load from main server config if available
    const serverConfig = require('../server.js');
    MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/FinanceDashboard';
} catch (error) {
    // Fallback to environment variable
    MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/FinanceDashboard';
}

/**
 * Connect to MongoDB
 */
async function connectToDatabase() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
            console.log('📊 Connected to MongoDB');
        }
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

/**
 * Fetch employee data from the optimized route logic
 * @param {string} siteID - Site identifier
 * @param {number} month - Month number
 * @param {number} year - Year number
 * @returns {Array} Employee data array
 */
async function fetchEmployeeData(siteID, month, year) {
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
            
            // Stage 3: Calculate overtime days (using default calculation)
            {
                $addFields: {
                    overtimeDays: { $divide: ["$totalovertime", 8] }
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
 * Main function to generate the employee report PDF.
 * @param {string} siteID - Site identifier
 * @param {number} month - Month number
 * @param {number} year - Year number
 * @param {string} path - The path to save the generated PDF file.
 */
async function createEmployeeReport(siteID, month, year, path) {
    try {
        // Connect to database
        await connectToDatabase();
        
        // Fetch real data from database
        console.log(`🔍 Fetching data for site ${siteID}, ${month}/${year}...`);
        const employees = await fetchEmployeeData(siteID, month, year);
        const siteInfo = await fetchSiteInfo(siteID);
        
        if (!employees || employees.length === 0) {
            console.log('⚠️ No employees found for the specified criteria');
            return;
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
                // Additional detailed data for individual reports
                payouts: emp.payouts || [],
                additional_req_pays: emp.additional_req_pays || [],
                attendance: emp.attendance || [],
                carry_forwarded: emp.carry_forwarded || {}
            }))
        };

        // Create a new PDF document with A4 size and wider margins for modern design
        let doc = new PDFDocument({ 
            size: 'A4', 
            margin: 40
        });

        // Pipe the PDF output to a writable stream to save it to a file
        doc.pipe(fs.createWriteStream(path));

        // Generate the main header for the report
        generateHeader(doc, reportData);

        // Generate the table containing all employee data
        generateEmployeeTable(doc, reportData);
        
        // Generate individual employee details
        generateIndividualEmployeeDetails(doc, reportData);

        // Finalize the PDF document
        doc.end();

        console.log(`✅ Employee report successfully generated at: ${path}`);
        
    } catch (error) {
        console.error('❌ Error creating employee report:', error);
        throw error;
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
 * Generates the main header of the report.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing month and site name.
 */
function generateHeader(doc, reportData) {
    // Modern header with gradient-like styling
    doc.fillColor('#2c3e50')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Company Name Inc.', 50, 50)
        .fillColor('#34495e')
        .fontSize(12)
        .font('Helvetica')
        .text('Employee Payment Report', 350, 50, { align: 'right' })
        .fillColor('#7f8c8d')
        .fontSize(10)
        .text(`Month: ${reportData.month}`, 350, 70, { align: 'right' })
        .text(`Site: ${reportData.siteName}`, 350, 85, { align: 'right' })
        .text(`Generated: ${new Date().toLocaleString()}`, 350, 100, { align: 'right' })
        .moveDown();

    // Modern header separator with gradient effect
    doc.fillColor('#3498db')
       .rect(50, 115, 500, 3)
       .fill()
       .fillColor('#2980b9')
       .rect(50, 118, 500, 1)
       .fill();
}


/**
 * Generates the employee data table with dynamic rows and page breaks.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing the list of employees.
 */
function generateEmployeeTable(doc, reportData) {
    // Define the starting Y position for the table with better spacing
    let tableTop = 140;
    
    // Draw the table header
    generateTableHeader(doc, tableTop);

    // Set the starting position for the first employee row
    let position = tableTop + 30;

    // Iterate through each employee record
    for (const employee of reportData.employees) {
        // Increased row height for better readability
        const rowHeight = 50; 

        // **Multi-page Logic**
        // Check if adding the next row would exceed the page's bottom margin.
        if (position + rowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage(); // Add a new page
            generateHeader(doc, reportData); // Redraw the main header on the new page
            
            // Reset the Y position for the new page's table
            tableTop = 140; 
            generateTableHeader(doc, tableTop); // Redraw the table header
            
            // Reset the row position
            position = tableTop + 30;
        }

        // Draw the row for the current employee
        generateTableRow(doc, position, employee);

        // Move the Y position down for the next row
        position += rowHeight;
    }
}

/**
 * Generates individual employee detail pages
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing the list of employees.
 */
function generateIndividualEmployeeDetails(doc, reportData) {
    // Add a new page for individual employee details
    doc.addPage();
    
    // Generate header for individual details section
    generateHeader(doc, reportData);
    
    let yPosition = 140;
    
    // Section title
    doc.fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .fontSize(16)
       .text('Individual Employee Details', 50, yPosition);
    
    yPosition += 30;
    
    // Generate details for each employee
    reportData.employees.forEach((employee, index) => {
        // Check if we need a new page
        if (yPosition > 650) {
            doc.addPage();
            generateHeader(doc, reportData);
            yPosition = 140;
        }
        
        yPosition = generateEmployeeDetailSection(doc, employee, yPosition, reportData.month);
        yPosition += 20; // Space between employees
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
    
    // Employee header with background
    doc.fillColor('#3498db')
       .rect(50, yPos, 500, 25)
       .fill()
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text(`${employee.name} (${employee.id})`, 60, yPos + 7);
    
    yPos += 35;
    
    // Basic info section
    doc.fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .fontSize(10)
       .text('Basic Information:', 50, yPos);
    
    yPos += 15;
    
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
        doc.text(`• ${info}`, 60, yPos);
        yPos += 12;
    });
    
    yPos += 10;
    
    // Advances/Payouts section
    if (employee.payouts && employee.payouts.length > 0) {
        doc.fillColor('#e74c3c')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Advances/Payouts:', 50, yPos);
        
        yPos += 15;
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8);
        
        employee.payouts.forEach(payout => {
            const date = payout.date ? new Date(payout.date).toLocaleDateString() : 'N/A';
            const remark = payout.remark || 'No remark';
            const value = formatCurrency(payout.value || 0);
            
            doc.text(`• ${date} - ${value} - ${remark}`, 60, yPos);
            yPos += 12;
        });
        
        yPos += 5;
    }
    
    // Additional payments section
    if (employee.additional_req_pays && employee.additional_req_pays.length > 0) {
        doc.fillColor('#27ae60')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Additional Payments/Bonus:', 50, yPos);
        
        yPos += 15;
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8);
        
        employee.additional_req_pays.forEach(payment => {
            const date = payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A';
            const remark = payment.remark || 'No remark';
            const value = formatCurrency(payment.value || 0);
            
            doc.text(`• ${date} - ${value} - ${remark}`, 60, yPos);
            yPos += 12;
        });
        
        yPos += 5;
    }
    
    // Carry forward information
    if (employee.carry_forwarded && employee.carry_forwarded.value !== 0) {
        doc.fillColor('#f39c12')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Carry Forward:', 50, yPos);
        
        yPos += 15;
        
        const carryDate = employee.carry_forwarded.date ? 
            new Date(employee.carry_forwarded.date).toLocaleDateString() : 'N/A';
        const carryRemark = employee.carry_forwarded.remark || 'No remark';
        const carryValue = formatCurrency(employee.carry_forwarded.value || 0);
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8)
           .text(`• ${carryDate} - ${carryValue} - ${carryRemark}`, 60, yPos);
        
        yPos += 15;
    }
    
    // Attendance summary (if needed)
    if (employee.attendance && employee.attendance.length > 0) {
        doc.fillColor('#9b59b6')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Attendance Summary:', 50, yPos);
        
        yPos += 15;
        
        doc.fillColor('#34495e')
           .font('Helvetica')
           .fontSize(8)
           .text(`Total attendance entries: ${employee.attendance.length}`, 60, yPos);
        
        yPos += 15;
    }
    
    // Add separator line
    doc.strokeColor("#bdc3c7")
       .lineWidth(1)
       .moveTo(50, yPos)
       .lineTo(550, yPos)
       .stroke();
    
    return yPos + 10;
}

/**
 * Generates the header row for the employee table.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {number} y - The Y position to draw the header at.
 */
function generateTableHeader(doc, y) {
    // Modern header with better spacing and colors (optimized for portrait)
    doc.fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .fontSize(8)
       .text('EMP ID', 50, y, { width: 45 })
       .text('Employee Name', 100, y, { width: 75 })
       .text('Present', 180, y, { width: 35, align: 'center' })
       .text('OT', 220, y, { width: 25, align: 'center' })
       .text('Rate', 250, y, { width: 40, align: 'right' })
       .text('Gross', 295, y, { width: 45, align: 'right' })
       .text('Advance', 345, y, { width: 45, align: 'right' })
       .text('Bonus', 395, y, { width: 35, align: 'right' })
       .text('Prev Bal', 435, y, { width: 45, align: 'right' })
       .text('Final Pay', 485, y, { width: 50, align: 'right' });
    
    // Modern separator line with better styling
    generateHr(doc, y + 18);
}

/**
 * Generates a single row in the employee table.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {number} y - The Y position to draw the row at.
 * @param {object} emp - The employee data object for the row.
 */
function generateTableRow(doc, y, emp) {
    // Alternating row colors for better readability
    const isEvenRow = Math.floor((y - 145) / 45) % 2 === 0;
    if (isEvenRow) {
        doc.fillColor('#f8f9fa')
           .rect(45, y - 5, 495, 40)
           .fill();
    }
    
    // Modern row styling with proper spacing and colors (optimized for portrait)
    doc.fillColor('#34495e')
       .font('Helvetica')
       .fontSize(7.5)
       .text(emp.id, 50, y, { width: 45 })
       .text(emp.name, 100, y, { width: 75 })
       .text(emp.present.toString(), 180, y, { width: 35, align: 'center' })
       .text(emp.overtime.toString(), 220, y, { width: 25, align: 'center' })
       .fillColor('#16a085')
       .text(formatCurrency(emp.dailyRate), 250, y, { width: 40, align: 'right' })
       .fillColor('#2980b9')
       .text(formatCurrency(emp.grossPayment), 295, y, { width: 45, align: 'right' })
       .fillColor('#e74c3c')
       .text(formatCurrency(emp.advances), 345, y, { width: 45, align: 'right' })
       .fillColor('#27ae60')
       .text(formatCurrency(emp.bonus), 395, y, { width: 35, align: 'right' })
       .fillColor(emp.prevBalance >= 0 ? '#27ae60' : '#e74c3c')
       .text(formatCurrency(emp.prevBalance), 435, y, { width: 45, align: 'right' })
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .fontSize(8)
       .text(formatCurrency(emp.finalPayment), 485, y, { width: 50, align: 'right' });

    // Subtle separator line
    generateHr(doc, y + 35);
}

// --- Helper Functions ---

/**
 * Draws a horizontal line.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {number} y - The Y position of the line.
 */
function generateHr(doc, y) {
    doc.strokeColor("#bdc3c7")
       .lineWidth(0.5)
       .moveTo(50, y)
       .lineTo(540, y)
       .stroke();
}

/**
 * Formats a number as a currency string.
 * @param {number} value - The number to format.
 * @returns {string} - The formatted currency string.
 */
function formatCurrency(value) {
    // Using Rs. instead of ₹ symbol for better PDF compatibility
    return `Rs. ${value.toFixed(2)}`;
}


// --- Main Execution ---

/**
 * Configuration - Update these values or pass as command line arguments
 * Usage: node new.js [siteID] [month] [year]
 * Example: node new.js 64b0f4c1a8e6f5d2c9a1b2c3 8 2025
 */

// Get command line arguments or use defaults
const args = process.argv.slice(2);
const SITE_ID = args[0] || "64b0f4c1a8e6f5d2c9a1b2c3"; // Replace with actual site ObjectId
const MONTH = parseInt(args[1]) || 8; // August
const YEAR = parseInt(args[2]) || 2025;

// Validate inputs
if (!SITE_ID || MONTH < 1 || MONTH > 12 || YEAR < 2020 || YEAR > 2030) {
    console.error('❌ Invalid arguments provided');
    console.log('Usage: node new.js [siteID] [month] [year]');
    console.log('Example: node new.js 64b0f4c1a8e6f5d2c9a1b2c3 8 2025');
    process.exit(1);
}

/**
 * Main execution function
 */
async function main() {
    try {
        // Generate the unique filename
        const timestamp = getTimestamp();
        const outputPath = `./Employee_Report_${MONTH}_${YEAR}_${timestamp}.pdf`;
        
        console.log(`🚀 Starting PDF generation for Site ${SITE_ID}, ${MONTH}/${YEAR}`);
        
        // Call the main function to generate the report
        await createEmployeeReport(SITE_ID, MONTH, YEAR, outputPath);
        
        console.log(`✅ Report generation completed successfully!`);
        
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('📊 Database connection closed');
        }
        
    } catch (error) {
        console.error('❌ Error in main execution:', error);
        process.exit(1);
    }
}

// Run the main function
main();

// --- ** HELPER FUNCTIONS ** ---

// Function to generate a formatted timestamp string
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

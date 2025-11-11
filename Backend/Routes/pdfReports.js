const express = require("express");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const employeeSchema = require("../models/EmployeeSchema");
const siteSchema = require("../models/Siteschema");
const SiteExpenseSchema = require("../models/SiteExpenseSchema");
const SitePaymentSchema = require("../models/SitePaymentSchema");
const { authenticateAndTrack } = require("../Middleware/usageTracker");

const router = express.Router();

/**
 * ═══════════════════════════════════════════════════════════════════════
 * PDF LAYOUT CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════
 * Centralized configuration for margins, colors, fonts, and dimensions
 */
const PDF_CONSTANTS = {
    // Page Dimensions (A4 Landscape)
    PAGE: {
        WIDTH: 842,        // A4 landscape width in points
        HEIGHT: 595,       // A4 landscape height in points
        CONTENT_WIDTH: 792 // Width minus margins (842 - 50)
    },
    
    // Margins
    MARGIN: {
        LEFT: 30,
        RIGHT: 30,
        TOP: 25,
        BOTTOM: 20,
        SECTION: 15        // Spacing between sections
    },
    
    // Column Widths for Employee Table (Total: 782px = Full content width)
    COLUMN_WIDTHS: {
        SERIAL: 30,        // S.No
        EMP_ID: 50,        // Employee ID
        NAME: 180,         // Employee Name (expanded for long names)
        PRESENT: 25,       // Present days
        OVERTIME: 25,      // Overtime hours
        RATE: 45,          // Daily rate
        GROSS: 90,         // Gross Payment (expanded)
        ADVANCES: 85,      // Advances (expanded)
        BONUS: 70,         // Bonus (expanded)
        PREV_BAL: 85,      // Previous Balance (expanded)
        FINAL: 97          // Final Payment (expanded, most important)
    },
    
    // Color Palette
    COLORS: {
        // Primary Colors
        PRIMARY: '#1a365d',       // Dark blue for main headings
        SECONDARY: '#2d3748',     // Dark gray for subheadings
        
        // Status Colors
        SUCCESS: '#27ae60',       // Green for positive values
        DANGER: '#e74c3c',        // Red for negative values
        WARNING: '#dd6b20',       // Orange for warnings
        INFO: '#2980b9',          // Blue for information
        ACCENT: '#16a085',        // Teal for accents
        
        // Table Colors
        TABLE_HEADER: '#2c3e50',  // Dark blue-gray for table headers
        TABLE_ROW_ODD: '#ecf0f1', // Light gray for odd rows
        TABLE_ROW_EVEN: '#ffffff', // White for even rows
        TABLE_BORDER: '#bdc3c7',  // Light gray for borders
        
        // Background Colors
        BG_LIGHT: '#f8f9fa',      // Very light gray
        BG_SUMMARY: '#e8f4f8',    // Light blue background
        
        // Text Colors
        TEXT_PRIMARY: '#2c3e50',  // Main text color
        TEXT_SECONDARY: '#718096', // Secondary text color
        TEXT_MUTED: '#a0aec0'     // Muted text color
    },
    
    // Typography
    FONTS: {
        HEADER: 22,        // Main page headers
        TITLE: 20,         // Section titles
        SUBTITLE: 16,      // Subsection titles
        BODY: 12,          // Regular body text
        BODY_SMALL: 10,    // Small body text
        TABLE_HEADER: 9,   // Table column headers
        TABLE_CELL: 8,     // Table cell content
        CAPTION: 7         // Image captions, footnotes
    },
    
    // Line Heights
    LINE_HEIGHT: {
        TIGHT: 1.2,
        NORMAL: 1.5,
        RELAXED: 1.8
    },
    
    // Calendar Configuration
    CALENDAR: {
        CELL_SIZE: 18,
        HEADER_HEIGHT: 20,
        MARGIN: 5
    }
};

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
 * Fetch site expenses for a specific month
 * @param {string} siteID - Site identifier
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year number
 * @returns {Object} Expense data with category breakdown
 */
async function fetchSiteExpenses(siteID, month, year) {
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const expenses = await SiteExpenseSchema.find({
            siteID: new mongoose.Types.ObjectId(siteID),
            date: {
                $gte: startDate,
                $lte: endDate
            }
        }).lean().sort({ date: 1 });

        // Group by category
        const byCategory = {};
        let total = 0;

        expenses.forEach(expense => {
            const category = expense.category || 'Uncategorized';
            if (!byCategory[category]) {
                byCategory[category] = {
                    total: 0,
                    items: []
                };
            }
            byCategory[category].total += expense.value;
            byCategory[category].items.push(expense);
            total += expense.value;
        });

        return {
            total,
            byCategory,
            expenses,
            count: expenses.length
        };
    } catch (error) {
        console.error('❌ Error fetching site expenses:', error);
        return { total: 0, byCategory: {}, expenses: [], count: 0 };
    }
}

/**
 * Fetch site payments for a specific month
 * @param {string} siteID - Site identifier
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year number
 * @returns {Object} Payment data
 */
async function fetchSitePayments(siteID, month, year) {
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const payments = await SitePaymentSchema.find({
            siteID: new mongoose.Types.ObjectId(siteID),
            date: {
                $gte: startDate,
                $lte: endDate
            }
        }).lean().sort({ date: 1 });

        const total = payments.reduce((sum, payment) => sum + payment.value, 0);

        return {
            total,
            payments,
            count: payments.length
        };
    } catch (error) {
        console.error('❌ Error fetching site payments:', error);
        return { total: 0, payments: [], count: 0 };
    }
}

/**
 * Calculate financial summary for the site
 * @param {Array} employeeData - Array of employee data
 * @param {Object} expenseData - Site expenses data
 * @param {Object} paymentData - Site payments data
 * @returns {Object} Financial summary
 */
function calculateFinancialSummary(employeeData, expenseData, paymentData) {
    // Calculate labour costs
    const totalWages = employeeData.reduce((sum, emp) => sum + (emp.totalWage || 0), 0);
    const totalAdvances = employeeData.reduce((sum, emp) => sum + (emp.totalPayouts || 0), 0);
    const totalBonus = employeeData.reduce((sum, emp) => sum + (emp.totalAdditionalReqPays || 0), 0);
    const pendingPayment = totalWages - totalAdvances;

    // Calculate site expenses
    const totalExpenses = expenseData.total || 0;

    // Calculate payments received
    const totalPayments = paymentData.total || 0;

    // Calculate profit/loss
    const totalCosts = totalWages + totalExpenses;
    const netProfit = totalPayments - totalCosts;
    const profitMargin = totalPayments > 0 ? (netProfit / totalPayments) * 100 : 0;

    // Calculate cash flow
    const cashIn = totalPayments;
    const cashOut = totalAdvances + totalExpenses;
    const netCashPosition = cashIn - cashOut;

    return {
        labour: {
            totalWages,
            totalAdvances,
            totalBonus,
            pendingPayment
        },
        expenses: {
            total: totalExpenses,
            byCategory: expenseData.byCategory,
            count: expenseData.count
        },
        payments: {
            total: totalPayments,
            count: paymentData.count
        },
        profitLoss: {
            revenue: totalPayments,
            costs: totalCosts,
            netProfit,
            profitMargin
        },
        cashFlow: {
            cashIn,
            cashOut,
            netCashPosition
        },
        statistics: {
            employeeCount: employeeData.length,
            totalWorkingDays: employeeData.reduce((sum, emp) => sum + (emp.totalDays || 0), 0),
            totalOvertimeHours: employeeData.reduce((sum, emp) => sum + (emp.totalovertime || 0), 0),
            expenseItems: expenseData.count,
            paymentTransactions: paymentData.count
        }
    };
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
    doc.save(); // Save graphics state
    
    // Professional header with site name as main title
    doc.fillColor(PDF_CONSTANTS.COLORS.PRIMARY)
        .fontSize(PDF_CONSTANTS.FONTS.HEADER)
        .font('UserFont')  // Use UserFont for site name (supports Hindi)
        .text(reportData.siteName.toUpperCase(), PDF_CONSTANTS.MARGIN.LEFT, PDF_CONSTANTS.MARGIN.TOP, { 
            width: 550, 
            ellipsis: true 
        });

    // Subtitle - Employee Payment Report
    doc.fillColor(PDF_CONSTANTS.COLORS.SECONDARY)
        .fontSize(PDF_CONSTANTS.FONTS.SUBTITLE)
        .font('Bold')
        .text('EMPLOYEE PAYMENT REPORT', PDF_CONSTANTS.MARGIN.LEFT, 50, { 
            width: 550 
        });

    // Report metadata in right column
    doc.fillColor(PDF_CONSTANTS.COLORS.TEXT_PRIMARY)
        .fontSize(11)
        .font('Bold')
        .text('REPORT DETAILS', 600, PDF_CONSTANTS.MARGIN.TOP, { 
            width: 212, 
            align: 'right' 
        })
        .fillColor(PDF_CONSTANTS.COLORS.TEXT_SECONDARY)
        .fontSize(PDF_CONSTANTS.FONTS.BODY_SMALL)
        .font('Regular')
        .text(`Period: ${reportData.month}`, 600, 42, { 
            width: 212, 
            align: 'right' 
        })
        .text(`Generated: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN', { hour12: false })}`, 600, 55, { 
            width: 212, 
            align: 'right' 
        })
        .text(`Total Employees: ${reportData.employees.length}`, 600, 68, { 
            width: 212, 
            align: 'right' 
        });

    // Simplified single separator bar with gradient effect
    const grad = doc.linearGradient(PDF_CONSTANTS.MARGIN.LEFT, 90, PDF_CONSTANTS.PAGE.WIDTH - PDF_CONSTANTS.MARGIN.RIGHT, 90);
    grad.stop(0, PDF_CONSTANTS.COLORS.INFO, 0.2)
        .stop(0.5, PDF_CONSTANTS.COLORS.INFO, 1)
        .stop(1, PDF_CONSTANTS.COLORS.INFO, 0.2);
    
    doc.rect(PDF_CONSTANTS.MARGIN.LEFT, 90, PDF_CONSTANTS.PAGE.CONTENT_WIDTH, 2)
       .fill(grad);
    
    doc.restore(); // Restore graphics state
}

/**
 * Generates the employee data table using PDFKit's built-in table method.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing the list of employees.
 */
function generateEmployeeTable(doc, reportData) {
    doc.save(); // Save graphics state
    
    // Add section header for employee table
    let y = PDF_CONSTANTS.MARGIN.LEFT;
    doc.fillColor(PDF_CONSTANTS.COLORS.PRIMARY)
        .fontSize(PDF_CONSTANTS.FONTS.TITLE)
        .font('Bold')
        .text('EMPLOYEE SUMMARY', PDF_CONSTANTS.MARGIN.LEFT, y, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });
    
    doc.fillColor(PDF_CONSTANTS.COLORS.TEXT_SECONDARY)
        .fontSize(PDF_CONSTANTS.FONTS.BODY_SMALL)
        .font('UserFont')  // Use UserFont for site name
        .text(`${reportData.siteName} - ${reportData.month}`, PDF_CONSTANTS.MARGIN.LEFT, y + 25, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });
    
    doc.fillColor(PDF_CONSTANTS.COLORS.TEXT_SECONDARY)
        .fontSize(PDF_CONSTANTS.FONTS.TABLE_HEADER)
        .text(`Total Employees: ${reportData.employees.length}`, PDF_CONSTANTS.MARGIN.LEFT, y + 40, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });

    y += 60;

    // Build table data array
    const tableData = [
        // Header row
        ['S.No', 'EMP ID', 'Employee Name', 'P', 'OT', 'Rate', 
         'Gross Payment', 'Advances', 'Bonus', 'Prev Balance', 'Final Payment'],
        // Data rows
        ...reportData.employees.map((emp, index) => [
            (index + 1).toString(),
            emp.id,
            { text: emp.name, font: 'UserFont' },  // Use UserFont for employee names
            emp.present.toString(),
            emp.overtime.toString(),
            { text: emp.dailyRateFormatted, textColor: PDF_CONSTANTS.COLORS.ACCENT },
            { text: emp.grossPaymentFormatted, textColor: PDF_CONSTANTS.COLORS.INFO },
            { text: emp.advancesFormatted, textColor: PDF_CONSTANTS.COLORS.DANGER },
            { text: emp.bonusFormatted, textColor: PDF_CONSTANTS.COLORS.SUCCESS },
            { 
                text: emp.prevBalanceFormatted, 
                textColor: emp.prevBalance >= 0 ? PDF_CONSTANTS.COLORS.SUCCESS : PDF_CONSTANTS.COLORS.DANGER 
            },
            { 
                text: emp.finalPaymentFormatted, 
                font: 'Bold',
                textColor: PDF_CONSTANTS.COLORS.TEXT_PRIMARY
            }
        ])
    ];

    // Generate table with styling
    doc.table({
        position: { x: PDF_CONSTANTS.MARGIN.LEFT, y: y },
        columnStyles: [
            PDF_CONSTANTS.COLUMN_WIDTHS.SERIAL,
            PDF_CONSTANTS.COLUMN_WIDTHS.EMP_ID,
            PDF_CONSTANTS.COLUMN_WIDTHS.NAME,
            PDF_CONSTANTS.COLUMN_WIDTHS.PRESENT,
            PDF_CONSTANTS.COLUMN_WIDTHS.OVERTIME,
            PDF_CONSTANTS.COLUMN_WIDTHS.RATE,
            PDF_CONSTANTS.COLUMN_WIDTHS.GROSS,
            PDF_CONSTANTS.COLUMN_WIDTHS.ADVANCES,
            PDF_CONSTANTS.COLUMN_WIDTHS.BONUS,
            PDF_CONSTANTS.COLUMN_WIDTHS.PREV_BAL,
            PDF_CONSTANTS.COLUMN_WIDTHS.FINAL
        ],
        rowStyles: (i) => {
            if (i === 0) {
                // Header row style
                return {
                    backgroundColor: PDF_CONSTANTS.COLORS.TABLE_HEADER,
                    textColor: '#ffffff',
                    font: 'Bold',
                    fontSize: PDF_CONSTANTS.FONTS.TABLE_HEADER,
                    padding: 8,
                    align: { x: 'center', y: 'center' }
                };
            }
            // Data row styles (alternating)
            return {
                backgroundColor: i % 2 === 0 ? PDF_CONSTANTS.COLORS.TABLE_ROW_EVEN : PDF_CONSTANTS.COLORS.TABLE_ROW_ODD,
                textColor: PDF_CONSTANTS.COLORS.TEXT_PRIMARY,
                font: 'Regular',
                fontSize: PDF_CONSTANTS.FONTS.TABLE_CELL,
                padding: 5,
                border: [0, 0, 0.5, 0],
                borderColor: PDF_CONSTANTS.COLORS.TABLE_BORDER
            };
        },
        data: tableData
    });
    
    doc.restore(); // Restore graphics state
}

// ============================================================================
// FINANCIAL SUMMARY PAGE - HELPER FUNCTIONS
// ============================================================================

/**
 * Draws simplified financial summary with 4 key boxes (like weekly report).
 * @param {PDFDocument} doc - PDF document instance
 * @param {object} fs - Financial summary data
 * @param {number} y - Current Y position
 * @returns {number} - New Y position after boxes
 */
function drawSimplifiedFinancialSummary(doc, fs, y) {
    // Section title
    doc.fillColor('#2d3748').fontSize(14).font('Helvetica-Bold')
        .text('MONTHLY FINANCIAL SUMMARY', 30, y, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });

    y += 25;

    // Calculate responsive box dimensions based on A4 page width
    const pageWidth = PDF_CONSTANTS.PAGE.WIDTH;
    const marginLeft = PDF_CONSTANTS.MARGIN.LEFT;
    const marginRight = PDF_CONSTANTS.MARGIN.RIGHT;
    const availableWidth = pageWidth - marginLeft - marginRight;
    
    const numBoxes = 4;
    const spacing = 8;  // Reduced from 10 for better fit
    const totalSpacing = spacing * (numBoxes - 1);
    const boxWidth = Math.floor((availableWidth - totalSpacing) / numBoxes);  // 185px per box
    const boxHeight = 80;
    
    const boxes = [
        {
            label: 'Labour Cost',
            value: formatCurrency(fs.labour.totalWages),
            color: '#3182ce',
            icon: 'LC',
            subtext: `${fs.statistics.employeeCount} employees`
        },
        {
            label: 'Site Expenses',
            value: formatCurrency(fs.expenses.total),
            color: '#d69e2e',
            icon: 'SE',
            subtext: `${fs.expenses.count} transactions`
        },
        {
            label: 'Advances Paid',
            value: formatCurrency(fs.labour.totalAdvances),
            color: '#e53e3e',
            icon: 'AP',
            subtext: `Cash paid to workers`
        },
        {
            label: 'Money Received',
            value: formatCurrency(fs.payments.total),
            color: '#38a169',
            icon: 'MR',
            subtext: `${fs.payments.count} payments`
        }
    ];

    // Draw boxes - 4 boxes in a row
    let boxX = 30;
    const boxY = y;
    
    boxes.forEach((box, index) => {
        // Background with reduced opacity
        const bgColor = box.color;
        doc.save();
        doc.fillColor(bgColor);
        doc.opacity(0.1);
        doc.rect(boxX, boxY, boxWidth, boxHeight).fill();
        doc.restore();

        // Border
        doc.save();
        doc.strokeColor(box.color);
        doc.lineWidth(1.5);
        doc.rect(boxX, boxY, boxWidth, boxHeight).stroke();
        doc.restore();

        // Icon
        doc.save();
        doc.fillColor(box.color);
        doc.fontSize(14);
        doc.font('Helvetica-Bold');
        doc.text(box.icon, boxX + 10, boxY + 10, { 
            width: boxWidth - 20, 
            align: 'left'
        });
        doc.restore();
        
        // Label
        doc.save();
        doc.fillColor('#4a5568');
        doc.fontSize(8);
        doc.font('Helvetica');
        doc.text(box.label, boxX + 10, boxY + 30, { 
            width: boxWidth - 20,
            align: 'left'
        });
        doc.restore();

        // Value
        doc.save();
        doc.fillColor(box.color);
        doc.fontSize(11);
        doc.font('Helvetica-Bold');
        doc.text(box.value, boxX + 10, boxY + 45, { 
            width: boxWidth - 20,
            align: 'left'
        });
        doc.restore();

        // Subtext
        doc.save();
        doc.fillColor('#718096');
        doc.fontSize(7);
        doc.font('Helvetica');
        doc.text(box.subtext, boxX + 10, boxY + 62, { 
            width: boxWidth - 20,
            align: 'left'
        });
        doc.restore();

        // Move to next position
        boxX += boxWidth + spacing;
    });

    y = boxY + boxHeight;

    // Additional key metrics in a simple row
    y += 20;
    doc.fillColor('#718096').fontSize(8).font('Helvetica')
        .text(`Working Days: ${fs.statistics.totalWorkingDays}`, 30, y, { width: 180 })
        .text(`Overtime Hours: ${fs.statistics.totalOvertimeHours}`, 220, y, { width: 180 })
        .text(`Pending Payment: ${formatCurrency(fs.labour.pendingPayment)}`, 410, y, { width: 180 })
        .text(`Total Cost: ${formatCurrency(fs.profitLoss.costs)}`, 600, y, { width: 212 });

    return y + 30;
}

/**
 * Generate Financial Summary Page
 * @param {PDFDocument} doc - The PDF document instance
 * @param {object} reportData - The report data containing financial summary
 */
function generateFinancialSummaryPage(doc, reportData) {
    doc.save(); // Save graphics state
    // NOTE: Page is already created and header already rendered by caller
    // Do not add a new page here - just continue on current page
    
    const fs = reportData.financialSummary;
    let y = 105; // Start below the header

    // Draw simplified financial summary (4 boxes like weekly report)
    y = drawSimplifiedFinancialSummary(doc, fs, y);

    // Cash Flow Summary at bottom
    y += 10;
    doc.fillColor('#2d3748').fontSize(10).font('Helvetica-Bold')
        .text('Cash Flow Summary:', 30, y, { width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH });
    
    y += 15;
    doc.fillColor('#718096').fontSize(8).font('Helvetica')
        .text(`Cash In: ${formatCurrency(fs.cashFlow.cashIn)} | Cash Out: ${formatCurrency(fs.cashFlow.cashOut)} | Net Position: ${formatCurrency(fs.cashFlow.netCashPosition)}`, 
              30, y, { width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH });
    
    doc.restore(); // Restore graphics state
}

/**
 * Generate Site Expenses Section
 * @param {PDFDocument} doc - The PDF document instance
 * @param {object} reportData - The report data containing expense data
 */
function generateSiteExpensesSection(doc, reportData) {
    const expenseData = reportData.expenseData;
    
    // Only add section if there are expenses
    if (expenseData.count === 0) {
        return;
    }

    doc.save(); // Save graphics state
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
    let y = 30;

    // Section Title
    doc.fillColor('#1a365d')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('SITE EXPENSES BREAKDOWN', 30, y, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });
    
    y += 30;

    // Summary Box
    doc.rect(30, y, 810, 55).fill('#f7fafc');
    doc.rect(30, y, 810, 55).stroke('#bdc3c7');
    
    doc.fillColor('#2d3748')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`Total Site Expenses: ${formatCurrency(expenseData.total)}`, 40, y + 12, { 
            width: 770 
        });
    doc.fillColor('#718096')
        .fontSize(10)
        .font('Helvetica')
        .text(`${expenseData.count} transactions | Period: ${reportData.month}`, 40, y + 33, { 
            width: 770 
        });

    y += 75;

    // Category Breakdown Table Header
    doc.fillColor('#2c3e50')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('CATEGORY', 30, y, { width: 200 })
        .text('AMOUNT', 250, y, { width: 150, align: 'right' })
        .text('ITEMS', 420, y, { width: 80, align: 'right' })
        .text('PERCENTAGE', 520, y, { width: 100, align: 'right' });

    doc.moveTo(30, y + 15).lineTo(640, y + 15).stroke('#2c3e50');
    y += 25;

    // List categories
    const categories = Object.keys(expenseData.byCategory).sort((a, b) => {
        return expenseData.byCategory[b].total - expenseData.byCategory[a].total;
    });

    categories.forEach((category, index) => {
        const catData = expenseData.byCategory[category];
        const percentage = expenseData.total > 0 
            ? ((catData.total / expenseData.total) * 100).toFixed(1) 
            : 0;

        // Alternate row background
        if (index % 2 === 0) {
            doc.rect(30, y - 3, 610, 20).fill('#f7fafc');
        }

        doc.fillColor('#34495e')
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(category, 35, y, { width: 200 })
            .fillColor('#2d3748')
            .font('Helvetica')
            .text(formatCurrency(catData.total), 250, y, { width: 150, align: 'right' })
            .text(catData.items.length.toString(), 420, y, { width: 80, align: 'right' })
            .fillColor('#718096')
            .text(`${percentage}%`, 520, y, { width: 100, align: 'right' });

        y += 20;

        // Check for page break
        if (y > 520) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
            y = 30;
        }
    });

    // Detailed Expense List
    y += 20;
    
    if (y > 480) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        y = 30;
    }

    doc.fillColor('#2d3748')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('DETAILED EXPENSE LIST', 30, y, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });
    
    y += 25;

    // Table header
    doc.fillColor('#2c3e50')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('DATE', 30, y, { width: 80 })
        .text('CATEGORY', 120, y, { width: 150 })
        .text('AMOUNT', 280, y, { width: 100, align: 'right' })
        .text('REMARK', 400, y, { width: 350 });

    doc.moveTo(30, y + 15).lineTo(770, y + 15).stroke('#2c3e50');
    y += 22;

    // List all expenses
    expenseData.expenses.forEach((expense, index) => {
        if (y > 540) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
            y = 30;
            // Repeat header
            doc.fillColor('#2c3e50')
                .fontSize(9)
                .font('Helvetica-Bold')
                .text('DATE', 30, y, { width: 80 })
                .text('CATEGORY', 120, y, { width: 150 })
                .text('AMOUNT', 280, y, { width: 100, align: 'right' })
                .text('REMARK', 400, y, { width: 350 });
            doc.moveTo(30, y + 15).lineTo(770, y + 15).stroke('#2c3e50');
            y += 22;
        }

        const dateStr = new Date(expense.date).toLocaleDateString('en-IN');
        const remark = expense.remark || '-';

        doc.fillColor('#34495e')
            .fontSize(8)
            .font('Helvetica')
            .text(dateStr, 30, y, { width: 80 })
            .text(expense.category, 120, y, { width: 150 })
            .fillColor('#2d3748')
            .font('Helvetica-Bold')
            .text(formatCurrency(expense.value), 280, y, { width: 100, align: 'right' })
            .fillColor('#718096')
            .font('UserFont')  // Use UserFont for remarks (may contain Hindi)
            .text(remark, 400, y, { width: 350, ellipsis: true });

        y += 18;
    });
    
    doc.restore(); // Restore graphics state
}

/**
 * Generate Payments Received Section
 * @param {PDFDocument} doc - The PDF document instance
 * @param {object} reportData - The report data containing payment data
 */
function generatePaymentsReceivedSection(doc, reportData) {
    const paymentData = reportData.paymentData;
    
    // Only add section if there are payments
    if (paymentData.count === 0) {
        return;
    }

    doc.save(); // Save graphics state
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
    let y = 30;

    // Section Title
    doc.fillColor('#1a365d')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('PAYMENTS RECEIVED', 30, y, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });
    
    y += 30;

    // Summary Box
    doc.rect(30, y, 810, 55).fill('#f0fdf4');
    doc.rect(30, y, 810, 55).stroke('#27ae60');
    
    doc.fillColor('#27ae60')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`Total Payments Received: ${formatCurrency(paymentData.total)}`, 40, y + 12, { 
            width: 770 
        });
    doc.fillColor('#718096')
        .fontSize(10)
        .font('Helvetica')
        .text(`${paymentData.count} transactions | Period: ${reportData.month}`, 40, y + 33, { 
            width: 770 
        });

    y += 75;

    // Payment List Table Header
    doc.fillColor('#2c3e50')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('DATE', 30, y, { width: 100 })
        .text('AMOUNT', 150, y, { width: 120, align: 'right' })
        .text('REMARK', 290, y, { width: 400 })
        .text('RECEIVED BY', 700, y, { width: 100 });

    doc.moveTo(30, y + 15).lineTo(820, y + 15).stroke('#2c3e50');
    y += 22;

    // List all payments
    paymentData.payments.forEach((payment, index) => {
        if (y > 540) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
            y = 30;
            // Repeat header
            doc.fillColor('#2c3e50')
                .fontSize(9)
                .font('Helvetica-Bold')
                .text('DATE', 30, y, { width: 100 })
                .text('AMOUNT', 150, y, { width: 120, align: 'right' })
                .text('REMARK', 290, y, { width: 400 })
                .text('RECEIVED BY', 700, y, { width: 100 });
            doc.moveTo(30, y + 15).lineTo(820, y + 15).stroke('#2c3e50');
            y += 22;
        }

        // Alternate row background
        if (index % 2 === 0) {
            doc.rect(30, y - 3, 790, 20).fill('#f7fafc');
        }

        const dateStr = new Date(payment.date).toLocaleDateString('en-IN');
        const remark = payment.remark || '-';
        const receivedBy = payment.receivedBy || '-';

        doc.fillColor('#34495e')
            .fontSize(8)
            .font('Helvetica')
            .text(dateStr, 30, y, { width: 100 })
            .fillColor('#27ae60')
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(formatCurrency(payment.value), 150, y, { width: 120, align: 'right' })
            .fillColor('#718096')
            .fontSize(8)
            .font('UserFont')  // Use UserFont for remarks and receivedBy (may contain Hindi)
            .text(remark, 290, y, { width: 400, ellipsis: true })
            .text(receivedBy, 700, y, { width: 100, ellipsis: true });

        y += 20;
    });
    
    doc.restore(); // Restore graphics state
}

/**
 * Generates individual employee detail pages with intelligent page breaks.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} reportData - The data containing the list of employees.
 */
function generateIndividualEmployeeDetails(doc, reportData) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
    generateHeader(doc, reportData); // Re-add header for the new section

    let y = 105; // Starting Y position
    const pageBottom = doc.page.height - doc.page.margins.bottom;

    doc.fillColor('#2d3748')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('INDIVIDUAL EMPLOYEE DETAILS', 30, y, { 
            width: PDF_CONSTANTS.PAGE.CONTENT_WIDTH 
        });

    y += 40; // Space after the section title

    for (const employee of reportData.employees) {
        // Add bookmark for this employee under the details section
        if (reportData._bookmarks && reportData._bookmarks.details) {
            reportData._bookmarks.details.addItem(`${employee.name} (${employee.id})`);
        }
        
        // --- Smart Page Break Logic ---
        // Calculate the height of the upcoming employee section
        const sectionHeight = calculateEmployeeDetailSectionHeight(employee, reportData.rawMonth, reportData.rawYear);

        // If the section doesn't fit on the current page, create a new one
        if (y + sectionHeight > pageBottom) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
            generateHeader(doc, reportData);
            y = 105; // Reset Y position for the new page
        }

        // Draw the section and update the Y position
        y = generateEmployeeDetailSection(doc, employee, y, reportData);
        y += 25; // Add consistent spacing between employee blocks
    }
}

/**
 * Calculates the required height for an employee detail section without drawing it.
 * This allows for intelligent page break decisions.
 * @param {object} employee - The employee data object.
 * @returns {number} - The calculated height in PDF units.
 */
function calculateEmployeeDetailSectionHeight(employee, monthNumber, yearNumber) {
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
    const columnsHeight = Math.max(col1Height, col2Height, col3Height);
    height += columnsHeight;
    height += 15; // Bottom separator line buffer

    // --- Calendar Height Estimation ---
    // We always plan space for the calendar so page breaks account for it.
    height += estimateCalendarHeight(monthNumber, yearNumber);

    return height;
}

// ============================================================================
// EMPLOYEE DETAIL SECTION - HELPER FUNCTIONS
// ============================================================================
// These functions break down the complex generateEmployeeDetailSection into
// smaller, focused, testable units. Each handles one visual component.

/**
 * Draws the employee header banner with name and ID.
 * @param {PDFDocument} doc - PDF document instance
 * @param {object} employee - Employee data
 * @param {number} sectionStartX - Left edge of section
 * @param {number} sectionWidth - Total width of section
 * @param {number} y - Current Y position
 * @returns {number} - New Y position after header
 */
function drawEmployeeHeader(doc, employee, sectionStartX, sectionWidth, y) {
    // Create gradient background for employee header
    const headerGrad = doc.linearGradient(sectionStartX, y, sectionStartX + sectionWidth, y);
    headerGrad.stop(0, '#0f2a47', 1)
              .stop(0.5, '#1a365d', 1)
              .stop(1, '#0f2a47', 1);
    
    doc.rect(sectionStartX, y, sectionWidth, 35).fill(headerGrad);
    doc.fillColor('#ffffff').font('UserFont').fontSize(14)  // Use UserFont for employee name
        .text(employee.name, sectionStartX + 10, y + 10, { width: 500 });
    doc.fillColor('#e2e8f0').font('Helvetica').fontSize(11)
        .text(`Employee ID: ${employee.id}`, sectionStartX + 260, y + 12, { width: sectionWidth - 320, align: 'right' });
    return y + 50;
}

/**
 * Draws the payment summary box with 5 key financial values.
 * @param {PDFDocument} doc - PDF document instance
 * @param {object} employee - Employee data with pre-formatted currency values
 * @param {number} sectionStartX - Left edge of section
 * @param {number} sectionWidth - Total width of section
 * @param {number} y - Current Y position
 * @returns {number} - New Y position after summary box
 */
function drawPaymentSummaryBox(doc, employee, sectionStartX, sectionWidth, y) {
    // Subtle gradient background for payment summary
    const summaryGrad = doc.linearGradient(sectionStartX, y, sectionStartX, y + 60);
    summaryGrad.stop(0, '#f7fafc', 1)
               .stop(1, '#edf2f7', 1);
    
    doc.rect(sectionStartX, y, sectionWidth, 60).fill(summaryGrad);
    doc.rect(sectionStartX, y, sectionWidth, 60).stroke('#e2e8f0');
    
    const summaryY = y + 15;
    const summaryCol1 = 45, summaryCol2 = 240, summaryCol3 = 430, summaryCol4 = 600;
    const summaryColumnWidth = 180;
    const summaryFinalWidth = 170;

    doc.fillColor('#2d3748').font('Helvetica-Bold').fontSize(10);
    doc.text(`Gross Payment: ${employee.grossPaymentFormatted}`, summaryCol1, summaryY, { width: summaryColumnWidth });
    doc.text(`Total Advances: ${employee.advancesFormatted}`, summaryCol2, summaryY, { width: summaryColumnWidth });
    doc.text(`Bonus/Additional: ${employee.bonusFormatted}`, summaryCol3, summaryY, { width: summaryColumnWidth });

    doc.fillColor(employee.prevBalance >= 0 ? '#2d3748' : '#c53030')
        .text(`Previous Balance: ${employee.prevBalanceFormatted}`, summaryCol1, summaryY + 25, { width: summaryColumnWidth });

    doc.fillColor(employee.finalPayment >= 0 ? '#22543d' : '#c53030').font('Helvetica-Bold').fontSize(12)
        .text(`FINAL PAYMENT: ${employee.finalPaymentFormatted}`, summaryCol4, summaryY + 12, { width: summaryFinalWidth, align: 'right' });
    
    return y + 80;
}

/**
 * Draws the payouts/advances column (left column).
 * @param {PDFDocument} doc - PDF document instance
 * @param {object} employee - Employee data
 * @param {number} col1X - X position for column
 * @param {number} contentY - Starting Y position for content
 * @returns {number} - Final Y position after all payouts
 */
function drawPayoutsColumn(doc, employee, col1X, contentY) {
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
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#c53030')
            .text(`Total: ${employee.advancesFormatted}`, col1X, col1Y, { width: 150, align: 'right' });
    } else {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#718096')
            .text('No advances recorded.', col1X, col1Y, { width: 150 });
    }
    return col1Y;
}

/**
 * Draws the bonus/additional payments column (middle column).
 * @param {PDFDocument} doc - PDF document instance
 * @param {object} employee - Employee data
 * @param {number} col2X - X position for column
 * @param {number} contentY - Starting Y position for content
 * @returns {number} - Final Y position after all bonus payments
 */
function drawBonusColumn(doc, employee, col2X, contentY) {
    let col2Y = contentY;
    if (employee.additional_req_pays && employee.additional_req_pays.length > 0) {
        employee.additional_req_pays.forEach(payment => {
            const date = payment.date ? new Date(payment.date).toLocaleDateString('en-IN') : 'N/A';
            const amount = formatCurrency(payment.value || 0);
            doc.font('Helvetica').fontSize(8).fillColor('#4a5568').text(date, col2X, col2Y, { width: 70 });
            doc.text(amount, col2X + 80, col2Y, { width: 70, align: 'right' });
            col2Y += 12;
        });
        col2Y += 8;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#2f855a')
            .text(`Total: ${employee.bonusFormatted}`, col2X, col2Y, { width: 150, align: 'right' });
    } else {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#718096')
            .text('No bonus payments recorded.', col2X, col2Y, { width: 150 });
    }
    return col2Y;
}

/**
 * Draws the attendance and balance column (right column).
 * @param {PDFDocument} doc - PDF document instance
 * @param {object} employee - Employee data
 * @param {number} col3X - X position for column
 * @param {number} colWidth - Width of column
 * @param {number} contentY - Starting Y position for content
 * @returns {number} - Final Y position after all content
 */
function drawAttendanceBalanceColumn(doc, employee, col3X, colWidth, contentY) {
    let col3Y = contentY;
    doc.font('Helvetica').fontSize(9).fillColor('#4a5568');
    doc.text(`• Total Present Days: ${employee.present}`, col3X, col3Y, { width: colWidth }); col3Y += 14;
    doc.text(`• Overtime Hours: ${employee.overtime}`, col3X, col3Y, { width: colWidth }); col3Y += 14;
    doc.text(`• Equivalent Work Days: ${(employee.present + (employee.overtime / 8)).toFixed(1)}`, col3X, col3Y, { width: colWidth }); col3Y += 20;

    if (employee.carry_forwarded && employee.carry_forwarded.value !== 0) {
        doc.font('Helvetica-Bold').text('Previous Balance:', col3X, col3Y, { width: colWidth }); col3Y += 14;
        let carryValue = formatCurrency(employee.carry_forwarded.value || 0);
        if (carryValue.length > 24) {
            carryValue = carryValue.slice(0, 21) + '...';
        }
        doc.font('Helvetica').fontSize(8).text(carryValue, col3X, col3Y, { width: colWidth, align: 'right' });
    } else {
        doc.font('Helvetica-Oblique').fontSize(9).text('No previous balance.', col3X, col3Y, { width: colWidth });
    }
    return col3Y;
}

/**
 * Generates a detailed, professionally styled section for a single employee.
 * @param {PDFDocument} doc - The PDF document instance.
 * @param {object} employee - The employee data object.
 * @param {number} startY - The Y position to start drawing at.
 * @returns {number} - The Y position after this section has been drawn.
 */
function generateEmployeeDetailSection(doc, employee, startY, reportData) {
    doc.save(); // Save graphics state
    
    const monthNumber = reportData.rawMonth;
    const yearNumber = reportData.rawYear;
    let y = startY;
    const sectionStartX = 30;
    const sectionWidth = 780;

    // Draw employee header using helper function
    y = drawEmployeeHeader(doc, employee, sectionStartX, sectionWidth, y);

    // Draw payment summary box using helper function
    y = drawPaymentSummaryBox(doc, employee, sectionStartX, sectionWidth, y);

    // --- Three-Column Layout ---
    const col1X = 30, col2X = 300, col3X = 560;
    const colWidth = 220;
    let contentY = y + 25;
    let finalY = y;

    // Draw Column Titles with gradient underlines
    doc.fillColor('#2d3748').font('Helvetica-Bold').fontSize(11);
    doc.text('ADVANCES & PAYOUTS', col1X, y, { width: colWidth });
    doc.text('BONUS & ADDITIONAL', col2X, y, { width: colWidth });
    doc.text('ATTENDANCE & BALANCE', col3X, y, { width: colWidth });
    
    // Add gradient separator line (fade in/out effect)
    const colGrad = doc.linearGradient(sectionStartX, y + 20, sectionStartX + sectionWidth, y + 20);
    colGrad.stop(0, '#bdc3c7', 0.2)
           .stop(0.5, '#bdc3c7', 1)
           .stop(1, '#bdc3c7', 0.2);
    doc.rect(sectionStartX, y + 20, sectionWidth, 0.5).fill(colGrad);

    // Draw all three columns using helper functions
    const col1Y = drawPayoutsColumn(doc, employee, col1X, contentY);
    const col2Y = drawBonusColumn(doc, employee, col2X, contentY);
    const col3Y = drawAttendanceBalanceColumn(doc, employee, col3X, colWidth, contentY);

    // --- Finalize Section ---
    finalY = Math.max(col1Y, col2Y, col3Y, y + 60);
    doc.strokeColor("#cbd5e0").lineWidth(1).moveTo(sectionStartX, finalY + 10).lineTo(sectionStartX + sectionWidth, finalY + 10).stroke();

    // --- Attendance Calendar (Placed after separator) ---
    let calendarStartY = finalY + 25;
    const calendarNeededHeight = estimateCalendarHeight(monthNumber, yearNumber);
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    if (calendarStartY + calendarNeededHeight > pageBottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        generateHeader(doc, reportData);
        calendarStartY = 105;
    }
    const calendarWidth = sectionWidth - 20;
    drawAttendanceCalendar(doc, employee.attendance || [], monthNumber, yearNumber, sectionStartX, calendarStartY, calendarWidth);
    const calendarBottom = calendarStartY + calendarNeededHeight - 10;

    doc.restore(); // Restore graphics state
    return calendarBottom;
}

// ---------------- Calendar Helpers ----------------
/**
 * Estimate calendar (grid + legend + totals) height for page-break planning.
 */
function estimateCalendarHeight(monthNumber, yearNumber) {
    if (!monthNumber || !yearNumber) return 0;
    const cellSize = 24; // square cell
    const titleHeight = 20; // "Monthly Attendance" label
    const legendHeight = 35; // legend + totals line
    const padding = 20; // spacing buffer
    const weeks = computeWeeksInMonth(monthNumber, yearNumber);
    const gridHeight = weeks * cellSize + 10; // include header row for weekdays
    return titleHeight + gridHeight + legendHeight + padding;
}

/**
 * Compute number of grid rows (weeks) for month (Monday-first)
 */
function computeWeeksInMonth(monthNumber, yearNumber) {
    const firstDay = new Date(yearNumber, monthNumber - 1, 1);
    let startIdx = firstDay.getDay(); // 0=Sun ... 6=Sat
    // Shift to Monday-first (Mon=0 ... Sun=6)
    startIdx = (startIdx + 6) % 7;
    const daysInMonth = new Date(yearNumber, monthNumber, 0).getDate();
    return Math.ceil((startIdx + daysInMonth) / 7);
}

/**
 * Draw attendance calendar for an employee.
 * attendanceEntries: sequential array where index i represents day i+1 (e.g., 'P2', 'A', 'W', 'P').
 */
function drawAttendanceCalendar(doc, attendanceEntries, monthNumber, yearNumber, x, y, width) {
    const title = `Monthly Attendance (${monthNumber}/${yearNumber})`;
    doc.fillColor('#2d3748').font('Helvetica-Bold').fontSize(12).text(title, x, y, { width });
    y += 20;

    const cellHeight = 24; // keep height constant per requirement
    const columns = 7;
    const cellWidth = Math.floor(width / columns);
    const daysInMonth = new Date(yearNumber, monthNumber, 0).getDate();
    const firstDay = new Date(yearNumber, monthNumber - 1, 1);
    let startIdx = firstDay.getDay();
    startIdx = (startIdx + 6) % 7; // Monday-first shift
    const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Weekday header row
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#4a5568');
    for (let c = 0; c < columns; c++) {
        doc.text(weekDayLabels[c], x + c * cellWidth, y, { width: cellWidth, align: 'center' });
    }
    y += 12;

    // Grid drawing
    // Draw full grid lines once (less vector objects than per-cell borders)
    const weeks = computeWeeksInMonth(monthNumber, yearNumber);
    doc.save().strokeColor('#e2e8f0').lineWidth(0.25);
    for (let r = 0; r <= weeks; r++) {
        const lineY = y + r * cellHeight;
        doc.moveTo(x, lineY).lineTo(x + columns * cellWidth, lineY);
    }
    for (let c = 0; c <= columns; c++) {
        const lineX = x + c * cellWidth;
        doc.moveTo(lineX, y).lineTo(lineX, y + weeks * cellHeight);
    }
    doc.stroke().restore();
    let dayCounter = 1;
    let presentCount = 0, absentCount = 0, weekoffCount = 0, overtimeHours = 0;
    while (dayCounter <= daysInMonth) {
        for (let col = 0; col < columns; col++) {
            const colX = x + col * cellWidth;
            if ((dayCounter === 1 && col < startIdx) || dayCounter > daysInMonth) {
                continue;
            }
            const cellY = y;
            const entry = attendanceEntries[dayCounter - 1] || '';
            const statusChar = entry.charAt(0) || '';
            const overtimeMatch = entry.match(/\d+/);
            const overtime = overtimeMatch ? parseInt(overtimeMatch[0]) : 0;
            overtimeHours += overtime;

            // Counts
            if (statusChar === 'P') presentCount++; else if (statusChar === 'A') absentCount++; else if (statusChar === 'W') weekoffCount++;

            // Day number (small, top-left)
            doc.fillColor('#2d3748').font('Helvetica').fontSize(7)
                .text(dayCounter.toString(), colX + 2, cellY + 2, { width: cellWidth - 4, align: 'left' });

            // Status letter centered (green P, red A, blue W) larger for clarity
            let statusColor = '#718096';
            if (statusChar === 'P') statusColor = '#2f855a';
            else if (statusChar === 'A') statusColor = '#e53e3e';
            else if (statusChar === 'W') statusColor = '#3182ce';
            const statusLetter = ['P', 'A', 'W'].includes(statusChar) ? statusChar : '';
            if (statusLetter) {
                doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(11)
                    .text(statusLetter, colX, cellY + 8, { width: cellWidth, align: 'center' });
            }

            // Overtime badge (orange rounded pill bottom-right) if OT > 0
            if (overtime > 0) {
                const badgeW = 16;
                const badgeH = 10;
                const badgeX = colX + cellWidth - badgeW - 2;
                const badgeY = cellY + cellHeight - badgeH - 2;
                doc.save().fillColor('#dd6b20').roundedRect(badgeX, badgeY, badgeW, badgeH, 2).fill();
                doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7)
                    .text(overtime.toString(), badgeX, badgeY + 1.2, { width: badgeW, align: 'center' });
                doc.restore();
            }

            dayCounter++;
        }
        y += cellHeight; // next week row
    }
    y += 8;

    // Legend & Totals (colored circles + labels)
    const legendItems = [
        { label: 'Present (P)', color: '#2f855a', value: presentCount },
        { label: 'Absent (A)', color: '#e53e3e', value: absentCount },
        { label: 'Weekly Off (W)', color: '#3182ce', value: weekoffCount },
        { label: 'OT Hours', color: '#dd6b20', value: overtimeHours }
    ];
    let legendX = x;
    doc.font('Helvetica').fontSize(8);
    legendItems.forEach(item => {
        doc.circle(legendX + 5, y + 6, 5).fill(item.color);
        doc.fillColor('#2d3748').text(`${item.label}: ${item.value}`, legendX + 15, y, { width: 125 });
        legendX += 140;
    });
}



/**
 * Generates a payment report PDF and returns the buffer
 * @param {Object} user - User object from request
 * @param {string} siteID - Site identifier
 * @param {string} month - Month number (1-12)
 * @param {string} year - Year number (2020-2030)
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePaymentReportPdf(user, siteID, month, year) {
    let filepath;
    let writeStream;
    
    try {
        console.log(`🔍 Generating PDF report for site ${siteID}, ${month}/${year}...`);

        // Fetch ALL data from database in parallel
        const calculationType = user?.calculationType || 'default';
        const [employees, siteInfo, expenseData, paymentData] = await Promise.all([
            fetchEmployeeData(siteID, month, year, calculationType),
            fetchSiteInfo(siteID),
            fetchSiteExpenses(siteID, month, year),
            fetchSitePayments(siteID, month, year)
        ]);

        if (!employees || employees.length === 0) {
            throw new Error(`No employees found for ${month}/${year} at site ${siteInfo.sitename}`);
        }

        console.log(`📊 Found ${employees.length} employees`);
        console.log(`💰 Found ${expenseData.count} expense transactions`);
        console.log(`💵 Found ${paymentData.count} payment transactions`);

        // Calculate financial summary
        const financialSummary = calculateFinancialSummary(employees, expenseData, paymentData);

        // Create report data object
        const reportData = {
            month: getMonthName(month) + ' ' + year,
            rawMonth: parseInt(month),
            rawYear: parseInt(year),
            siteName: siteInfo.sitename,
            siteID: siteID,
            financialSummary: financialSummary,
            expenseData: expenseData,
            paymentData: paymentData,
            employees: employees.map(emp => ({
                // Raw numeric values
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
                
                // Pre-formatted currency values (PERFORMANCE OPTIMIZATION)
                // Format once, use many times throughout PDF
                dailyRateFormatted: formatCurrency(emp.rate || 0),
                grossPaymentFormatted: formatCurrency(emp.totalWage || 0),
                advancesFormatted: formatCurrency(emp.totalPayouts || 0),
                bonusFormatted: formatCurrency(emp.totalAdditionalReqPays || 0),
                prevBalanceFormatted: formatCurrency(emp.carryForward || 0),
                finalPaymentFormatted: formatCurrency(emp.closing_balance || 0),
                
                // Complex data structures
                payouts: emp.payouts || [],
                additional_req_pays: emp.additional_req_pays || [],
                attendance: emp.attendance || [],
                carry_forwarded: emp.carry_forwarded || {}
            }))
        };

        // Generate unique filename with sitename and full timestamp down to seconds
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
        const sanitizedSiteName = siteInfo.sitename.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${sanitizedSiteName}_${month}_${year}_${timestamp}.pdf`;
        filepath = path.join(__dirname, '../temp', filename);

        // Ensure temp directory exists
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create PDF document with enhanced metadata and font registration
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: PDF_CONSTANTS.MARGIN.LEFT,
            compress: true,              // Enable compression for smaller file size
            bufferPages: true,           // Enable page buffering for page numbers
            pdfVersion: '1.7',          // Modern PDF version
            info: {
                Title: `Payment Report - ${siteInfo.sitename}`,
                Author: 'Site Haazri',
                Subject: `Employee Payment Report for ${getMonthName(month)} ${year}`,
                Keywords: 'payroll, attendance, salary, report',
                Creator: 'Site Haazri Finance Dashboard',
                CreationDate: now
            }
        });

        // Register fonts for performance (faster lookups)
        doc.registerFont('Regular', 'Helvetica');
        doc.registerFont('Bold', 'Helvetica-Bold');
        doc.registerFont('Oblique', 'Helvetica-Oblique');
        doc.registerFont('BoldOblique', 'Helvetica-BoldOblique');

        // Register Devanagari font for Hindi support
        try {
            const devanagariPath = path.join(__dirname, '..', 'fonts', 'NotoSansDevanagari-Regular.ttf');
            if (fs.existsSync(devanagariPath)) {
                const devanagariBuffer = fs.readFileSync(devanagariPath);
                doc.registerFont('UserFont', devanagariBuffer);
                console.log('✅ Devanagari font loaded successfully');
            } else {
                console.warn('⚠️ Devanagari font not found. Hindi text may not render correctly.');
                console.warn('   Please download NotoSansDevanagari-Regular.ttf to Backend/fonts/');
                // Fallback to Helvetica
                doc.registerFont('UserFont', 'Helvetica');
            }
        } catch (error) {
            console.error('❌ Error loading Devanagari font:', error.message);
            // Fallback to Helvetica
            doc.registerFont('UserFont', 'Helvetica');
        }

        // Create PDF bookmarks/outline for easy navigation
        const { outline } = doc;
        const summaryBookmark = outline.addItem('📊 Financial Summary', { expanded: true });
        const employeeBookmark = outline.addItem('👥 Employee Summary');
        
        // Add expense section bookmark if expenses exist
        let expenseBookmark = null;
        if (reportData.expenseData.count > 0) {
            expenseBookmark = outline.addItem('💰 Site Expenses');
        }
        
        // Add payment section bookmark if payments exist
        let paymentBookmark = null;
        if (reportData.paymentData.count > 0) {
            paymentBookmark = outline.addItem('💵 Payments Received');
        }
        
        // Add individual details section with employee sub-bookmarks
        const detailsBookmark = outline.addItem('📋 Individual Employee Details', { expanded: false });
        
        // Add sub-bookmark for each employee (will be added during generation)
        // Store bookmark reference for later use
        reportData._bookmarks = {
            summary: summaryBookmark,
            employee: employeeBookmark,
            expense: expenseBookmark,
            payment: paymentBookmark,
            details: detailsBookmark
        };

        // Pipe to file
        writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);
        
        // Add error handler for write stream
        writeStream.on('error', (error) => {
            console.error('❌ Write stream error:', error);
            throw error;
        });

        // Generate PDF content - NEW STRUCTURE
        // Page 1: Header + Financial Summary
        generateHeader(doc, reportData);
        generateFinancialSummaryPage(doc, reportData);      // Continues on page 1 below header
        
        // Page 2: Employee Table (add new page before employee table)
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        generateEmployeeTable(doc, reportData);
        
        // Subsequent pages: Expenses and Payments
        generateSiteExpensesSection(doc, reportData);       // NEW - Expense breakdown
        generatePaymentsReceivedSection(doc, reportData);   // NEW - Payment list
        
        // Final pages: Individual employee details
        generateIndividualEmployeeDetails(doc, reportData);

        // Add page numbers to all pages BEFORE finalizing
        // Must use absolute positioning to not affect document flow
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            
            // Save current state and position
            const currentX = doc.x;
            const currentY = doc.y;
            
            doc.save();
            
            // Position absolutely at bottom center (does not affect flow)
            doc.fillColor(PDF_CONSTANTS.COLORS.TEXT_SECONDARY)
               .fontSize(PDF_CONSTANTS.FONTS.CAPTION)
               .font('Regular');
            
            // Calculate centered position
            const pageNumberText = `Page ${i + 1} of ${range.count}`;
            const textWidth = doc.widthOfString(pageNumberText);
            const centerX = (doc.page.width - textWidth) / 2;
            
            // Draw text at absolute position (does not move cursor)
            doc.text(
                pageNumberText,
                centerX,
                doc.page.height - 15,
                { 
                    lineBreak: false,  // Important: prevents adding to flow
                    width: textWidth,
                    height: PDF_CONSTANTS.FONTS.CAPTION
                }
            );
            
            doc.restore();
            
            // Restore original position (though not needed since we're done)
            doc.x = currentX;
            doc.y = currentY;
        }

        // Finalize PDF
        doc.end();

        // Wait for PDF to be written
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        console.log(`✅ PDF report generated successfully: ${filename}`);

        // Read PDF buffer
        const pdfBuffer = fs.readFileSync(filepath);

        return {
            buffer: pdfBuffer,
            filename: filename,
            siteName: siteInfo.sitename,
            employeeCount: employees.length
        };

    } catch (error) {
        console.error("❌ Error generating PDF report:", error);
        throw error;
    } finally {
        // Always clean up temp file
        if (filepath && fs.existsSync(filepath)) {
            try {
                fs.unlinkSync(filepath);
                console.log(`🧹 Cleaned up temp file: ${filepath}`);
            } catch (cleanupError) {
                console.error('⚠️ Failed to cleanup temp file:', cleanupError);
            }
        }
    }
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

        // Generate PDF using the reusable function
        const pdfResult = await generatePaymentReportPdf(req.user, siteID, month, year);

        // Send PDF as response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);

        return res.send(pdfResult.buffer);

    } catch (error) {
        console.error("❌ Error generating PDF report:", error);

        // Handle specific error cases
        if (error.message.includes('No employees found')) {
            return res.status(404).json({
                success: false,
                error: error.message,
            });
        }

        return res.status(500).json({
            success: false,
            error: "Error generating PDF report.",
            message: error.message,
        });
    }
});

module.exports = {
    router,
    generatePaymentReportPdf
};

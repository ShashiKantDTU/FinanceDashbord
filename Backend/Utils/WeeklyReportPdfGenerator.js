/**
 * Weekly Report PDF Generator
 * Creates comprehensive weekly reports with employee and site financial data
 */

const PDFDocument = require('pdfkit');
const siteSchema = require('../models/Siteschema');

/**
 * Format currency value
 * @param {number} value - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
    return `Rs. ${value.toFixed(2)}`;
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Draw horizontal line
 * @param {PDFDocument} doc - PDF document
 * @param {number} y - Y position
 * @param {string} color - Line color
 */
function drawHr(doc, y, color = '#bdc3c7', width = 0.5) {
    doc.strokeColor(color)
        .lineWidth(width)
        .moveTo(30, y)
        .lineTo(565, y)
        .stroke();
}

/**
 * Generate report header
 * @param {PDFDocument} doc - PDF document
 * @param {Object} reportData - Report data
 */
function generateWeeklyReportHeader(doc, reportData) {
    const { siteName, dateRange } = reportData;

    // Site name
    doc.fillColor('#1a365d')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(siteName.toUpperCase(), 30, 30);

    // Report title
    doc.fillColor('#2d3748')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('WEEKLY SITE REPORT', 30, 55);

    // Date range and metadata
    doc.fillColor('#4a5568')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('REPORT PERIOD', 400, 30, { align: 'right' })
        .fillColor('#718096')
        .fontSize(9)
        .font('Helvetica')
        .text(dateRange.formattedRange, 400, 45, { align: 'right' })
        .text(`Generated: ${formatDate(new Date())}`, 400, 58, { align: 'right' })
        .text(`Time: ${new Date().toLocaleTimeString('en-IN')}`, 400, 71, { align: 'right' });

    // Separator
    doc.fillColor('#2b6cb0')
        .rect(30, 90, 535, 2)
        .fill();
}

/**
 * Generate summary metrics section
 * @param {PDFDocument} doc - PDF document
 * @param {number} startY - Starting Y position
 * @param {Object} weeklyMetrics - Weekly metrics data
 * @returns {number} New Y position
 */
function generateWeeklySummary(doc, startY, weeklyMetrics) {
    let y = startY;

    // Section title
    doc.fillColor('#2d3748')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('WEEKLY FINANCIAL SUMMARY', 30, y);

    y += 25;

    // Summary boxes with clear definitions
    const boxWidth = 125;
    const boxHeight = 65;
    const spacing = 10;
    const boxes = [
        {
            label: 'Labour Cost',
            value: formatCurrency(weeklyMetrics.summary.labourCost),
            color: '#3182ce',
            icon: 'LC',
            tooltip: 'Total Weekly Wages'
        },
        {
            label: 'Site Expenses',
            value: formatCurrency(weeklyMetrics.site.totalExpenses),
            color: '#d69e2e',
            icon: 'SE',
            tooltip: 'Operational costs'
        },
        {
            label: 'Advances Paid',
            value: formatCurrency(weeklyMetrics.employees.totalAdvances),
            color: '#e53e3e',
            icon: 'AP',
            tooltip: 'Cash advances'
        },
        {
            label: 'Total Cash Outflow',
            value: formatCurrency(weeklyMetrics.summary.totalCashOutflow),
            color: '#805ad5',
            icon: 'CO',
            tooltip: 'Advances + Expenses'
        }
    ];

    // Draw boxes - 3 boxes in first row, 1 in second row
    let boxX = 30;
    let boxY = y;
    
    boxes.forEach((box, index) => {
        // Background with reduced opacity
        const bgColor = box.color;
        doc.save();
        doc.fillColor(bgColor);
        doc.opacity(0.1);
        doc.rect(boxX, boxY, boxWidth, boxHeight);
        doc.fill();
        doc.restore();

        // Border
        doc.save();
        doc.strokeColor(box.color);
        doc.lineWidth(1.5);
        doc.rect(boxX, boxY, boxWidth, boxHeight);
        doc.stroke();
        doc.restore();

        // Icon
        doc.save();
        doc.fillColor(box.color);
        doc.fontSize(14);
        doc.font('Helvetica-Bold');
        doc.text(box.icon, boxX + 10, boxY + 10, { 
            width: boxWidth - 20, 
            height: 15,
            align: 'left',
            continued: false
        });
        doc.restore();
        
        // Label
        doc.save();
        doc.fillColor('#4a5568');
        doc.fontSize(8);
        doc.font('Helvetica');
        doc.text(box.label, boxX + 10, boxY + 30, { 
            width: boxWidth - 20,
            height: 12,
            align: 'left',
            continued: false
        });
        doc.restore();

        // Value
        doc.save();
        doc.fillColor(box.color);
        doc.fontSize(11);
        doc.font('Helvetica-Bold');
        doc.text(box.value, boxX + 10, boxY + 45, { 
            width: boxWidth - 20,
            height: 15,
            align: 'left',
            continued: false
        });
        doc.restore();

        // Move to next position
        // Layout: 3 boxes in row 1 (index 0, 1, 2), 1 box in row 2 (index 3)
        if (index === 2) {
            // After third box, move to next row
            boxX = 30;
            boxY += boxHeight + spacing;
        } else if (index < 2) {
            // First two boxes, move right
            boxX += boxWidth + spacing;
        }
        // index 3 stays at boxX = 30, boxY already moved down
    });

    y = boxY + boxHeight;

    // Calculation explanation
    y += 15;
    doc.fillColor('#718096')
        .fontSize(7)
        .font('Helvetica-Oblique')
        .text('* Total Cash Outflow = Advances Paid + Site Expenses (actual money spent)', 30, y, { width: 535 });
    
    y += 12;
    doc.fillColor('#718096')
        .fontSize(7)
        .font('Helvetica-Oblique')
        .text('* Labour Cost = Total Weekly Wages (obligation, not yet fully paid)', 30, y, { width: 535 });

    // Additional metrics
    y += 15;
    doc.fillColor('#4a5568')
        .fontSize(9)
        .font('Helvetica')
        .text(`Working Days: ${weeklyMetrics.employees.totalWorkingDays.toFixed(2)}`, 30, y)
        .text(`Overtime Hours: ${weeklyMetrics.employees.totalOvertimeHours}`, 200, y)
        .text(`Employees: ${weeklyMetrics.employees.total}`, 350, y)
        .text(`Expense Items: ${weeklyMetrics.site.expenseCount}`, 450, y);

    return y + 30;
}

/**
 * Generate employee details table
 * @param {PDFDocument} doc - PDF document
 * @param {number} startY - Starting Y position
 * @param {Array} employeeData - Employee data array
 * @returns {number} New Y position
 */
function generateEmployeeTable(doc, startY, employeeData) {
    let y = startY;

    // Section title
    doc.fillColor('#2d3748')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('EMPLOYEE WEEKLY DETAILS', 30, y);

    y += 20;

    // Table header
    doc.fillColor('#2c3e50')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('EMP ID', 30, y, { width: 50 })
        .text('Name', 85, y, { width: 100 })
        .text('Days', 190, y, { width: 30, align: 'center' })
        .text('OT Hrs', 225, y, { width: 30, align: 'center' })
        .text('Rate', 260, y, { width: 50, align: 'right' })
        .text('Wage', 315, y, { width: 70, align: 'right' })
        .text('Advances', 390, y, { width: 70, align: 'right' })
        .text('Net Payment', 465, y, { width: 100, align: 'right' });

    drawHr(doc, y + 12, '#2c3e50', 1);
    y += 20;

    // Table rows
    employeeData.forEach((emp, index) => {
        // Check for page break
        if (y > 700) {
            doc.addPage();
            y = 50;
            
            // Redraw header on new page
            doc.fillColor('#2c3e50')
                .font('Helvetica-Bold')
                .fontSize(8)
                .text('EMP ID', 30, y, { width: 50 })
                .text('Name', 85, y, { width: 100 })
                .text('Days', 190, y, { width: 30, align: 'center' })
                .text('OT Hrs', 225, y, { width: 30, align: 'center' })
                .text('Rate', 260, y, { width: 50, align: 'right' })
                .text('Wage', 315, y, { width: 70, align: 'right' })
                .text('Advances', 390, y, { width: 70, align: 'right' })
                .text('Net Payment', 465, y, { width: 100, align: 'right' });
            
            drawHr(doc, y + 12, '#2c3e50', 1);
            y += 20;
        }

        // Alternate row background
        if (index % 2 === 0) {
            doc.fillColor('#f8f9fa')
                .rect(25, y - 3, 545, 18)
                .fill();
        }

        // Row data
        doc.fillColor('#34495e')
            .font('Helvetica')
            .fontSize(8)
            .text(emp.empid, 30, y, { width: 50 })
            .text(emp.name, 85, y, { width: 100, ellipsis: true })
            .text(emp.weekly.daysPresent.toString(), 190, y, { width: 30, align: 'center' })
            .text(emp.weekly.overtimeHours.toString(), 225, y, { width: 30, align: 'center' })
            .fillColor('#16a085')
            .text(formatCurrency(emp.rate), 260, y, { width: 50, align: 'right' })
            .fillColor('#2980b9')
            .text(formatCurrency(emp.weekly.wage), 315, y, { width: 70, align: 'right' })
            .fillColor('#e74c3c')
            .text(formatCurrency(emp.weekly.advances), 390, y, { width: 70, align: 'right' })
            .fillColor(emp.weekly.netPayment >= 0 ? '#27ae60' : '#e74c3c')
            .font('Helvetica-Bold')
            .text(formatCurrency(emp.weekly.netPayment), 465, y, { width: 100, align: 'right' });

        y += 18;
    });

    drawHr(doc, y, '#2c3e50', 1);
    return y + 15;
}

/**
 * Generate site expenses breakdown
 * @param {PDFDocument} doc - PDF document
 * @param {number} startY - Starting Y position
 * @param {Object} expenseData - Expense data
 * @returns {number} New Y position
 */
function generateExpenseBreakdown(doc, startY, expenseData) {
    let y = startY;

    // Check for new page
    if (y > 650) {
        doc.addPage();
        y = 50;
    }

    // Section title
    doc.fillColor('#2d3748')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('SITE EXPENSES BREAKDOWN', 30, y);

    y += 20;

    if (expenseData.count === 0) {
        doc.fillColor('#718096')
            .fontSize(10)
            .font('Helvetica')
            .text('No expenses recorded for this week.', 30, y);
        return y + 20;
    }

    // Category summary
    const categories = Object.keys(expenseData.byCategory);
    
    categories.forEach((category) => {
        const categoryData = expenseData.byCategory[category];
        
        // Category header
        doc.fillColor('#2c3e50')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(category, 30, y)
            .fillColor('#e74c3c')
            .text(formatCurrency(categoryData.total), 500, y, { width: 65, align: 'right' });

        y += 15;

        // Items in category (first 5 only)
        const itemsToShow = categoryData.items.slice(0, 5);
        itemsToShow.forEach((item) => {
            doc.fillColor('#718096')
                .fontSize(8)
                .font('Helvetica')
                .text(`• ${formatDate(item.date)}`, 40, y, { width: 80 })
                .text(item.remark || 'No remark', 125, y, { width: 320, ellipsis: true })
                .fillColor('#4a5568')
                .text(formatCurrency(item.value), 450, y, { width: 115, align: 'right' });

            y += 12;
        });

        if (categoryData.items.length > 5) {
            doc.fillColor('#a0aec0')
                .fontSize(7)
                .font('Helvetica-Oblique')
                .text(`... and ${categoryData.items.length - 5} more items`, 40, y);
            y += 12;
        }

        y += 8;

        // Check for page break
        if (y > 700) {
            doc.addPage();
            y = 50;
        }
    });

    // Total
    drawHr(doc, y, '#2c3e50', 1);
    y += 10;
    doc.fillColor('#2c3e50')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('TOTAL EXPENSES', 30, y)
        .fillColor('#e74c3c')
        .text(formatCurrency(expenseData.total), 500, y, { width: 65, align: 'right' });

    return y + 25;
}

/**
 * Generate monthly comparison section
 * @param {PDFDocument} doc - PDF document
 * @param {number} startY - Starting Y position
 * @param {Object} weeklyMetrics - Weekly metrics
 * @param {Object} monthlyMetrics - Monthly metrics
 * @returns {number} New Y position
 */
function generateMonthlyComparison(doc, startY, weeklyMetrics, monthlyMetrics) {
    let y = startY;

    // New page for comparison
    doc.addPage();
    y = 50;

    // Section title
    doc.fillColor('#2d3748')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('MONTH-TO-DATE COMPARISON', 30, y);

    y += 25;

    // Comparison table
    const comparisons = [
        { label: 'Working Days', weekly: weeklyMetrics.employees.totalWorkingDays.toFixed(2), monthly: monthlyMetrics.employees.totalWorkingDays.toFixed(2) },
        { label: 'Overtime Hours', weekly: weeklyMetrics.employees.totalOvertimeHours, monthly: monthlyMetrics.employees.totalOvertimeHours },
        { label: 'Labour Cost', weekly: formatCurrency(weeklyMetrics.summary.labourCost), monthly: formatCurrency(monthlyMetrics.summary.labourCost) },
        { label: 'Advances Paid', weekly: formatCurrency(weeklyMetrics.employees.totalAdvances), monthly: formatCurrency(monthlyMetrics.employees.totalAdvances) },
        { label: 'Site Expenses', weekly: formatCurrency(weeklyMetrics.site.totalExpenses), monthly: formatCurrency(monthlyMetrics.site.totalExpenses) },
        { label: 'Total Cash Outflow', weekly: formatCurrency(weeklyMetrics.summary.totalCashOutflow), monthly: formatCurrency(monthlyMetrics.summary.totalCashOutflow) }
    ];

    // Table header
    doc.fillColor('#2c3e50')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Metric', 30, y, { width: 200 })
        .text('This Week', 240, y, { width: 120, align: 'right' })
        .text('Month Total', 370, y, { width: 120, align: 'right' })
        .text('% of Month', 500, y, { width: 65, align: 'right' });

    drawHr(doc, y + 12, '#2c3e50', 1);
    y += 20;

    // Table rows
    comparisons.forEach((comp, index) => {
        if (index % 2 === 0) {
            doc.fillColor('#f8f9fa')
                .rect(25, y - 3, 545, 18)
                .fill();
        }

        // Calculate percentage
        let percentage = '-';
        if (comp.label === 'Working Days' || comp.label === 'Overtime Hours') {
            const weeklyNum = parseFloat(comp.weekly);
            const monthlyNum = parseFloat(comp.monthly);
            if (monthlyNum > 0) {
                percentage = ((weeklyNum / monthlyNum) * 100).toFixed(1) + '%';
            }
        } else {
            // For currency values, extract numbers
            const weeklyNum = parseFloat(comp.weekly.replace(/[₹,Rs.\s]/g, ''));
            const monthlyNum = parseFloat(comp.monthly.replace(/[₹,Rs.\s]/g, ''));
            if (monthlyNum > 0) {
                percentage = ((weeklyNum / monthlyNum) * 100).toFixed(1) + '%';
            }
        }

        doc.fillColor('#34495e')
            .font('Helvetica')
            .fontSize(9)
            .text(comp.label, 30, y, { width: 200 })
            .fillColor('#2980b9')
            .text(comp.weekly, 240, y, { width: 120, align: 'right' })
            .fillColor('#27ae60')
            .text(comp.monthly, 370, y, { width: 120, align: 'right' })
            .fillColor('#805ad5')
            .font('Helvetica-Bold')
            .text(percentage, 500, y, { width: 65, align: 'right' });

        y += 18;
    });

    drawHr(doc, y, '#2c3e50', 1);
    y += 20;

    // Additional monthly info
    doc.fillColor('#4a5568')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Monthly Balance Summary', 30, y);

    y += 15;

    doc.fillColor('#718096')
        .fontSize(9)
        .font('Helvetica')
        .text(`Total Pending Balance: ${formatCurrency(monthlyMetrics.employees.totalClosingBalance)}`, 30, y);

    return y + 30;
}

/**
 * Generate footer
 * @param {PDFDocument} doc - PDF document
 */
function generateFooter(doc) {
    const range = doc.bufferedPageRange();
    const pageCount = range.count;
    
    for (let i = 0; i < pageCount; i++) {
        const pageIndex = range.start + i;
        doc.switchToPage(pageIndex);
        
        // Page number
        doc.save();
        doc.fillColor('#a0aec0');
        doc.fontSize(8);
        doc.font('Helvetica');
        doc.text(
            `Page ${i + 1} of ${pageCount}`,
            30,
            doc.page.height - 30,
            { 
                width: doc.page.width - 60,
                align: 'center',
                continued: false
            }
        );
        doc.restore();
        
        // Branding
        doc.save();
        doc.fillColor('#a0aec0');
        doc.fontSize(8);
        doc.font('Helvetica');
        doc.text(
            'Generated by Site Haazri - support@sitehaazri.com',
            30,
            doc.page.height - 20,
            { 
                width: doc.page.width - 60,
                align: 'center',
                continued: false
            }
        );
        doc.restore();
    }
}

/**
 * Main function to generate weekly report PDF
 * @param {Object} reportData - Complete report data
 * @param {string} siteName - Site name
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateWeeklyReportPdf(reportData, siteName) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: 30,
                size: 'A4'
            });

            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Add site name to report data
            reportData.siteName = siteName;

            // Generate report sections
            generateWeeklyReportHeader(doc, reportData);
            
            let y = 110;
            y = generateWeeklySummary(doc, y, reportData.weeklyMetrics);
            y = generateEmployeeTable(doc, y, reportData.employeeData);
            y = generateExpenseBreakdown(doc, y, reportData.weeklyExpenses);
            
            generateMonthlyComparison(doc, y, reportData.weeklyMetrics, reportData.monthlyMetrics);
            
            // Footer removed to prevent extra blank pages
            // generateFooter(doc);

            doc.end();

        } catch (error) {
            console.error('❌ Error generating weekly report PDF:', error);
            reject(error);
        }
    });
}

/**
 * Generate weekly report PDF with all data fetching
 * @param {string} siteID - Site identifier
 * @param {string} calculationType - Calculation type
 * @returns {Promise<Object>} PDF buffer and filename
 */
async function generateWeeklyPaymentReportPdf(siteID, calculationType = 'default') {
    try {
        const { fetchCompleteWeeklyReportData } = require('../Utils/WeeklyReportUtils');

        // Fetch site info
        const site = await siteSchema.findById(siteID);
        if (!site) {
            throw new Error('Site not found');
        }

        // Fetch complete report data
        const reportData = await fetchCompleteWeeklyReportData(siteID, calculationType);

        if (!reportData.employeeData || reportData.employeeData.length === 0) {
            throw new Error('No employees found for weekly report');
        }

        // Generate PDF
        const pdfBuffer = await generateWeeklyReportPdf(reportData, site.sitename);

        // Create filename
        const dateRange = reportData.dateRange;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
        const filename = `Weekly_Report_${site.sitename.replace(/\s+/g, '_')}_${dateRange.startDate.getDate()}-${dateRange.endDate.getDate()}_${dateRange.month}_${dateRange.year}_${timestamp}.pdf`;

        return {
            buffer: pdfBuffer,
            filename: filename,
            reportData: reportData
        };

    } catch (error) {
        console.error('❌ Error generating weekly payment report PDF:', error);
        throw error;
    }
}

module.exports = {
    generateWeeklyReportPdf,
    generateWeeklyPaymentReportPdf
};

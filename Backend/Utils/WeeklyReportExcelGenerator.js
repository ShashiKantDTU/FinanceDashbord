/**
 * Weekly Report Excel Generator
 * Creates detailed Excel reports with weekly and monthly data
 */

const ExcelJS = require('exceljs');
const siteSchema = require('../models/Siteschema');

/**
 * Format currency for Excel
 * @param {number} value - Amount to format
 * @returns {string} Formatted currency
 */
function formatCurrency(value) {
    return `₹${value.toFixed(2)}`;
}

/**
 * Apply header style to row
 * @param {Row} row - Excel row
 */
function applyHeaderStyle(row) {
    row.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C3E50' }
        };
        cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' },
            size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
}

/**
 * Apply data row style
 * @param {Row} row - Excel row
 * @param {boolean} isEven - Is even row
 */
function applyDataRowStyle(row, isEven) {
    row.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFF8F9FA' : 'FFFFFFFF' }
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
        cell.alignment = { vertical: 'middle' };
    });
}

/**
 * Create summary sheet
 * @param {Workbook} workbook - Excel workbook
 * @param {Object} reportData - Report data
 * @param {string} siteName - Site name
 */
function createSummarySheet(workbook, reportData, siteName) {
    const sheet = workbook.addWorksheet('Weekly Summary', {
        views: [{ showGridLines: false }]
    });

    const { dateRange, weeklyMetrics, monthlyMetrics } = reportData;

    // Title
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = siteName.toUpperCase();
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF1A365D' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Subtitle
    sheet.mergeCells('A2:F2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = 'WEEKLY SITE REPORT';
    subtitleCell.font = { bold: true, size: 14, color: { argb: 'FF2D3748' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Date range
    sheet.mergeCells('A3:F3');
    const dateCell = sheet.getCell('A3');
    dateCell.value = `Period: ${dateRange.formattedRange}`;
    dateCell.font = { size: 11, color: { argb: 'FF718096' } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' };

    let row = 5;

    // Weekly Metrics Section
    sheet.mergeCells(`A${row}:F${row}`);
    const weeklyTitle = sheet.getCell(`A${row}`);
    weeklyTitle.value = 'WEEKLY METRICS';
    weeklyTitle.font = { bold: true, size: 12, color: { argb: 'FF2C3E50' } };
    weeklyTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
    row += 2;

    // Weekly metrics table
    const weeklyMetricsData = [
        ['Metric', 'Value'],
        ['Total Employees', weeklyMetrics.employees.total],
        ['Working Days', weeklyMetrics.employees.totalWorkingDays.toFixed(2)],
        ['Overtime Hours', weeklyMetrics.employees.totalOvertimeHours],
        ['Labour Cost', formatCurrency(weeklyMetrics.summary.labourCost)],
        ['Advances Paid', formatCurrency(weeklyMetrics.employees.totalAdvances)],
        ['Site Expenses', formatCurrency(weeklyMetrics.site.totalExpenses)],
        ['Total Cash Outflow', formatCurrency(weeklyMetrics.summary.totalCashOutflow)]
    ];

    weeklyMetricsData.forEach((data, index) => {
        const currentRow = sheet.getRow(row + index);
        currentRow.values = ['', ...data]; // Offset by 1 for column A
        if (index === 0) {
            applyHeaderStyle(currentRow);
        } else {
            applyDataRowStyle(currentRow, index % 2 === 0);
        }
    });

    row += weeklyMetricsData.length + 2;

    // Monthly Metrics Section
    sheet.mergeCells(`A${row}:F${row}`);
    const monthlyTitle = sheet.getCell(`A${row}`);
    monthlyTitle.value = 'MONTH-TO-DATE METRICS';
    monthlyTitle.font = { bold: true, size: 12, color: { argb: 'FF2C3E50' } };
    monthlyTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FFF4' } };
    row += 2;

    // Monthly metrics table
    const monthlyMetricsData = [
        ['Metric', 'Value'],
        ['Total Employees', monthlyMetrics.employees.total],
        ['Working Days', monthlyMetrics.employees.totalWorkingDays.toFixed(2)],
        ['Overtime Hours', monthlyMetrics.employees.totalOvertimeHours],
        ['Labour Cost', formatCurrency(monthlyMetrics.summary.labourCost)],
        ['Advances Paid', formatCurrency(monthlyMetrics.employees.totalAdvances)],
        ['Site Expenses', formatCurrency(monthlyMetrics.site.totalExpenses)],
        ['Total Cash Outflow', formatCurrency(monthlyMetrics.summary.totalCashOutflow)],
        ['Pending Balance', formatCurrency(monthlyMetrics.employees.totalClosingBalance)]
    ];

    monthlyMetricsData.forEach((data, index) => {
        const currentRow = sheet.getRow(row + index);
        currentRow.values = ['', ...data];
        if (index === 0) {
            applyHeaderStyle(currentRow);
        } else {
            applyDataRowStyle(currentRow, index % 2 === 0);
        }
    });

    // Set column widths
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 20;
}

/**
 * Create weekly employee details sheet
 * @param {Workbook} workbook - Excel workbook
 * @param {Array} employeeData - Employee data
 */
function createWeeklyEmployeeSheet(workbook, employeeData) {
    const sheet = workbook.addWorksheet('Weekly Employee Details');

    // Headers
    const headers = [
        'EMP ID',
        'Name',
        'Rate',
        'Days Present',
        'OT Hours',
        'Total Attendance',
        'Weekly Wage',
        'Advances',
        'Net Payment'
    ];

    const headerRow = sheet.addRow(headers);
    applyHeaderStyle(headerRow);

    // Data rows
    employeeData.forEach((emp, index) => {
        const row = sheet.addRow([
            emp.empid,
            emp.name,
            emp.rate,
            emp.weekly.daysPresent,
            emp.weekly.overtimeHours,
            emp.weekly.totalAttendance.toFixed(2),
            emp.weekly.wage,
            emp.weekly.advances,
            emp.weekly.netPayment
        ]);

        applyDataRowStyle(row, index % 2 === 0);

        // Format currency columns (Rate=3, Wage=7, Advances=8, Net=9)
        [3, 7, 8, 9].forEach(col => {
            row.getCell(col).numFmt = '₹#,##0.00';
        });

        // Format number columns
        [4, 5, 6].forEach(col => {
            row.getCell(col).numFmt = '0.00';
        });

        // Color code net payment (now column 9)
        const netCell = row.getCell(9);
        if (emp.weekly.netPayment < 0) {
            netCell.font = { color: { argb: 'FFE74C3C' }, bold: true };
        } else {
            netCell.font = { color: { argb: 'FF27AE60' }, bold: true };
        }
    });

    // Totals row (removed bonus column)
    const totalRow = sheet.addRow([
        '',
        'TOTAL',
        '',
        { formula: `SUM(D2:D${employeeData.length + 1})` },
        { formula: `SUM(E2:E${employeeData.length + 1})` },
        { formula: `SUM(F2:F${employeeData.length + 1})` },
        { formula: `SUM(G2:G${employeeData.length + 1})` },
        { formula: `SUM(H2:H${employeeData.length + 1})` },
        { formula: `SUM(I2:I${employeeData.length + 1})` }
    ]);

    totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
        cell.font = { bold: true };
        cell.border = {
            top: { style: 'double' },
            bottom: { style: 'double' }
        };
    });

    // Format currency columns (Rate=3, Wage=7, Advances=8, Net=9)
    [3, 7, 8, 9].forEach(col => {
        totalRow.getCell(col).numFmt = '₹#,##0.00';
    });

    // Auto-fit columns
    sheet.columns.forEach((column) => {
        column.width = 15;
    });
    sheet.getColumn(2).width = 25; // Name column wider
}

/**
 * Create daily attendance breakdown sheet
 * @param {Workbook} workbook - Excel workbook
 * @param {Array} employeeData - Employee data
 * @param {Object} dateRange - Date range
 */
function createDailyAttendanceSheet(workbook, employeeData, dateRange) {
    const sheet = workbook.addWorksheet('Daily Attendance');

    // Create headers with dates
    const headers = ['EMP ID', 'Name'];
    const { startDay, endDay } = dateRange;
    
    for (let day = startDay; day <= endDay; day++) {
        headers.push(`Day ${day}`);
    }
    headers.push('Total Days', 'OT Hours');

    const headerRow = sheet.addRow(headers);
    applyHeaderStyle(headerRow);

    // Data rows
    employeeData.forEach((emp, index) => {
        const rowData = [emp.empid, emp.name];
        
        // Add daily attendance - show raw values like P, A, P2, A4, P12, etc.
        emp.weekly.dailyBreakdown.forEach(day => {
            rowData.push(day.attendance); // This will be 'P', 'A', 'P2', 'P12', '-', etc.
        });

        // Add totals
        rowData.push(emp.weekly.daysPresent);
        rowData.push(emp.weekly.overtimeHours);

        const row = sheet.addRow(rowData);
        applyDataRowStyle(row, index % 2 === 0);

        // Color code attendance cells based on status
        emp.weekly.dailyBreakdown.forEach((day, dayIndex) => {
            const cell = row.getCell(dayIndex + 3);
            const attendanceValue = day.attendance;
            
            if (attendanceValue === '-') {
                // Unmarked - gray background
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
                cell.font = { color: { argb: 'FF999999' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (attendanceValue && attendanceValue.toUpperCase().startsWith('P')) {
                // Present (P, P2, P12, etc.) - green background
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
                cell.font = { color: { argb: 'FF155724' }, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (attendanceValue && attendanceValue.toUpperCase().startsWith('A')) {
                // Absent (A, A4, etc.) - red background
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
                cell.font = { color: { argb: 'FF721C24' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                // Other cases - default
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
        });
    });

    // Auto-fit columns
    sheet.columns.forEach((column, index) => {
        if (index < 2) {
            column.width = 15;
        } else {
            column.width = 10;
        }
    });
    sheet.getColumn(2).width = 25; // Name column
}

/**
 * Create site expenses sheet
 * @param {Workbook} workbook - Excel workbook
 * @param {Object} expenseData - Expense data
 */
function createExpensesSheet(workbook, expenseData) {
    const sheet = workbook.addWorksheet('Site Expenses');

    // Headers
    const headers = ['Date', 'Category', 'Amount', 'Remark', 'Created By'];
    const headerRow = sheet.addRow(headers);
    applyHeaderStyle(headerRow);

    // Group expenses by category
    const categories = Object.keys(expenseData.byCategory);
    let rowIndex = 0;

    categories.forEach(category => {
        const categoryData = expenseData.byCategory[category];

        // Category header
        const categoryRow = sheet.addRow([
            '',
            category,
            formatCurrency(categoryData.total),
            '',
            ''
        ]);
        
        categoryRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEAA7' } };
            cell.font = { bold: true, size: 11 };
        });

        // Category items
        categoryData.items.forEach((item, index) => {
            const row = sheet.addRow([
                new Date(item.date).toLocaleDateString('en-IN'),
                '',
                item.value,
                item.remark || '',
                item.createdBy || ''
            ]);

            applyDataRowStyle(row, index % 2 === 0);
            row.getCell(3).numFmt = '₹#,##0.00';
        });

        rowIndex += categoryData.items.length + 1;
    });

    // Total row
    const totalRow = sheet.addRow([
        '',
        'TOTAL EXPENSES',
        expenseData.total,
        '',
        ''
    ]);

    totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    });
    totalRow.getCell(3).numFmt = '₹#,##0.00';

    // Auto-fit columns
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 40;
    sheet.getColumn(5).width = 20;
}

/**
 * Create monthly employee details sheet for reference
 * @param {Workbook} workbook - Excel workbook
 * @param {Array} employeeData - Employee data
 */
function createMonthlyReferenceSheet(workbook, employeeData) {
    const sheet = workbook.addWorksheet('Monthly Reference');

    // Headers (removed Total Bonus)
    const headers = [
        'EMP ID',
        'Name',
        'Rate',
        'Monthly Days',
        'Monthly OT Hrs',
        'Monthly Wage',
        'Total Advances',
        'Closing Balance',
        'Carry Forward'
    ];

    const headerRow = sheet.addRow(headers);
    applyHeaderStyle(headerRow);

    // Data rows
    employeeData.forEach((emp, index) => {
        const row = sheet.addRow([
            emp.empid,
            emp.name,
            emp.rate,
            emp.monthly.daysPresent,
            emp.monthly.overtimeHours,
            emp.monthly.wage,
            emp.monthly.totalAdvances,
            emp.monthly.closingBalance,
            emp.monthly.carryForward
        ]);

        applyDataRowStyle(row, index % 2 === 0);

        // Format currency columns (Rate=3, Wage=6, Advances=7, Balance=8, CarryFwd=9)
        [3, 6, 7, 8, 9].forEach(col => {
            row.getCell(col).numFmt = '₹#,##0.00';
        });

        // Color code balance (now column 8)
        const balanceCell = row.getCell(8);
        if (emp.monthly.closingBalance < 0) {
            balanceCell.font = { color: { argb: 'FFE74C3C' }, bold: true };
        } else {
            balanceCell.font = { color: { argb: 'FF27AE60' }, bold: true };
        }
    });

    // Totals row (removed bonus column H)
    const totalRow = sheet.addRow([
        '',
        'TOTAL',
        '',
        { formula: `SUM(D2:D${employeeData.length + 1})` },
        { formula: `SUM(E2:E${employeeData.length + 1})` },
        { formula: `SUM(F2:F${employeeData.length + 1})` },
        { formula: `SUM(G2:G${employeeData.length + 1})` },
        { formula: `SUM(H2:H${employeeData.length + 1})` },
        { formula: `SUM(I2:I${employeeData.length + 1})` }
    ]);

    totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
        cell.font = { bold: true };
    });

    // Format currency columns (Rate=3, Wage=6, Advances=7, Balance=8, CarryFwd=9)
    [3, 6, 7, 8, 9].forEach(col => {
        totalRow.getCell(col).numFmt = '₹#,##0.00';
    });

    // Auto-fit columns
    sheet.columns.forEach((column) => {
        column.width = 15;
    });
    sheet.getColumn(2).width = 25;
}

/**
 * Main function to generate weekly Excel report
 * @param {string} siteID - Site identifier
 * @param {string} calculationType - Calculation type
 * @returns {Promise<Buffer>} Excel buffer
 */
async function generateWeeklyReportExcel(siteID, calculationType = 'default') {
    try {
        const { fetchCompleteWeeklyReportData } = require('./WeeklyReportUtils');

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

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Site Haazri';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Create sheets
        createSummarySheet(workbook, reportData, site.sitename);
        createWeeklyEmployeeSheet(workbook, reportData.employeeData);
        createDailyAttendanceSheet(workbook, reportData.employeeData, reportData.dateRange);
        createExpensesSheet(workbook, reportData.weeklyExpenses);
        createMonthlyReferenceSheet(workbook, reportData.employeeData);

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Create filename
        const dateRange = reportData.dateRange;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
        const filename = `Weekly_Report_${site.sitename.replace(/\s+/g, '_')}_${dateRange.startDate.getDate()}-${dateRange.endDate.getDate()}_${dateRange.month}_${dateRange.year}_${timestamp}.xlsx`;

        return {
            buffer,
            filename,
            reportData
        };

    } catch (error) {
        console.error('❌ Error generating weekly Excel report:', error);
        throw error;
    }
}

module.exports = {
    generateWeeklyReportExcel
};

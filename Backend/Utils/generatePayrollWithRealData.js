const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const employeeSchema = require("../models/EmployeeSchema");
const siteSchema = require("../models/Siteschema");
const SiteExpenseSchema = require("../models/SiteExpenseSchema");
const SitePaymentSchema = require("../models/SitePaymentSchema");

/**
 * Fetch employee data using the same aggregation pipeline as PDF reports
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
                cond: { $regexMatch: { input: "$att", regex: /^P/ } }
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
                      overtimeStr: { $arrayElemAt: [{ $regexFindAll: { input: "$att", regex: /\d+/ } }, 0] }
                    },
                    in: { $ifNull: [{ $toInt: "$overtimeStr.match" }, 0] }
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
  const totalWages = employeeData.reduce((sum, emp) => sum + (emp.totalWage || 0), 0);
  const totalAdvances = employeeData.reduce((sum, emp) => sum + (emp.totalPayouts || 0), 0);
  const totalBonus = employeeData.reduce((sum, emp) => sum + (emp.totalAdditionalReqPays || 0), 0);
  const pendingPayment = totalWages - totalAdvances;

  const totalExpenses = expenseData.total || 0;
  const totalPayments = paymentData.total || 0;

  const totalCosts = totalWages + totalExpenses;
  const netProfit = totalPayments - totalCosts;
  const profitMargin = totalPayments > 0 ? (netProfit / totalPayments) * 100 : 0;

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
 * Generate a complete payroll Excel report with real data from database
 * @param {Object} params - Parameters for report generation
 * @param {string} params.siteID - Site identifier
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @param {string} params.calculationType - Calculation type ('default' or 'special')
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateFullPayrollReportWithRealData(params = {}) {
  console.log('Starting payroll report generation with real data...');

  const {
    siteID,
    month = new Date().getMonth() + 1,
    year = new Date().getFullYear(),
    calculationType = 'default'
  } = params;

  if (!siteID) {
    throw new Error('siteID is required for fetching real data');
  }

  // Fetch ALL data from database (including financial data)
  const [employeeData, siteInfo, expenseData, paymentData] = await Promise.all([
    fetchEmployeeData(siteID, month, year, calculationType),
    fetchSiteInfo(siteID),
    fetchSiteExpenses(siteID, month, year),
    fetchSitePayments(siteID, month, year)
  ]);

  console.log(`📊 Found ${employeeData.length} employees for ${siteInfo.sitename}`);
  console.log(`💰 Found ${expenseData.count} expense transactions`);
  console.log(`💵 Found ${paymentData.count} payment transactions`);

  if (employeeData.length === 0) {
    console.log('⚠️ No employee data found for the specified criteria');
  }

  // Calculate financial summary
  const financialSummary = calculateFinancialSummary(employeeData, expenseData, paymentData);

  const workbook = new ExcelJS.Workbook();

  // =========================================================================
  // SHEET 1: FINANCIAL SUMMARY (NEW)
  // =========================================================================
  createFinancialSummarySheet(workbook, financialSummary, siteInfo, month, year);

  // =========================================================================
  // SHEET 2: MONTHLY ATTENDANCE REPORT (EXISTING)
  // =========================================================================
  const worksheet = workbook.addWorksheet('Monthly Attendance Report');

  // Set worksheet properties for better appearance
  worksheet.properties.defaultRowHeight = 20;
  worksheet.views = [{ showGridLines: false }];

  // =========================================================================
  // PART A: SOPHISTICATED CORPORATE HEADER DESIGN
  // =========================================================================

  const daysInMonth = getDaysInMonth(month, year);
  const totalColumns = 3 + daysInMonth + 8;
  const lastColumn = getColumnLetter(totalColumns);

  // Add top spacing for professional look
  worksheet.addRow([]);
  worksheet.addRow([]);

  // Company/System branding bar (subtle top accent)
  worksheet.mergeCells(`A3:${lastColumn}3`);
  const brandingCell = worksheet.getCell('A3');
  brandingCell.value = '';
  brandingCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2C3E50' } // Professional dark blue-gray
  };
  worksheet.getRow(3).height = 4;

  // Get month name for display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month - 1];

  // Main title section with site name
  worksheet.mergeCells(`A4:${lastColumn}5`);
  const titleCell = worksheet.getCell('A4');
  titleCell.value = `${siteInfo.sitename.toUpperCase()}`;
  titleCell.font = {
    name: 'Calibri',
    size: 28,
    bold: true,
    color: { argb: 'FF2C3E50' }
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8F9FA' }
  };
  titleCell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  titleCell.border = {
    top: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    bottom: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    left: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    right: { style: 'thin', color: { argb: 'FFE9ECEF' } }
  };
  worksheet.getRow(4).height = 40;
  worksheet.getRow(5).height = 40;

  // Report type section
  worksheet.mergeCells(`A6:${lastColumn}6`);
  const reportTypeCell = worksheet.getCell('A6');
  reportTypeCell.value = 'EMPLOYEE PAYMENT REPORT';
  reportTypeCell.font = {
    name: 'Calibri',
    size: 18,
    bold: true,
    color: { argb: 'FF495057' }
  };
  reportTypeCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8F9FA' }
  };
  reportTypeCell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  reportTypeCell.border = {
    top: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    bottom: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    left: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    right: { style: 'thin', color: { argb: 'FFE9ECEF' } }
  };
  worksheet.getRow(6).height = 30;

  // Period information
  worksheet.mergeCells(`A7:${lastColumn}7`);
  const periodCell = worksheet.getCell('A7');
  periodCell.value = `Period: ${monthName} ${year}`;
  periodCell.font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: 'FF6C757D' }
  };
  periodCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8F9FA' }
  };
  periodCell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  periodCell.border = {
    top: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    bottom: { style: 'medium', color: { argb: 'FF2C3E50' } },
    left: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    right: { style: 'thin', color: { argb: 'FFE9ECEF' } }
  };
  worksheet.getRow(7).height = 25;

  // Add spacing after title
  worksheet.addRow([]);
  worksheet.addRow([]);

  // Professional info section with clean card design
  const infoStartRow = 10;

  // Create a professional info panel
  worksheet.mergeCells(`A${infoStartRow}:${lastColumn}${infoStartRow + 2}`);
  const infoPanel = worksheet.getCell(`A${infoStartRow}`);
  infoPanel.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' }
  };
  infoPanel.border = {
    top: { style: 'thin', color: { argb: 'FFDEE2E6' } },
    bottom: { style: 'thin', color: { argb: 'FFDEE2E6' } },
    left: { style: 'thin', color: { argb: 'FFDEE2E6' } },
    right: { style: 'thin', color: { argb: 'FFDEE2E6' } }
  };

  // Site information
  const siteInfoCell = worksheet.getCell(`A${infoStartRow}`);
  siteInfoCell.value = 'SITE LOCATION';
  siteInfoCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF6C757D' } };
  siteInfoCell.alignment = { vertical: 'top', horizontal: 'left', indent: 1 };

  const siteValueCell = worksheet.getCell(`A${infoStartRow + 1}`);
  siteValueCell.value = siteInfo.sitename.toUpperCase();
  siteValueCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF2C3E50' } };
  siteValueCell.alignment = { vertical: 'top', horizontal: 'left', indent: 1 };

  // Period information
  const periodCol = getColumnLetter(Math.floor(totalColumns / 3));
  const periodInfoCell = worksheet.getCell(`${periodCol}${infoStartRow}`);
  periodInfoCell.value = 'REPORTING PERIOD';
  periodInfoCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF6C757D' } };
  periodInfoCell.alignment = { vertical: 'top', horizontal: 'center' };

  const periodValueCell = worksheet.getCell(`${periodCol}${infoStartRow + 1}`);
  periodValueCell.value = `${getMonthName(month).toUpperCase()} ${year}`;
  periodValueCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF2C3E50' } };
  periodValueCell.alignment = { vertical: 'top', horizontal: 'center' };

  // Employee count and generation info
  const rightCol = getColumnLetter(totalColumns - 3);
  const employeeInfoCell = worksheet.getCell(`${rightCol}${infoStartRow}`);
  employeeInfoCell.value = 'TOTAL EMPLOYEES';
  employeeInfoCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF6C757D' } };
  employeeInfoCell.alignment = { vertical: 'top', horizontal: 'right' };

  const employeeValueCell = worksheet.getCell(`${rightCol}${infoStartRow + 1}`);
  employeeValueCell.value = employeeData.length.toString();
  employeeValueCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF2C3E50' } };
  employeeValueCell.alignment = { vertical: 'top', horizontal: 'right' };

  // Generation timestamp (bottom right, subtle)
  const timestampCell = worksheet.getCell(`${rightCol}${infoStartRow + 2}`);
  timestampCell.value = `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  timestampCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF9CA3AF' } };
  timestampCell.alignment = { vertical: 'bottom', horizontal: 'right' };

  // Set row heights for info panel
  worksheet.getRow(infoStartRow).height = 18;
  worksheet.getRow(infoStartRow + 1).height = 22;
  worksheet.getRow(infoStartRow + 2).height = 16;

  // Add spacing before table
  worksheet.addRow([]);
  worksheet.addRow([]);

  // =========================================================================
  // PART B: MODERN TABLE HEADERS WITH PROFESSIONAL STYLING
  // =========================================================================
  
  // Function to identify Sunday columns
  function getSundayColumns(month, year, daysInMonth) {
    const sundayColumns = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      if (date.getDay() === 0) { // Sunday is 0
        sundayColumns.push(3 + day); // Column number (3 base columns + day number)
      }
    }
    return sundayColumns;
  }
  
  const sundayColumns = getSundayColumns(month, year, daysInMonth);
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

  const fullHeader = [
    'S.No', 'EMP ID', 'Employee Name',
    ...dayHeaders,
    'P', 'OT', 'Rate', 'Gross Payment', 'Advances', 'Bonus', 'Prev Balance', 'Final Payment'
  ];

  const tableHeaderRow = worksheet.addRow(fullHeader);
  tableHeaderRow.height = 25;

  // Style different sections of headers with different colors
  tableHeaderRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1f4e79' } },
      bottom: { style: 'medium', color: { argb: 'FF1f4e79' } },
      left: { style: 'thin', color: { argb: 'FF1f4e79' } },
      right: { style: 'thin', color: { argb: 'FF1f4e79' } }
    };

    // Professional color scheme for different sections
    if (colNumber <= 3) {
      // Employee info section - Professional dark gray
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    } else if (colNumber <= 3 + daysInMonth) {
      // Daily attendance section - Check if it's a Sunday
      if (sundayColumns.includes(colNumber)) {
        // Sunday columns - Red highlight
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
        cell.font.color = { argb: 'FFFFFFFF' };
      } else {
        // Regular day columns - Professional blue-gray
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
      }
    } else {
      // Summary/calculation section - Professional accent
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3498DB' } };
    }
  });

  // =========================================================================
  // PART C: POPULATE THE WORKSHEET WITH REAL DATA
  // =========================================================================
  if (employeeData.length === 0) {
    // Add a row indicating no data found
    const noDataRow = worksheet.addRow(['', '', 'No employee data found for the specified period', ...Array(daysInMonth + 5).fill('')]);
    noDataRow.getCell(3).font = { italic: true, color: { argb: 'FF666666' } };
  } else {
    employeeData.forEach((employee, index) => {
      // Process attendance data - show full attendance strings (P2, A5, P12, etc.)
      const attendance = Array.from({ length: daysInMonth }, (_, i) => {
        const dayAttendance = employee.attendance[i] || '';
        // Return the full attendance string (P2, A5, P12, etc.)
        return dayAttendance || '';
      });

      // Construct the full row array with real data
      const rowData = [
        index + 1,                    // S.No
        employee.empid || '',         // EMP ID
        employee.name || '',          // Employee Name
        ...attendance,                // Attendance for days in month
        {},                           // P (Present Days) - will be calculated with formula
        {},                           // OT (Overtime Hours) - will be calculated with formula
        employee.rate || 0,           // Rate
        {},                           // Gross Payment (placeholder for formula)
        employee.totalPayouts || 0,   // Advances
        employee.totalAdditionalReqPays || 0, // Bonus
        employee.carryForward || 0,   // Prev Balance
        {}                            // Final Payment (placeholder for formula)
      ];

      const dataRow = worksheet.addRow(rowData);
      const rowNumber = dataRow.number;
      dataRow.height = 22;

      // Calculate column letters for formulas
      const firstAttendanceCol = getColumnLetter(4); // First day column (D)
      const lastAttendanceCol = getColumnLetter(3 + daysInMonth); // Last day column
      const presentCol = getColumnLetter(3 + daysInMonth + 1); // P column
      const otCol = getColumnLetter(3 + daysInMonth + 2);      // OT column
      const rateCol = getColumnLetter(3 + daysInMonth + 3);    // Rate column
      const grossCol = getColumnLetter(3 + daysInMonth + 4);   // Gross Payment column
      const advancesCol = getColumnLetter(3 + daysInMonth + 5); // Advances column
      const bonusCol = getColumnLetter(3 + daysInMonth + 6);   // Bonus column
      const prevBalCol = getColumnLetter(3 + daysInMonth + 7); // Prev Balance column
      const finalCol = getColumnLetter(3 + daysInMonth + 8);   // Final Payment column

      // Formula to count all cells that start with "P" (Present days)
      dataRow.getCell(presentCol).value = {
        formula: `SUMPRODUCT(--(LEFT(${firstAttendanceCol}${rowNumber}:${lastAttendanceCol}${rowNumber},1)="P"))`
      };

      // Formula to sum all numbers after P or A (Overtime hours)
      // This uses a complex formula to extract numbers from strings like "P2", "A5", "P12"
      let otFormula = '';
      for (let col = 4; col <= 3 + daysInMonth; col++) {
        const colLetter = getColumnLetter(col);
        if (otFormula) otFormula += '+';
        otFormula += `IF(LEN(${colLetter}${rowNumber})>1,VALUE(MID(${colLetter}${rowNumber},2,10)),0)`;
      }
      dataRow.getCell(otCol).value = {
        formula: otFormula
      };

      // Add formulas to the Gross Payment and Final Payment cells
      dataRow.getCell(grossCol).value = {
        formula: `${presentCol}${rowNumber}*${rateCol}${rowNumber} + (${otCol}${rowNumber}*${rateCol}${rowNumber}/8)`
      };

      dataRow.getCell(finalCol).value = {
        formula: `${grossCol}${rowNumber}-${advancesCol}${rowNumber}+${bonusCol}${rowNumber}-${prevBalCol}${rowNumber}`
      };

      // Modern styling for data rows with alternating colors
      const isEvenRow = index % 2 === 0;

      dataRow.eachCell((cell, colNumber) => {
        // Base styling
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFe1e5e9' } },
          bottom: { style: 'thin', color: { argb: 'FFe1e5e9' } },
          left: { style: 'thin', color: { argb: 'FFe1e5e9' } },
          right: { style: 'thin', color: { argb: 'FFe1e5e9' } }
        };

        // Section-specific styling
        if (colNumber <= 3) {
          // Employee info section
          cell.alignment.horizontal = colNumber === 1 ? 'center' : 'left';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEvenRow ? 'FFf8f9fa' : 'FFFFFFFF' }
          };
          if (colNumber === 3) cell.font.bold = true; // Employee name bold
        } else if (colNumber <= 3 + daysInMonth) {
          // Daily attendance section
          cell.alignment.horizontal = 'center';
          cell.font.size = 9;

          // Check if this is a Sunday column
          const isSunday = sundayColumns.includes(colNumber);
          
          // Color code attendance
          const attendanceValue = cell.value;
          if (attendanceValue && attendanceValue.toString().startsWith('P')) {
            if (isSunday) {
              // Present on Sunday - Special highlight
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD54F' } }; // Amber
              cell.font.color = { argb: 'FF2e7d32' };
              cell.font.bold = true;
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f5e8' } };
              cell.font.color = { argb: 'FF2e7d32' };
              cell.font.bold = true;
            }
          } else if (attendanceValue && attendanceValue.toString().startsWith('A')) {
            if (isSunday) {
              // Absent on Sunday - Special highlight
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8A65' } }; // Light orange
              cell.font.color = { argb: 'FFc62828' };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFffebee' } };
              cell.font.color = { argb: 'FFc62828' };
            }
          } else if (attendanceValue && attendanceValue.toString().startsWith('W')) {
            if (isSunday) {
              // Weekly off on Sunday - Special highlight
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF81C784' } }; // Light green
              cell.font.color = { argb: 'FF1565c0' };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe3f2fd' } };
              cell.font.color = { argb: 'FF1565c0' };
            }
          } else {
            if (isSunday) {
              // Empty Sunday cell - Light red background
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } }; // Very light red
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEvenRow ? 'FFf5f5f5' : 'FFFAFAFA' }
              };
            }
          }
        } else {
          // Summary/calculation section
          cell.alignment.horizontal = 'right';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEvenRow ? 'FFf0f4f8' : 'FFf8fafc' }
          };

          // Special styling for financial columns
          if (colNumber >= 3 + daysInMonth + 3) { // Rate and payment columns
            cell.numFmt = '#,##0.00';
            if (colNumber === 3 + daysInMonth + 4 || colNumber === 3 + daysInMonth + 8) {
              // Gross Payment and Final Payment - bold
              cell.font.bold = true;
            }
            if (colNumber === 3 + daysInMonth + 8) {
              // Final Payment - special color
              const finalValue = parseFloat(cell.value) || 0;
              if (finalValue < 0) {
                cell.font.color = { argb: 'FFc62828' };
              } else {
                cell.font.color = { argb: 'FF2e7d32' };
              }
            }
          }
        }
      });
    });
  }

  // =========================================================================
  // PART D: PROFESSIONAL COLUMN WIDTHS AND FINAL TOUCHES
  // =========================================================================

  // Set optimal column widths
  worksheet.getColumn('A').width = 6;   // S.No
  worksheet.getColumn('B').width = 14;  // EMP ID
  worksheet.getColumn('C').width = 28;  // Employee Name

  // Day columns - slightly wider for better readability
  for (let i = 4; i < 4 + daysInMonth; i++) {
    worksheet.getColumn(i).width = 5;
  }

  // Summary columns with appropriate widths
  const summaryStartCol = 4 + daysInMonth;
  const summaryWidths = [8, 8, 12, 16, 14, 12, 14, 16]; // P, OT, Rate, Gross, Advances, Bonus, Prev, Final
  summaryWidths.forEach((width, i) => {
    worksheet.getColumn(summaryStartCol + i).width = width;
  });

  // Keep grid lines hidden for clean appearance
  worksheet.views = [{ showGridLines: false }];

  // Add a professional footer
  const footerRow = worksheet.lastRow.number + 2;
  worksheet.mergeCells(`A${footerRow}:${lastColumn}${footerRow}`);
  const footerCell = worksheet.getCell(`A${footerRow}`);
  footerCell.value = `CONFIDENTIAL DOCUMENT | Generated: ${new Date().toLocaleDateString()} | Records: ${employeeData.length} | Site Haazri`;
  footerCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF6C757D' } };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
  footerCell.border = {
    top: { style: 'thin', color: { argb: 'FFDEE2E6' } }
  };

  // Create second worksheet for individual employee details
  await createEmployeeDetailsWorksheet(workbook, employeeData, siteInfo, month, year);

  // =========================================================================
  // SHEET 4: SITE EXPENSES (NEW)
  // =========================================================================
  createSiteExpensesSheet(workbook, expenseData, siteInfo, month, year);

  // =========================================================================
  // SHEET 5: PAYMENTS RECEIVED (NEW)
  // =========================================================================
  createSitePaymentsSheet(workbook, paymentData, siteInfo, month, year);

  // Generate buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  console.log('✅ Success! Professional payroll report generated with real data');

  return buffer;
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

/**
 * Helper function to get days in month
 */
function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/**
 * Helper function to convert column number to Excel column letter
 */
function getColumnLetter(columnNumber) {
  let result = '';
  while (columnNumber > 0) {
    columnNumber--;
    result = String.fromCharCode(65 + (columnNumber % 26)) + result;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return result;
}

/**
 * Create detailed employee information worksheet with advances and bonus details
 * @param {ExcelJS.Workbook} workbook - Excel workbook instance
 * @param {Array} employeeData - Employee data array
 * @param {Object} siteInfo - Site information
 * @param {number} month - Month number
 * @param {number} year - Year number
 */
async function createEmployeeDetailsWorksheet(workbook, employeeData, siteInfo, month, year) {
  const worksheet = workbook.addWorksheet('Employee Details');
  
  // Get month name for display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month - 1];

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // A - Employee ID
    { width: 25 }, // B - Employee Name
    { width: 15 }, // C - Type (Advance/Bonus)
    { width: 15 }, // D - Amount
    { width: 12 }, // E - Date
    { width: 30 }, // F - Remark
  ];

  // Add top spacing
  worksheet.addRow([]);
  worksheet.addRow([]);

  // Company branding bar
  worksheet.mergeCells('A3:F3');
  const brandingCell = worksheet.getCell('A3');
  brandingCell.value = '';
  brandingCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2C3E50' }
  };
  worksheet.getRow(3).height = 4;

  // Title section
  worksheet.mergeCells('A4:F5');
  const titleCell = worksheet.getCell('A4');
  titleCell.value = `${siteInfo.sitename.toUpperCase()} - EMPLOYEE DETAILS`;
  titleCell.font = {
    name: 'Calibri',
    size: 24,
    bold: true,
    color: { argb: 'FF2C3E50' }
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8F9FA' }
  };
  titleCell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  titleCell.border = {
    top: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    bottom: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    left: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    right: { style: 'thin', color: { argb: 'FFE9ECEF' } }
  };
  worksheet.getRow(4).height = 35;
  worksheet.getRow(5).height = 35;

  // Period information
  worksheet.mergeCells('A6:F6');
  const periodCell = worksheet.getCell('A6');
  periodCell.value = `Advances & Bonus Details - ${monthName} ${year}`;
  periodCell.font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: 'FF6C757D' }
  };
  periodCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8F9FA' }
  };
  periodCell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  periodCell.border = {
    top: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    bottom: { style: 'medium', color: { argb: 'FF2C3E50' } },
    left: { style: 'thin', color: { argb: 'FFE9ECEF' } },
    right: { style: 'thin', color: { argb: 'FFE9ECEF' } }
  };
  worksheet.getRow(6).height = 25;

  // Add spacing
  worksheet.addRow([]);
  worksheet.addRow([]);

  // Table headers
  const headerRow = worksheet.addRow([
    'Employee ID',
    'Employee Name', 
    'Type',
    'Amount (₹)',
    'Date',
    'Remark'
  ]);
  
  headerRow.height = 30;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2C3E50' } },
      bottom: { style: 'thin', color: { argb: 'FF2C3E50' } },
      left: { style: 'thin', color: { argb: 'FF2C3E50' } },
      right: { style: 'thin', color: { argb: 'FF2C3E50' } }
    };
  });

  // Add employee detail rows with separation
  let currentRow = 10;
  let employeeIndex = 0;
  
  for (const employee of employeeData) {
    let hasData = false;
    
    // Employee header section
    if ((employee.payouts && employee.payouts.length > 0) || 
        (employee.additional_req_pays && employee.additional_req_pays.length > 0)) {
      
      // Add spacing between employees (except for first employee)
      if (employeeIndex > 0) {
        worksheet.addRow([]);
        currentRow++;
      }
      
      // Employee name header
      const employeeHeaderRow = worksheet.addRow([
        employee.empid,
        employee.name,
        'EMPLOYEE DETAILS',
        '',
        '',
        ''
      ]);
      
      worksheet.mergeCells(`C${employeeHeaderRow.number}:F${employeeHeaderRow.number}`);
      
      employeeHeaderRow.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF495057' } // Dark gray header
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber <= 2 ? 'left' : 'center'
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF495057' } },
          bottom: { style: 'medium', color: { argb: 'FF495057' } },
          left: { style: 'medium', color: { argb: 'FF495057' } },
          right: { style: 'medium', color: { argb: 'FF495057' } }
        };
      });
      
      employeeHeaderRow.height = 25;
      currentRow++;
      hasData = true;
    }
    
    // Add advances (payouts)
    if (employee.payouts && employee.payouts.length > 0) {
      for (const payout of employee.payouts) {
        const dataRow = worksheet.addRow([
          '', // Empty employee ID for detail rows
          '', // Empty employee name for detail rows
          'Advance',
          payout.value,
          payout.date ? new Date(payout.date).toLocaleDateString('en-IN') : '',
          payout.remark || 'Advance Payment'
        ]);
        
        // Style the row
        dataRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFe1e5e9' } },
            bottom: { style: 'thin', color: { argb: 'FFe1e5e9' } },
            left: { style: 'thin', color: { argb: 'FFe1e5e9' } },
            right: { style: 'thin', color: { argb: 'FFe1e5e9' } }
          };
          
          // Column-specific styling
          if (colNumber === 1 || colNumber === 2) {
            cell.alignment.horizontal = 'left';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8F9FA' } // Light background for empty cells
            };
          } else if (colNumber === 3) {
            cell.alignment.horizontal = 'center';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEAA7' } // Light orange for advances
            };
            cell.font.color = { argb: 'FFD63031' };
            cell.font.bold = true;
          } else if (colNumber === 4) {
            cell.alignment.horizontal = 'right';
            cell.numFmt = '₹#,##0.00';
          } else {
            cell.alignment.horizontal = 'center';
          }
        });
        currentRow++;
      }
    }
    
    // Add bonus payments (additional_req_pays)
    if (employee.additional_req_pays && employee.additional_req_pays.length > 0) {
      for (const bonus of employee.additional_req_pays) {
        const dataRow = worksheet.addRow([
          '', // Empty employee ID for detail rows
          '', // Empty employee name for detail rows
          'Bonus',
          bonus.value,
          bonus.date ? new Date(bonus.date).toLocaleDateString('en-IN') : '',
          bonus.remark || 'Bonus Payment'
        ]);
        
        // Style the row
        dataRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFe1e5e9' } },
            bottom: { style: 'thin', color: { argb: 'FFe1e5e9' } },
            left: { style: 'thin', color: { argb: 'FFe1e5e9' } },
            right: { style: 'thin', color: { argb: 'FFe1e5e9' } }
          };
          
          // Column-specific styling
          if (colNumber === 1 || colNumber === 2) {
            cell.alignment.horizontal = 'left';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8F9FA' } // Light background for empty cells
            };
          } else if (colNumber === 3) {
            cell.alignment.horizontal = 'center';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD1F2EB' } // Light green for bonus
            };
            cell.font.color = { argb: 'FF00B894' };
            cell.font.bold = true;
          } else if (colNumber === 4) {
            cell.alignment.horizontal = 'right';
            cell.numFmt = '₹#,##0.00';
          } else {
            cell.alignment.horizontal = 'center';
          }
        });
        currentRow++;
      }
    }
    
    // Add employee summary row
    if (hasData) {
      const totalAdvances = (employee.payouts || []).reduce((sum, payout) => sum + (payout.value || 0), 0);
      const totalBonus = (employee.additional_req_pays || []).reduce((sum, bonus) => sum + (bonus.value || 0), 0);
      
      const summaryRow = worksheet.addRow([
        '',
        '',
        'TOTAL',
        totalAdvances + totalBonus,
        '',
        `Advances: ₹${totalAdvances.toFixed(2)} | Bonus: ₹${totalBonus.toFixed(2)}`
      ]);
      
      summaryRow.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF2C3E50' }
        };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF2C3E50' } },
          bottom: { style: 'medium', color: { argb: 'FF2C3E50' } },
          left: { style: 'thin', color: { argb: 'FFe1e5e9' } },
          right: { style: 'thin', color: { argb: 'FFe1e5e9' } }
        };
        
        if (colNumber === 1 || colNumber === 2) {
          cell.alignment.horizontal = 'left';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }
          };
        } else if (colNumber === 3) {
          cell.alignment.horizontal = 'center';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' } // Light blue for total
          };
        } else if (colNumber === 4) {
          cell.alignment.horizontal = 'right';
          cell.numFmt = '₹#,##0.00';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
          };
        } else {
          cell.alignment.horizontal = 'left';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
          };
        }
      });
      
      currentRow++;
      employeeIndex++;
    }
  }

  // Add summary section if there are no details
  if (currentRow === 10) {
    const noDataRow = worksheet.addRow([
      '', '', 'No advance or bonus payments found for this period', '', '', ''
    ]);
    worksheet.mergeCells(`A${noDataRow.number}:F${noDataRow.number}`);
    const noDataCell = worksheet.getCell(`A${noDataRow.number}`);
    noDataCell.font = {
      name: 'Calibri',
      size: 12,
      italic: true,
      color: { argb: 'FF6C757D' }
    };
    noDataCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
    noDataCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8F9FA' }
    };
  }
}

/**
 * Create Financial Summary Sheet
 * @param {ExcelJS.Workbook} workbook - The workbook instance
 * @param {Object} financialSummary - Financial summary data
 * @param {Object} siteInfo - Site information
 * @param {number} month - Month number
 * @param {number} year - Year number
 */
function createFinancialSummarySheet(workbook, financialSummary, siteInfo, month, year) {
  const worksheet = workbook.addWorksheet('Financial Summary');
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month - 1];

  const fs = financialSummary;

  // Helper function to format currency
  const formatCurrency = (value) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Set column widths
  worksheet.columns = [
    { width: 5 },
    { width: 25 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 }
  ];

  let row = 1;

  // Title Section
  worksheet.mergeCells(`A${row}:F${row}`);
  let cell = worksheet.getCell(`A${row}`);
  cell.value = 'FINANCIAL SUMMARY';
  cell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF1a365d' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 35;
  row++;

  // Site and Period Info
  worksheet.mergeCells(`A${row}:F${row}`);
  cell = worksheet.getCell(`A${row}`);
  cell.value = `${siteInfo.sitename} - ${monthName} ${year}`;
  cell.font = { name: 'Calibri', size: 14, color: { argb: 'FF718096' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row += 2;

  // Money Received Section
  worksheet.mergeCells(`B${row}:C${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = '💵 MONEY RECEIVED THIS MONTH';
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF27ae60' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
  cell.border = { top: { style: 'thick', color: { argb: 'FF27ae60' } }, left: { style: 'thick', color: { argb: 'FF27ae60' } }, right: { style: 'thick', color: { argb: 'FF27ae60' } } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row++;

  worksheet.mergeCells(`B${row}:C${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = formatCurrency(fs.payments.total);
  cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF1a365d' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
  cell.border = { left: { style: 'thick', color: { argb: 'FF27ae60' } }, right: { style: 'thick', color: { argb: 'FF27ae60' } } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 30;
  row++;

  worksheet.mergeCells(`B${row}:C${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = `${fs.payments.count} transactions`;
  cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF718096' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
  cell.border = { bottom: { style: 'thick', color: { argb: 'FF27ae60' } }, left: { style: 'thick', color: { argb: 'FF27ae60' } }, right: { style: 'thick', color: { argb: 'FF27ae60' } } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 20;
  row += 2;

  // Spending Breakdown Section
  worksheet.mergeCells(`B${row}:F${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = '💰 SPENDING BREAKDOWN';
  cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF2d3748' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row++;

  // Three column headers
  cell = worksheet.getCell(`B${row}`);
  cell.value = 'Labour Costs';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF718096' } };

  cell = worksheet.getCell(`D${row}`);
  cell.value = 'Site Expenses';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF718096' } };

  cell = worksheet.getCell(`F${row}`);
  cell.value = 'Advances Paid';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF718096' } };
  worksheet.getRow(row).height = 18;
  row++;

  // Three column values
  cell = worksheet.getCell(`B${row}`);
  cell.value = formatCurrency(fs.labour.totalWages);
  cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF2980b9' } };

  cell = worksheet.getCell(`D${row}`);
  cell.value = formatCurrency(fs.expenses.total);
  cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFe74c3c' } };

  cell = worksheet.getCell(`F${row}`);
  cell.value = formatCurrency(fs.labour.totalAdvances);
  cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8e44ad' } };
  worksheet.getRow(row).height = 25;
  row++;

  // Statistics
  cell = worksheet.getCell(`B${row}`);
  cell.value = `${fs.statistics.employeeCount} employees`;
  cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF718096' } };

  cell = worksheet.getCell(`D${row}`);
  cell.value = `${fs.expenses.count} transactions`;
  cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF718096' } };

  cell = worksheet.getCell(`F${row}`);
  cell.value = `Pending: ${formatCurrency(fs.labour.pendingPayment)}`;
  cell.font = { name: 'Calibri', size: 9, color: { argb: 'FFe67e22' }, bold: true };
  worksheet.getRow(row).height = 18;
  row += 2;

  // Profit/Loss Section
  const profitColor = fs.profitLoss.netProfit >= 0 ? 'FF27ae60' : 'FFe74c3c';
  const profitLabel = fs.profitLoss.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS';

  worksheet.mergeCells(`B${row}:F${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = `📊 ${profitLabel}`;
  cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: profitColor } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fs.profitLoss.netProfit >= 0 ? 'FFF0FDF4' : 'FFFEF2F2' } };
  cell.border = { top: { style: 'thick', color: { argb: profitColor } }, left: { style: 'thick', color: { argb: profitColor } }, right: { style: 'thick', color: { argb: profitColor } } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row++;

  // Calculation breakdown
  worksheet.mergeCells(`B${row}:D${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = `Money Received: ${formatCurrency(fs.profitLoss.revenue)}`;
  cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF2d3748' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fs.profitLoss.netProfit >= 0 ? 'FFF0FDF4' : 'FFFEF2F2' } };
  cell.border = { left: { style: 'thick', color: { argb: profitColor } } };

  worksheet.mergeCells(`E${row}:F${row}`);
  cell = worksheet.getCell(`E${row}`);
  cell.value = formatCurrency(Math.abs(fs.profitLoss.netProfit));
  cell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: profitColor } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fs.profitLoss.netProfit >= 0 ? 'FFF0FDF4' : 'FFFEF2F2' } };
  cell.border = { right: { style: 'thick', color: { argb: profitColor } } };
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row++;

  worksheet.mergeCells(`B${row}:D${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = `Total Costs: ${formatCurrency(fs.profitLoss.costs)}`;
  cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF2d3748' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fs.profitLoss.netProfit >= 0 ? 'FFF0FDF4' : 'FFFEF2F2' } };
  cell.border = { bottom: { style: 'thick', color: { argb: profitColor } }, left: { style: 'thick', color: { argb: profitColor } } };

  worksheet.mergeCells(`E${row}:F${row}`);
  cell = worksheet.getCell(`E${row}`);
  cell.value = `Margin: ${fs.profitLoss.profitMargin.toFixed(1)}%`;
  cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF718096' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fs.profitLoss.netProfit >= 0 ? 'FFF0FDF4' : 'FFFEF2F2' } };
  cell.border = { bottom: { style: 'thick', color: { argb: profitColor } }, right: { style: 'thick', color: { argb: profitColor } } };
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row += 2;

  // Cash Flow Summary
  worksheet.mergeCells(`B${row}:F${row}`);
  cell = worksheet.getCell(`B${row}`);
  cell.value = `Cash Flow: In ${formatCurrency(fs.cashFlow.cashIn)} | Out ${formatCurrency(fs.cashFlow.cashOut)} | Net Position ${formatCurrency(fs.cashFlow.netCashPosition)}`;
  cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF718096' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 18;
}

/**
 * Create Site Expenses Sheet
 * @param {ExcelJS.Workbook} workbook - The workbook instance
 * @param {Object} expenseData - Expense data
 * @param {Object} siteInfo - Site information
 * @param {number} month - Month number
 * @param {number} year - Year number
 */
function createSiteExpensesSheet(workbook, expenseData, siteInfo, month, year) {
  const worksheet = workbook.addWorksheet('Site Expenses');
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month - 1];

  const formatCurrency = (value) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Set column widths
  worksheet.columns = [
    { width: 15 },  // Date
    { width: 20 },  // Category
    { width: 18 },  // Amount
    { width: 50 },  // Remark
    { width: 20 }   // Created By
  ];

  let row = 1;

  // Title
  worksheet.mergeCells(`A${row}:E${row}`);
  let cell = worksheet.getCell(`A${row}`);
  cell.value = 'SITE EXPENSES BREAKDOWN';
  cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF1a365d' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 30;
  row++;

  // Subtitle
  worksheet.mergeCells(`A${row}:E${row}`);
  cell = worksheet.getCell(`A${row}`);
  cell.value = `${siteInfo.sitename} - ${monthName} ${year}`;
  cell.font = { name: 'Calibri', size: 12, color: { argb: 'FF718096' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 20;
  row++;

  // Summary Box
  worksheet.mergeCells(`A${row}:E${row}`);
  cell = worksheet.getCell(`A${row}`);
  cell.value = `Total Expenses: ${formatCurrency(expenseData.total)} | ${expenseData.count} transactions`;
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF2d3748' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E6' } };
  cell.border = {
    top: { style: 'medium', color: { argb: 'FFe74c3c' } },
    bottom: { style: 'medium', color: { argb: 'FFe74c3c' } },
    left: { style: 'medium', color: { argb: 'FFe74c3c' } },
    right: { style: 'medium', color: { argb: 'FFe74c3c' } }
  };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row += 2;

  // Category Summary Table Header
  cell = worksheet.getCell(`A${row}`);
  cell.value = 'CATEGORY';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`B${row}`);
  cell.value = 'AMOUNT';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`C${row}`);
  cell.value = 'ITEMS';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`D${row}`);
  cell.value = 'PERCENTAGE';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row++;

  // Category breakdown
  const categories = Object.keys(expenseData.byCategory).sort((a, b) => {
    return expenseData.byCategory[b].total - expenseData.byCategory[a].total;
  });

  categories.forEach((category, index) => {
    const catData = expenseData.byCategory[category];
    const percentage = expenseData.total > 0 ? ((catData.total / expenseData.total) * 100).toFixed(1) : 0;
    const bgColor = index % 2 === 0 ? 'FFF7FAFC' : 'FFFFFFFF';

    cell = worksheet.getCell(`A${row}`);
    cell.value = category;
    cell.font = { name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    cell = worksheet.getCell(`B${row}`);
    cell.value = formatCurrency(catData.total);
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: 'right' };

    cell = worksheet.getCell(`C${row}`);
    cell.value = catData.items.length;
    cell.font = { name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: 'center' };

    cell = worksheet.getCell(`D${row}`);
    cell.value = `${percentage}%`;
    cell.font = { name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: 'right' };

    worksheet.getRow(row).height = 18;
    row++;
  });

  row += 2;

  // Detailed Expense List
  worksheet.mergeCells(`A${row}:E${row}`);
  cell = worksheet.getCell(`A${row}`);
  cell.value = 'DETAILED EXPENSE LIST';
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF2d3748' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row++;

  // Table Header
  cell = worksheet.getCell(`A${row}`);
  cell.value = 'DATE';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`B${row}`);
  cell.value = 'CATEGORY';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`C${row}`);
  cell.value = 'AMOUNT';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`D${row}`);
  cell.value = 'REMARK';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`E${row}`);
  cell.value = 'CREATED BY';
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 20;
  row++;

  // Expense rows
  expenseData.expenses.forEach((expense, index) => {
    const bgColor = index % 2 === 0 ? 'FFF7FAFC' : 'FFFFFFFF';
    const dateStr = new Date(expense.date).toLocaleDateString('en-IN');

    cell = worksheet.getCell(`A${row}`);
    cell.value = dateStr;
    cell.font = { name: 'Calibri', size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    cell = worksheet.getCell(`B${row}`);
    cell.value = expense.category;
    cell.font = { name: 'Calibri', size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    cell = worksheet.getCell(`C${row}`);
    cell.value = formatCurrency(expense.value);
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFe74c3c' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: 'right' };

    cell = worksheet.getCell(`D${row}`);
    cell.value = expense.remark || '-';
    cell.font = { name: 'Calibri', size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    cell = worksheet.getCell(`E${row}`);
    cell.value = expense.createdBy || '-';
    cell.font = { name: 'Calibri', size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    worksheet.getRow(row).height = 18;
    row++;
  });
}

/**
 * Create Site Payments Sheet
 * @param {ExcelJS.Workbook} workbook - The workbook instance
 * @param {Object} paymentData - Payment data
 * @param {Object} siteInfo - Site information
 * @param {number} month - Month number
 * @param {number} year - Year number
 */
function createSitePaymentsSheet(workbook, paymentData, siteInfo, month, year) {
  const worksheet = workbook.addWorksheet('Payments Received');
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month - 1];

  const formatCurrency = (value) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Set column widths
  worksheet.columns = [
    { width: 15 },  // Date
    { width: 20 },  // Amount
    { width: 50 },  // Remark
    { width: 20 }   // Received By
  ];

  let row = 1;

  // Title
  worksheet.mergeCells(`A${row}:D${row}`);
  let cell = worksheet.getCell(`A${row}`);
  cell.value = 'PAYMENTS RECEIVED';
  cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF1a365d' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 30;
  row++;

  // Subtitle
  worksheet.mergeCells(`A${row}:D${row}`);
  cell = worksheet.getCell(`A${row}`);
  cell.value = `${siteInfo.sitename} - ${monthName} ${year}`;
  cell.font = { name: 'Calibri', size: 12, color: { argb: 'FF718096' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 20;
  row++;

  // Summary Box
  worksheet.mergeCells(`A${row}:D${row}`);
  cell = worksheet.getCell(`A${row}`);
  cell.value = `Total Payments: ${formatCurrency(paymentData.total)} | ${paymentData.count} transactions`;
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF27ae60' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
  cell.border = {
    top: { style: 'medium', color: { argb: 'FF27ae60' } },
    bottom: { style: 'medium', color: { argb: 'FF27ae60' } },
    left: { style: 'medium', color: { argb: 'FF27ae60' } },
    right: { style: 'medium', color: { argb: 'FF27ae60' } }
  };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row += 2;

  // Table Header
  cell = worksheet.getCell(`A${row}`);
  cell.value = 'DATE';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`B${row}`);
  cell.value = 'AMOUNT';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`C${row}`);
  cell.value = 'REMARK';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };

  cell = worksheet.getCell(`D${row}`);
  cell.value = 'RECEIVED BY';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 22;
  row++;

  // Payment rows
  paymentData.payments.forEach((payment, index) => {
    const bgColor = index % 2 === 0 ? 'FFF0FDF4' : 'FFFFFFFF';
    const dateStr = new Date(payment.date).toLocaleDateString('en-IN');

    cell = worksheet.getCell(`A${row}`);
    cell.value = dateStr;
    cell.font = { name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    cell = worksheet.getCell(`B${row}`);
    cell.value = formatCurrency(payment.value);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF27ae60' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: 'right' };

    cell = worksheet.getCell(`C${row}`);
    cell.value = payment.remark || '-';
    cell.font = { name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    cell = worksheet.getCell(`D${row}`);
    cell.value = payment.receivedBy || '-';
    cell.font = { name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

    worksheet.getRow(row).height = 18;
    row++;
  });
}

module.exports = {
  generateFullPayrollReportWithRealData,
  fetchEmployeeData,
  fetchSiteInfo
};
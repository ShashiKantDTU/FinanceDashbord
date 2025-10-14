/**
 * Weekly Report Utilities
 * Handles data aggregation and calculations for weekly reports
 * 
 * CALCULATION DEFINITIONS:
 * ========================
 * 
 * 1. WEEKLY WAGE (Per Employee)
 *    Formula: Rate × (Days Present + Overtime Days)
 *    - Days Present: Count of "P" attendance marks in last 7 days
 *    - Overtime Days: Calculated from overtime hours
 *      * Default: OT Hours / 8
 *      * Special: floor(OT Hours / 8) + (OT Hours % 8) / 10
 *    Example: Rate ₹600, 6 days present, 4 OT hours
 *      → ₹600 × (6 + 0.5) = ₹3,900
 * 
 * 2. TOTAL LABOUR COST (All Employees)
 *    Formula: Sum of Weekly Wages for all employees
 *    - This is the OBLIGATION (what you OWE workers)
 *    - NOT the same as cash paid out
 *    Example: If 5 employees earn ₹19,258 total wages
 *      → Total Labour Cost = ₹19,258
 * 
 * 3. ADVANCES PAID (Cash Given)
 *    Formula: Sum of all payouts.value where date is in last 7 days
 *    - This is ACTUAL CASH given to workers as advance
 *    - Filters by payout.date within date range
 *    Example: Worker A got ₹500 on Oct 7, Worker B got ₹800 on Oct 10
 *      → Total Advances = ₹1,300
 * 
 * 4. SITE EXPENSES
 *    Formula: Sum of all site_expenses.value where date is in last 7 days
 *    - Includes: Material, Travel, Food, Equipment, etc.
 *    - Grouped by category for breakdown
 *    Example: Material ₹12,500, Food ₹2,800, Travel ₹1,800
 *      → Total Expenses = ₹17,100
 * 
 * 5. TOTAL CASH OUTFLOW (Actual Money Spent)
 *    Formula: Advances Paid + Site Expenses
 *    - This is ACTUAL CASH that left the account
 *    - Does NOT include labour cost (that's owed, not paid)
 *    Example: Advances ₹3,000 + Expenses ₹20,600
 *      → Total Cash Outflow = ₹23,600
 * 
 * 6. NET PAYMENT (Per Employee)
 *    Formula: Weekly Wage - Advances
 *    - This is what worker is OWED at end of week
 *    - Can be negative if advances exceed wage
 *    Example: Wage ₹3,900 - Advance ₹500
 *      → Net Payment = ₹3,400 (still owed to worker)
 * 
 * KEY DIFFERENCES:
 * ================
 * - Labour Cost = What you OWE (obligation)
 * - Advances = What you PAID (cash out)
 * - Net Payment = What you STILL OWE (balance)
 * - Cash Outflow = Actual money spent (advances + expenses)
 * 
 * IMPORTANT NOTES:
 * ===============
 * - Date Range: Last 7 days including today (today - 6 days to today)
 * - Attendance Array: Monthly array where index = day-1 (e.g., arr[0] = Day 1)
 * - Currency: All amounts in paise internally, displayed as rupees
 * - Precision: 2 decimal places for all currency values
 */

const mongoose = require('mongoose');
const employeeSchema = require('../models/EmployeeSchema');
const siteExpenseSchema = require('../models/SiteExpenseSchema');
const sitePaymentSchema = require('../models/SitePaymentSchema');

/**
 * Get current date in IST timezone
 * This ensures consistency with cron job scheduling which uses 'Asia/Kolkata' timezone
 * @returns {Date} Current date/time in IST
 */
function getISTDate() {
    // Get current UTC time
    const now = new Date();
    
    // Convert to IST (UTC +5:30)
    // Using toLocaleString to get IST time, then parse it back to Date object
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    
    return istDate;
}

/**
 * Calculate date range for last 7 days ENDING YESTERDAY
 * CRITICAL: Reports run at 2 AM, so "today" data is incomplete
 * We need last 7 COMPLETE days, which means ending yesterday
 * 
 * IMPORTANT: Uses IST timezone to match cron job scheduling
 * 
 * Example: Cron runs at 2 AM IST on Oct 15
 *   - Today (IST) = Oct 15
 *   - Yesterday = Oct 14
 *   - Last 7 days = Oct 8-14 (complete data)
 * 
 * @returns {Object} { startDate, endDate, startDay, endDay, month, year }
 */
function getLast7DaysRange() {
    // CRITICAL: Use IST date to match cron job timezone (Asia/Kolkata)
    // When cron runs at 2 AM IST, server might be in UTC (8:30 PM previous day)
    const today = getISTDate();
    
    // Calculate yesterday (since today's data at 2 AM is incomplete)
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // End date is yesterday at 23:59:59 (last second of yesterday)
    const endDate = new Date(yesterday);
    endDate.setHours(23, 59, 59, 999);
    
    // Start date is 7 days before yesterday (yesterday - 6 days = 7 days total)
    const startDate = new Date(yesterday);
    startDate.setDate(yesterday.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    return {
        startDate,
        endDate,
        startDay: startDate.getDate(),
        endDay: endDate.getDate(),
        month: yesterday.getMonth() + 1,
        year: yesterday.getFullYear(),
        formattedRange: `${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}`,
        timezone: 'Asia/Kolkata (IST)',
        note: 'Last 7 complete days ending yesterday'
    };
}

/**
 * Parse attendance string to get overtime hours
 * @param {string} attendance - Attendance string (e.g., "P", "P2", "A")
 * @returns {Object} { isPresent, overtimeHours }
 */
function parseAttendance(attendance) {
    if (!attendance || attendance === 'A' || attendance === '') {
        return { isPresent: false, overtimeHours: 0 };
    }
    
    const match = attendance.match(/P(\d+)?/);
    if (match) {
        return {
            isPresent: true,
            overtimeHours: match[1] ? parseInt(match[1]) : 0
        };
    }
    
    return { isPresent: false, overtimeHours: 0 };
}

/**
 * Calculate weekly attendance for an employee
 * @param {Array} attendanceArray - Full month attendance array
 * @param {number} startDay - Start day of week range
 * @param {number} endDay - End day of week range
 * @param {string} calculationType - Calculation type for overtime
 * @returns {Object} { daysPresent, overtimeHours, overtimeDays, dailyBreakdown }
 */
function calculateWeeklyAttendance(attendanceArray, startDay, endDay, calculationType = 'default') {
    let daysPresent = 0;
    let overtimeHours = 0;
    const dailyBreakdown = [];

    // Handle month boundary crossing (e.g., week spans across two months)
    for (let day = startDay; day <= endDay; day++) {
        const dayIndex = day - 1; // Array is 0-indexed
        if (dayIndex < attendanceArray.length) {
            const attendance = attendanceArray[dayIndex];
            const parsed = parseAttendance(attendance);
            
            if (parsed.isPresent) {
                daysPresent++;
                overtimeHours += parsed.overtimeHours;
            }

            dailyBreakdown.push({
                day: day,
                attendance: attendance || '-',  // Use '-' for unmarked attendance
                isPresent: parsed.isPresent,
                overtimeHours: parsed.overtimeHours
            });
        }
    }

    // Calculate overtime days based on calculation type
    let overtimeDays;
    if (calculationType === 'special') {
        // Special calculation: floor(OT/8) + (OT%8)/10
        const fullDays = Math.floor(overtimeHours / 8);
        const remainingHours = overtimeHours % 8;
        overtimeDays = fullDays + (remainingHours / 10);
    } else {
        // Default calculation: OT/8
        overtimeDays = overtimeHours / 8;
    }

    return {
        daysPresent,
        overtimeHours,
        overtimeDays,
        totalAttendance: daysPresent + overtimeDays,
        dailyBreakdown
    };
}

/**
 * Fetch weekly employee data with calculations
 * @param {string} siteID - Site identifier
 * @param {Object} dateRange - Date range object
 * @param {string} calculationType - Calculation type
 * @returns {Array} Employee data with weekly calculations
 */
async function fetchWeeklyEmployeeData(siteID, dateRange, calculationType = 'default') {
    try {
        const { startDate, endDate, month, year, startDay, endDay } = dateRange;

        // Fetch all employees for the current month
        const employees = await employeeSchema.find({
            siteID: new mongoose.Types.ObjectId(siteID),
            month: month,
            year: year
        }).lean();

        const weeklyData = [];

        for (const emp of employees) {
            // Calculate weekly attendance
            const weeklyAttendance = calculateWeeklyAttendance(
                emp.attendance || [],
                startDay,
                endDay,
                calculationType
            );

            // Calculate weekly wage
            const weeklyWage = emp.rate * weeklyAttendance.totalAttendance;

            // Filter payouts for the week
            const weeklyPayouts = (emp.payouts || []).filter(payout => {
                const payoutDate = new Date(payout.date);
                return payoutDate >= startDate && payoutDate <= endDate;
            });
            const totalWeeklyAdvances = weeklyPayouts.reduce((sum, p) => sum + (p.value || 0), 0);

            // Filter additional payments for the week (DEPRECATED - bonus not used)
            const weeklyAdditionalPays = (emp.additional_req_pays || []).filter(pay => {
                const payDate = new Date(pay.date);
                return payDate >= startDate && payDate <= endDate;
            });
            const totalWeeklyBonus = 0; // Bonus deprecated - always 0

            // Calculate monthly totals for comparison
            const monthlyDaysPresent = emp.attendance.filter(att => {
                const parsed = parseAttendance(att);
                return parsed.isPresent;
            }).length;

            const monthlyOvertimeHours = emp.attendance.reduce((sum, att) => {
                const parsed = parseAttendance(att);
                return sum + parsed.overtimeHours;
            }, 0);

            weeklyData.push({
                _id: emp._id,
                empid: emp.empid,
                name: emp.name,
                rate: emp.rate,
                
                // Weekly data
                weekly: {
                    daysPresent: weeklyAttendance.daysPresent,
                    overtimeHours: weeklyAttendance.overtimeHours,
                    overtimeDays: weeklyAttendance.overtimeDays,
                    totalAttendance: weeklyAttendance.totalAttendance,
                    wage: weeklyWage,
                    advances: totalWeeklyAdvances,
                    bonus: totalWeeklyBonus, // Deprecated - always 0
                    netPayment: weeklyWage - totalWeeklyAdvances, // Removed bonus
                    dailyBreakdown: weeklyAttendance.dailyBreakdown,
                    payouts: weeklyPayouts,
                    additionalPays: weeklyAdditionalPays
                },
                
                // Monthly data for reference
                monthly: {
                    daysPresent: monthlyDaysPresent,
                    overtimeHours: monthlyOvertimeHours,
                    wage: emp.wage,
                    totalAdvances: (emp.payouts || []).reduce((sum, p) => sum + (p.value || 0), 0),
                    totalBonus: 0, // Deprecated - always 0
                    closingBalance: emp.closing_balance,
                    carryForward: emp.carry_forwarded?.value || 0
                }
            });
        }

        return weeklyData;
    } catch (error) {
        console.error('❌ Error fetching weekly employee data:', error);
        throw error;
    }
}

/**
 * Fetch weekly site expenses
 * @param {string} siteID - Site identifier
 * @param {Object} dateRange - Date range object
 * @returns {Object} Expenses data with category breakdown
 */
async function fetchWeeklySiteExpenses(siteID, dateRange) {
    try {
        const { startDate, endDate } = dateRange;

        const expenses = await siteExpenseSchema.find({
            siteID: new mongoose.Types.ObjectId(siteID),
            date: {
                $gte: startDate,
                $lte: endDate
            }
        }).lean();

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
        console.error('❌ Error fetching weekly site expenses:', error);
        throw error;
    }
}

/**
 * Fetch monthly site expenses for comparison
 * @param {string} siteID - Site identifier
 * @param {number} month - Month number
 * @param {number} year - Year number
 * @returns {Object} Monthly expenses data
 */
async function fetchMonthlySiteExpenses(siteID, month, year) {
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const expenses = await siteExpenseSchema.find({
            siteID: new mongoose.Types.ObjectId(siteID),
            date: {
                $gte: startDate,
                $lte: endDate
            }
        }).lean();

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
        console.error('❌ Error fetching monthly site expenses:', error);
        throw error;
    }
}

/**
 * Calculate comprehensive weekly metrics
 * @param {Array} employeeData - Weekly employee data
 * @param {Object} expenseData - Weekly expense data
 * @returns {Object} Aggregated metrics
 */
function calculateWeeklyMetrics(employeeData, expenseData) {
    const metrics = {
        employees: {
            total: employeeData.length,
            totalWorkingDays: 0,
            totalOvertimeHours: 0,
            totalWage: 0,
            totalAdvances: 0,
            totalBonus: 0,
            netLabourCost: 0
        },
        site: {
            totalExpenses: expenseData.total,
            expensesByCategory: expenseData.byCategory,
            expenseCount: expenseData.count
        },
        summary: {
            totalCashOutflow: 0,
            labourCost: 0,
            operationalCost: 0
        }
    };

    // Aggregate employee metrics
    employeeData.forEach(emp => {
        metrics.employees.totalWorkingDays += emp.weekly.daysPresent;
        metrics.employees.totalOvertimeHours += emp.weekly.overtimeHours;
        metrics.employees.totalWage += emp.weekly.wage;
        metrics.employees.totalAdvances += emp.weekly.advances;
        metrics.employees.totalBonus += emp.weekly.bonus; // Always 0
        metrics.employees.netLabourCost += emp.weekly.netPayment;
    });

    // Calculate summary (bonus removed from labour cost)
    metrics.summary.labourCost = metrics.employees.totalWage; // Removed bonus
    metrics.summary.operationalCost = expenseData.total;
    metrics.summary.totalCashOutflow = metrics.employees.totalAdvances + expenseData.total;

    return metrics;
}

/**
 * Calculate monthly metrics for comparison
 * @param {Array} employeeData - Employee data with monthly info
 * @param {Object} monthlyExpenses - Monthly expense data
 * @returns {Object} Monthly metrics
 */
function calculateMonthlyMetrics(employeeData, monthlyExpenses) {
    const metrics = {
        employees: {
            total: employeeData.length,
            totalWorkingDays: 0,
            totalOvertimeHours: 0,
            totalWage: 0,
            totalAdvances: 0,
            totalBonus: 0,
            totalClosingBalance: 0
        },
        site: {
            totalExpenses: monthlyExpenses.total,
            expensesByCategory: monthlyExpenses.byCategory
        },
        summary: {
            totalCashOutflow: 0,
            labourCost: 0,
            operationalCost: 0
        }
    };

    // Aggregate employee monthly metrics
    employeeData.forEach(emp => {
        metrics.employees.totalWorkingDays += emp.monthly.daysPresent;
        metrics.employees.totalOvertimeHours += emp.monthly.overtimeHours;
        metrics.employees.totalWage += emp.monthly.wage;
        metrics.employees.totalAdvances += emp.monthly.totalAdvances;
        metrics.employees.totalBonus += emp.monthly.totalBonus; // Always 0
        metrics.employees.totalClosingBalance += emp.monthly.closingBalance;
    });

    // Calculate summary (bonus removed from labour cost)
    metrics.summary.labourCost = metrics.employees.totalWage; // Removed bonus
    metrics.summary.operationalCost = monthlyExpenses.total;
    metrics.summary.totalCashOutflow = metrics.employees.totalAdvances + monthlyExpenses.total;

    return metrics;
}

/**
 * Main function to fetch complete weekly report data
 * @param {string} siteID - Site identifier
 * @param {string} calculationType - Calculation type
 * @returns {Object} Complete weekly report data
 */
async function fetchCompleteWeeklyReportData(siteID, calculationType = 'default') {
    try {
        // Get date range for last 7 days
        const dateRange = getLast7DaysRange();

        // Fetch all required data
        const [employeeData, weeklyExpenses, monthlyExpenses] = await Promise.all([
            fetchWeeklyEmployeeData(siteID, dateRange, calculationType),
            fetchWeeklySiteExpenses(siteID, dateRange),
            fetchMonthlySiteExpenses(siteID, dateRange.month, dateRange.year)
        ]);

        // Calculate metrics
        const weeklyMetrics = calculateWeeklyMetrics(employeeData, weeklyExpenses);
        const monthlyMetrics = calculateMonthlyMetrics(employeeData, monthlyExpenses);

        return {
            dateRange,
            employeeData,
            weeklyExpenses,
            monthlyExpenses,
            weeklyMetrics,
            monthlyMetrics,
            generatedAt: getISTDate(),
            timezone: 'Asia/Kolkata (IST)'
        };
    } catch (error) {
        console.error('❌ Error fetching complete weekly report data:', error);
        throw error;
    }
}

module.exports = {
    getISTDate,
    getLast7DaysRange,
    parseAttendance,
    calculateWeeklyAttendance,
    fetchWeeklyEmployeeData,
    fetchWeeklySiteExpenses,
    fetchMonthlySiteExpenses,
    calculateWeeklyMetrics,
    calculateMonthlyMetrics,
    fetchCompleteWeeklyReportData
};

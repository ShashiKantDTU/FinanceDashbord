const express = require("express");
const mongoose = require("mongoose");
const SiteExpense = require("../models/SiteExpenseSchema");
const SitePayment = require("../models/SitePaymentSchema");
const Employee = require("../models/EmployeeSchema");
const Site = require("../models/Siteschema");
const { authenticateAndTrack } = require("../Middleware/usageTracker");
const { 
    calculateEmployeeData, 
    CorrectAllEmployeeData 
} = require("../Utils/Jobs");
const router = express.Router();

// POST /expenses - Add a new site expense
router.post("/expenses", authenticateAndTrack, async (req, res) => {
    try {
        const { siteID, value, category, date, remark } = req.body;

        // Validate required fields
        if (!siteID || !value || !category || !date) {
            return res.status(400).json({
                success: false,
                error: "siteID, value, category, and date are required fields."
            });
        }

        // Validate value is positive
        if (value <= 0) {
            return res.status(400).json({
                success: false,
                error: "Expense value must be greater than 0."
            });
        }

        // Validate siteID format
        if (!mongoose.Types.ObjectId.isValid(siteID)) {
            return res.status(400).json({
                success: false,
                error: "Invalid siteID format."
            });
        }

        // Check if site exists
        const siteExists = await Site.findById(siteID);
        if (!siteExists) {
            return res.status(404).json({
                success: false,
                error: "Site not found."
            });
        }

        // Get user info from auth middleware
        const createdBy = req.user.name || req.user?.email || "unknown-user";

        // Create new expense
        const newExpense = new SiteExpense({
            siteID: siteID.trim(),
            value: parseFloat(value),
            category: category.trim(),
            date: new Date(date),
            remark: remark ? remark.trim() : "",
            createdBy: createdBy
        });

        const savedExpense = await newExpense.save();

        return res.status(201).json({
            success: true,
            data: savedExpense,
            message: `Site expense of ${value} for ${category} added successfully.`
        });

    } catch (error) {
        console.error("❌ Error adding site expense:", error);
        return res.status(500).json({
            success: false,
            error: "Error adding site expense.",
            message: error.message
        });
    }
});

// POST /payments - Add a new site payment (incoming money)
router.post("/payments", authenticateAndTrack, async (req, res) => {
    try {
        const { siteID, value, date, remark } = req.body;

        // Validate required fields
        if (!siteID || !value || !date) {
            return res.status(400).json({
                success: false,
                error: "siteID, value, and date are required fields."
            });
        }

        // Validate value is positive
        if (value <= 0) {
            return res.status(400).json({
                success: false,
                error: "Payment value must be greater than 0."
            });
        }

        // Validate siteID format
        if (!mongoose.Types.ObjectId.isValid(siteID)) {
            return res.status(400).json({
                success: false,
                error: "Invalid siteID format."
            });
        }

        // Check if site exists
        const siteExists = await Site.findById(siteID);
        if (!siteExists) {
            return res.status(404).json({
                success: false,
                error: "Site not found."
            });
        }

        // Get user info from auth middleware
        const receivedBy = req.user.name || req.user?.email || "unknown-user";

        // Create new payment
        const newPayment = new SitePayment({
            siteID: siteID.trim(),
            value: parseFloat(value),
            date: new Date(date),
            remark: remark ? remark.trim() : "",
            receivedBy: receivedBy
        });

        const savedPayment = await newPayment.save();

        return res.status(201).json({
            success: true,
            data: savedPayment,
            message: `Site payment of ${value} recorded successfully.`
        });

    } catch (error) {
        console.error("❌ Error adding site payment:", error);
        return res.status(500).json({
            success: false,
            error: "Error adding site payment.",
            message: error.message
        });
    }
});

// GET /sites/:siteID/financial-summary - Get comprehensive financial summary
router.get("/sites/:siteID/financial-summary", authenticateAndTrack, async (req, res) => {
    const { siteID } = req.params;
    const { month, year } = req.query;

    const plan = req.user?.plan || 'free';
    if (plan === 'free') {
        return res.status(403).json({
            success: false,
            error: "Access to financial summary is restricted on the free plan. Please upgrade your plan to access this feature."
        });
    }

    // Validate required parameters
    if (!month || !year) {
        return res.status(400).json({
            success: false,
            error: "Month and year are required query parameters."
        });
    }

    // Validate siteID format
    if (!mongoose.Types.ObjectId.isValid(siteID)) {
        return res.status(400).json({
            success: false,
            error: "Invalid siteID format."
        });
    }

    try {
        const siteObjectId = new mongoose.Types.ObjectId(siteID);
        const parsedMonth = parseInt(month);
        const parsedYear = parseInt(year);

        // Validate month and year ranges
        if (parsedMonth < 1 || parsedMonth > 12) {
            return res.status(400).json({
                success: false,
                error: "Month must be between 1 and 12."
            });
        }

        if (parsedYear < 2000 || parsedYear > 2100) {
            return res.status(400).json({
                success: false,
                error: "Year must be between 2000 and 2100."
            });
        }

        // Create date range for the specified month
        const startDate = new Date(parsedYear, parsedMonth - 1, 1);
        const endDate = new Date(parsedYear, parsedMonth, 1);

        // Step 1: Ensure all employee data is up-to-date by triggering recalculation if needed
        // This uses the existing CorrectAllEmployeeData function from Jobs.js
        await CorrectAllEmployeeData(siteID, null, null, null, null, req.user);

        // Step 2: Execute all queries in parallel for maximum efficiency
        const [
            expensesResult,
            paymentsResult,
            expenseBreakdown,
            expenseDetails,
            paymentDetails,
            employees
        ] = await Promise.all([
            // 1. Get Total Expenses from SiteExpenses
            SiteExpense.aggregate([
                { $match: { siteID: siteObjectId, date: { $gte: startDate, $lt: endDate } } },
                { $group: { _id: null, total: { $sum: "$value" } } }
            ]),

            // 2. Get Total Payments from SitePayments
            SitePayment.aggregate([
                { $match: { siteID: siteObjectId, date: { $gte: startDate, $lt: endDate } } },
                { $group: { _id: null, total: { $sum: "$value" } } }
            ]),

            // 3. Get expense breakdown by category
            SiteExpense.aggregate([
                { $match: { siteID: siteObjectId, date: { $gte: startDate, $lt: endDate } } },
                { $group: { _id: "$category", total: { $sum: "$value" }, count: { $sum: 1 } } },
                { $sort: { total: -1 } }
            ]),

            // 4. Get expense details
            SiteExpense.find({
                siteID: siteObjectId,
                date: { $gte: startDate, $lt: endDate }
            }).sort({ date: -1 }),

            // 5. Get recent payments
            SitePayment.find({
                siteID: siteObjectId,
                date: { $gte: startDate, $lt: endDate }
            }).sort({ date: -1 }).limit(10),

            // 6. Get all employees for the month (raw data, will be processed with calculateEmployeeData)
            Employee.find({
                siteID: siteObjectId,
                month: parsedMonth,
                year: parsedYear
            })
        ]);

        // Step 3: Process each employee using the existing calculateEmployeeData function
        // This ensures consistent calculations across all endpoints
        const employeeBreakdown = employees.map(employee => {
            // Use the same calculation function as other endpoints
            const calculated = calculateEmployeeData(employee, req.user);
            const calcData = calculated._calculationData || {};

            // Build employee breakdown object
            return {
                empid: employee.empid,
                name: employee.name,
                label: employee.label || null,
                rate: employee.rate,
                month: employee.month,
                year: employee.year,
                siteID: employee.siteID,
                carry_forwarded: employee.carry_forwarded,
                payouts: (employee.payouts || []).map(p => ({
                    value: p.value,
                    remark: p.remark,
                    date: p.date
                })),
                payoutCount: (employee.payouts || []).length,
                totalAdvances: calcData.totalAdvances || 0,
                totalWage: calculated.wage,
                totalAttendance: calcData.totalAttendance || 0,
                totalDays: calcData.totalDays || 0,
                totalovertime: calcData.totalOvertime || 0,
                overtimeDays: calcData.overtimeDays || 0,
                totalAdditionalReqPays: calcData.totalAdditionalReqPays || 0,
                carryForward: employee.carry_forwarded?.value || 0,
                closing_balance: calculated.closing_balance
            };
        });

        // Sort by totalWage descending
        employeeBreakdown.sort((a, b) => (b.totalWage || 0) - (a.totalWage || 0));

        // Step 4: Calculate summary totals
        const expenses = expensesResult[0]?.total || 0;
        const payments = paymentsResult[0]?.total || 0;
        
        // Sum of all employee advances (payouts)
        const advances = employeeBreakdown.reduce((sum, emp) => sum + (emp.totalAdvances || 0), 0);
        
        // Sum of all employee wages
        const wages = employeeBreakdown.reduce((sum, emp) => sum + (emp.totalWage || 0), 0);
        
        // Total costs = wages + site expenses
        const totalCosts = wages + expenses;
        const finalProfit = payments - totalCosts;

        // Construct the summary object
        const summary = {
            advances,
            expenses,
            payments,
            wages,
            totalCosts,
            finalProfit
        };

        return res.status(200).json({
            success: true,
            data: {
                summary: summary,
                breakdown: {
                    siteExpenses: {
                        categoryBreakdown: expenseBreakdown,
                        expenseDetails: expenseDetails
                    },
                    recentPayments: paymentDetails,
                    employeeCount: employees.length,
                    employeeBreakdown: employeeBreakdown
                },
                metadata: {
                    siteID: siteID,
                    month: parsedMonth,
                    year: parsedYear,
                    dateRange: {
                        start: startDate,
                        end: endDate
                    }
                }
            },
            message: `Financial summary for ${parsedMonth}/${parsedYear} retrieved successfully.`
        });

    } catch (error) {
        console.error("❌ Error in /financial-summary route:", error);
        return res.status(500).json({
            success: false,
            error: "Server error calculating financial summary.",
            message: error.message
        });
    }
});

// GET /sites/:siteID/expenses - Get all expenses for a site with optional date filtering
router.get("/sites/:siteID/expenses", authenticateAndTrack, async (req, res) => {
    const { siteID } = req.params;
    const { month, year, category, limit = 50, page = 1 } = req.query;

    // Validate siteID format
    if (!mongoose.Types.ObjectId.isValid(siteID)) {
        return res.status(400).json({
            success: false,
            error: "Invalid siteID format."
        });
    }

    try {
        const siteObjectId = new mongoose.Types.ObjectId(siteID);
        let query = { siteID: siteObjectId };

        // Add date filtering if month and year are provided
        if (month && year) {
            const parsedMonth = parseInt(month);
            const parsedYear = parseInt(year);
            const startDate = new Date(parsedYear, parsedMonth - 1, 1);
            const endDate = new Date(parsedYear, parsedMonth, 1);
            query.date = { $gte: startDate, $lt: endDate };
        }

        // Add category filtering if provided
        if (category) {
            query.category = category.trim();
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [expenses, totalCount] = await Promise.all([
            SiteExpense.find(query)
                .sort({ date: -1 })
                .limit(parseInt(limit))
                .skip(skip),
            SiteExpense.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            data: {
                expenses: expenses,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalCount: totalCount,
                    hasMore: skip + expenses.length < totalCount
                }
            },
            message: `Retrieved ${expenses.length} expenses.`
        });

    } catch (error) {
        console.error("❌ Error fetching site expenses:", error);
        return res.status(500).json({
            success: false,
            error: "Error fetching site expenses.",
            message: error.message
        });
    }
});

// GET /sites/:siteID/payments - Get all payments for a site with optional date filtering
router.get("/sites/:siteID/payments", authenticateAndTrack, async (req, res) => {
    const { siteID } = req.params;
    const { month, year, limit = 50, page = 1 } = req.query;

    // Validate siteID format
    if (!mongoose.Types.ObjectId.isValid(siteID)) {
        return res.status(400).json({
            success: false,
            error: "Invalid siteID format."
        });
    }

    try {
        const siteObjectId = new mongoose.Types.ObjectId(siteID);
        let query = { siteID: siteObjectId };

        // Add date filtering if month and year are provided
        if (month && year) {
            const parsedMonth = parseInt(month);
            const parsedYear = parseInt(year);
            const startDate = new Date(parsedYear, parsedMonth - 1, 1);
            const endDate = new Date(parsedYear, parsedMonth, 1);
            query.date = { $gte: startDate, $lt: endDate };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [payments, totalCount] = await Promise.all([
            SitePayment.find(query)
                .sort({ date: -1 })
                .limit(parseInt(limit))
                .skip(skip),
            SitePayment.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            data: {
                payments: payments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalCount: totalCount,
                    hasMore: skip + payments.length < totalCount
                }
            },
            message: `Retrieved ${payments.length} payments.`
        });

    } catch (error) {
        console.error("❌ Error fetching site payments:", error);
        return res.status(500).json({
            success: false,
            error: "Error fetching site payments.",
            message: error.message
        });
    }
});

// DELETE /expenses/:expenseID - Delete a specific expense
router.delete("/expenses/:expenseID", authenticateAndTrack, async (req, res) => {
    const { expenseID } = req.params;

    // Validate expenseID format
    if (!mongoose.Types.ObjectId.isValid(expenseID)) {
        return res.status(400).json({
            success: false,
            error: "Invalid expense ID format."
        });
    }

    try {
        const deletedExpense = await SiteExpense.findByIdAndDelete(expenseID);

        if (!deletedExpense) {
            return res.status(404).json({
                success: false,
                error: "Expense not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: deletedExpense,
            message: `Expense of ${deletedExpense.value} for ${deletedExpense.category} deleted successfully.`
        });

    } catch (error) {
        console.error("❌ Error deleting expense:", error);
        return res.status(500).json({
            success: false,
            error: "Error deleting expense.",
            message: error.message
        });
    }
});

// DELETE /payments/:paymentID - Delete a specific payment
router.delete("/payments/:paymentID", authenticateAndTrack, async (req, res) => {
    const { paymentID } = req.params;

    // Validate paymentID format
    if (!mongoose.Types.ObjectId.isValid(paymentID)) {
        return res.status(400).json({
            success: false,
            error: "Invalid payment ID format."
        });
    }

    try {
        const deletedPayment = await SitePayment.findByIdAndDelete(paymentID);

        if (!deletedPayment) {
            return res.status(404).json({
                success: false,
                error: "Payment not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: deletedPayment,
            message: `Payment of ${deletedPayment.value} deleted successfully.`
        });

    } catch (error) {
        console.error("❌ Error deleting payment:", error);
        return res.status(500).json({
            success: false,
            error: "Error deleting payment.",
            message: error.message
        });
    }
});

module.exports = router;
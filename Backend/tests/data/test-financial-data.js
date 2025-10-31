/**
 * Test script to verify financial data fetching functions
 * Run: node test-financial-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import schemas
const SiteExpenseSchema = require("./models/SiteExpenseSchema");
const SitePaymentSchema = require("./models/SitePaymentSchema");
const EmployeeSchema = require("./models/EmployeeSchema");
const SiteSchema = require("./models/Siteschema");

// Import functions from pdfReports (we'll need to export them first)
// For now, we'll duplicate the functions here for testing

/**
 * Fetch site expenses for a specific month
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
 * Main test function
 */
async function testFinancialData() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get a sample site from database
        const site = await SiteSchema.findOne({ isActive: true });
        if (!site) {
            console.log('❌ No active sites found in database');
            return;
        }

        console.log(`📍 Testing with site: ${site.sitename} (ID: ${site._id})\n`);

        // Test with current month and previous month
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        console.log(`📅 Testing Period 1: ${prevMonth}/${prevYear}`);
        console.log('━'.repeat(50));

        // Fetch expenses for previous month
        const expensesData = await fetchSiteExpenses(site._id.toString(), prevMonth, prevYear);
        console.log(`\n💰 Site Expenses:`);
        console.log(`   Total Amount: ₹${expensesData.total.toLocaleString('en-IN')}`);
        console.log(`   Transactions: ${expensesData.count}`);
        
        if (Object.keys(expensesData.byCategory).length > 0) {
            console.log(`\n   Breakdown by Category:`);
            Object.keys(expensesData.byCategory).forEach(category => {
                const catData = expensesData.byCategory[category];
                console.log(`   • ${category}: ₹${catData.total.toLocaleString('en-IN')} (${catData.items.length} items)`);
            });
        }

        // Fetch payments for previous month
        const paymentsData = await fetchSitePayments(site._id.toString(), prevMonth, prevYear);
        console.log(`\n💵 Site Payments Received:`);
        console.log(`   Total Amount: ₹${paymentsData.total.toLocaleString('en-IN')}`);
        console.log(`   Transactions: ${paymentsData.count}`);

        if (paymentsData.count > 0) {
            console.log(`\n   Payment Details:`);
            paymentsData.payments.slice(0, 5).forEach((payment, idx) => {
                console.log(`   ${idx + 1}. ${payment.date.toLocaleDateString()} - ₹${payment.value.toLocaleString('en-IN')} ${payment.remark ? `(${payment.remark})` : ''}`);
            });
            if (paymentsData.count > 5) {
                console.log(`   ... and ${paymentsData.count - 5} more`);
            }
        }

        // Get employee count for context
        const employeeCount = await EmployeeSchema.countDocuments({
            siteID: site._id,
            month: prevMonth,
            year: prevYear
        });

        console.log(`\n👷 Employees: ${employeeCount}`);
        console.log('\n' + '━'.repeat(50));

        // Summary
        console.log(`\n📊 Financial Summary:`);
        const netCash = paymentsData.total - expensesData.total;
        console.log(`   Money In:  ₹${paymentsData.total.toLocaleString('en-IN')}`);
        console.log(`   Expenses:  ₹${expensesData.total.toLocaleString('en-IN')}`);
        console.log(`   Net Flow:  ₹${netCash.toLocaleString('en-IN')} ${netCash >= 0 ? '✅' : '⚠️'}`);

        console.log('\n✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run test
testFinancialData();

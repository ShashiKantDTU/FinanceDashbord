// Test file for the new report sending functions
require('dotenv').config();
const mongoose = require('mongoose');
const { sendMonthlyReport, sendWeeklyReport } = require('../scripts/whatsappReport');

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/finance-dashboard';

async function connectToDatabase() {
    try {
        await mongoose.connect(mongoURI);
        return true;
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        return false;
    }
}

// Real user object from MongoDB (based on your actual data)
const testUser = {
    "_id": {
        "$oid": "685ea4b3d1d66ef1033d6782"
    },
    "name": "Sunny Poddar",
    "email": "sunnypoddar1919@gmail.com",
    "password": "$2b$10$49bNgPSn..JQje8FNRKb/uOyWVEhZ6gP5t0m/7ExDaFXjPvGvpBYS",
    "resetPasswordToken": null,
    "resetPasswordExpires": null,
    "site": [
        {
            "$oid": "6870f208c36ebbb9064d6649"
        },
        {
            "$oid": "6871231a89ce2f1a46adeb4f"
        }
    ],
    "createdAt": {
        "$date": "2025-06-27T14:03:31.576Z"
    },
    "updatedAt": {
        "$date": "2025-08-26T21:42:15.234Z"
    },
    "__v": 30,
    "phoneNumber": "+919354739451", // ✅ Will be converted to 919354739451 for WhatsApp API
    "supervisors": [
        {
            "$oid": "689102352c61559aba3dc144"
        },
        {
            "$oid": "689102412c61559aba3dc14c"
        }
    ],
    "plan": "free",
    "isPaymentVerified": false,
    "isTrial": false,
    "planHistory": [],
    "billing_cycle": "monthly",
    "graceExpiresAt": null,
    "isCancelled": false,
    "isGrace": false,
    "lastPurchaseToken": "kfjihkohmlbhkikhhejanplb.AO-J1Oxftq2uRYZHOzvdkTzF6Yvvy7Jr-66nZBEvsiC1peMy-qSVYXoziV-IJSi3oHzUCQqdHemtQFiRZ5rcnqraiOP10O-iCw",
    "planExpiresAt": null,
    "planSource": null,
    "purchaseToken": null,
    "planActivatedAt": {
        "$date": "2025-08-23T14:30:01.263Z"
    },
    "lastSiteUpdated": {
        "$date": "2025-08-26T21:42:15.233Z"
    }
};

// Test parameters (using real site ID from user's sites array)
const testSiteId = "68ee282b41993bb4a9485e06"; // First site from user's sites array
const testMonth = 10; // October
const testYear = 2025;
const testWeek = 2; // Week 2 of the month

async function testMonthlyReport() {
    console.log("🧪 Testing Monthly Report Function...\n");

    // Connect to database first
    const connected = await connectToDatabase();
    if (!connected) {
        console.error("❌ Failed to connect to database. Aborting test.");
        return;
    }

    try {
        const result = await sendMonthlyReport(testUser, testSiteId, testMonth, testYear);
        console.log("Monthly Report Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Monthly Report Test Failed:", error.message);
    } finally {
        // Close database connection
        await mongoose.connection.close();
    }

    console.log("\n" + "=".repeat(50) + "\n");
}

async function testWeeklyReport() {
    console.log("🧪 Testing Weekly Report Function (PDF + Excel)...\n");

    // Connect to database first
    const connected = await connectToDatabase();
    if (!connected) {
        console.error("❌ Failed to connect to database. Aborting test.");
        return;
    }

    try {
        const result = await sendWeeklyReport(testUser, testSiteId, testMonth, testYear, testWeek);
        console.log("Weekly Report Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Weekly Report Test Failed:", error.message);
    } finally {
        // Close database connection
        await mongoose.connection.close();
    }

    console.log("\n" + "=".repeat(50) + "\n");
}



async function testInvalidParameters() {
    console.log("🧪 Testing Invalid Parameters...\n");

    // Connect to database first
    const connected = await connectToDatabase();
    if (!connected) {
        console.error("❌ Failed to connect to database. Aborting test.");
        return;
    }

    try {
        // Test with invalid user object
        try {
            const result = await sendMonthlyReport(null, testSiteId, testMonth, testYear);
            console.log("Invalid User Test Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Invalid User Test:", error.message);
        }

        // Test with invalid month
        try {
            const result = await sendWeeklyReport(testUser, testSiteId, 13, testYear, testWeek);
            console.log("Invalid Month Test Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Invalid Month Test:", error.message);
        }
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log("🔌 Database connection closed");
    }

    console.log("\n" + "=".repeat(50) + "\n");
}

async function runAllTests() {
    console.log("🚀 Starting Report Function Tests...\n");
    console.log("=".repeat(50));

    // Connect to database once for all tests
    const connected = await connectToDatabase();
    if (!connected) {
        console.error("❌ Failed to connect to database. Aborting all tests.");
        return;
    }

    try {
        // Test monthly report (without individual connection)
        console.log("🧪 Testing Monthly Report Function...\n");
        try {
            const result = await sendMonthlyReport(testUser, testSiteId, testMonth, testYear);
            console.log("Monthly Report Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Monthly Report Test Failed:", error.message);
        }
        console.log("\n" + "=".repeat(50) + "\n");

        // Test weekly report (without individual connection)
        console.log("🧪 Testing Weekly Report Function...\n");
        try {
            const result = await sendWeeklyReport(testUser, testSiteId, testMonth, testYear, testWeek);
            console.log("Weekly Report Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Weekly Report Test Failed:", error.message);
        }
        console.log("\n" + "=".repeat(50) + "\n");

        // Test invalid parameters (without individual connection)
        console.log("🧪 Testing Invalid Parameters...\n");
        try {
            const result = await sendMonthlyReport(null, testSiteId, testMonth, testYear);
            console.log("Invalid User Test Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Invalid User Test:", error.message);
        }

        try {
            const result = await sendWeeklyReport(testUser, testSiteId, 13, testYear, testWeek);
            console.log("Invalid Month Test Result:", JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Invalid Month Test:", error.message);
        }
        console.log("\n" + "=".repeat(50) + "\n");

    } finally {
        // Close database connection
        await mongoose.connection.close();
    }

    console.log("✅ All tests completed!");
}

// Uncomment the line below to run the tests
// runAllTests();

// Export for manual testing
module.exports = {
    testUser,
    testSiteId,
    testMonth,
    testYear,
    testWeek,
    runAllTests,
    testMonthlyReport,
    testWeeklyReport,
    testInvalidParameters
};

// Usage examples:
console.log(`
📋 USAGE EXAMPLES:

1. Send Monthly Report:
   const result = await sendMonthlyReport(userObject, "SITE001", 12, 2024);

2. Send Weekly Report:
   const result = await sendWeeklyReport(userObject, "SITE001", 12, 2024, 2);

3. Run Tests:
   node Backend/test-report-functions.js
   
4. Manual Testing in Node REPL:
   const { sendMonthlyReport, sendWeeklyReport } = require('./scripts/whatsappReport');
   // Then call the functions with your test data

⚠️  IMPORTANT:
- Make sure your .env file has all required Meta WhatsApp API credentials
- The functions will use the same PDF generation as monthly reports for now
- Week parameter (1-4) represents weeks within the month
`);
const fs = require('fs');
const mongoose = require('mongoose');

// MongoDB Connection
const MONGODB_URI = 'mongodb://localhost:27017/finance-dashboard';

// Configuration
const SITE_ID = "6870f208c36ebbb9064d6649";
const CREATED_BY = "sunnypoddar1919@gmail.com";
const START_DATE = new Date(2024, 5, 1); // June 2024
const END_DATE = new Date(2025, 6, 29); // July 29, 2025

// Employee Schema Definition
const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    empid: {
        type: String,
        required: true,
        trim: true
    },
    rate: {
        type: Number,
        required: true,
        min: 0
    },
    month: {
        type: Number,
        required: true,
    },
    year: {
        type: Number,
        required: true,
        min: 2000,
        max: new Date().getFullYear() + 1
    },
    siteID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Site',
        required: true
    },
    payouts: [{
        value: {
            type: Number,
        },
        remark: {
            type: String,
        },
        date: {
            type: Date,
        },
        createdBy: {
            type: String,
            required: true
        }
    }],
    wage: {
        type: Number,
        required: true,
        min: 0
    },
    additional_req_pays: [{
        value: {
            type: Number,
            required: true,
            min: 0
        },
        remark: {
            type: String,
            required: true,
            trim: true
        },
        date: {
            type: Date,
            default: Date.now
        }
    }],
    attendance: [String],
    closing_balance: {
        type: Number,
        default: 0
    },
    carry_forwarded: {
        value: {
            type: Number,
            default: 0
        },
        remark: {
            type: String,
            default: ''
        },
        date: {
            type: Date,
            default: Date.now
        }
    },
    createdBy: {
        type: String,
        required: true
    },    attendanceHistory: {
        type: Map,
        of: {
            attendance: [String],
            updated_by: String
        },
        default: {}
    },
    recalculationneeded: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Create compound unique index
employeeSchema.index({ empid: 1, month: 1, year: 1 }, { unique: true });

const Employee = mongoose.model('Employee', employeeSchema);

// Helper function to get number of days in a month
function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

// Helper function to generate random attendance for a month
function generateAttendance(year, month) {
    const daysInMonth = getDaysInMonth(year, month);
    const attendance = [];
    
    // Add employee variation - different attendance patterns
    const employeeReliability = Math.random();
    let baseAttendanceRate;
    
    if (employeeReliability < 0.2) {
        baseAttendanceRate = 0.7; // 20% are irregular workers (70% attendance)
    } else if (employeeReliability < 0.6) {
        baseAttendanceRate = 0.85; // 40% are average workers (85% attendance)
    } else if (employeeReliability < 0.9) {
        baseAttendanceRate = 0.95; // 30% are regular workers (95% attendance)
    } else {
        baseAttendanceRate = 0.98; // 10% are very reliable workers (98% attendance)
    }
    
    // Some employees are more likely to do overtime
    const overtimeWorker = Math.random() < 0.3; // 30% are overtime workers
    
    for (let day = 1; day <= daysInMonth; day++) {
        const isPresent = Math.random() < baseAttendanceRate;
        
        if (isPresent) {
            let overtimeHours = 0;
            
            if (overtimeWorker) {
                // Overtime workers do overtime 40% of their working days
                if (Math.random() < 0.4) {
                    overtimeHours = Math.floor(Math.random() * 8) + 1; // 1-8 hours
                }
            } else {
                // Regular workers do overtime only 10% of their working days
                if (Math.random() < 0.1) {
                    overtimeHours = Math.floor(Math.random() * 4) + 1; // 1-4 hours
                }
            }
            
            attendance.push(overtimeHours > 0 ? `P${overtimeHours}` : "P");
        } else {
            // Even when absent, very rarely might do some work (emergency calls)
            const emergencyWork = Math.random() < 0.05; // 5% chance
            if (emergencyWork) {
                const emergencyHours = Math.floor(Math.random() * 4) + 1; // 1-4 hours
                attendance.push(`A${emergencyHours}`);
            } else {
                attendance.push("A");
            }
        }
    }
    
    return attendance;
}

// Helper function to generate random additional required payments
function generateAdditionalReqPays() {
    const payments = [];
    
    // Add variation - some employees get more benefits than others
    const employeeType = Math.random();
    let numPayments;
    
    if (employeeType < 0.4) {
        numPayments = 0; // 40% get no additional payments
    } else if (employeeType < 0.7) {
        numPayments = 1; // 30% get 1 additional payment
    } else if (employeeType < 0.9) {
        numPayments = 2; // 20% get 2 additional payments
    } else {
        numPayments = 3; // 10% get 3 additional payments (senior employees)
    }
    
    const paymentTypes = [
        { name: "Transport allowance", min: 300, max: 800 },
        { name: "Food allowance", min: 200, max: 600 },
        { name: "Night shift bonus", min: 500, max: 1200 },
        { name: "Performance bonus", min: 800, max: 2000 },
        { name: "Overtime bonus", min: 400, max: 1000 },
        { name: "Festival bonus", min: 1000, max: 3000 },
        { name: "Attendance bonus", min: 300, max: 700 },
        { name: "Skill bonus", min: 600, max: 1500 },
        { name: "Safety bonus", min: 200, max: 500 }
    ];
    
    // Shuffle payment types to add randomness
    const shuffledTypes = paymentTypes.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numPayments; i++) {
        const paymentType = shuffledTypes[i];
        const amount = Math.floor(Math.random() * (paymentType.max - paymentType.min + 1)) + paymentType.min;
        
        payments.push({
            value: amount,
            remark: paymentType.name,
            date: new Date(2024 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
        });
    }
    
    return payments;
}

// Helper function to generate realistic payouts based on estimated monthly earnings
function generatePayouts(estimatedMonthlyWage, additionalPayments = 0) {
    const payouts = [];
    const totalEarnings = estimatedMonthlyWage + additionalPayments;
    
    // Ensure minimum earnings for calculation
    const minimumMonthlyEarnings = 3000;
    const baseEarnings = Math.max(totalEarnings, minimumMonthlyEarnings);
    
    // Create realistic payout scenarios
    const payoutScenario = Math.random();
    let payoutPercentage;
    let numPayouts;
    
    if (payoutScenario < 0.15) {
        // 15% - Employee gets overpaid (advance from next month)
        payoutPercentage = Math.random() * 0.4 + 1.1; // 110-150% of earnings
        numPayouts = Math.floor(Math.random() * 2) + 3; // 3-4 payments
    } else if (payoutScenario < 0.35) {
        // 20% - Employee gets paid almost full amount
        payoutPercentage = Math.random() * 0.15 + 0.85; // 85-100% of earnings
        numPayouts = Math.floor(Math.random() * 2) + 2; // 2-3 payments
    } else if (payoutScenario < 0.55) {
        // 20% - Employee gets paid more than earned (but less than overpaid)
        payoutPercentage = Math.random() * 0.2 + 1.0; // 100-120% of earnings
        numPayouts = Math.floor(Math.random() * 3) + 2; // 2-4 payments
    } else if (payoutScenario < 0.75) {
        // 20% - Employee gets moderate advances
        payoutPercentage = Math.random() * 0.25 + 0.65; // 65-90% of earnings
        numPayouts = Math.floor(Math.random() * 2) + 2; // 2-3 payments
    } else {
        // 25% - Employee gets minimal advances (saving up)
        payoutPercentage = Math.random() * 0.25 + 0.4; // 40-65% of earnings
        numPayouts = Math.floor(Math.random() * 2) + 2; // 2-3 payments
    }
    
    const totalPayouts = Math.floor(baseEarnings * payoutPercentage);
    
    // Generate payment amounts with variation
    const payments = [];
    let remainingAmount = totalPayouts;
    
    for (let i = 0; i < numPayouts; i++) {
        let paymentAmount;
        
        if (i === numPayouts - 1) {
            // Last payment gets remaining amount
            paymentAmount = Math.max(500, remainingAmount);
        } else {
            // Distribute payments with variation
            const percentage = Math.random() * 0.4 + 0.2; // 20-60% of remaining
            paymentAmount = Math.floor(remainingAmount * percentage);
            paymentAmount = Math.max(500, paymentAmount);
        }
        
        remainingAmount -= paymentAmount;
        payments.push(paymentAmount);
    }
    
    // Create payout objects with varied dates and remarks
    const remarks = [
        "Weekly salary advance",
        "Bi-weekly payment", 
        "Emergency advance",
        "Festival advance",
        "Monthly advance",
        "Salary payment",
        "Partial salary",
        "Advance payment",
        "Weekly advance",
        "Mid-month payment",
        "Overtime advance",
        "Extra advance",
        "Full month advance"
    ];
    
    for (let i = 0; i < payments.length; i++) {
        // Generate dates spread throughout the month
        const dayOfMonth = Math.floor((30 / numPayouts) * i) + Math.floor(Math.random() * 7) + 1;
        const paymentDay = Math.min(28, Math.max(1, dayOfMonth));
        
        payouts.push({
            value: payments[i],
            remark: remarks[Math.floor(Math.random() * remarks.length)],
            date: new Date(2024 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), paymentDay),
            createdBy: CREATED_BY
        });
    }
    
    return payouts;
}

// Employee names for variety
const employeeNames = [
    "Rajesh Kumar",
    "Priya Sharma",
    "Amit Patel",
    "Sunita Singh",
    "Vikash Yadav",
    "Meera Gupta",
    "Rohit Verma",
    "Kavita Joshi",
    "Deepak Mishra",
    "Pooja Agarwal",
    "Suresh Pandey",
    "Anjali Tiwari",
    "Manoj Kumar",
    "Rekha Devi",
    "Santosh Rai",
    "Geeta Kumari",
    "Dinesh Singh",
    "Kiran Patel",
    "Ramesh Gupta",
    "Sita Sharma",
    "Arjun Singh",
    "Nisha Patel",
    "Ravi Sharma",
    "Seema Gupta",
    "Manish Verma",
    "Shreya Joshi",
    "Anil Kumar",
    "Poonam Singh",
    "Vikas Mishra",
    "Neha Agarwal"
];

// Generate employees data
function generateEmployeesData() {
    const employees = [];
    const numEmployees = 20; // Generate 20 employees
    
    for (let i = 0; i < numEmployees; i++) {        const empId = `EMP${String(i + 1).padStart(3, '0')}`; // Changed to 3 digits for better formatting
        const name = employeeNames[i % employeeNames.length]; // Use modulo to cycle through names if needed
        const rate = Math.floor(Math.random() * 351) + 550; // 550-900 daily rate
        
        // Generate data for each month from June 2024 to May 2025
        const currentDate = new Date(START_DATE);
        const endDate = new Date(END_DATE);
          while (currentDate <= endDate) {
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            
            // Generate attendance for this month
            const attendance = generateAttendance(year, month);
              // Calculate estimated monthly wage for realistic payouts
            // Count present days and overtime from attendance
            let presentDays = 0;
            let overtimeHours = 0;
            
            attendance.forEach(att => {
                if (att.includes('P')) {
                    presentDays += 1;
                    const overtimeMatch = att.match(/P(\d+)/);
                    if (overtimeMatch) {
                        overtimeHours += parseInt(overtimeMatch[1]);
                    }
                } else if (att.includes('A')) {
                    // Check for work done even when marked absent
                    const workMatch = att.match(/A(\d+)/);
                    if (workMatch) {
                        overtimeHours += parseInt(workMatch[1]);
                    }
                }
            });
            
            // Calculate estimated wage properly
            // Base wage = rate * present days (8 hours each)
            const baseWage = rate * presentDays;
            
            // Overtime wage = rate * (overtime hours / 8) 
            // Assuming overtime is paid at same rate as regular hours
            const overtimeWage = rate * (overtimeHours / 8);
            
            const estimatedMonthlyWage = Math.floor(baseWage + overtimeWage);
            
            // Generate additional payments
            const additionalPayments = generateAdditionalReqPays();
            const totalAdditionalAmount = additionalPayments.reduce((sum, pay) => sum + pay.value, 0);
            
            const employee = {
                name: name,
                empid: empId,
                rate: rate,
                month: month + 1, // MongoDB months are 1-indexed
                year: year,
                siteID: SITE_ID,
                payouts: generatePayouts(estimatedMonthlyWage, totalAdditionalAmount),
                wage: 0, // Will be calculated by backend
                additional_req_pays: additionalPayments,
                attendance: attendance,
                closing_balance: 0, // Will be calculated by backend
                carry_forwarded: {
                    value: 0,
                    remark: '',
                    date: new Date()
                },
                createdBy: CREATED_BY,
                attendanceHistory: {},
                recalculationneeded: true // Set to true for all records
            };
            
            employees.push(employee);
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        // Reset date for next employee
        currentDate.setTime(START_DATE.getTime());
    }
    
    return employees;
}

// Main function to connect to MongoDB and insert data
async function insertDataToMongoDB() {
    try {
        // Connect to MongoDB
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB successfully!");

        // Generate the data
        console.log("Generating dummy employee data...");
        const employeesData = generateEmployeesData();

        // Clear existing data (optional - remove if you want to keep existing data)
        // console.log("Clearing existing employee data...");
        // await Employee.deleteMany({});
        // console.log("✅ Existing data cleared!");

        // Insert data in batches for better performance
        console.log("Inserting employee data to MongoDB...");
        const batchSize = 30;
        let insertedCount = 0;

        for (let i = 0; i < employeesData.length; i += batchSize) {
            const batch = employeesData.slice(i, i + batchSize);
            await Employee.insertMany(batch);
            insertedCount += batch.length;
            console.log(`📊 Inserted ${insertedCount}/${employeesData.length} records...`);
        }

        console.log(`\n🎉 Successfully inserted ${employeesData.length} employee records!`);
        console.log(`📊 Period: June 2024 to May 29, 2025`);
        console.log(`🏢 Site ID: ${SITE_ID}`);
        console.log(`👤 Created by: ${CREATED_BY}`);

        // Optional: Create JSON backup files
        const jsonLines = employeesData.map(employee => JSON.stringify(employee)).join('\n');
        fs.writeFileSync('employee_dummy_data_backup.json', jsonLines);
        
        const outputData = {
            employees: employeesData,
            metadata: {
                total_records: employeesData.length,
                generated_on: new Date().toISOString(),
                period: "June 2024 to May 2025",
                site_id: SITE_ID,
                created_by: CREATED_BY
            }
        };
        fs.writeFileSync('employee_dummy_data_readable_backup.json', JSON.stringify(outputData, null, 2));
        console.log(`📄 Backup files created: employee_dummy_data_backup.json & employee_dummy_data_readable_backup.json`);

        // Verify insertion
        const count = await Employee.countDocuments({});
        console.log(`\n� Total employee records in database: ${count}`);

        // Show sample of inserted data
        const sampleEmployee = await Employee.findOne().lean();
        console.log('\n📋 Sample Employee Record from Database:');
        console.log(JSON.stringify(sampleEmployee, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('\n🔐 MongoDB connection closed.');
    }
}

// Run the script
insertDataToMongoDB();
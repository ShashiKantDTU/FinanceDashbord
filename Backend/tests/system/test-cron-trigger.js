/**
 * Simple test script to manually trigger cron jobs
 * Usage: node Backend/test-cron-trigger.js [job-name]
 * 
 * Available jobs:
 * - week1: Weekly Report Week 1 (Days 1-7)
 * - week2: Weekly Report Week 2 (Days 8-14)
 * - week3: Weekly Report Week 3 (Days 15-21)
 * - week4: Weekly Report Week 4 (Days 22-28+)
 * - monthly: Monthly Report (previous month)
 * - all-weekly: All 4 weekly reports
 */

require('dotenv').config();
const mongoose = require('mongoose');
const cronJobService = require('./services/cronJobs');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Main test function
const runTest = async (jobName) => {
    await connectDB();
    console.log('\n' + '='.repeat(60));
    console.log('🧪 CRON JOB TEST - Manual Trigger');
    console.log('='.repeat(60));
    console.log(`📅 Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`🎯 Job: ${jobName}`);
    console.log('='.repeat(60) + '\n');

    try {
        switch (jobName.toLowerCase()) {
            case 'week1':
                console.log('🚀 Triggering Weekly Report Week 1 (Days 1-7)...\n');
                await cronJobService.manualTriggerWeeklyReportWeek1();
                break;

            case 'week2':
                console.log('🚀 Triggering Weekly Report Week 2 (Days 8-14)...\n');
                await cronJobService.manualTriggerWeeklyReportWeek2();
                break;

            case 'week3':
                console.log('🚀 Triggering Weekly Report Week 3 (Days 15-21)...\n');
                await cronJobService.manualTriggerWeeklyReportWeek3();
                break;

            case 'week4':
                console.log('🚀 Triggering Weekly Report Week 4 (Days 22-28+)...\n');
                await cronJobService.manualTriggerWeeklyReportWeek4();
                break;

            case 'monthly':
                console.log('🚀 Triggering Monthly Report (previous month)...\n');
                await cronJobService.manualTriggerMonthlyReport();
                break;

            case 'all-weekly':
                console.log('🚀 Triggering ALL Weekly Reports...\n');
                
                console.log('\n📊 Week 1 (Days 1-7):');
                await cronJobService.manualTriggerWeeklyReportWeek1();
                await sleep(2000);
                
                console.log('\n📊 Week 2 (Days 8-14):');
                await cronJobService.manualTriggerWeeklyReportWeek2();
                await sleep(2000);
                
                console.log('\n📊 Week 3 (Days 15-21):');
                await cronJobService.manualTriggerWeeklyReportWeek3();
                await sleep(2000);
                
                console.log('\n📊 Week 4 (Days 22-28+):');
                await cronJobService.manualTriggerWeeklyReportWeek4();
                break;

            default:
                console.error('❌ Invalid job name. Available options:');
                console.log('   - week1: Weekly Report Week 1');
                console.log('   - week2: Weekly Report Week 2');
                console.log('   - week3: Weekly Report Week 3');
                console.log('   - week4: Weekly Report Week 4');
                console.log('   - monthly: Monthly Report');
                console.log('   - all-weekly: All 4 weekly reports');
                process.exit(1);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ TEST FAILED');
        console.error('='.repeat(60));
        console.error('Error:', error.message);
        console.error('\nStack trace:', error.stack);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('\n✅ MongoDB connection closed');
        process.exit(0);
    }
};

// Helper function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Get job name from command line argument
const jobName = process.argv[2];

if (!jobName) {
    console.error('❌ Please provide a job name');
    console.log('\nUsage: node Backend/test-cron-trigger.js [job-name]\n');
    console.log('Available jobs:');
    console.log('  week1     - Weekly Report Week 1 (Days 1-7)');
    console.log('  week2     - Weekly Report Week 2 (Days 8-14)');
    console.log('  week3     - Weekly Report Week 3 (Days 15-21)');
    console.log('  week4     - Weekly Report Week 4 (Days 22-28+)');
    console.log('  monthly   - Monthly Report (previous month)');
    console.log('  all-weekly - All 4 weekly reports\n');
    console.log('Examples:');
    console.log('  node Backend/test-cron-trigger.js week1');
    console.log('  node Backend/test-cron-trigger.js monthly');
    console.log('  node Backend/test-cron-trigger.js all-weekly\n');
    process.exit(1);
}

// Run the test
runTest(jobName);

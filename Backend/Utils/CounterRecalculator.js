/**
 * Counter Recalculator - Self-Healing Cron Job
 * 
 * Fixes any drift in cached employee counters using a "Chained" algorithm:
 * 1. Fix Sites (source of truth: Employees)
 * 2. Fix Users (source of truth: corrected Sites)
 * 
 * This approach is optimized because Step 2 only touches the small Sites collection,
 * not the potentially large Employees collection.
 * 
 * Schedule: Sunday 4 AM IST (0 4 * * 0)
 */

const Site = require('../models/Siteschema');
const User = require('../models/Userschema');
const Employee = require('../models/EmployeeSchema');
const CronJobLog = require('../models/CronJobLogSchema');

/**
 * Recalculates all cached employee counters for Sites and Users.
 * Uses cursor-based streaming and bulkWrite for efficiency.
 * 
 * @returns {Promise<{success: boolean, sitesUpdated: number, usersUpdated: number}>}
 */
const recalculateCounters = async () => {
    console.time('⏱️ CounterRecalculation');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let sitesUpdated = 0;
    let usersUpdated = 0;

    try {
        // ==========================================
        // STEP 1: FIX SITES (Source of Truth: Employees)
        // ==========================================
        
        // A. Get the Real Counts from Employees for current month
        const employeeCounts = await Employee.aggregate([
            { $match: { month: currentMonth, year: currentYear } },
            { $group: { _id: "$siteID", count: { $sum: 1 } } }
        ]);
        
        // Convert array to Map for O(1) lookup: { "siteId_string": 5 }
        const empCountMap = new Map(employeeCounts.map(e => [String(e._id), e.count]));

        // B. Stream ALL Sites to find discrepancies
        // .cursor() automatically batches data, keeping memory low
        const siteCursor = Site.find({}).cursor(); 
        let siteOps = [];

        for await (const site of siteCursor) {
            const realCount = empCountMap.get(String(site._id)) || 0;
            const cachedCount = site.stats?.employeeCount || 0;

            if (realCount !== cachedCount) {
                siteOps.push({
                    updateOne: {
                        filter: { _id: site._id },
                        update: { $set: { "stats.employeeCount": realCount } }
                    }
                });
                sitesUpdated++;
            }

            // Flush batch if too big (e.g., 500 ops)
            if (siteOps.length >= 500) {
                await Site.bulkWrite(siteOps);
                siteOps = [];
            }
        }
        // Flush remaining ops
        if (siteOps.length > 0) await Site.bulkWrite(siteOps);

        // ==========================================
        // STEP 2: FIX USERS (Source of Truth: Sites)
        // ==========================================

        // A. Get Real Counts from Sites (We just fixed them!)
        // Only count Active sites for user totals
        const siteAgg = await Site.aggregate([
             { $match: { isActive: true } }, 
             { $group: { _id: "$owner", total: { $sum: "$stats.employeeCount" } } }
        ]);
        
        const userCountMap = new Map(siteAgg.map(u => [String(u._id), u.total]));

        // B. Stream ALL Users
        const userCursor = User.find({}).cursor();
        let userOps = [];

        for await (const user of userCursor) {
            const realTotal = userCountMap.get(String(user._id)) || 0;
            const cachedTotal = user.stats?.totalActiveLabors || 0;

            if (realTotal !== cachedTotal) {
                userOps.push({
                    updateOne: {
                        filter: { _id: user._id },
                        update: { $set: { "stats.totalActiveLabors": realTotal } }
                    }
                });
                usersUpdated++;
            }

            // Flush batch if too big
            if (userOps.length >= 500) {
                await User.bulkWrite(userOps);
                userOps = [];
            }
        }
        // Flush remaining ops
        if (userOps.length > 0) await User.bulkWrite(userOps);

        // ==========================================
        // STEP 3: LOGGING (Minimalist)
        // ==========================================
        
        console.timeEnd('⏱️ CounterRecalculation');
        console.log(`✅ Counter Sync Complete. Fixed ${sitesUpdated} Sites, ${usersUpdated} Users.`);
        
        // Log to existing CronJobLog collection
        await CronJobLog.create({
            jobName: 'weekly-counter-sync',
            executionDate: now,
            status: 'completed',
            metadata: {
                month: currentMonth,
                year: currentYear,
                sitesDriftFixed: sitesUpdated,
                usersDriftFixed: usersUpdated
            }
        });

        return { success: true, sitesUpdated, usersUpdated };

    } catch (error) {
        console.error("❌ Counter Sync Failed:", error.message);
        
        // Log failure
        await CronJobLog.create({
            jobName: 'weekly-counter-sync',
            executionDate: now,
            status: 'failed',
            failures: [{ error: error.message, timestamp: new Date() }]
        });

        return { success: false, error: error.message };
    }
};

module.exports = { recalculateCounters };

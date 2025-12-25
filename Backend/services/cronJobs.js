const cron = require('node-cron');
const User = require('../models/Userschema');
const { google } = require('googleapis');
const { sendMonthlyReport, sendWeeklyReport } = require('../scripts/whatsappReport');
const siteSchema = require('../models/Siteschema');
const CronJobLog = require('../models/CronJobLogSchema');
const { recalculateCounters, monthlyCounterReset } = require('../Utils/CounterRecalculator');

// Configurable knobs (module-level constants)
const EXPIRED_BATCH_SIZE = 50; // users per batch when processing expired cancellations
const EXPIRED_DELAY_BETWEEN_BATCHES_MS = 1000; // 1s delay between expired batches
const GRACE_BATCH_SIZE = 20; // users per batch for grace checks (Google API limited)
const GRACE_DELAY_BETWEEN_BATCHES_MS = 1500; // 1.5s delay between grace batches
const PROVISIONAL_AGE_MINUTES = 15; // only finalize provisional users older than 15 minutes
const PROVISIONAL_VERIFY_LIMIT = 500; // cap per run to avoid overload

// Import the verification function logic
async function verifyAndroidPurchase(packageName, purchaseToken, requestId = 'cron-job') {
    console.log(`[${requestId}] Verifying purchase: ${purchaseToken?.substring(0, 20)}...`);

    try {
        const serviceAccountCredentials = JSON.parse(process.env.PLAY_BILLING_SERVICE_KEY);
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccountCredentials,
            scopes: ['https://www.googleapis.com/auth/androidpublisher'],
        });

        const androidpublisher = google.androidpublisher({
            version: 'v3',
            auth: auth,
        });

        const response = await androidpublisher.purchases.subscriptionsv2.get({
            packageName: packageName,
            token: purchaseToken,
        });

        // Check for valid subscription states (active or in grace period)
        if (response.data && (response.data.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' || response.data.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD')) {
            const lineItem = response.data.lineItems[0];
            const originalProductId = lineItem.productId;

            // Map product IDs to internal plan names
            let mappedProductId = lineItem.productId;
            if (lineItem.productId === 'pro_monthly') {
                mappedProductId = 'pro';
            } else if (lineItem.productId === 'haazri_automate') {
                mappedProductId = 'premium';
            } else if (lineItem.productId === 'haazri_lite' || lineItem.productId === 'lite_monthly') {
                mappedProductId = 'lite';
            }

            console.log(`[${requestId}] ✅ Verification successful: ${originalProductId} → ${mappedProductId}, expires: ${lineItem.expiryTime}`);

            return {
                success: true,
                productId: mappedProductId,
                originalProductId: originalProductId,
                expires: new Date(lineItem.expiryTime),
                gracePeriodEndTime: lineItem.gracePeriodEndTime ? new Date(lineItem.gracePeriodEndTime) : null,
                subscriptionState: response.data.subscriptionState,
                startTime: response.data.startTime ? new Date(response.data.startTime) : null,
                regionCode: response.data.regionCode || null,
                subscriptionId: response.data.subscriptionId || null
            };
        } else {
            console.log(`[${requestId}] ❌ Subscription not active: ${response.data?.subscriptionState || 'unknown'}`);
            return {
                success: false,
                error: `Subscription is not active. State: ${response.data?.subscriptionState || 'unknown'}`,
                subscriptionState: response.data?.subscriptionState,
                rawResponse: response.data
            };
        }
    } catch (error) {
        console.error(`[${requestId}] ❌ Google API Error:`, error.message);
        if (error.response) {
            console.error(`[${requestId}] Error response:`, error.response.status, error.response.data);
        }

        return {
            success: false,
            error: `Failed to verify purchase with Google: ${error.message}`,
            errorCode: error.code,
            errorStatus: error.response?.status,
            errorData: error.response?.data
        };
    }
}

class CronJobService {
    constructor() {
        this.jobs = new Map();
    }

    // Initialize all cron jobs
    init() {
        console.log('🕐 Initializing cron jobs...');

        // Run expired trial cleanup every 4 hours starting at midnight (12 AM, 4 AM, 8 AM, 12 PM, 4 PM, 8 PM)
        this.scheduleJob('expired-trials-cleanup', '0 */4 * * *', this.handleExpiredTrials.bind(this));

        // Run daily at 3 AM for cancelled and grace period subscription cleanup
        this.scheduleJob('daily-subscription-cleanup', '0 3 * * *', this.runDailyCleanup.bind(this));

        // Safety net: finalize provisional Google Play purchases every 2 hours
        this.scheduleJob('finalize-provisional-google-play', '0 */2 * * *', this.finalizeProvisionalGooglePlay.bind(this));

        // Weekly Report Cron Jobs - Run at 2 AM on specific days
        // Week 1: Day 8 of every month (for days 1-7)
        this.scheduleJob('weekly-report-week1', '0 2 8 * *', this.sendWeeklyReportWeek1.bind(this));

        // Week 2: Day 15 of every month (for days 8-14)
        this.scheduleJob('weekly-report-week2', '0 2 15 * *', this.sendWeeklyReportWeek2.bind(this));

        // Week 3: Day 22 of every month (for days 15-21)
        this.scheduleJob('weekly-report-week3', '0 2 22 * *', this.sendWeeklyReportWeek3.bind(this));

        // Week 4: Day 29 of every month (for days 22-28, with special handling for February)
        this.scheduleJob('weekly-report-week4', '0 2 29 * *', this.sendWeeklyReportWeek4.bind(this));

        // Special: February 28th for non-leap years (backup for Week 4)
        this.scheduleJob('weekly-report-feb28', '0 2 28 2 *', this.sendWeeklyReportFeb28.bind(this));

        // Monthly Report: 1st day of every month at 2 AM (for previous month)
        this.scheduleJob('monthly-report', '0 2 1 * *', this.sendMonthlyReportAll.bind(this));

        // API Call Tracking: Cleanup expired users every 6 hours
        // Note: Actions are executed IMMEDIATELY when threshold is hit (not queued)
        this.scheduleJob('api-tracking-cleanup', '0 */6 * * *', this.cleanupExpiredApiTracking.bind(this));

        // Employee Counter Sync: Sunday at 4 AM IST (Self-healing for Calculate-on-Write)
        // Fixes any drift in cached Site.stats.employeeCount and User.stats.totalActiveLabors
        this.scheduleJob('weekly-counter-sync', '0 4 * * 0', this.syncEmployeeCounters.bind(this));

        // Monthly Counter Reset: 1st day of every month at 12:00 AM (midnight)
        // Resets counters for the new month since employees need to be re-imported
        this.scheduleJob('monthly-counter-reset', '0 0 1 * *', this.monthlyCounterReset.bind(this));

        console.log('✅ All cron jobs initialized');
    }

    // Generic method to schedule a job
    scheduleJob(name, schedule, task) {
        if (this.jobs.has(name)) {
            console.log(`⚠️  Job ${name} already exists, stopping previous instance`);
            this.jobs.get(name).stop();
        }

        const job = cron.schedule(schedule, async () => {
            console.log(`🔄 Running cron job: ${name} at ${new Date().toISOString()}`);
            try {
                await task();
                console.log(`✅ Completed cron job: ${name}`);
            } catch (error) {
                console.error(`❌ Error in cron job ${name}:`, error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata" // Adjust timezone as needed
        });

        this.jobs.set(name, job);
        console.log(`📅 Scheduled job: ${name} with schedule: ${schedule}`);
    }


    // Run all cleanup tasks sequentially (excluding expired trials which run separately)
    async runDailyCleanup() {
        console.log('🧹 Starting daily subscription cleanup...');
        const startTime = Date.now();

        try {
            await this.handleExpiredUsers();
            await this.handleGraceExpiredUsers();
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Daily subscription cleanup completed in ${duration}s`);
        } catch (error) {
            console.error('❌ Daily subscription cleanup failed:', error);
            throw error;
        }
    }

    // Safety net to confirm provisional purchases where webhook may be delayed/missed
    async finalizeProvisionalGooglePlay() {
        console.log('🧯 Running provisional purchase finalizer...');
        try {
            const cutoff = new Date(Date.now() - PROVISIONAL_AGE_MINUTES * 60 * 1000);
            const candidates = await User.find({
                isPaymentVerified: false,
                planSource: 'google_play',
                purchaseToken: { $ne: null },
                updatedAt: { $lt: cutoff }
            }).limit(PROVISIONAL_VERIFY_LIMIT);

            console.log(`🔍 Found ${candidates.length} provisional Google Play users to verify`);

            for (const user of candidates) {
                try {
                    const verificationResult = await verifyAndroidPurchase(
                        'com.sitehaazri.app',
                        user.purchaseToken,
                        `provisional-check-${user._id}`
                    );

                    if (verificationResult.success && (verificationResult.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' || verificationResult.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD')) {
                        const billingCycle = verificationResult.originalProductId.includes('yearly') ? 'yearly' : 'monthly';
                        await User.findByIdAndUpdate(user._id, {
                            $set: {
                                plan: verificationResult.productId,
                                billing_cycle: billingCycle,
                                planExpiresAt: verificationResult.expires,
                                isPaymentVerified: true,
                                planActivatedAt: new Date(),
                                isCancelled: false,
                                isGrace: verificationResult.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
                                graceExpiresAt: verificationResult.gracePeriodEndTime || null
                            }
                        });
                        console.log(`✅ Finalized provisional subscription for ${user.email || user.phoneNumber}`);
                    } else {
                        // If token invalid or expired, downgrade to free to avoid dangling provisional
                        await User.findByIdAndUpdate(user._id, {
                            $set: {
                                plan: 'free',
                                billing_cycle: 'monthly',
                                isPaymentVerified: false,
                                isCancelled: false,
                                isGrace: false,
                                planExpiresAt: null,
                                graceExpiresAt: null,
                                lastPurchaseToken: user.purchaseToken,
                                purchaseToken: null,
                                planSource: null,
                                planActivatedAt: new Date(),
                            }
                        });
                        console.log(`⚠️  Reverted provisional subscription for ${user.email || user.phoneNumber} (not confirmed by Google)`);
                    }
                } catch (innerErr) {
                    console.error(`❌ Error finalizing provisional for ${user._id}:`, innerErr.message);
                }
            }

            console.log('🧯 Provisional finalizer run complete');
        } catch (error) {
            console.error('❌ Provisional finalizer failed:', error.message);
        }
    }

    // Handle users with isTrial: true and planExpiresAt < current date
    async handleExpiredTrials() {
        try {
            const currentDate = new Date();
            const BATCH_SIZE = EXPIRED_BATCH_SIZE; // Same batch size as expired users

            const expiredTrials = await User.find({
                isTrial: true,
                planExpiresAt: { $lt: currentDate }
            });

            console.log(`🔍 Found ${expiredTrials.length} expired trial users`);

            if (expiredTrials.length === 0) {
                return;
            }

            // Process users in batches to avoid server overload
            for (let i = 0; i < expiredTrials.length; i += BATCH_SIZE) {
                const batch = expiredTrials.slice(i, i + BATCH_SIZE);
                console.log(`📦 Processing trial batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(expiredTrials.length / BATCH_SIZE)} (${batch.length} users)`);

                // Process batch concurrently with per-user error isolation
                await Promise.all(
                    batch.map(user => this.processExpiredTrial(user)
                        .catch(err => console.error(`❌ Error processing expired trial ${user._id}:`, err.message)))
                );

                // Add delay between batches if there are more users to process
                if (i + BATCH_SIZE < expiredTrials.length) {
                    console.log(`⏳ Waiting ${EXPIRED_DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, EXPIRED_DELAY_BETWEEN_BATCHES_MS));
                }
            }

        } catch (error) {
            console.error('Error handling expired trials:', error);
            throw error;
        }
    }

    // Process individual expired trial user
    async processExpiredTrial(user) {
        try {
            console.log(`📋 Processing expired trial: ${user.email || user.phoneNumber} (ID: ${user._id})`);

            // Downgrade trial user to free plan and clear all payment-related flags
            await User.findByIdAndUpdate(user._id, {
                $set: {
                    plan: 'free',
                    billing_cycle: 'monthly',
                    isTrial: false,
                    planExpiresAt: null,
                    planSource: null,
                    isPaymentVerified: false,  // CRITICAL FIX: Clear payment verification
                    purchaseToken: null,        // Clear current purchase token
                }
            });

            console.log(`✅ Processed expired trial: ${user.email || user.phoneNumber} - downgraded to free plan`);

        } catch (error) {
            console.error(`❌ Error processing expired trial ${user._id}:`, error);
        }
    }

    // Handle users with isCancelled: true and planExpiresAt < current date
    async handleExpiredUsers() {
        try {
            const currentDate = new Date();
            const BATCH_SIZE = EXPIRED_BATCH_SIZE; // env-configured
            const DELAY_BETWEEN_BATCHES = EXPIRED_DELAY_BETWEEN_BATCHES_MS; // env-configured

            const expiredUsers = await User.find({
                isCancelled: true,
                planExpiresAt: { $lt: currentDate }
            });

            console.log(`🔍 Found ${expiredUsers.length} expired cancelled users`);

            // Process users in batches to avoid server overload
            for (let i = 0; i < expiredUsers.length; i += BATCH_SIZE) {
                const batch = expiredUsers.slice(i, i + BATCH_SIZE);
                console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(expiredUsers.length / BATCH_SIZE)} (${batch.length} users)`);

                // Process batch concurrently with per-user error isolation
                await Promise.all(
                    batch.map(user => this.processExpiredUser(user)
                        .catch(err => console.error(`❌ Error processing expired user ${user._id}:`, err.message)))
                );

                // Add delay between batches if there are more users to process
                if (i + BATCH_SIZE < expiredUsers.length) {
                    console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            }

        } catch (error) {
            console.error('Error handling expired users:', error);
            throw error;
        }
    }

    // Handle users with isGrace: true and graceExpiresAt < current date
    async handleGraceExpiredUsers() {
        try {
            const currentDate = new Date();
            const BATCH_SIZE = GRACE_BATCH_SIZE; // env-configured for API limits
            const DELAY_BETWEEN_BATCHES = GRACE_DELAY_BETWEEN_BATCHES_MS; // env-configured delay

            const graceExpiredUsers = await User.find({
                isGrace: true,
                graceExpiresAt: { $lt: currentDate }
            });

            console.log(`🔍 Found ${graceExpiredUsers.length} grace period expired users`);

            // Process users in smaller batches due to Google API calls
            for (let i = 0; i < graceExpiredUsers.length; i += BATCH_SIZE) {
                const batch = graceExpiredUsers.slice(i, i + BATCH_SIZE);
                console.log(`📦 Processing grace batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(graceExpiredUsers.length / BATCH_SIZE)} (${batch.length} users)`);

                // Process batch with limited concurrency for Google API calls
                const promises = batch.map(async (user, index) => {
                    // Stagger API calls to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, index * 200));
                    return this.processGraceExpiredUser(user);
                }).map(p => p.catch(err => console.error('❌ Error in grace batch item:', err.message)));
                await Promise.all(promises);

                // Add delay between batches if there are more users to process
                if (i + BATCH_SIZE < graceExpiredUsers.length) {
                    console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            }

        } catch (error) {
            console.error('Error handling grace expired users:', error);
            throw error;
        }
    }



    // Process individual expired user (cancelled subscriptions)
    async processExpiredUser(user) {
        try {
            console.log(`📋 Processing expired cancelled user: ${user.email || user.phoneNumber} (ID: ${user._id})`);

            // For cancelled users, we trust the cancellation status and don't need to verify
            // since they explicitly cancelled their subscription
            await User.findByIdAndUpdate(user._id, {
                $set: {
                    plan: 'free',
                    billing_cycle: 'monthly',
                    isCancelled: false, // Reset cancellation status
                    planExpiresAt: null,
                    isPaymentVerified: false,
                    lastPurchaseToken: user.purchaseToken, // Keep for audit trail
                    purchaseToken: null,
                    planSource: null
                }
            });

            console.log(`✅ Processed expired cancelled user: ${user.email || user.phoneNumber} - downgraded to free plan`);

            // Optional: Add audit log entry
            // await this.logUserDowngrade(user, 'subscription_cancelled_expired');

        } catch (error) {
            console.error(`❌ Error processing expired user ${user._id}:`, error);
        }
    }

    // Process individual grace expired user with final verification
    async processGraceExpiredUser(user) {
        try {
            console.log(`📋 Processing grace expired user: ${user.email || user.phoneNumber} (ID: ${user._id})`);

            // Final verification check before downgrading
            if (user.purchaseToken) {
                console.log(`🔍 Final verification check for user ${user.email || user.phoneNumber}`);

                const verificationResult = await verifyAndroidPurchase(
                    'com.sitehaazri.app',
                    user.purchaseToken,
                    `grace-check-${user._id}`
                );

                // If subscription is still active, update the user
                if (verificationResult.success && verificationResult.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE') {
                    console.log(`🎉 User ${user.email || user.phoneNumber} recovered! Updating plan.`);

                    const billingCycle = verificationResult.originalProductId.includes('yearly') ? 'yearly' : 'monthly';

                    await User.findByIdAndUpdate(user._id, {
                        plan: verificationResult.productId,
                        billing_cycle: billingCycle,
                        planExpiresAt: verificationResult.expires,
                        isPaymentVerified: true,
                        isGrace: false,
                        graceExpiresAt: null,
                        planActivatedAt: new Date()
                    });

                    console.log(`✅ User ${user.email || user.phoneNumber} subscription recovered`);
                    return;
                }

                console.log(`❌ Verification confirmed expiry for ${user.email || user.phoneNumber}. Downgrading.`);
            }

            // Downgrade to free plan
            await User.findByIdAndUpdate(user._id, {
                plan: 'free',
                billing_cycle: 'monthly',
                isGrace: false,
                graceExpiresAt: null,
                planExpiresAt: null,
                isPaymentVerified: false,
                lastPurchaseToken: user.purchaseToken,
                purchaseToken: null,
                planSource: null,
                planActivatedAt: new Date(),
            });

            console.log(`✅ Downgraded user: ${user.email || user.phoneNumber} to free plan`);

        } catch (error) {
            console.error(`❌ Error processing grace expired user ${user._id}:`, error);
        }
    }

    // Stop a specific job
    stopJob(name) {
        if (this.jobs.has(name)) {
            this.jobs.get(name).stop();
            this.jobs.delete(name);
            console.log(`🛑 Stopped cron job: ${name}`);
        }
    }

    // Stop all jobs
    stopAllJobs() {
        console.log('🛑 Stopping all cron jobs...');
        for (const [name, job] of this.jobs) {
            job.stop();
            console.log(`🛑 Stopped job: ${name}`);
        }
        this.jobs.clear();
        console.log('✅ All cron jobs stopped');
    }

    // Get status of all jobs
    getJobsStatus() {
        const status = {};
        for (const [name, job] of this.jobs) {
            status[name] = {
                running: job.running,
                scheduled: job.scheduled
            };
        }
        return status;
    }

    // ============================================
    // HELPER METHODS FOR REPORT GENERATION
    // ============================================

    /**
     * Create a cron job log entry
     */
    async createCronJobLog(jobName, metadata = {}) {
        try {
            const log = await CronJobLog.create({
                jobName,
                executionDate: new Date(),
                status: 'started',
                metadata
            });
            return log._id;
        } catch (error) {
            console.error('❌ Error creating cron job log:', error);
            return null;
        }
    }

    /**
     * Update cron job log with completion status
     */
    async updateCronJobLog(logId, updates) {
        try {
            if (!logId) return;
            await CronJobLog.findByIdAndUpdate(logId, updates);
        } catch (error) {
            console.error('❌ Error updating cron job log:', error);
        }
    }

    /**
     * Get eligible users for reports (Premium/Business plan OR Trial users only)
     * Excludes: Free plan and Pro plan (unless on trial)
     * @returns {Array} Array of eligible users with their active sites
     */
    async getEligibleUsersForReports() {
        try {
            // Find users who are either:
            // 1. On premium or business plan (NOT pro, NOT free)
            // 2. On trial (isTrial: true) - any plan on trial is eligible
            const users = await User.find({
                $or: [
                    { plan: { $in: ['premium', 'business'] } }, // Only premium/business plans
                    { isTrial: true }, // OR any user on trial
                ],
                site: { $exists: true, $not: { $size: 0 } }, // Must have sites
                whatsAppReportsEnabled: true // Only users who have enabled WhatsApp reports
            }).populate('site'); // Populate to get site details including isActive

            console.log(`📋 Found ${users.length} eligible users (premium/business/trial)`);

            // Filter out inactive sites and prepare user-site pairs
            const userSitePairs = [];
            
            for (const user of users) {
                // Filter only active sites
                const activeSites = user.site.filter(site => site.isActive === true);
                
                if (activeSites.length > 0) {
                    userSitePairs.push({
                        user: {
                            name: user.name,
                            phoneNumber: user.whatsAppReportPhone, // Use WhatsApp number, not regular phone
                            calculationType: 'default' // Can be extended based on user settings
                        },
                        sites: activeSites.map(site => site._id.toString())
                    });
                }
            }

            console.log(`✅ Prepared ${userSitePairs.length} user-site pairs with active sites`);
            return userSitePairs;
        } catch (error) {
            console.error('❌ Error getting eligible users:', error);
            throw error;
        }
    }

    // ============================================
    // WEEKLY REPORT CRON JOBS
    // ============================================

    /**
     * Send weekly report for Week 1 (Days 1-7)
     * Runs on 8th day of every month at 2 AM
     */
    async sendWeeklyReportWeek1() {
        const startTime = Date.now();
        console.log('📊 Starting Weekly Report Week 1 (Days 1-7)...');
        
        // Create log entry
        const logId = await this.createCronJobLog('weekly-week1', { weekNumber: 1 });
        
        try {
            // Get eligible users (premium/trial only) with active sites
            const userSitePairs = await this.getEligibleUsersForReports();

            if (userSitePairs.length === 0) {
                console.log('⏭️  No eligible users found for weekly reports');
                await this.updateCronJobLog(logId, {
                    status: 'completed',
                    totalUsers: 0,
                    totalSites: 0,
                    completedAt: new Date(),
                    executionTime: Date.now() - startTime
                });
                return;
            }
            
            let successCount = 0;
            let failureCount = 0;
            let skippedCount = 0;
            const failures = [];
            const successfulReports = [];
            const skippedReports = [];
            const userSummaryMap = new Map();
            const totalSites = userSitePairs.reduce((sum, pair) => sum + pair.sites.length, 0);

            // Send reports to all eligible users for all their active sites
            for (const pair of userSitePairs) {
                // Initialize user summary
                const userKey = pair.user.name;
                if (!userSummaryMap.has(userKey)) {
                    userSummaryMap.set(userKey, {
                        userName: pair.user.name,
                        phoneNumber: pair.user.phoneNumber,
                        totalSites: pair.sites.length,
                        successfulSites: 0,
                        failedSites: 0,
                        skippedSites: 0
                    });
                }

                for (const siteId of pair.sites) {
                    try {
                        // Get site name
                        const site = await siteSchema.findById(siteId);
                        const siteName = site ? site.sitename : 'Unknown Site';

                        const result = await sendWeeklyReport(pair.user, siteId);
                        
                        if (result?.skipped) {
                            skippedCount++;
                            userSummaryMap.get(userKey).skippedSites++;
                            skippedReports.push({
                                userName: pair.user.name,
                                phoneNumber: pair.user.phoneNumber,
                                siteId: siteId,
                                siteName: siteName,
                                reason: result.reason || 'Unknown',
                                timestamp: new Date()
                            });
                        } else {
                            successCount++;
                            userSummaryMap.get(userKey).successfulSites++;
                            successfulReports.push({
                                userName: pair.user.name,
                                phoneNumber: pair.user.phoneNumber,
                                siteId: siteId,
                                siteName: siteName,
                                timestamp: new Date()
                            });
                        }
                        
                        // Small delay to avoid API rate limits
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`❌ Failed to send weekly report to ${pair.user.name} for site ${siteId}:`, error.message);
                        failureCount++;
                        userSummaryMap.get(userKey).failedSites++;
                        
                        // Get site name for failure log
                        let siteName = 'Unknown Site';
                        try {
                            const site = await siteSchema.findById(siteId);
                            siteName = site ? site.sitename : 'Unknown Site';
                        } catch {}

                        failures.push({
                            userName: pair.user.name,
                            phoneNumber: pair.user.phoneNumber,
                            siteId: siteId,
                            siteName: siteName,
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                }
            }

            console.log(`✅ Weekly Report Week 1 completed: ${successCount} sent, ${failureCount} failed, ${skippedCount} skipped`);
            
            // Convert user summary map to array
            const userSummary = Array.from(userSummaryMap.values());

            // Update log with completion status
            await this.updateCronJobLog(logId, {
                status: 'completed',
                totalUsers: userSitePairs.length,
                totalSites: totalSites,
                successCount,
                failureCount,
                skippedCount,
                successfulReports,
                skippedReports,
                failures,
                userSummary,
                completedAt: new Date(),
                executionTime: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Error in sendWeeklyReportWeek1:', error);
            
            // Update log with failure
            await this.updateCronJobLog(logId, {
                status: 'failed',
                failures: [{
                    error: error.message,
                    timestamp: new Date()
                }],
                completedAt: new Date(),
                executionTime: Date.now() - startTime
            });
            
            throw error;
        }
    }

    /**
     * Send weekly report for Week 2 (Days 8-14)
     * Runs on 15th day of every month at 2 AM
     */
    async sendWeeklyReportWeek2() {
        console.log('📊 Starting Weekly Report Week 2 (Days 8-14)...');
        const startTime = Date.now();
        
        // Create log entry
        const logId = await this.createCronJobLog('weekly-week2', { weekNumber: 2 });
        
        try {
            const userSitePairs = await this.getEligibleUsersForReports();

            if (userSitePairs.length === 0) {
                console.log('⏭️  No eligible users found for weekly reports');
                await this.updateCronJobLog(logId, {
                    status: 'completed',
                    totalUsers: 0,
                    totalSites: 0,
                    successCount: 0,
                    failureCount: 0,
                    skippedCount: 0,
                    executionTime: Date.now() - startTime
                });
                return;
            }
            
            let successCount = 0;
            let failureCount = 0;
            let skippedCount = 0;

            // Arrays to track detailed reports
            const successfulReports = [];
            const skippedReports = [];
            const failures = [];

            // Map to track per-user summary
            const userSummaryMap = new Map();

            for (const pair of userSitePairs) {
                const userName = pair.user.name;
                const phoneNumber = pair.user.phoneNumber;

                // Initialize user summary
                if (!userSummaryMap.has(phoneNumber)) {
                    userSummaryMap.set(phoneNumber, {
                        userName,
                        phoneNumber,
                        totalSites: 0,
                        successfulSites: 0,
                        failedSites: 0,
                        skippedSites: 0
                    });
                }

                for (const siteId of pair.sites) {
                    userSummaryMap.get(phoneNumber).totalSites++;

                    try {
                        // Get site name for logging
                        const site = await siteSchema.findById(siteId).select('sitename');
                        const siteName = site?.sitename || 'Unknown Site';

                        const result = await sendWeeklyReport(pair.user, siteId);
                        
                        if (result.skipped) {
                            // Report was skipped (e.g., no employees found)
                            skippedCount++;
                            userSummaryMap.get(phoneNumber).skippedSites++;
                            skippedReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                reason: result.reason || 'No employees found',
                                timestamp: new Date()
                            });
                            console.log(`⏭️  Skipped report for ${userName} - ${siteName}: ${result.reason}`);
                        } else {
                            // Report sent successfully
                            successCount++;
                            userSummaryMap.get(phoneNumber).successfulSites++;
                            successfulReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                timestamp: new Date()
                            });
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`❌ Failed to send weekly report to ${pair.user.name} for site ${siteId}:`, error.message);
                        failureCount++;
                        userSummaryMap.get(phoneNumber).failedSites++;

                        // Get site name even for failures
                        let siteName = 'Unknown Site';
                        try {
                            const site = await siteSchema.findById(siteId).select('sitename');
                            siteName = site?.sitename || 'Unknown Site';
                        } catch (e) {
                            console.error('Could not fetch site name for failure log');
                        }

                        failures.push({
                            userName,
                            phoneNumber,
                            siteId: siteId.toString(),
                            siteName,
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Convert user summary map to array
            const userSummary = Array.from(userSummaryMap.values());

            // Update log with results
            await this.updateCronJobLog(logId, {
                status: 'completed',
                totalUsers: userSitePairs.length,
                totalSites: userSitePairs.reduce((sum, pair) => sum + pair.sites.length, 0),
                successCount,
                failureCount,
                skippedCount,
                successfulReports,
                skippedReports,
                failures,
                userSummary,
                executionTime: Date.now() - startTime
            });

            console.log(`✅ Weekly Report Week 2 completed: ${successCount} sent, ${failureCount} failed, ${skippedCount} skipped`);
        } catch (error) {
            console.error('❌ Error in sendWeeklyReportWeek2:', error);
            await this.updateCronJobLog(logId, {
                status: 'failed',
                error: error.message,
                executionTime: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Send weekly report for Week 3 (Days 15-21)
     * Runs on 22nd day of every month at 2 AM
     */
    async sendWeeklyReportWeek3() {
        console.log('📊 Starting Weekly Report Week 3 (Days 15-21)...');
        const startTime = Date.now();
        
        // Create log entry
        const logId = await this.createCronJobLog('weekly-week3', { weekNumber: 3 });
        
        try {
            const userSitePairs = await this.getEligibleUsersForReports();

            if (userSitePairs.length === 0) {
                console.log('⏭️  No eligible users found for weekly reports');
                await this.updateCronJobLog(logId, {
                    status: 'completed',
                    totalUsers: 0,
                    totalSites: 0,
                    successCount: 0,
                    failureCount: 0,
                    skippedCount: 0,
                    executionTime: Date.now() - startTime
                });
                return;
            }
            
            let successCount = 0;
            let failureCount = 0;
            let skippedCount = 0;

            // Arrays to track detailed reports
            const successfulReports = [];
            const skippedReports = [];
            const failures = [];

            // Map to track per-user summary
            const userSummaryMap = new Map();

            for (const pair of userSitePairs) {
                const userName = pair.user.name;
                const phoneNumber = pair.user.phoneNumber;

                // Initialize user summary
                if (!userSummaryMap.has(phoneNumber)) {
                    userSummaryMap.set(phoneNumber, {
                        userName,
                        phoneNumber,
                        totalSites: 0,
                        successfulSites: 0,
                        failedSites: 0,
                        skippedSites: 0
                    });
                }

                for (const siteId of pair.sites) {
                    userSummaryMap.get(phoneNumber).totalSites++;

                    try {
                        // Get site name for logging
                        const site = await siteSchema.findById(siteId).select('sitename');
                        const siteName = site?.sitename || 'Unknown Site';

                        const result = await sendWeeklyReport(pair.user, siteId);
                        
                        if (result.skipped) {
                            // Report was skipped (e.g., no employees found)
                            skippedCount++;
                            userSummaryMap.get(phoneNumber).skippedSites++;
                            skippedReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                reason: result.reason || 'No employees found',
                                timestamp: new Date()
                            });
                            console.log(`⏭️  Skipped report for ${userName} - ${siteName}: ${result.reason}`);
                        } else {
                            // Report sent successfully
                            successCount++;
                            userSummaryMap.get(phoneNumber).successfulSites++;
                            successfulReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                timestamp: new Date()
                            });
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`❌ Failed to send weekly report to ${pair.user.name} for site ${siteId}:`, error.message);
                        failureCount++;
                        userSummaryMap.get(phoneNumber).failedSites++;

                        // Get site name even for failures
                        let siteName = 'Unknown Site';
                        try {
                            const site = await siteSchema.findById(siteId).select('sitename');
                            siteName = site?.sitename || 'Unknown Site';
                        } catch (e) {
                            console.error('Could not fetch site name for failure log');
                        }

                        failures.push({
                            userName,
                            phoneNumber,
                            siteId: siteId.toString(),
                            siteName,
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Convert user summary map to array
            const userSummary = Array.from(userSummaryMap.values());

            // Update log with results
            await this.updateCronJobLog(logId, {
                status: 'completed',
                totalUsers: userSitePairs.length,
                totalSites: userSitePairs.reduce((sum, pair) => sum + pair.sites.length, 0),
                successCount,
                failureCount,
                skippedCount,
                successfulReports,
                skippedReports,
                failures,
                userSummary,
                executionTime: Date.now() - startTime
            });

            console.log(`✅ Weekly Report Week 3 completed: ${successCount} sent, ${failureCount} failed, ${skippedCount} skipped`);
        } catch (error) {
            console.error('❌ Error in sendWeeklyReportWeek3:', error);
            await this.updateCronJobLog(logId, {
                status: 'failed',
                error: error.message,
                executionTime: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Send weekly report for Week 4 (Days 22-28/29/30)
     * Runs on 29th day of every month at 2 AM
     * Special handling for February
     */
    async sendWeeklyReportWeek4() {
        console.log('📊 Starting Weekly Report Week 4 (Days 22-28+)...');
        const startTime = Date.now();
        
        try {
            // Check if this is February and handle accordingly
            // CRITICAL: Use IST date to match cron timezone
            const { getISTDate } = require('../Utils/WeeklyReportUtils');
            const now = getISTDate();
            const month = now.getMonth() + 1; // 1-12
            const year = now.getFullYear();
            
            // For February, this job runs on Feb 29 (leap year) or won't run (non-leap year)
            // We need a separate job for February 28th in non-leap years
            if (month === 2) {
                console.log('⚠️  February detected - Week 4 report for days 22-28');
            }

            // Create log entry
            const logId = await this.createCronJobLog('weekly-week4', { weekNumber: 4, month, year });

            const userSitePairs = await this.getEligibleUsersForReports();

            if (userSitePairs.length === 0) {
                console.log('⏭️  No eligible users found for weekly reports');
                await this.updateCronJobLog(logId, {
                    status: 'completed',
                    totalUsers: 0,
                    totalSites: 0,
                    successCount: 0,
                    failureCount: 0,
                    skippedCount: 0,
                    executionTime: Date.now() - startTime
                });
                return;
            }
            
            let successCount = 0;
            let failureCount = 0;
            let skippedCount = 0;

            // Arrays to track detailed reports
            const successfulReports = [];
            const skippedReports = [];
            const failures = [];

            // Map to track per-user summary
            const userSummaryMap = new Map();

            for (const pair of userSitePairs) {
                const userName = pair.user.name;
                const phoneNumber = pair.user.phoneNumber;

                // Initialize user summary
                if (!userSummaryMap.has(phoneNumber)) {
                    userSummaryMap.set(phoneNumber, {
                        userName,
                        phoneNumber,
                        totalSites: 0,
                        successfulSites: 0,
                        failedSites: 0,
                        skippedSites: 0
                    });
                }

                for (const siteId of pair.sites) {
                    userSummaryMap.get(phoneNumber).totalSites++;

                    try {
                        // Get site name for logging
                        const site = await siteSchema.findById(siteId).select('sitename');
                        const siteName = site?.sitename || 'Unknown Site';

                        const result = await sendWeeklyReport(pair.user, siteId);
                        
                        if (result.skipped) {
                            // Report was skipped (e.g., no employees found)
                            skippedCount++;
                            userSummaryMap.get(phoneNumber).skippedSites++;
                            skippedReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                reason: result.reason || 'No employees found',
                                timestamp: new Date()
                            });
                            console.log(`⏭️  Skipped report for ${userName} - ${siteName}: ${result.reason}`);
                        } else {
                            // Report sent successfully
                            successCount++;
                            userSummaryMap.get(phoneNumber).successfulSites++;
                            successfulReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                timestamp: new Date()
                            });
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`❌ Failed to send weekly report to ${pair.user.name} for site ${siteId}:`, error.message);
                        failureCount++;
                        userSummaryMap.get(phoneNumber).failedSites++;

                        // Get site name even for failures
                        let siteName = 'Unknown Site';
                        try {
                            const site = await siteSchema.findById(siteId).select('sitename');
                            siteName = site?.sitename || 'Unknown Site';
                        } catch (e) {
                            console.error('Could not fetch site name for failure log');
                        }

                        failures.push({
                            userName,
                            phoneNumber,
                            siteId: siteId.toString(),
                            siteName,
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Convert user summary map to array
            const userSummary = Array.from(userSummaryMap.values());

            // Update log with results
            await this.updateCronJobLog(logId, {
                status: 'completed',
                totalUsers: userSitePairs.length,
                totalSites: userSitePairs.reduce((sum, pair) => sum + pair.sites.length, 0),
                successCount,
                failureCount,
                skippedCount,
                successfulReports,
                skippedReports,
                failures,
                userSummary,
                executionTime: Date.now() - startTime
            });

            console.log(`✅ Weekly Report Week 4 completed: ${successCount} sent, ${failureCount} failed, ${skippedCount} skipped`);
        } catch (error) {
            console.error('❌ Error in sendWeeklyReportWeek4:', error);
            const logId = await this.createCronJobLog('weekly-week4', { weekNumber: 4, error: 'Failed to create initial log' });
            await this.updateCronJobLog(logId, {
                status: 'failed',
                error: error.message,
                executionTime: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Send weekly report for February 28th (non-leap years only)
     * Runs on Feb 28th at 2 AM
     * This ensures Week 4 report is sent even in non-leap years
     */
    async sendWeeklyReportFeb28() {
        console.log('📊 Starting Weekly Report for February 28th...');
        const startTime = Date.now();
        
        try {
            // CRITICAL: Use IST date to match cron timezone
            const { getISTDate } = require('../Utils/WeeklyReportUtils');
            const now = getISTDate();
            const year = now.getFullYear();
            
            // Check if this is a leap year
            const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            
            if (isLeapYear) {
                console.log('⏭️  Skipping Feb 28 job - Leap year detected, will run on Feb 29');
                
                // Create log entry for skipped execution
                const logId = await this.createCronJobLog('weekly-feb28', { weekNumber: 4, month: 2, year, skipped: true, reason: 'Leap year' });
                await this.updateCronJobLog(logId, {
                    status: 'completed',
                    totalUsers: 0,
                    totalSites: 0,
                    successCount: 0,
                    failureCount: 0,
                    skippedCount: 0,
                    executionTime: Date.now() - startTime
                });
                return;
            }

            console.log('✅ Non-leap year detected - Sending Week 4 report for days 22-28');

            // Create log entry
            const logId = await this.createCronJobLog('weekly-feb28', { weekNumber: 4, month: 2, year });

            const userSitePairs = await this.getEligibleUsersForReports();

            if (userSitePairs.length === 0) {
                console.log('⏭️  No eligible users found for weekly reports');
                await this.updateCronJobLog(logId, {
                    status: 'completed',
                    totalUsers: 0,
                    totalSites: 0,
                    successCount: 0,
                    failureCount: 0,
                    skippedCount: 0,
                    executionTime: Date.now() - startTime
                });
                return;
            }
            
            let successCount = 0;
            let failureCount = 0;
            let skippedCount = 0;

            // Arrays to track detailed reports
            const successfulReports = [];
            const skippedReports = [];
            const failures = [];

            // Map to track per-user summary
            const userSummaryMap = new Map();

            for (const pair of userSitePairs) {
                const userName = pair.user.name;
                const phoneNumber = pair.user.phoneNumber;

                // Initialize user summary
                if (!userSummaryMap.has(phoneNumber)) {
                    userSummaryMap.set(phoneNumber, {
                        userName,
                        phoneNumber,
                        totalSites: 0,
                        successfulSites: 0,
                        failedSites: 0,
                        skippedSites: 0
                    });
                }

                for (const siteId of pair.sites) {
                    userSummaryMap.get(phoneNumber).totalSites++;

                    try {
                        // Get site name for logging
                        const site = await siteSchema.findById(siteId).select('sitename');
                        const siteName = site?.sitename || 'Unknown Site';

                        const result = await sendWeeklyReport(pair.user, siteId);
                        
                        if (result.skipped) {
                            // Report was skipped (e.g., no employees found)
                            skippedCount++;
                            userSummaryMap.get(phoneNumber).skippedSites++;
                            skippedReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                reason: result.reason || 'No employees found',
                                timestamp: new Date()
                            });
                            console.log(`⏭️  Skipped report for ${userName} - ${siteName}: ${result.reason}`);
                        } else {
                            // Report sent successfully
                            successCount++;
                            userSummaryMap.get(phoneNumber).successfulSites++;
                            successfulReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                timestamp: new Date()
                            });
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`❌ Failed to send weekly report to ${pair.user.name} for site ${siteId}:`, error.message);
                        failureCount++;
                        userSummaryMap.get(phoneNumber).failedSites++;

                        // Get site name even for failures
                        let siteName = 'Unknown Site';
                        try {
                            const site = await siteSchema.findById(siteId).select('sitename');
                            siteName = site?.sitename || 'Unknown Site';
                        } catch (e) {
                            console.error('Could not fetch site name for failure log');
                        }

                        failures.push({
                            userName,
                            phoneNumber,
                            siteId: siteId.toString(),
                            siteName,
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Convert user summary map to array
            const userSummary = Array.from(userSummaryMap.values());

            // Update log with results
            await this.updateCronJobLog(logId, {
                status: 'completed',
                totalUsers: userSitePairs.length,
                totalSites: userSitePairs.reduce((sum, pair) => sum + pair.sites.length, 0),
                successCount,
                failureCount,
                skippedCount,
                successfulReports,
                skippedReports,
                failures,
                userSummary,
                executionTime: Date.now() - startTime
            });

            console.log(`✅ February 28 Weekly Report completed: ${successCount} sent, ${failureCount} failed, ${skippedCount} skipped`);
        } catch (error) {
            console.error('❌ Error in sendWeeklyReportFeb28:', error);
            const logId = await this.createCronJobLog('weekly-feb28', { weekNumber: 4, month: 2, error: 'Failed to create initial log' });
            await this.updateCronJobLog(logId, {
                status: 'failed',
                error: error.message,
                executionTime: Date.now() - startTime
            });
            throw error;
        }
    }

    // ============================================
    // MONTHLY REPORT CRON JOB
    // ============================================

    /**
     * Send monthly report for previous month
     * Runs on 1st day of every month at 2 AM
     */
    async sendMonthlyReportAll() {
        console.log('📊 Starting Monthly Report for all users...');
        const startTime = Date.now();
        
        try {
            // Get previous month and year using IST timezone
            // CRITICAL: Cron runs at 2 AM IST, must use IST date to get correct month
            // When cron runs at 2 AM IST on Nov 1, server in UTC shows Oct 31 @ 8:30 PM
            const { getISTDate } = require('../Utils/WeeklyReportUtils');
            const now = getISTDate();
            const previousMonth = now.getMonth(); // 0-11 (January is 0)
            const year = previousMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const month = previousMonth === 0 ? 12 : previousMonth;

            console.log(`📅 Sending reports for: ${month}/${year} (Previous month from IST date)`);

            // Create log entry
            const logId = await this.createCronJobLog('monthly-report', { month, year });

            const userSitePairs = await this.getEligibleUsersForReports();

            if (userSitePairs.length === 0) {
                console.log('⏭️  No eligible users found for monthly reports');
                await this.updateCronJobLog(logId, {
                    status: 'completed',
                    totalUsers: 0,
                    totalSites: 0,
                    successCount: 0,
                    failureCount: 0,
                    skippedCount: 0,
                    executionTime: Date.now() - startTime
                });
                return;
            }
            
            let successCount = 0;
            let failureCount = 0;
            let skippedCount = 0;

            // Arrays to track detailed reports
            const successfulReports = [];
            const skippedReports = [];
            const failures = [];

            // Map to track per-user summary
            const userSummaryMap = new Map();

            // Send reports to all users for all their sites
            for (const pair of userSitePairs) {
                const userName = pair.user.name;
                const phoneNumber = pair.user.phoneNumber;

                // Initialize user summary
                if (!userSummaryMap.has(phoneNumber)) {
                    userSummaryMap.set(phoneNumber, {
                        userName,
                        phoneNumber,
                        totalSites: 0,
                        successfulSites: 0,
                        failedSites: 0,
                        skippedSites: 0
                    });
                }

                for (const siteId of pair.sites) {
                    userSummaryMap.get(phoneNumber).totalSites++;

                    try {
                        // Get site name for logging
                        const site = await siteSchema.findById(siteId).select('sitename');
                        const siteName = site?.sitename || 'Unknown Site';

                        const result = await sendMonthlyReport(pair.user, siteId, month, year);
                        
                        if (result.skipped) {
                            // Report was skipped (e.g., no employees found)
                            skippedCount++;
                            userSummaryMap.get(phoneNumber).skippedSites++;
                            skippedReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                reason: result.reason || 'No employees found',
                                timestamp: new Date()
                            });
                            console.log(`⏭️  Skipped report for ${userName} - ${siteName}: ${result.reason}`);
                        } else {
                            // Report sent successfully
                            successCount++;
                            userSummaryMap.get(phoneNumber).successfulSites++;
                            successfulReports.push({
                                userName,
                                phoneNumber,
                                siteId: siteId.toString(),
                                siteName,
                                timestamp: new Date()
                            });
                        }
                        
                        // Small delay to avoid API rate limits
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (error) {
                        console.error(`❌ Failed to send monthly report to ${pair.user.name} for site ${siteId}:`, error.message);
                        failureCount++;
                        userSummaryMap.get(phoneNumber).failedSites++;

                        // Get site name even for failures
                        let siteName = 'Unknown Site';
                        try {
                            const site = await siteSchema.findById(siteId).select('sitename');
                            siteName = site?.sitename || 'Unknown Site';
                        } catch (e) {
                            console.error('Could not fetch site name for failure log');
                        }

                        failures.push({
                            userName,
                            phoneNumber,
                            siteId: siteId.toString(),
                            siteName,
                            error: error.message,
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Convert user summary map to array
            const userSummary = Array.from(userSummaryMap.values());

            // Update log with results
            await this.updateCronJobLog(logId, {
                status: 'completed',
                totalUsers: userSitePairs.length,
                totalSites: userSitePairs.reduce((sum, pair) => sum + pair.sites.length, 0),
                successCount,
                failureCount,
                skippedCount,
                successfulReports,
                skippedReports,
                failures,
                userSummary,
                executionTime: Date.now() - startTime
            });

            console.log(`✅ Monthly Report completed: ${successCount} sent, ${failureCount} failed, ${skippedCount} skipped`);
        } catch (error) {
            console.error('❌ Error in sendMonthlyReportAll:', error);
            const logId = await this.createCronJobLog('monthly-report', { error: 'Failed to create initial log' });
            await this.updateCronJobLog(logId, {
                status: 'failed',
                error: error.message,
                executionTime: Date.now() - startTime
            });
            throw error;
        }
    }

    // Manual trigger for testing
    async manualTriggerDailyCleanup() {
        console.log('🔧 Manual trigger: Daily subscription cleanup');
        await this.runDailyCleanup();
    }

    async manualTriggerExpiredUsers() {
        console.log('🔧 Manual trigger: Expired users check');
        await this.handleExpiredUsers();
    }

    async manualTriggerGraceExpired() {
        console.log('🔧 Manual trigger: Grace expired users check');
        await this.handleGraceExpiredUsers();
    }

    async manualTriggerExpiredTrials() {
        console.log('🔧 Manual trigger: Expired trials check');
        await this.handleExpiredTrials();
    }

    // Manual triggers for weekly reports
    async manualTriggerWeeklyReportWeek1() {
        console.log('🔧 Manual trigger: Weekly Report Week 1');
        await this.sendWeeklyReportWeek1();
    }

    async manualTriggerWeeklyReportWeek2() {
        console.log('🔧 Manual trigger: Weekly Report Week 2');
        await this.sendWeeklyReportWeek2();
    }

    async manualTriggerWeeklyReportWeek3() {
        console.log('🔧 Manual trigger: Weekly Report Week 3');
        await this.sendWeeklyReportWeek3();
    }

    async manualTriggerWeeklyReportWeek4() {
        console.log('🔧 Manual trigger: Weekly Report Week 4');
        await this.sendWeeklyReportWeek4();
    }

    // Manual trigger for monthly report
    async manualTriggerMonthlyReport() {
        console.log('🔧 Manual trigger: Monthly Report');
        await this.sendMonthlyReportAll();
    }

    // ============================================
    // API CALL TRACKING CRON JOBS
    // ============================================

    /**
     * Cleanup expired users from tracking set
     * Runs every 6 hours
     */
    async cleanupExpiredApiTracking() {
        console.log('🧹 Cleaning up expired API tracking users...');
        
        try {
            const { cleanupExpiredUsers } = require('../Middleware/apiCallTracker');
            
            const removedCount = await cleanupExpiredUsers();
            
            if (removedCount > 0) {
                console.log(`✅ Cleaned up ${removedCount} expired users from API tracking`);
            } else {
                console.log('✨ No expired users to clean up');
            }
            
        } catch (error) {
            console.error('❌ Error cleaning up API tracking:', error.message);
            throw error;
        }
    }

    // Manual trigger for API tracking cleanup
    async manualTriggerApiTrackingCleanup() {
        console.log('🔧 Manual trigger: API Tracking Cleanup');
        await this.cleanupExpiredApiTracking();
    }

    // ============================================
    // EMPLOYEE COUNTER SYNC (Self-Healing)
    // ============================================

    /**
     * Sync employee counters for Sites and Users.
     * Fixes any drift in cached values using chained algorithm.
     * Schedule: Sundays at 4 AM IST
     */
    async syncEmployeeCounters() {
        console.log('🔄 Running weekly employee counter sync...');
        
        try {
            const result = await recalculateCounters();
            
            if (result.success) {
                console.log(`✅ Counter sync complete. Fixed ${result.sitesUpdated} Sites, ${result.usersUpdated} Users.`);
            } else {
                console.error('❌ Counter sync failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Error in counter sync:', error.message);
            throw error;
        }
    }

    // Manual trigger for counter sync
    async manualTriggerCounterSync() {
        console.log('🔧 Manual trigger: Employee Counter Sync');
        await this.syncEmployeeCounters();
    }

    /**
     * Monthly counter reset - runs on 1st of each month at midnight.
     * Resets counters for the new month.
     */
    async monthlyCounterReset() {
        console.log('🗓️ Running monthly counter reset...');
        
        try {
            const result = await monthlyCounterReset();
            
            if (result.success) {
                console.log(`✅ Monthly reset complete. Reset ${result.sitesUpdated} Sites, ${result.usersUpdated} Users.`);
            } else {
                console.error('❌ Monthly reset failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Error in monthly counter reset:', error.message);
            throw error;
        }
    }

    // Manual trigger for monthly counter reset
    async manualTriggerMonthlyReset() {
        console.log('🔧 Manual trigger: Monthly Counter Reset');
        await this.monthlyCounterReset();
    }
}

// Create singleton instance
const cronJobService = new CronJobService();

module.exports = cronJobService;
const cron = require('node-cron');
const User = require('../models/Userschema');
const { google } = require('googleapis');

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

        // Run daily at 3 AM for all subscription cleanup tasks
        this.scheduleJob('daily-subscription-cleanup', '0 3 * * *', this.runDailyCleanup.bind(this));



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

    // Run both cleanup tasks sequentially
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

    // Handle users with isCancelled: true and planExpiresAt < current date
    async handleExpiredUsers() {
        try {
            const currentDate = new Date();
            const BATCH_SIZE = 50; // Process 50 users at a time
            const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

            const expiredUsers = await User.find({
                isCancelled: true,
                planExpiresAt: { $lt: currentDate }
            });

            console.log(`🔍 Found ${expiredUsers.length} expired cancelled users`);

            // Process users in batches to avoid server overload
            for (let i = 0; i < expiredUsers.length; i += BATCH_SIZE) {
                const batch = expiredUsers.slice(i, i + BATCH_SIZE);
                console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(expiredUsers.length / BATCH_SIZE)} (${batch.length} users)`);

                // Process batch concurrently
                await Promise.all(batch.map(user => this.processExpiredUser(user)));

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
            const BATCH_SIZE = 20; // Process 20 users at a time for Google API calls
            const DELAY_BETWEEN_BATCHES = 1500; // 1.5 second delay between batches

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
                });
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
                planSource: null
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


}

// Create singleton instance
const cronJobService = new CronJobService();

module.exports = cronJobService;
const express = require('express');
const { google } = require('googleapis');
const router = express.Router();
const User = require('../models/Userschema');
const { authenticateToken } = require('../Middleware/auth');

// Make sure you have this at the top of your server file to load .env variables
require("dotenv").config();

async function verifyAndroidPurchase(packageName, purchaseToken) {
    // Parse the NEW, dedicated key for Play Billing
    const serviceAccountCredentials = JSON.parse(process.env.PLAY_BILLING_SERVICE_KEY);

    // 2. ADD THIS LINE TO DEBUG
    console.log("VERIFYING WITH SERVICE ACCOUNT EMAIL:", serviceAccountCredentials.client_email);

    const auth = new google.auth.GoogleAuth({
        credentials: serviceAccountCredentials, // Use the new key
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidpublisher = google.androidpublisher({
        version: 'v3',
        auth: auth,
    });

    try {
        const response = await androidpublisher.purchases.subscriptionsv2.get({
            packageName: packageName,
            token: purchaseToken,
        });

        if (response.data && response.data.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE') {
            const lineItem = response.data.lineItems[0];
            const originalProductId = lineItem.productId;

            // Map product IDs to internal plan names
            if (lineItem.productId === 'pro_monthly') {
                lineItem.productId = 'pro';
            } else if (lineItem.productId === 'haazri_automate') {
                lineItem.productId = 'premium';
            }

            return {
                success: true,
                productId: lineItem.productId,
                originalProductId: originalProductId,
                expires: new Date(lineItem.expiryTime),
                subscriptionState: response.data.subscriptionState,
                startTime: response.data.startTime ? new Date(response.data.startTime) : null,
                regionCode: response.data.regionCode || null,
                subscriptionId: response.data.subscriptionId || null
            };
        } else {
            return { success: false, error: 'Subscription is not active.' };
        }
    } catch (error) {
        console.error('Google API Error:', error.response ? error.response.data.error : error.message);
        return { success: false, error: 'Failed to verify purchase with Google.' };
    }
}

// Add your play purchase routes here
router.post('/verify-android-purchase', authenticateToken, async (req, res) => {
    try {
        const { purchaseToken } = req.body;
        const user = req.user;
        const packageName = 'com.sitehaazri.app'; // Your app's package name
        if (!purchaseToken) {
            return res.status(400).json({ error: 'Purchase token is required.' });
        }
        if (!user) {
            return res.status(400).json({ error: 'User is not authenticated.' });
        }

        console.log('Received purchase token:', purchaseToken);
        console.log('packageName:', packageName);
        console.log('user:', user);
        // Call the verification function
        const verificationResult = await verifyAndroidPurchase(packageName, purchaseToken);

        if (verificationResult.success) {
            // Determine billing cycle from expiry time
            const diffInMs = new Date(verificationResult.expires) - new Date();
            const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
            const billingCycle = diffInDays > 180 ? 'yearly' : 'monthly';

            // Get current user to check if this is a renewal or new purchase
            const currentUser = await User.findById(user.id);
            const isRenewal = currentUser.purchaseToken && currentUser.purchaseToken !== purchaseToken;

            // Prepare plan history entry
            const planHistoryEntry = {
                plan: verificationResult.productId,
                purchasedAt: verificationResult.startTime || new Date(),
                expiresAt: new Date(verificationResult.expires),
                transactionId: purchaseToken, // Using purchase token as transaction ID
                platform: 'android',
                source: 'google_play',
                isActive: true,
                renewalToken: isRenewal ? purchaseToken : null,
                originalPurchaseToken: isRenewal ? currentUser.purchaseToken : purchaseToken,
                // Google Play specific data
                originalProductId: verificationResult.originalProductId,
                subscriptionId: verificationResult.subscriptionId,
                regionCode: verificationResult.regionCode,
                verificationData: {
                    subscriptionState: verificationResult.subscriptionState,
                    startTime: verificationResult.startTime
                }
            };

            // Mark previous plan history entries as inactive
            await User.findByIdAndUpdate(user.id, {
                $set: { "planHistory.$[].isActive": false }
            });

            // Update user's subscription in database - use productId directly and save purchase token
            await User.findByIdAndUpdate(
                user.id,
                {
                    plan: verificationResult.productId,
                    billing_cycle: billingCycle,
                    planExpiresAt: new Date(verificationResult.expires),
                    planActivatedAt: new Date(),
                    isPaymentVerified: true,
                    lastPurchaseToken: currentUser.purchaseToken, // Store previous token
                    purchaseToken: purchaseToken, // Save the current purchase token
                    planSource: 'google_play',
                    $push: { planHistory: planHistoryEntry } // Add to plan history
                }
            );

            console.log('User subscription updated successfully:', {
                userId: user.id,
                plan: verificationResult.productId,
                billing_cycle: billingCycle,
                expires_at: verificationResult.expires,
                purchaseToken: purchaseToken
            });

            res.status(200).json({
                message: 'Subscription activated successfully!',
                plan: verificationResult.productId,
                billing_cycle: billingCycle,
                expires_at: verificationResult.expires,
                purchase_token: purchaseToken,
                plan_source: 'google_play'
            });
        } else {
            res.status(400).json({ error: verificationResult.error });
        }
    } catch (error) {
        console.error('Purchase verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get("/plan", authenticateToken, async (req, res) => {

    if (!req.user.plan) {
        req.user.plan = 'free';
    }

    // If plan is basic, automatically set billing cycle as monthly
    if (req.user.plan === 'free') {
        req.user.billing_cycle = 'monthly';
    }
    console.log("req.user.plan", req.user.plan);
    console.log("req.user.billing_cycle", req.user.billing_cycle);

    return res.status(200).json({
        plan: req.user.plan,
        billing_cycle: req.user.billing_cycle,
        planExpiry: req.user.planExpiresAt,
        planSource: req.user.planSource,
        isPaymentVerified: req.user.isPaymentVerified
    })
})



// ============================================================================
// GOOGLE CLOUD PUB/SUB WEBHOOK ENDPOINT
// ============================================================================

/**
 * Helper function to find user by purchase token
 * @param {string} purchaseToken - The purchase token to search for
 * @returns {Object|null} - User document or null if not found
 */
async function findUserByPurchaseToken(purchaseToken) {
    try {
        // Search in both current and last purchase tokens
        const user = await User.findOne({
            $or: [
                { purchaseToken: purchaseToken },
                { lastPurchaseToken: purchaseToken },
                { 'planHistory.transactionId': purchaseToken }
            ]
        });
        return user;
    } catch (error) {
        console.error('Error finding user by purchase token:', error);
        return null;
    }
}

/**
 * Helper function to update user subscription based on notification
 */
async function updateUserSubscription(user, notification, notificationType) {
    try {
        let updateData = {};
        let message = '';

        switch (notificationType) {
            case 'SUBSCRIPTION_RENEWED':
                const verification = await verifyAndroidPurchase('com.sitehaazri.app', notification.purchaseToken);

                if (verification.success) {
                    const billingCycle = (new Date(verification.expires) - new Date()) > (180 * 24 * 60 * 60 * 1000) ? 'yearly' : 'monthly';

                    updateData = {
                        plan: verification.productId,
                        billing_cycle: billingCycle,
                        planExpiresAt: new Date(verification.expires),
                        isPaymentVerified: true,
                        lastPurchaseToken: user.purchaseToken,
                        purchaseToken: notification.purchaseToken
                    };
                    message = 'Subscription renewed';
                }
                break;

            case 'SUBSCRIPTION_CANCELED':
            case 'SUBSCRIPTION_EXPIRED':
                updateData = {
                    plan: 'free',
                    billing_cycle: 'monthly',
                    isPaymentVerified: false,
                    lastPurchaseToken: user.purchaseToken,
                    purchaseToken: null
                };
                message = notificationType === 'SUBSCRIPTION_CANCELED' ? 'Subscription cancelled' : 'Subscription expired';
                break;

            default:
                message = `Notification processed: ${notificationType}`;
        }

        if (Object.keys(updateData).length > 0) {
            await User.findByIdAndUpdate(user._id, updateData);
        }

        return { success: true, message, userId: user._id };

    } catch (error) {
        return { success: false, error: error.message, userId: user._id };
    }
}

/**
 * Google Cloud Pub/Sub Webhook Endpoint
 * Receives real-time subscription notifications from Google Play
 */
router.post('/notifications', async (req, res) => {
    try {
        // Parse and decode Pub/Sub message
        const pubsubMessage = JSON.parse(req.body.toString());
        const decodedData = Buffer.from(pubsubMessage.message.data, 'base64').toString('utf-8');
        const notificationData = JSON.parse(decodedData);

        const subscription = notificationData.subscriptionNotification;
        const notificationType = subscription.notificationType;
        const purchaseToken = subscription.purchaseToken;

        console.log(`Processing ${notificationType} for token: ${purchaseToken?.substring(0, 20)}...`);

        // Find user and update subscription
        const user = await findUserByPurchaseToken(purchaseToken);

        if (!user) {
            return res.status(200).json({
                message: 'No user found',
                acknowledged: true
            });
        }

        const updateResult = await updateUserSubscription(user, subscription, notificationType);

        console.log(`${updateResult.success ? 'Success' : 'Failed'}: ${updateResult.message}`);

        res.status(200).json({
            message: 'Notification processed',
            success: updateResult.success,
            acknowledged: true
        });

    } catch (error) {
        console.error('Pub/Sub webhook error:', error);
        res.status(200).json({
            message: 'Error acknowledged',
            acknowledged: true
        });
    }
});

// Test endpoint for development only
router.post('/test-notification', async (req, res) => {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: 'Endpoint not found' });
    }

    try {
        const { notificationType, purchaseToken } = req.body;

        if (!notificationType || !purchaseToken) {
            return res.status(400).json({ error: 'notificationType and purchaseToken required' });
        }

        const user = await findUserByPurchaseToken(purchaseToken);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updateResult = await updateUserSubscription(user, { notificationType, purchaseToken }, notificationType);

        res.status(200).json({
            message: 'Test processed',
            result: updateResult
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
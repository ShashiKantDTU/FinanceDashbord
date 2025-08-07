const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();
const User = require('../models/Userschema');
const { authenticateToken } = require('../Middleware/auth');

require("dotenv").config();

const client = new OAuth2Client();

// JWT Authentication Middleware for Webhook
async function authenticateWebhook(req, res, next) {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            console.log('❌ Webhook authentication failed: Missing Authorization header');
            return res.status(401).send('Unauthorized: Missing Authorization header');
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            console.log('❌ Webhook authentication failed: Invalid Authorization header format');
            return res.status(401).send('Unauthorized: Invalid Authorization header format');
        }

        // Use the correct audience from environment variable
        const expectedAudience = process.env.GOOGLE_WEBHOOK_AUDIENCE;
        if (!expectedAudience) {
            console.error('CRITICAL: GOOGLE_WEBHOOK_AUDIENCE environment variable is not set.');
            return res.status(500).send('Server configuration error.');
        }

        // Verify the JWT token against Google's public keys
        await client.verifyIdToken({
            idToken: token,
            audience: expectedAudience
        });

        console.log('✅ Webhook authentication successful');
        next();
    } catch (error) {
        console.error('❌ Webhook authentication failed:', error.message);
        return res.status(401).send('Unauthorized: Invalid token');
    }
}

function getNotificationTypeName(notificationType) {
    const notificationTypes = {
        1: 'SUBSCRIPTION_PURCHASED',
        2: 'SUBSCRIPTION_RENEWED',
        3: 'SUBSCRIPTION_CANCELED',
        4: 'SUBSCRIPTION_ON_HOLD',
        5: 'SUBSCRIPTION_IN_GRACE_PERIOD',
        6: 'SUBSCRIPTION_RESTARTED',
        12: 'SUBSCRIPTION_EXPIRED',
        13: 'SUBSCRIPTION_RECOVERED'
    };
    return notificationTypes[notificationType] || `UNKNOWN_TYPE_${notificationType}`;
}

async function verifyAndroidPurchase(packageName, purchaseToken, requestId = 'unknown') {
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

// Purchase verification endpoint
router.post('/verify-android-purchase', authenticateToken, async (req, res) => {
    try {
        const { purchaseToken } = req.body;
        const user = req.user;
        const packageName = 'com.sitehaazri.app';

        if (!purchaseToken) {
            return res.status(400).json({ error: 'Purchase token is required.' });
        }
        if (!user) {
            return res.status(400).json({ error: 'User is not authenticated.' });
        }

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
                transactionId: purchaseToken,
                platform: 'android',
                source: 'google_play',
                isActive: true,
                renewalToken: isRenewal ? purchaseToken : null,
                originalPurchaseToken: isRenewal ? currentUser.purchaseToken : purchaseToken,
                originalProductId: verificationResult.originalProductId,
                subscriptionId: verificationResult.subscriptionId,
                regionCode: verificationResult.regionCode,
                verificationData: {
                    subscriptionState: verificationResult.subscriptionState,
                    startTime: verificationResult.startTime
                }
            };

            // Mark previous plan history entries as inactive ONLY if they exist
            if (currentUser.planHistory && currentUser.planHistory.length > 0) {
                await User.updateOne(
                    { _id: user.id },
                    { $set: { "planHistory.$[].isActive": false } }
                );
            }

            // Update user's subscription in database
            await User.findByIdAndUpdate(
                user.id,
                {
                    plan: verificationResult.productId,
                    billing_cycle: billingCycle,
                    planExpiresAt: new Date(verificationResult.expires),
                    planActivatedAt: new Date(),
                    isPaymentVerified: true,
                    lastPurchaseToken: currentUser.purchaseToken,
                    purchaseToken: purchaseToken,
                    isCancelled: false,
                    isGrace: false,
                    graceExpiresAt: null,
                    planSource: 'google_play',
                    $push: { planHistory: planHistoryEntry }
                }
            );

            console.log(`✅ Subscription activated: ${user.email} → ${verificationResult.productId} (${billingCycle})`);

            res.status(200).json({
                message: 'Subscription activated successfully!',
                plan: verificationResult.productId,
                billing_cycle: billingCycle,
                expires_at: verificationResult.expires,
                purchase_token: purchaseToken,
                plan_source: 'google_play'
            });
        } else {
            console.log(`❌ Purchase verification failed: ${verificationResult.error}`);
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

    if (req.user.plan === 'free') {
        req.user.billing_cycle = 'monthly';
    }

    const response = {
        plan: req.user.plan,
        billing_cycle: req.user.billing_cycle,
        planExpiry: req.user.planExpiresAt,
        planSource: req.user.planSource,
        isPaymentVerified: req.user.isPaymentVerified
    };

    // Only include isTrial, isCancelled, isGrace, and purchaseToken for normal users, not supervisors
    if (req.user.role !== 'Supervisor') {
        response.isTrial = req.user.isTrial || false;
        response.isCancelled = req.user.isCancelled || false;
        response.isGrace = req.user.isGrace || false;
        response.purchaseToken = req.user.purchaseToken || null;
    }

    return res.status(200).json(response)
});

// Debug endpoint to check user subscription details
router.get("/debug-user/:userId?", authenticateToken, async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: 'Endpoint not found' });
    }

    try {
        const userId = req.params.userId || req.user.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const debugInfo = {
            userId: user._id,
            email: user.email,
            name: user.name,
            plan: user.plan,
            billing_cycle: user.billing_cycle,
            planExpiresAt: user.planExpiresAt,
            planActivatedAt: user.planActivatedAt,
            isPaymentVerified: user.isPaymentVerified,
            isTrial: user.isTrial,
            isCancelled: user.isCancelled,
            isGrace: user.isGrace,
            graceExpiresAt: user.graceExpiresAt,
            purchaseToken: user.purchaseToken ? `${user.purchaseToken.substring(0, 20)}...` : null,
            lastPurchaseToken: user.lastPurchaseToken ? `${user.lastPurchaseToken.substring(0, 20)}...` : null,
            planSource: user.planSource,
            planHistoryCount: user.planHistory?.length || 0,
            planHistory: user.planHistory?.map(h => ({
                plan: h.plan,
                purchasedAt: h.purchasedAt,
                expiresAt: h.expiresAt,
                platform: h.platform,
                source: h.source,
                isActive: h.isActive,
                transactionId: h.transactionId ? `${h.transactionId.substring(0, 20)}...` : null
            })) || []
        };

        res.status(200).json({
            message: 'Debug info retrieved',
            user: debugInfo
        });

    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

async function findUserByPurchaseToken(purchaseToken, requestId = 'unknown') {
    try {
        const searchQuery = {
            $or: [
                { purchaseToken: purchaseToken },
                { lastPurchaseToken: purchaseToken },
                { 'planHistory.transactionId': purchaseToken }
            ]
        };

        const user = await User.findOne(searchQuery);

        if (user) {
            console.log(`[${requestId}] ✅ User found: ${user.phoneNumber} (${user.plan})`);
        } else {
            console.log(`[${requestId}] ❌ No user found for token: ${purchaseToken?.substring(0, 20)}...`);
        }

        return user;

    } catch (error) {
        console.error(`[${requestId}] ❌ Error finding user:`, error.message);
        return null;
    }
}

async function updateUserSubscription(user, notification, notificationType, requestId = 'unknown') {
    try {
        let updateData = {};
        let message = '';

        switch (notificationType) {
            // Cases where a NEW expiry date is generated. We MUST verify to get the official date.
            case 1:  // SUBSCRIPTION_PURCHASED
            case 2:  // SUBSCRIPTION_RENEWED
            case 6:  // SUBSCRIPTION_RESTARTED
            case 13: // SUBSCRIPTION_RECOVERED
                const verification = await verifyAndroidPurchase('com.sitehaazri.app', notification.purchaseToken, requestId);
                if (verification.success) {
                    // Determine billing cycle from the Product ID (more reliable than date calculation)
                    const billingCycle = verification.originalProductId.includes('yearly') ? 'yearly' : 'monthly';

                    updateData = {
                        plan: verification.productId,
                        billing_cycle: billingCycle,
                        planExpiresAt: verification.expires,
                        isPaymentVerified: true,
                        isCancelled: false,
                        isGrace: false,
                        graceExpiresAt: null,
                        lastPurchaseToken: user.purchaseToken,
                        purchaseToken: notification.purchaseToken,
                        planActivatedAt: new Date()
                    };
                    message = `Subscription active. Type: ${getNotificationTypeName(notificationType)}.`;
                } else {
                    return {
                        success: false,
                        error: verification.error,
                        userId: user._id,
                        message: `Webhook received for ${getNotificationTypeName(notificationType)}, but verification failed.`
                    };
                }
                break;

            // Simple status change cases - trust the authenticated webhook
            case 3: // SUBSCRIPTION_CANCELED
                updateData = {
                    isCancelled: true,
                    isGrace: false,
                    graceExpiresAt: null,
                    isPaymentVerified: false,
                    lastPurchaseToken: user.purchaseToken
                };
                message = 'Subscription cancellation recorded.';
                break;

            case 4: // SUBSCRIPTION_ON_HOLD
                updateData = {
                    isPaymentVerified: false
                };
                message = 'Subscription is On Hold.';
                break;

            case 5: // SUBSCRIPTION_IN_GRACE_PERIOD
                // Verify to get the gracePeriodEndTime for accurate tracking
                const graceVerification = await verifyAndroidPurchase('com.sitehaazri.app', notification.purchaseToken, requestId);
                if (graceVerification.success && graceVerification.gracePeriodEndTime) {
                    updateData = {
                        isGrace: true,
                        isPaymentVerified: false,
                        graceExpiresAt: graceVerification.gracePeriodEndTime,
                        lastPurchaseToken: user.purchaseToken
                    };
                    message = `Subscription in grace period until ${graceVerification.gracePeriodEndTime.toDateString()}`;
                } else {
                    // Fallback if API call fails
                    updateData = {
                        isGrace: true,
                        isPaymentVerified: false,
                        lastPurchaseToken: user.purchaseToken
                    };
                    message = 'Subscription in grace period.';
                }
                break;

            // The final downgrade state
            case 12: // SUBSCRIPTION_EXPIRED
                updateData = {
                    plan: 'free',
                    billing_cycle: 'monthly',
                    isPaymentVerified: false,
                    isCancelled: false,
                    isGrace: false,
                    lastPurchaseToken: user.purchaseToken,
                    purchaseToken: null,
                    planExpiresAt: null,
                    graceExpiresAt: null
                };
                message = 'Subscription expired. Reverted to free plan.';
                break;

            default:
                message = `Unknown notification type: ${notificationType} acknowledged.`;
                return { success: true, message, userId: user._id, updateData: {} };
        }

        // Apply database update if needed
        if (Object.keys(updateData).length > 0) {
            const updateResult = await User.findByIdAndUpdate(user._id, { $set: updateData }, { new: true });
            if (!updateResult) {
                return { success: false, error: 'Database update failed', userId: user._id, message: 'Database update failed' };
            }
        }

        return { success: true, message, userId: user._id, updateData };

    } catch (error) {
        console.error(`[${requestId}] ❌ Update error:`, error.message);
        return { success: false, error: error.message, userId: user._id, message: `Update failed: ${error.message}` };
    }
}

// Google Cloud Pub/Sub Webhook Endpoint
router.post('/notifications', authenticateWebhook, async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] 🔔 Webhook received`);

    try {
        // Parse request body
        let rawBody;
        if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString();
        } else if (typeof req.body === 'string') {
            rawBody = req.body;
        } else {
            rawBody = JSON.stringify(req.body);
        }

        // Parse Pub/Sub message and decode data
        const pubsubMessage = JSON.parse(rawBody);
        if (!pubsubMessage.message?.data) {
            throw new Error('No data field in Pub/Sub message');
        }

        const decodedData = Buffer.from(pubsubMessage.message.data, 'base64').toString('utf-8');
        const notificationData = JSON.parse(decodedData);

        // Handle different notification types
        if (notificationData.subscriptionNotification) {
            const subscription = notificationData.subscriptionNotification;
            const notificationType = subscription.notificationType;
            const purchaseToken = subscription.purchaseToken;

            console.log(`[${requestId}] 📱 Subscription ${getNotificationTypeName(notificationType)} for token: ${purchaseToken?.substring(0, 20)}...`);

            const user = await findUserByPurchaseToken(purchaseToken, requestId);
            if (!user) {
                return res.status(200).json({
                    message: 'No user found for purchase token',
                    acknowledged: true,
                    requestId: requestId,
                    notificationType: notificationType
                });
            }

            const updateResult = await updateUserSubscription(user, subscription, notificationType, requestId);
            console.log(`[${requestId}] ${updateResult.success ? '✅' : '❌'} ${updateResult.message}`);

            res.status(200).json({
                message: 'Subscription notification processed',
                success: updateResult.success,
                acknowledged: true,
                requestId: requestId,
                notificationType: notificationType,
                userId: user._id.toString()
            });

        } else if (notificationData.voidedPurchaseNotification) {
            const voidedPurchase = notificationData.voidedPurchaseNotification;
            console.log(`[${requestId}] 🗑️ Voided purchase: ${voidedPurchase.purchaseToken?.substring(0, 20)}...`);

            res.status(200).json({
                message: 'Voided purchase notification acknowledged',
                acknowledged: true,
                requestId: requestId,
                notificationType: 'voidedPurchase'
            });

        } else if (notificationData.testNotification) {
            console.log(`[${requestId}] 🧪 Test notification acknowledged`);

            res.status(200).json({
                message: 'Test notification acknowledged',
                acknowledged: true,
                requestId: requestId,
                notificationType: 'test'
            });

        } else {
            console.log(`[${requestId}] ❓ Unknown notification type: ${Object.keys(notificationData)}`);

            res.status(200).json({
                message: 'Unknown notification type acknowledged',
                acknowledged: true,
                requestId: requestId,
                notificationType: 'unknown'
            });
        }

    } catch (error) {
        console.error(`[${requestId}] ❌ Webhook error:`, error.message);
        res.status(200).json({
            message: 'Error processing notification',
            error: error.message,
            acknowledged: true,
            requestId: requestId
        });
    }
});

module.exports = router;
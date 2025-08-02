const express = require('express');
const { google } = require('googleapis');
const router = express.Router();
const User = require('../models/Userschema');
const { authenticateToken } = require('../Middleware/auth');

// Make sure you have this at the top of your server file to load .env variables
require("dotenv").config();

async function verifyAndroidPurchase(packageName, purchaseToken, requestId = 'unknown') {
    console.log(`[${requestId}] 🔍 verifyAndroidPurchase() started`);
    console.log(`[${requestId}] 📋 Parameters:`);
    console.log(`[${requestId}]   - Package Name: ${packageName}`);
    console.log(`[${requestId}]   - Purchase Token: ${purchaseToken?.substring(0, 20)}...${purchaseToken?.substring(-10)}`);
    
    try {
        // Parse the NEW, dedicated key for Play Billing
        console.log(`[${requestId}] 🔑 Parsing service account credentials...`);
        const serviceAccountCredentials = JSON.parse(process.env.PLAY_BILLING_SERVICE_KEY);
        console.log(`[${requestId}] ✅ Service account email: ${serviceAccountCredentials.client_email}`);

        console.log(`[${requestId}] 🔐 Setting up Google Auth...`);
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccountCredentials,
            scopes: ['https://www.googleapis.com/auth/androidpublisher'],
        });

        console.log(`[${requestId}] 📱 Initializing Android Publisher API...`);
        const androidpublisher = google.androidpublisher({
            version: 'v3',
            auth: auth,
        });

        console.log(`[${requestId}] 🌐 Making API call to Google Play...`);
        const response = await androidpublisher.purchases.subscriptionsv2.get({
            packageName: packageName,
            token: purchaseToken,
        });

        console.log(`[${requestId}] 📥 Google Play API response received`);
        console.log(`[${requestId}] 📊 Response status: ${response.status}`);
        console.log(`[${requestId}] 📋 Response data:`, JSON.stringify(response.data, null, 2));

        if (response.data && response.data.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE') {
            console.log(`[${requestId}] ✅ Subscription is ACTIVE`);
            
            const lineItem = response.data.lineItems[0];
            const originalProductId = lineItem.productId;
            
            console.log(`[${requestId}] 📦 Line item details:`);
            console.log(`[${requestId}]   - Original Product ID: ${originalProductId}`);
            console.log(`[${requestId}]   - Expiry Time: ${lineItem.expiryTime}`);
            console.log(`[${requestId}]   - Full line item:`, JSON.stringify(lineItem, null, 2));

            // Map product IDs to internal plan names
            let mappedProductId = lineItem.productId;
            if (lineItem.productId === 'pro_monthly') {
                mappedProductId = 'pro';
                console.log(`[${requestId}] 🔄 Mapped product ID: ${originalProductId} → ${mappedProductId}`);
            } else if (lineItem.productId === 'haazri_automate') {
                mappedProductId = 'premium';
                console.log(`[${requestId}] 🔄 Mapped product ID: ${originalProductId} → ${mappedProductId}`);
            } else {
                console.log(`[${requestId}] ℹ️ No mapping needed for product ID: ${originalProductId}`);
            }

            const verificationResult = {
                success: true,
                productId: mappedProductId,
                originalProductId: originalProductId,
                expires: new Date(lineItem.expiryTime),
                subscriptionState: response.data.subscriptionState,
                startTime: response.data.startTime ? new Date(response.data.startTime) : null,
                regionCode: response.data.regionCode || null,
                subscriptionId: response.data.subscriptionId || null
            };
            
            console.log(`[${requestId}] ✅ Verification successful!`);
            console.log(`[${requestId}] 📤 Returning result:`, JSON.stringify(verificationResult, null, 2));
            
            return verificationResult;
        } else {
            console.log(`[${requestId}] ❌ Subscription is NOT active`);
            console.log(`[${requestId}] 📊 Subscription state: ${response.data?.subscriptionState || 'unknown'}`);
            
            const errorResult = { 
                success: false, 
                error: `Subscription is not active. State: ${response.data?.subscriptionState || 'unknown'}`,
                subscriptionState: response.data?.subscriptionState,
                rawResponse: response.data
            };
            
            console.log(`[${requestId}] 📤 Returning error result:`, JSON.stringify(errorResult, null, 2));
            return errorResult;
        }
    } catch (error) {
        console.log(`[${requestId}] ❌ Google API Error occurred:`);
        console.log(`[${requestId}] Error name:`, error.name);
        console.log(`[${requestId}] Error message:`, error.message);
        
        if (error.response) {
            console.log(`[${requestId}] 📊 Error response status:`, error.response.status);
            console.log(`[${requestId}] 📊 Error response data:`, JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.code) {
            console.log(`[${requestId}] 📊 Error code:`, error.code);
        }
        
        console.log(`[${requestId}] 📊 Full error stack:`, error.stack);
        
        const errorResult = { 
            success: false, 
            error: `Failed to verify purchase with Google: ${error.message}`,
            errorCode: error.code,
            errorStatus: error.response?.status,
            errorData: error.response?.data
        };
        
        console.log(`[${requestId}] 📤 Returning error result:`, JSON.stringify(errorResult, null, 2));
        return errorResult;
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

// Debug endpoint to check user subscription details
router.get("/debug-user/:userId?", authenticateToken, async (req, res) => {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: 'Endpoint not found' });
    }

    try {
        const userId = req.params.userId || req.user.id;
        
        console.log(`🔍 Debug request for user: ${userId}`);
        
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

        console.log(`✅ Debug info retrieved for user ${userId}`);
        
        res.status(200).json({
            message: 'Debug info retrieved',
            user: debugInfo
        });

    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
})



// ============================================================================
// GOOGLE CLOUD PUB/SUB WEBHOOK ENDPOINT
// ============================================================================

/**
 * Helper function to find user by purchase token
 * @param {string} purchaseToken - The purchase token to search for
 * @returns {Object|null} - User document or null if not found
 */
async function findUserByPurchaseToken(purchaseToken, requestId = 'unknown') {
    console.log(`[${requestId}] 🔍 findUserByPurchaseToken() started`);
    console.log(`[${requestId}] 🎯 Searching for purchase token: ${purchaseToken?.substring(0, 20)}...${purchaseToken?.substring(-10)}`);
    
    try {
        // Search query
        const searchQuery = {
            $or: [
                { purchaseToken: purchaseToken },
                { lastPurchaseToken: purchaseToken },
                { 'planHistory.transactionId': purchaseToken }
            ]
        };
        
        console.log(`[${requestId}] 📋 Search query:`, JSON.stringify(searchQuery, null, 2));
        console.log(`[${requestId}] 🔍 Searching in fields:`);
        console.log(`[${requestId}]   - purchaseToken (current active token)`);
        console.log(`[${requestId}]   - lastPurchaseToken (previous token)`);
        console.log(`[${requestId}]   - planHistory.transactionId (historical transactions)`);
        
        const user = await User.findOne(searchQuery);
        
        if (user) {
            console.log(`[${requestId}] ✅ User found!`);
            console.log(`[${requestId}] 👤 User details:`);
            console.log(`[${requestId}]   - ID: ${user._id}`);
            console.log(`[${requestId}]   - Email: ${user.email}`);
            console.log(`[${requestId}]   - Name: ${user.name}`);
            console.log(`[${requestId}]   - Current Plan: ${user.plan}`);
            console.log(`[${requestId}]   - Current Purchase Token: ${user.purchaseToken?.substring(0, 20)}...`);
            console.log(`[${requestId}]   - Last Purchase Token: ${user.lastPurchaseToken?.substring(0, 20)}...`);
            console.log(`[${requestId}]   - Plan Expires At: ${user.planExpiresAt}`);
            console.log(`[${requestId}]   - Payment Verified: ${user.isPaymentVerified}`);
            console.log(`[${requestId}]   - Plan History Count: ${user.planHistory?.length || 0}`);
            
            // Check which field matched
            if (user.purchaseToken === purchaseToken) {
                console.log(`[${requestId}] 🎯 Match found in: purchaseToken (current active)`);
            } else if (user.lastPurchaseToken === purchaseToken) {
                console.log(`[${requestId}] 🎯 Match found in: lastPurchaseToken (previous)`);
            } else {
                const historyMatch = user.planHistory?.find(h => h.transactionId === purchaseToken);
                if (historyMatch) {
                    console.log(`[${requestId}] 🎯 Match found in: planHistory.transactionId`);
                    console.log(`[${requestId}] 📋 Matching history entry:`, JSON.stringify(historyMatch, null, 2));
                }
            }
        } else {
            console.log(`[${requestId}] ❌ No user found for purchase token`);
            console.log(`[${requestId}] 🔍 Attempted searches:`);
            console.log(`[${requestId}]   - Current purchase tokens`);
            console.log(`[${requestId}]   - Previous purchase tokens`);
            console.log(`[${requestId}]   - Historical transaction IDs`);
            
            // Additional debugging - let's see if there are any users with similar tokens
            try {
                const partialToken = purchaseToken?.substring(0, 10);
                const similarUsers = await User.find({
                    $or: [
                        { purchaseToken: { $regex: partialToken, $options: 'i' } },
                        { lastPurchaseToken: { $regex: partialToken, $options: 'i' } }
                    ]
                }).limit(5);
                
                if (similarUsers.length > 0) {
                    console.log(`[${requestId}] 🔍 Found ${similarUsers.length} users with similar token patterns:`);
                    similarUsers.forEach((u, index) => {
                        console.log(`[${requestId}]   ${index + 1}. ${u.email} - current: ${u.purchaseToken?.substring(0, 15)}..., last: ${u.lastPurchaseToken?.substring(0, 15)}...`);
                    });
                } else {
                    console.log(`[${requestId}] 🔍 No users found with similar token patterns`);
                }
            } catch (debugError) {
                console.log(`[${requestId}] ⚠️ Debug search failed:`, debugError.message);
            }
        }
        
        console.log(`[${requestId}] ✅ findUserByPurchaseToken() completed`);
        return user;
        
    } catch (error) {
        console.log(`[${requestId}] ❌ Error in findUserByPurchaseToken():`);
        console.log(`[${requestId}] Error name:`, error.name);
        console.log(`[${requestId}] Error message:`, error.message);
        console.log(`[${requestId}] Error stack:`, error.stack);
        return null;
    }
}

/**
 * Helper function to update user subscription based on notification
 */
async function updateUserSubscription(user, notification, notificationType, requestId = 'unknown') {
    console.log(`[${requestId}] 🔄 updateUserSubscription() started`);
    console.log(`[${requestId}] Input parameters:`);
    console.log(`[${requestId}]   - User ID: ${user._id}`);
    console.log(`[${requestId}]   - User Email: ${user.email}`);
    console.log(`[${requestId}]   - Notification Type: ${notificationType}`);
    console.log(`[${requestId}]   - Notification Object:`, JSON.stringify(notification, null, 2));
    
    try {
        let updateData = {};
        let message = '';
        let additionalInfo = {};

        console.log(`[${requestId}] 🔀 Processing notification type: ${notificationType}`);

        // Store user's current state before update
        const userStateBefore = {
            plan: user.plan,
            billing_cycle: user.billing_cycle,
            planExpiresAt: user.planExpiresAt,
            isPaymentVerified: user.isPaymentVerified,
            purchaseToken: user.purchaseToken,
            lastPurchaseToken: user.lastPurchaseToken
        };
        console.log(`[${requestId}] 📊 User state BEFORE update:`, JSON.stringify(userStateBefore, null, 2));

        switch (notificationType) {
            case 'SUBSCRIPTION_RENEWED':
                console.log(`[${requestId}] 🔄 Processing SUBSCRIPTION_RENEWED...`);
                console.log(`[${requestId}] 🔍 Verifying purchase with Google Play API...`);
                
                const verification = await verifyAndroidPurchase('com.sitehaazri.app', notification.purchaseToken, requestId);
                console.log(`[${requestId}] 📋 Google Play verification result:`, JSON.stringify(verification, null, 2));

                if (verification.success) {
                    console.log(`[${requestId}] ✅ Google Play verification successful`);
                    
                    // Calculate billing cycle
                    const expiryDate = new Date(verification.expires);
                    const currentDate = new Date();
                    const diffInMs = expiryDate - currentDate;
                    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
                    const billingCycle = diffInDays > 180 ? 'yearly' : 'monthly';
                    
                    console.log(`[${requestId}] 📅 Billing cycle calculation:`);
                    console.log(`[${requestId}]   - Expiry Date: ${expiryDate.toISOString()}`);
                    console.log(`[${requestId}]   - Current Date: ${currentDate.toISOString()}`);
                    console.log(`[${requestId}]   - Difference in days: ${diffInDays}`);
                    console.log(`[${requestId}]   - Calculated billing cycle: ${billingCycle}`);

                    updateData = {
                        plan: verification.productId,
                        billing_cycle: billingCycle,
                        planExpiresAt: expiryDate,
                        isPaymentVerified: true,
                        lastPurchaseToken: user.purchaseToken,
                        purchaseToken: notification.purchaseToken,
                        planActivatedAt: new Date()
                    };
                    
                    message = 'Subscription renewed successfully';
                    additionalInfo = {
                        originalProductId: verification.originalProductId,
                        subscriptionId: verification.subscriptionId,
                        regionCode: verification.regionCode,
                        subscriptionState: verification.subscriptionState
                    };
                    
                    console.log(`[${requestId}] ✅ Renewal update data prepared:`, JSON.stringify(updateData, null, 2));
                } else {
                    console.log(`[${requestId}] ❌ Google Play verification failed:`, verification.error);
                    message = `Renewal verification failed: ${verification.error}`;
                    return { 
                        success: false, 
                        error: verification.error, 
                        userId: user._id,
                        message: message,
                        requestId: requestId
                    };
                }
                break;

            case 'SUBSCRIPTION_CANCELED':
                console.log(`[${requestId}] 🚫 Processing SUBSCRIPTION_CANCELED...`);
                updateData = {
                    plan: 'free',
                    billing_cycle: 'monthly',
                    isPaymentVerified: false,
                    lastPurchaseToken: user.purchaseToken,
                    purchaseToken: null,
                    planExpiresAt: null
                };
                message = 'Subscription cancelled - reverted to free plan';
                console.log(`[${requestId}] ✅ Cancellation update data prepared:`, JSON.stringify(updateData, null, 2));
                break;

            case 'SUBSCRIPTION_EXPIRED':
                console.log(`[${requestId}] ⏰ Processing SUBSCRIPTION_EXPIRED...`);
                updateData = {
                    plan: 'free',
                    billing_cycle: 'monthly',
                    isPaymentVerified: false,
                    lastPurchaseToken: user.purchaseToken,
                    purchaseToken: null,
                    planExpiresAt: null
                };
                message = 'Subscription expired - reverted to free plan';
                console.log(`[${requestId}] ✅ Expiration update data prepared:`, JSON.stringify(updateData, null, 2));
                break;

            case 'SUBSCRIPTION_RECOVERED':
                console.log(`[${requestId}] 🔄 Processing SUBSCRIPTION_RECOVERED...`);
                console.log(`[${requestId}] 🔍 Verifying recovered subscription with Google Play API...`);
                
                const recoveryVerification = await verifyAndroidPurchase('com.sitehaazri.app', notification.purchaseToken, requestId);
                console.log(`[${requestId}] 📋 Recovery verification result:`, JSON.stringify(recoveryVerification, null, 2));

                if (recoveryVerification.success) {
                    const expiryDate = new Date(recoveryVerification.expires);
                    const currentDate = new Date();
                    const diffInMs = expiryDate - currentDate;
                    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
                    const billingCycle = diffInDays > 180 ? 'yearly' : 'monthly';

                    updateData = {
                        plan: recoveryVerification.productId,
                        billing_cycle: billingCycle,
                        planExpiresAt: expiryDate,
                        isPaymentVerified: true,
                        lastPurchaseToken: user.purchaseToken,
                        purchaseToken: notification.purchaseToken,
                        planActivatedAt: new Date()
                    };
                    message = 'Subscription recovered successfully';
                    console.log(`[${requestId}] ✅ Recovery update data prepared:`, JSON.stringify(updateData, null, 2));
                } else {
                    console.log(`[${requestId}] ❌ Recovery verification failed:`, recoveryVerification.error);
                    message = `Recovery verification failed: ${recoveryVerification.error}`;
                    return { 
                        success: false, 
                        error: recoveryVerification.error, 
                        userId: user._id,
                        message: message,
                        requestId: requestId
                    };
                }
                break;

            default:
                console.log(`[${requestId}] ⚠️ Unknown notification type: ${notificationType}`);
                message = `Unknown notification type processed: ${notificationType}`;
                console.log(`[${requestId}] ℹ️ No database update will be performed for unknown notification type`);
        }

        // Perform database update if we have update data
        if (Object.keys(updateData).length > 0) {
            console.log(`[${requestId}] 💾 Performing database update...`);
            console.log(`[${requestId}] 🎯 Target User ID: ${user._id}`);
            console.log(`[${requestId}] 📝 Update data:`, JSON.stringify(updateData, null, 2));
            
            try {
                const updateResult = await User.findByIdAndUpdate(
                    user._id, 
                    updateData, 
                    { 
                        new: true, // Return updated document
                        runValidators: true // Run schema validators
                    }
                );
                
                if (!updateResult) {
                    console.log(`[${requestId}] ❌ Database update failed - user not found or update failed`);
                    return { 
                        success: false, 
                        error: 'User not found or update failed', 
                        userId: user._id,
                        message: 'Database update failed',
                        requestId: requestId
                    };
                }
                
                console.log(`[${requestId}] ✅ Database update successful!`);
                console.log(`[${requestId}] 📊 Updated user data:`, {
                    id: updateResult._id,
                    email: updateResult.email,
                    plan: updateResult.plan,
                    billing_cycle: updateResult.billing_cycle,
                    planExpiresAt: updateResult.planExpiresAt,
                    isPaymentVerified: updateResult.isPaymentVerified,
                    purchaseToken: updateResult.purchaseToken?.substring(0, 20) + '...',
                    lastPurchaseToken: updateResult.lastPurchaseToken?.substring(0, 20) + '...'
                });

                // Log the changes made
                const userStateAfter = {
                    plan: updateResult.plan,
                    billing_cycle: updateResult.billing_cycle,
                    planExpiresAt: updateResult.planExpiresAt,
                    isPaymentVerified: updateResult.isPaymentVerified,
                    purchaseToken: updateResult.purchaseToken,
                    lastPurchaseToken: updateResult.lastPurchaseToken
                };
                
                console.log(`[${requestId}] 📊 User state AFTER update:`, JSON.stringify(userStateAfter, null, 2));
                console.log(`[${requestId}] 🔄 Changes made:`);
                Object.keys(updateData).forEach(key => {
                    const oldValue = userStateBefore[key];
                    const newValue = userStateAfter[key];
                    if (oldValue !== newValue) {
                        console.log(`[${requestId}]   - ${key}: ${oldValue} → ${newValue}`);
                    }
                });
                
            } catch (dbError) {
                console.log(`[${requestId}] ❌ Database update error:`, dbError.message);
                console.log(`[${requestId}] 📋 Database error details:`, dbError);
                return { 
                    success: false, 
                    error: `Database update failed: ${dbError.message}`, 
                    userId: user._id,
                    message: 'Database update error',
                    requestId: requestId
                };
            }
        } else {
            console.log(`[${requestId}] ℹ️ No database update needed - updateData is empty`);
        }

        const successResult = { 
            success: true, 
            message, 
            userId: user._id,
            updateData: updateData,
            additionalInfo: additionalInfo,
            requestId: requestId
        };
        
        console.log(`[${requestId}] ✅ updateUserSubscription() completed successfully`);
        console.log(`[${requestId}] 📤 Returning result:`, JSON.stringify(successResult, null, 2));
        
        return successResult;

    } catch (error) {
        console.log(`[${requestId}] ❌ CRITICAL ERROR in updateUserSubscription():`);
        console.log(`[${requestId}] Error name:`, error.name);
        console.log(`[${requestId}] Error message:`, error.message);
        console.log(`[${requestId}] Error stack:`, error.stack);
        
        const errorResult = { 
            success: false, 
            error: error.message, 
            userId: user._id,
            message: `Update failed: ${error.message}`,
            requestId: requestId
        };
        
        console.log(`[${requestId}] 📤 Returning error result:`, JSON.stringify(errorResult, null, 2));
        return errorResult;
    }
}

/**
 * Google Cloud Pub/Sub Webhook Endpoint
 * Receives real-time subscription notifications from Google Play
 */
router.post('/notifications', async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`\n🔔 [${requestId}] ===== NOTIFICATION WEBHOOK STARTED =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Request Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[${requestId}] Request Body Type:`, typeof req.body);
    console.log(`[${requestId}] Request Body Length:`, req.body ? req.body.length : 'null');
    
    try {
        // Step 1: Parse raw request body
        console.log(`[${requestId}] 📥 Step 1: Parsing raw request body...`);
        let rawBody;
        if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString();
            console.log(`[${requestId}] ✅ Body is Buffer, converted to string`);
        } else if (typeof req.body === 'string') {
            rawBody = req.body;
            console.log(`[${requestId}] ✅ Body is already string`);
        } else {
            rawBody = JSON.stringify(req.body);
            console.log(`[${requestId}] ✅ Body converted from object to string`);
        }
        console.log(`[${requestId}] Raw body preview:`, rawBody.substring(0, 200) + '...');

        // Step 2: Parse Pub/Sub message
        console.log(`[${requestId}] 📥 Step 2: Parsing Pub/Sub message...`);
        const pubsubMessage = JSON.parse(rawBody);
        console.log(`[${requestId}] ✅ Pub/Sub message parsed successfully`);
        console.log(`[${requestId}] Pub/Sub message structure:`, {
            hasMessage: !!pubsubMessage.message,
            hasData: !!pubsubMessage.message?.data,
            hasAttributes: !!pubsubMessage.message?.attributes,
            messageId: pubsubMessage.message?.messageId,
            publishTime: pubsubMessage.message?.publishTime
        });

        // Step 3: Decode base64 data
        console.log(`[${requestId}] 🔓 Step 3: Decoding base64 data...`);
        if (!pubsubMessage.message?.data) {
            throw new Error('No data field in Pub/Sub message');
        }
        
        const decodedData = Buffer.from(pubsubMessage.message.data, 'base64').toString('utf-8');
        console.log(`[${requestId}] ✅ Base64 data decoded successfully`);
        console.log(`[${requestId}] Decoded data:`, decodedData);

        // Step 4: Parse notification data
        console.log(`[${requestId}] 📋 Step 4: Parsing notification data...`);
        const notificationData = JSON.parse(decodedData);
        console.log(`[${requestId}] ✅ Notification data parsed successfully`);
        console.log(`[${requestId}] Full notification data:`, JSON.stringify(notificationData, null, 2));

        // Step 5: Extract subscription details
        console.log(`[${requestId}] 🔍 Step 5: Extracting subscription details...`);
        const subscription = notificationData.subscriptionNotification;
        if (!subscription) {
            throw new Error('No subscriptionNotification in notification data');
        }

        const notificationType = subscription.notificationType;
        const purchaseToken = subscription.purchaseToken;
        const subscriptionId = subscription.subscriptionId;
        
        console.log(`[${requestId}] ✅ Subscription details extracted:`);
        console.log(`[${requestId}]   - Notification Type: ${notificationType}`);
        console.log(`[${requestId}]   - Purchase Token: ${purchaseToken?.substring(0, 20)}...${purchaseToken?.substring(-10)}`);
        console.log(`[${requestId}]   - Subscription ID: ${subscriptionId}`);
        console.log(`[${requestId}]   - Full subscription object:`, JSON.stringify(subscription, null, 2));

        // Step 6: Find user by purchase token
        console.log(`[${requestId}] 👤 Step 6: Finding user by purchase token...`);
        const user = await findUserByPurchaseToken(purchaseToken, requestId);
        
        if (!user) {
            console.log(`[${requestId}] ❌ No user found for purchase token: ${purchaseToken?.substring(0, 20)}...`);
            console.log(`[${requestId}] 🔍 Searched in fields: purchaseToken, lastPurchaseToken, planHistory.transactionId`);
            
            return res.status(200).json({
                message: 'No user found for purchase token',
                acknowledged: true,
                requestId: requestId,
                purchaseToken: purchaseToken?.substring(0, 20) + '...',
                notificationType: notificationType
            });
        }

        console.log(`[${requestId}] ✅ User found:`);
        console.log(`[${requestId}]   - User ID: ${user._id}`);
        console.log(`[${requestId}]   - Email: ${user.email}`);
        console.log(`[${requestId}]   - Current Plan: ${user.plan}`);
        console.log(`[${requestId}]   - Current Purchase Token: ${user.purchaseToken?.substring(0, 20)}...`);
        console.log(`[${requestId}]   - Last Purchase Token: ${user.lastPurchaseToken?.substring(0, 20)}...`);
        console.log(`[${requestId}]   - Plan Expires At: ${user.planExpiresAt}`);
        console.log(`[${requestId}]   - Is Payment Verified: ${user.isPaymentVerified}`);

        // Step 7: Update user subscription
        console.log(`[${requestId}] 🔄 Step 7: Updating user subscription...`);
        const updateResult = await updateUserSubscription(user, subscription, notificationType, requestId);

        console.log(`[${requestId}] ${updateResult.success ? '✅ SUCCESS' : '❌ FAILED'}: ${updateResult.message}`);
        if (updateResult.updateData) {
            console.log(`[${requestId}] 📊 Update data applied:`, JSON.stringify(updateResult.updateData, null, 2));
        }
        if (updateResult.error) {
            console.log(`[${requestId}] ❌ Update error:`, updateResult.error);
        }

        // Step 8: Send response
        console.log(`[${requestId}] 📤 Step 8: Sending response...`);
        const response = {
            message: 'Notification processed successfully',
            success: updateResult.success,
            acknowledged: true,
            requestId: requestId,
            notificationType: notificationType,
            userId: user._id.toString(),
            updateResult: updateResult.message
        };

        console.log(`[${requestId}] ✅ Response:`, JSON.stringify(response, null, 2));
        console.log(`[${requestId}] ===== NOTIFICATION WEBHOOK COMPLETED =====\n`);

        res.status(200).json(response);

    } catch (error) {
        console.log(`[${requestId}] ❌ CRITICAL ERROR in notification webhook:`);
        console.log(`[${requestId}] Error name:`, error.name);
        console.log(`[${requestId}] Error message:`, error.message);
        console.log(`[${requestId}] Error stack:`, error.stack);
        
        const errorResponse = {
            message: 'Error processing notification',
            error: error.message,
            acknowledged: true,
            requestId: requestId,
            timestamp: new Date().toISOString()
        };

        console.log(`[${requestId}] 📤 Error response:`, JSON.stringify(errorResponse, null, 2));
        console.log(`[${requestId}] ===== NOTIFICATION WEBHOOK FAILED =====\n`);

        res.status(200).json(errorResponse);
    }
});

// Test endpoint for development only
router.post('/test-notification', async (req, res) => {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: 'Endpoint not found' });
    }

    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`\n🧪 [${testId}] ===== TEST NOTIFICATION STARTED =====`);
    console.log(`[${testId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${testId}] Request body:`, JSON.stringify(req.body, null, 2));

    try {
        const { notificationType, purchaseToken } = req.body;

        if (!notificationType || !purchaseToken) {
            console.log(`[${testId}] ❌ Missing required parameters`);
            return res.status(400).json({ 
                error: 'notificationType and purchaseToken required',
                testId: testId
            });
        }

        console.log(`[${testId}] 🔍 Finding user for test...`);
        const user = await findUserByPurchaseToken(purchaseToken, testId);
        
        if (!user) {
            console.log(`[${testId}] ❌ User not found for test`);
            return res.status(404).json({ 
                error: 'User not found',
                testId: testId,
                purchaseToken: purchaseToken.substring(0, 20) + '...'
            });
        }

        console.log(`[${testId}] 🔄 Running test update...`);
        const updateResult = await updateUserSubscription(
            user, 
            { notificationType, purchaseToken }, 
            notificationType, 
            testId
        );

        console.log(`[${testId}] ✅ Test completed`);
        console.log(`[${testId}] ===== TEST NOTIFICATION COMPLETED =====\n`);

        res.status(200).json({
            message: 'Test processed successfully',
            result: updateResult,
            testId: testId
        });

    } catch (error) {
        console.log(`[${testId}] ❌ Test error:`, error.message);
        console.log(`[${testId}] ===== TEST NOTIFICATION FAILED =====\n`);
        
        res.status(500).json({ 
            error: error.message,
            testId: testId
        });
    }
});

module.exports = router;
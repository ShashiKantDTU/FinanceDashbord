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
            if(lineItem.productId === 'pro_monthly'){
                lineItem.productId = 'pro';
            }else if(lineItem.productId === 'haazri_automate'){
                lineItem.productId = 'premium';
            }
            return {
                success: true,
                productId: lineItem.productId,
                expires: new Date(lineItem.expiryTime),
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
        if(!user){
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

            // Update user's subscription in database - use productId directly
            await User.findByIdAndUpdate(user.id, {
                plan: verificationResult.productId,
                billing_cycle: billingCycle,
                planExpiresAt: new Date(verificationResult.expires),
                planActivatedAt: new Date(),
                isPaymentVerified: true
            });

            res.status(200).json({
                message: 'Subscription activated successfully!',
                plan: verificationResult.productId,
                billing_cycle: billingCycle,
                expires_at: verificationResult.expires
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
        planExpiry: req.user.planExpiresAt
    })


})

module.exports = router;
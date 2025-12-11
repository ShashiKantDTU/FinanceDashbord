const mongoose = require('mongoose');
const path = require('path');
// Load env from Backend/.env regardless of where script is run
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/Userschema');
const playPurchaseRoutes = require('../Routes/playPurchase');
const { sendWebhook } = require('../Utils/refferalWebhook');

const verifyAndroidPurchase = playPurchaseRoutes.verifyAndroidPurchase;
const activateAllUserSites = playPurchaseRoutes.activateAllUserSites;

async function manualVerify(identifier, purchaseToken) {
  try {
    console.log('🔍 Connecting to database...');
    
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/finance-dashboard';
    // Log the URI (masking credentials) to verify we are hitting the right DB
    const maskedURI = mongoURI.replace(/:([^:@]+)@/, ':****@');
    console.log(`📡 Target DB: ${maskedURI}`);

    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    let user;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        user = await User.findById(identifier);
    } 
    
    if (!user) {
        // Try as phone number
        let phone = identifier.replace(/\s+/g, ''); // Remove spaces
        // If it doesn't start with +, add +91 (assuming India if not specified)
        if (!phone.startsWith('+')) {
            phone = '+91' + phone;
        }
        console.log(`🔍 Searching for user with phone: ${phone}`);
        user = await User.findOne({ phoneNumber: phone });
    }

    if (!user) {
      console.error(`❌ User not found with identifier: ${identifier}`);
      process.exit(1);
    }

    console.log(`👤 Verifying purchase for user: ${user.name || 'Unknown'} (${user.phoneNumber || user.email}) [${user._id}]`);
    console.log(`🎟️ Token: ${purchaseToken}`);

    const packageName = "com.sitehaazri.app";
    const verificationResult = await verifyAndroidPurchase(packageName, purchaseToken, `manual_${user._id}`);

    if (verificationResult.success) {
      console.log('✅ Google Verification Successful!');
      console.log('Product:', verificationResult.productId);
      console.log('Expires:', verificationResult.expires);

      const billingCycle = verificationResult.originalProductId.includes("yearly") ? "yearly" : "monthly";

      await User.updateOne(
        { _id: user.id },
        {
          $set: {
            plan: verificationResult.productId,
            billing_cycle: billingCycle,
            planSource: "google_play",
            purchaseToken: purchaseToken,
            lastPurchaseToken: user.purchaseToken || null,
            isPaymentVerified: true, // Manually verified, so true
            isTrial: false,
            isCancelled: false,
            isGrace: false,
            graceExpiresAt: null,
            planActivatedAt: new Date(),
          },
          $max: {
            planExpiresAt: verificationResult.expires,
          },
        }
      );

      await activateAllUserSites(user.id);
      console.log('✅ User updated and sites activated.');

      // Send webhook if needed
       try {
        let isUpgrade = false;
        if (user.phoneNumber) {
          await sendWebhook(
            user.phoneNumber,
            verificationResult.productId === "pro" ? 299 : 499,
            verificationResult.expires,
            isUpgrade,
            purchaseToken
          );
          console.log('✅ Webhook sent.');
        } else {
            console.log('⚠️ No phone number, webhook skipped.');
        }
      } catch (webhookError) {
        console.error('❌ Failed to send webhook:', webhookError.message);
      }

    } else {
      console.error('❌ Verification Failed:', verificationResult.error);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/manual_verify_purchase.js <userId_or_phone> <purchaseToken>');
  process.exit(1);
}

manualVerify(args[0], args[1]);

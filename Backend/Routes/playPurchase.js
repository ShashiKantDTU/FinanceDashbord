const express = require("express");
const { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");
const router = express.Router();
const User = require("../models/Userschema");
const Site = require("../models/Siteschema");
const { authenticateToken } = require("../Middleware/auth");
const {
  sendWebhook,
  sendCancellationWebhook,
  sendPlanStatusChangeWebhook,
} = require("../Utils/refferalWebhook");

require("dotenv").config();

const client = new OAuth2Client();

// Function to activate all sites of User inCase of plan upgrade
async function activateAllUserSites(userId) {
  try {
    // Activate all sites owned by the user in one efficient query
    await Site.updateMany({ owner: userId }, { $set: { isActive: true } });
    console.log(`All sites activated for user: ${userId}`);
  } catch (error) {
    console.error("Error activating user sites:", error);
  }
}

// JWT Authentication Middleware for Webhook
async function authenticateWebhook(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      console.log(
        "❌ Webhook authentication failed: Missing Authorization header"
      );
      return res.status(401).send("Unauthorized: Missing Authorization header");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log(
        "❌ Webhook authentication failed: Invalid Authorization header format"
      );
      return res
        .status(401)
        .send("Unauthorized: Invalid Authorization header format");
    }

    // Use the correct audience from environment variable
    const expectedAudience = process.env.GOOGLE_WEBHOOK_AUDIENCE;
    if (!expectedAudience) {
      console.error(
        "CRITICAL: GOOGLE_WEBHOOK_AUDIENCE environment variable is not set."
      );
      return res.status(500).send("Server configuration error.");
    }

    // Verify the JWT token against Google's public keys
    await client.verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });

    console.log("✅ Webhook authentication successful");
    next();
  } catch (error) {
    console.error("❌ Webhook authentication failed:", error.message);
    return res.status(401).send("Unauthorized: Invalid token");
  }
}

function getNotificationTypeName(notificationType) {
  const notificationTypes = {
    1: "SUBSCRIPTION_RECOVERED",
    2: "SUBSCRIPTION_RENEWED",
    3: "SUBSCRIPTION_CANCELED",
    4: "SUBSCRIPTION_PURCHASED",
    5: "SUBSCRIPTION_ON_HOLD",
    6: "SUBSCRIPTION_IN_GRACE_PERIOD",
    7: "SUBSCRIPTION_RESTARTED",
    8: "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED_DEPRECATED",
    9: "SUBSCRIPTION_DEFERRED",
    10: "SUBSCRIPTION_PAUSED",
    11: "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED",
    12: "SUBSCRIPTION_REVOKED",
    13: "SUBSCRIPTION_EXPIRED",
    19: "SUBSCRIPTION_PRICE_CHANGE_UPDATED",
    20: "SUBSCRIPTION_PENDING_PURCHASE_CANCELED",
  };
  return (
    notificationTypes[notificationType] || `UNKNOWN_TYPE_${notificationType}`
  );
}

async function verifyAndroidPurchase(
  packageName,
  purchaseToken,
  requestId = "unknown"
) {
  console.log(
    `[${requestId}] Verifying purchase: ${purchaseToken?.substring(0, 20)}...`
  );

  try {
    const serviceAccountCredentials = JSON.parse(
      process.env.PLAY_BILLING_SERVICE_KEY
    );
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountCredentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    const androidpublisher = google.androidpublisher({
      version: "v3",
      auth: auth,
    });

    const response = await androidpublisher.purchases.subscriptionsv2.get({
      packageName: packageName,
      token: purchaseToken,
    });

    // Check for valid subscription states (active or in grace period)
    if (
      response.data &&
      (response.data.subscriptionState === "SUBSCRIPTION_STATE_ACTIVE" ||
        response.data.subscriptionState ===
          "SUBSCRIPTION_STATE_IN_GRACE_PERIOD")
    ) {
      const lineItem = response.data.lineItems[0];
      const originalProductId = lineItem.productId;

      // Map product IDs to internal plan names
      let mappedProductId = lineItem.productId;
      if (lineItem.productId === "pro_monthly") {
        mappedProductId = "pro";
      } else if (lineItem.productId === "haazri_automate") {
        mappedProductId = "premium";
      }

      console.log(
        `[${requestId}] ✅ Verification successful: ${originalProductId} → ${mappedProductId}, expires: ${lineItem.expiryTime}`
      );

      return {
        success: true,
        productId: mappedProductId,
        originalProductId: originalProductId,
        expires: new Date(lineItem.expiryTime),
        gracePeriodEndTime: lineItem.gracePeriodEndTime
          ? new Date(lineItem.gracePeriodEndTime)
          : null,
        subscriptionState: response.data.subscriptionState,
        startTime: response.data.startTime
          ? new Date(response.data.startTime)
          : null,
        regionCode: response.data.regionCode || null,
        subscriptionId: response.data.subscriptionId || null,
      };
    } else {
      console.log(
        `[${requestId}] ❌ Subscription not active: ${
          response.data?.subscriptionState || "unknown"
        }`
      );
      return {
        success: false,
        error: `Subscription is not active. State: ${
          response.data?.subscriptionState || "unknown"
        }`,
        subscriptionState: response.data?.subscriptionState,
        rawResponse: response.data,
      };
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Google API Error:`, error.message);
    if (error.response) {
      console.error(
        `[${requestId}] Error response:`,
        error.response.status,
        error.response.data
      );
    }

    return {
      success: false,
      error: `Failed to verify purchase with Google: ${error.message}`,
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorData: error.response?.data,
    };
  }
}

// Purchase verification endpoint (READ-ONLY)
// This endpoint only verifies the purchase with Google but does NOT update the database
// The webhook handles all database updates to prevent race conditions
router.post("/verify-android-purchase", authenticateToken, async (req, res) => {
  try {
    const { purchaseToken } = req.body;
    const user = req.user;
    const packageName = "com.sitehaazri.app";

    if (!purchaseToken) {
      return res.status(400).json({ error: "Purchase token is required." });
    }
    if (!user) {
      return res.status(400).json({ error: "User is not authenticated." });
    }

    // --- NEW LOGIC: CHECK FIRST ---
    // Check if the webhook has already processed this exact token.
    if (
      user.purchaseToken === purchaseToken &&
      user.isPaymentVerified === true
    ) {
      console.log(
        `✅ Plan already activated by webhook for user: ${
          user.phoneNumber || user.email
        }. Skipping provisional update.`
      );
      return res.status(200).json({
        message: "Your plan is already active.",
        plan: user.plan,
        billing_cycle: user.billing_cycle,
        expires_at: user.planExpiresAt,
        purchase_token: user.purchaseToken,
        plan_source: user.planSource,
        provisional: false, // It's fully verified
      });
    }
    // --- END OF NEW LOGIC ---

    const verificationResult = await verifyAndroidPurchase(
      packageName,
      purchaseToken,
      `frontend_${user.id}`
    );

    if (verificationResult.success) {
      // Determine billing cycle from the original product ID (more reliable)
      const billingCycle = verificationResult.originalProductId.includes(
        "yearly"
      )
        ? "yearly"
        : "monthly";

      // Provisional access: set plan and expiry immediately, but keep isPaymentVerified=false
      await User.updateOne(
        { _id: user.id }, // We can simplify the condition now
        {
          $set: {
            plan: verificationResult.productId,
            billing_cycle: billingCycle,
            planSource: "google_play",
            purchaseToken: purchaseToken,
            lastPurchaseToken: user.purchaseToken || null,
            isPaymentVerified: false,
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

      // Instant access: activate all sites immediately; webhook will reconcile if needed
      await activateAllUserSites(user.id);

      console.log(
        `✅ Provisional access granted for user: ${
          user.phoneNumber || user.email
        } → ${verificationResult.productId}. Awaiting webhook.`
      );

      try {

        // Validate phone number before sending webhook
        isUpgrade = false; // Disable upgrade detection for now
        if (!user.phoneNumber) {
          console.error(
        `User ${user._id} has no phone number, cannot send webhook`
          );
        } else {
          await sendWebhook(
        user.phoneNumber,
        verificationResult.productId === "pro" ? 299 : 499,
        verificationResult.expires,
        isUpgrade,
        purchaseToken // Add purchaseToken for idempotency
          );
          console.log(
        `✅ Payment webhook sent (isUpgrade: ${isUpgrade}, token: ${purchaseToken?.substring(
          0,
          20
        )}...)`
          );
        }
      } catch (webhookError) {
        console.error(
          `❌ Failed to send payment webhook:`,
          webhookError.message
        );
        // Continue with user update even if webhook fails
      }

      res.status(200).json({
        message:
          "Purchase successful! Your plan is now active (awaiting final verification).",
        plan: verificationResult.productId,
        billing_cycle: billingCycle,
        expires_at: verificationResult.expires,
        purchase_token: purchaseToken,
        plan_source: "google_play",
        provisional: true,
      });
    } else {
      console.log(
        `❌ Frontend verification failed for user: ${user.email} - ${verificationResult.error}`
      );
      res.status(400).json({ error: verificationResult.error });
    }
  } catch (error) {
    console.error("Purchase verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/plan", authenticateToken, async (req, res) => {
  if (!req.user.plan) {
    req.user.plan = "free";
  }

  if (req.user.plan === "free") {
    req.user.billing_cycle = "monthly";
  }

  const response = {
    plan: req.user.plan,
    billing_cycle: req.user.billing_cycle,
    planExpiry: req.user.planExpiresAt,
    planActivatedAt: req.user.planActivatedAt,
    planSource: req.user.planSource,
    isPaymentVerified: req.user.isPaymentVerified,
  };

  // Only include isTrial, isCancelled, isGrace, and purchaseToken for normal users, not supervisors
  if (req.user.role !== "Supervisor") {
    response.isTrial = req.user.isTrial || false;
    response.isCancelled = req.user.isCancelled || false;
    response.isGrace = req.user.isGrace || false;
    response.purchaseToken = req.user.purchaseToken || null;
  }

  return res.status(200).json(response);
});

// Debug endpoint to check user subscription details
router.get("/debug-user/:userId?", authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Endpoint not found" });
  }

  try {
    const userId = req.params.userId || req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
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
      purchaseToken: user.purchaseToken
        ? `${user.purchaseToken.substring(0, 20)}...`
        : null,
      lastPurchaseToken: user.lastPurchaseToken
        ? `${user.lastPurchaseToken.substring(0, 20)}...`
        : null,
      planSource: user.planSource,
      planHistoryCount: user.planHistory?.length || 0,
      planHistory:
        user.planHistory?.map((h) => ({
          plan: h.plan,
          purchasedAt: h.purchasedAt,
          expiresAt: h.expiresAt,
          platform: h.platform,
          source: h.source,
          isActive: h.isActive,
          transactionId: h.transactionId
            ? `${h.transactionId.substring(0, 20)}...`
            : null,
        })) || [],
    };

    res.status(200).json({
      message: "Debug info retrieved",
      user: debugInfo,
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function findUserByPurchaseToken(purchaseToken, requestId = "unknown") {
  try {
    const searchQuery = {
      $or: [
        { purchaseToken: purchaseToken },
        { lastPurchaseToken: purchaseToken },
        { "planHistory.transactionId": purchaseToken },
      ],
    };

    const user = await User.findOne(searchQuery);

    if (user) {
      console.log(
        `[${requestId}] ✅ User found: ${user.phoneNumber} (${user.plan})`
      );
    } else {
      console.log(
        `[${requestId}] ❌ No user found for token: ${purchaseToken?.substring(
          0,
          20
        )}...`
      );
    }

    return user;
  } catch (error) {
    console.error(`[${requestId}] ❌ Error finding user:`, error.message);
    return null;
  }
}

async function updateUserSubscription(
  user,
  notification,
  notificationType,
  requestId = "unknown"
) {
  try {
    let updateData = {};
    let message = "";
    let shouldActivateAllSites = false;

    switch (notificationType) {
      // Cases where a NEW expiry date is generated or entitlement should be active.
      case 4: // SUBSCRIPTION_PURCHASED
      case 2: // SUBSCRIPTION_RENEWED
      case 7: // SUBSCRIPTION_RESTARTED
      case 1: // SUBSCRIPTION_RECOVERED
        const verification = await verifyAndroidPurchase(
          "com.sitehaazri.app",
          notification.purchaseToken,
          requestId
        );
        if (verification.success) {
          // Determine billing cycle from the Product ID (more reliable than date calculation)
          const billingCycle = verification.originalProductId.includes("yearly")
            ? "yearly"
            : "monthly";

          // Send webhook for new payments: PURCHASED, RENEWED, and RESTARTED
          // Exclude RECOVERED (case 1) to avoid duplicate earnings during grace period recovery
          if (
            notificationType === 4 ||
            notificationType === 2 ||
            notificationType === 7
          ) {
            try {
              // Detect if this is an upgrade within the same billing cycle
              // Check if user activated plan within last 7 days
              // const isUpgrade =
              //   user.planActivatedAt &&
              //   new Date() - new Date(user.planActivatedAt) <
              //     7 * 24 * 60 * 60 * 1000;

              // Validate phone number before sending webhook
              isUpgrade = false; // Disable upgrade detection for now
              if (!user.phoneNumber) {
                console.error(
                  `[${requestId}] ❌ User ${user._id} has no phone number, cannot send webhook`
                );
              } else {
                await sendWebhook(
                  user.phoneNumber,
                  verification.productId === "pro" ? 299 : 499,
                  verification.expires,
                  isUpgrade,
                  notification.purchaseToken // Add purchaseToken for idempotency
                );
                console.log(
                  `[${requestId}] ✅ Payment webhook sent for ${getNotificationTypeName(
                    notificationType
                  )} (isUpgrade: ${isUpgrade}, token: ${notification.purchaseToken?.substring(
                    0,
                    20
                  )}...)`
                );
              }
            } catch (webhookError) {
              console.error(
                `[${requestId}] ❌ Failed to send payment webhook:`,
                webhookError.message
              );
              // Continue with user update even if webhook fails
            }
          }
          updateData = {
            plan: verification.productId,
            billing_cycle: billingCycle,
            planExpiresAt: verification.expires,
            isPaymentVerified: true,
            isCancelled: false,
            isGrace: false,
            isTrial: false, // User is now on paid plan, not trial
            graceExpiresAt: null,
            lastPurchaseToken: user.purchaseToken,
            purchaseToken: notification.purchaseToken,
            planActivatedAt: new Date(),
            planSource: "google_play",
            lastSiteUpdated: null, // Reset last site update to allow immediate site updates
          };
          message = `Subscription active. Type: ${getNotificationTypeName(
            notificationType
          )}.`;
          shouldActivateAllSites = true;
        } else {
          return {
            success: false,
            error: verification.error,
            userId: user._id,
            message: `Webhook received for ${getNotificationTypeName(
              notificationType
            )}, but verification failed.`,
          };
        }
        break;

      // Simple status change cases - trust the authenticated webhook
      case 3: // SUBSCRIPTION_CANCELED
        // CRITICAL FIX: Protect against stale webhook tokens
        if (notification.purchaseToken !== user.purchaseToken) {
          message = `Ignoring stale CANCELED notification for an old token. User is on a newer plan.`;
          console.log(`[${requestId}] ✅ ${message}`);
          return { success: true, message, userId: user._id, updateData: {} };
        }

        // Mark auto-renew/cancellation flag, but do not forcefully clear entitlements here.
        // Entitlement changes are handled by EXPIRED/REVOKED or a subsequent active event.

        // Send plan-status-changed webhook
        try {
          if (user.phoneNumber) {
            await sendPlanStatusChangeWebhook(
              user.phoneNumber,
              "cancelled",
              false,
              user.planExpiresAt || null,
              "User cancelled auto-renewal"
            );
            console.log(
              `[${requestId}] ✅ Plan status webhook sent for SUBSCRIPTION_CANCELED`
            );
          }
        } catch (webhookError) {
          console.error(
            `[${requestId}] ❌ Failed to send plan status webhook:`,
            webhookError.message
          );
        }

        updateData = {
          isCancelled: true,
          isGrace: false,
          graceExpiresAt: null,
          isPaymentVerified: false,
          lastPurchaseToken: user.purchaseToken,
        };
        message = "Subscription cancellation recorded.";
        break;

      case 5: // SUBSCRIPTION_ON_HOLD
        // CRITICAL FIX: Protect against stale webhook tokens
        if (notification.purchaseToken !== user.purchaseToken) {
          message = `Ignoring stale ON_HOLD notification for an old token. User is on a newer plan.`;
          console.log(`[${requestId}] ✅ ${message}`);
          return { success: true, message, userId: user._id, updateData: {} };
        }

        updateData = {
          isPaymentVerified: false,
          // Ensure cancelled flag is not left stale if user returns from hold
          isCancelled: false,
        };
        message = "Subscription is On Hold.";
        break;

      case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
        // CRITICAL FIX: Protect against stale webhook tokens
        if (notification.purchaseToken !== user.purchaseToken) {
          message = `Ignoring stale GRACE_PERIOD notification for an old token. User is on a newer plan.`;
          console.log(`[${requestId}] ✅ ${message}`);
          return { success: true, message, userId: user._id, updateData: {} };
        }

        // Verify to get the gracePeriodEndTime for accurate tracking
        const graceVerification = await verifyAndroidPurchase(
          "com.sitehaazri.app",
          notification.purchaseToken,
          requestId
        );
        if (graceVerification.success && graceVerification.gracePeriodEndTime) {
          updateData = {
            isGrace: true,
            isPaymentVerified: false,
            isCancelled: false,
            graceExpiresAt: graceVerification.gracePeriodEndTime,
            lastPurchaseToken: user.purchaseToken,
          };
          message = `Subscription in grace period until ${graceVerification.gracePeriodEndTime.toDateString()}`;
        } else {
          // Fallback if API call fails
          updateData = {
            isGrace: true,
            isPaymentVerified: false,
            isCancelled: false,
            lastPurchaseToken: user.purchaseToken,
          };
          message = "Subscription in grace period.";
        }
        break;

      case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED_DEPRECATED
        // Keep entitlement; refresh expiry and plan to be safe
        {
          const verifyPrice = await verifyAndroidPurchase(
            "com.sitehaazri.app",
            notification.purchaseToken,
            requestId
          );
          if (verifyPrice.success) {
            const billingCycle = verifyPrice.originalProductId.includes(
              "yearly"
            )
              ? "yearly"
              : "monthly";
            updateData = {
              plan: verifyPrice.productId,
              billing_cycle: billingCycle,
              planExpiresAt: verifyPrice.expires,
              isPaymentVerified: true,
              isCancelled: false,
              isGrace: false,
              graceExpiresAt: null,
              lastPurchaseToken: user.purchaseToken,
              purchaseToken: notification.purchaseToken,
              planSource: "google_play",
            };
            message =
              "Price change confirmed (deprecated RTDN); subscription remains active.";
            shouldActivateAllSites = true;
          } else {
            updateData = { isCancelled: false };
            message = "Price change notification acknowledged.";
          }
        }
        break;

      case 9: // SUBSCRIPTION_DEFERRED
        // New expiry date; verify and update
        {
          const verifyDeferred = await verifyAndroidPurchase(
            "com.sitehaazri.app",
            notification.purchaseToken,
            requestId
          );
          if (verifyDeferred.success) {
            const billingCycle = verifyDeferred.originalProductId.includes(
              "yearly"
            )
              ? "yearly"
              : "monthly";
            updateData = {
              plan: verifyDeferred.productId,
              billing_cycle: billingCycle,
              planExpiresAt: verifyDeferred.expires,
              isPaymentVerified: true,
              isCancelled: false,
              isGrace: false,
              graceExpiresAt: null,
              lastPurchaseToken: user.purchaseToken,
              purchaseToken: notification.purchaseToken,
              planSource: "google_play",
            };
            message = "Subscription deferred; expiry updated.";
            shouldActivateAllSites = true;
          } else {
            message = "Subscription deferred; verification failed.";
          }
        }
        break;

      case 10: // SUBSCRIPTION_PAUSED
        // CRITICAL FIX: Protect against stale webhook tokens
        if (notification.purchaseToken !== user.purchaseToken) {
          message = `Ignoring stale PAUSED notification for an old token. User is on a newer plan.`;
          console.log(`[${requestId}] ✅ ${message}`);
          return { success: true, message, userId: user._id, updateData: {} };
        }

        updateData = {
          isPaymentVerified: false,
          isCancelled: false,
        };
        message = "Subscription paused.";
        break;

      case 11: // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
        // Just acknowledge and ensure flags aren’t stale
        updateData = {
          isCancelled: false,
        };
        message = "Subscription pause schedule changed.";
        break;

      case 12: // SUBSCRIPTION_REVOKED
        // --- ADD THIS PROTECTIVE CHECK ---
        if (notification.purchaseToken !== user.purchaseToken) {
          message = `Ignoring stale REVOKED notification for an old token. User is on a newer plan.`;
          console.log(`[${requestId}] ✅ ${message}`);
          return { success: true, message, userId: user._id, updateData: {} };
        }

        // Send cancellation webhook before updating user data
        try {
          // Validate user has phone number and a valid plan
          if (!user.phoneNumber) {
            console.error(
              `[${requestId}] ❌ User ${user._id} has no phone number, cannot send cancellation webhook`
            );
          } else if (!user.plan || user.plan === "free") {
            console.error(
              `[${requestId}] ❌ User ${user._id} has no active plan (plan: ${user.plan}), cannot determine refund amount`
            );
          } else {
            const subscriptionAmount =
              user.plan === "pro" ? 299 : user.plan === "premium" ? 499 : null;

            if (subscriptionAmount) {
              await sendCancellationWebhook(
                user.phoneNumber,
                subscriptionAmount,
                "User requested refund",
                notification.purchaseToken // Add purchaseToken for idempotency
              );
              console.log(
                `[${requestId}] ✅ Cancellation webhook sent for user: ${
                  user.phoneNumber
                } (${
                  user.plan
                } - ₹${subscriptionAmount}, token: ${notification.purchaseToken?.substring(
                  0,
                  20
                )}...)`
              );
            } else {
              console.error(
                `[${requestId}] ❌ Unknown plan type: ${user.plan}, cannot determine subscription amount`
              );
            }
          }
        } catch (webhookError) {
          console.error(
            `[${requestId}] ❌ Failed to send cancellation webhook:`,
            webhookError.message
          );
          // Continue with user update even if webhook fails
        }

        updateData = {
          plan: "free",
          billing_cycle: "monthly",
          isPaymentVerified: false,
          isCancelled: false,
          isGrace: false,
          lastPurchaseToken: user.purchaseToken,
          purchaseToken: null,
          planExpiresAt: null,
          planActivatedAt: new Date(),
          graceExpiresAt: null,
        };
        message = "Subscription revoked. Reverted to free plan.";
        break;

      // The final downgrade state
      case 13: // SUBSCRIPTION_EXPIRED
        // --- ADD THIS PROTECTIVE CHECK ---
        if (notification.purchaseToken !== user.purchaseToken) {
          message = `Ignoring stale EXPIRED notification for an old token. User is on a newer plan.`;
          console.log(`[${requestId}] ✅ ${message}`);
          return { success: true, message, userId: user._id, updateData: {} };
        }

        // Send plan-status-changed webhook
        try {
          if (user.phoneNumber) {
            await sendPlanStatusChangeWebhook(
              user.phoneNumber,
              "expired",
              false,
              null,
              "Subscription expired without renewal"
            );
            console.log(
              `[${requestId}] ✅ Plan status webhook sent for SUBSCRIPTION_EXPIRED`
            );
          }
        } catch (webhookError) {
          console.error(
            `[${requestId}] ❌ Failed to send plan status webhook:`,
            webhookError.message
          );
        }

        updateData = {
          plan: "free",
          billing_cycle: "monthly",
          isPaymentVerified: false,
          isCancelled: false,
          isGrace: false,
          lastPurchaseToken: user.purchaseToken,
          purchaseToken: null,
          planExpiresAt: null,
          planActivatedAt: new Date(),
          graceExpiresAt: null,
        };
        message = "Subscription expired. Reverted to free plan.";
        break;

      case 19: // SUBSCRIPTION_PRICE_CHANGE_UPDATED
        {
          const verifyUpdated = await verifyAndroidPurchase(
            "com.sitehaazri.app",
            notification.purchaseToken,
            requestId
          );
          if (verifyUpdated.success) {
            const billingCycle = verifyUpdated.originalProductId.includes(
              "yearly"
            )
              ? "yearly"
              : "monthly";
            updateData = {
              plan: verifyUpdated.productId,
              billing_cycle: billingCycle,
              planExpiresAt: verifyUpdated.expires,
              isPaymentVerified: true,
              isCancelled: false,
              isGrace: false,
              graceExpiresAt: null,
              lastPurchaseToken: user.purchaseToken,
              purchaseToken: notification.purchaseToken,
              planSource: "google_play",
            };
            message =
              "Subscription price change updated; subscription remains active.";
          } else {
            message = "Subscription price change updated.";
          }
        }
        break;

      case 20: // SUBSCRIPTION_PENDING_PURCHASE_CANCELED
        updateData = {
          isPaymentVerified: false,
          isCancelled: false,
        };
        message = "Pending subscription purchase canceled.";
        break;

      default:
        message = `Unknown notification type: ${notificationType} acknowledged.`;
        return { success: true, message, userId: user._id, updateData: {} };
    }

    // Apply database update if needed
    if (Object.keys(updateData).length > 0) {
      const updateResult = await User.findByIdAndUpdate(
        user._id,
        { $set: updateData },
        { new: true }
      );
      if (!updateResult) {
        return {
          success: false,
          error: "Database update failed",
          userId: user._id,
          message: "Database update failed",
        };
      }
      // If plan is (re)activated, ensure all sites are active for this user
      if (shouldActivateAllSites) {
        await activateAllUserSites(user._id);
      }
    }

    return { success: true, message, userId: user._id, updateData };
  } catch (error) {
    console.error(`[${requestId}] ❌ Update error:`, error.message);
    return {
      success: false,
      error: error.message,
      userId: user._id,
      message: `Update failed: ${error.message}`,
    };
  }
}

// Google Cloud Pub/Sub Webhook Endpoint
// This is the SINGLE SOURCE OF TRUTH for all subscription state changes
// The frontend verification endpoint is read-only to prevent race conditions
router.post("/notifications", authenticateWebhook, async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  console.log(`[${requestId}] 🔔 Webhook received`);

  try {
    // Parse request body
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString();
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }

    // Parse Pub/Sub message and decode data
    const pubsubMessage = JSON.parse(rawBody);
    if (!pubsubMessage.message?.data) {
      throw new Error("No data field in Pub/Sub message");
    }

    const decodedData = Buffer.from(
      pubsubMessage.message.data,
      "base64"
    ).toString("utf-8");
    const notificationData = JSON.parse(decodedData);

    // Handle different notification types
    if (notificationData.subscriptionNotification) {
      const subscription = notificationData.subscriptionNotification;
      const notificationType = subscription.notificationType;
      const purchaseToken = subscription.purchaseToken;

      console.log(
        `[${requestId}] 📱 Subscription ${getNotificationTypeName(
          notificationType
        )} for token: ${purchaseToken?.substring(0, 20)}...`
      );

      const user = await findUserByPurchaseToken(purchaseToken, requestId);
      if (!user) {
        return res.status(200).json({
          message: "No user found for purchase token",
          acknowledged: true,
          requestId: requestId,
          notificationType: notificationType,
        });
      }

      const updateResult = await updateUserSubscription(
        user,
        subscription,
        notificationType,
        requestId
      );
      console.log(
        `[${requestId}] ${updateResult.success ? "✅" : "❌"} ${
          updateResult.message
        }`
      );

      res.status(200).json({
        message: "Subscription notification processed",
        success: updateResult.success,
        acknowledged: true,
        requestId: requestId,
        notificationType: notificationType,
        userId: user._id.toString(),
      });
    } else if (notificationData.voidedPurchaseNotification) {
      const voidedPurchase = notificationData.voidedPurchaseNotification;
      console.log(
        `[${requestId}] 🗑️ Voided purchase: ${voidedPurchase.purchaseToken?.substring(
          0,
          20
        )}...`
      );

      res.status(200).json({
        message: "Voided purchase notification acknowledged",
        acknowledged: true,
        requestId: requestId,
        notificationType: "voidedPurchase",
      });
    } else if (notificationData.testNotification) {
      console.log(`[${requestId}] 🧪 Test notification acknowledged`);

      res.status(200).json({
        message: "Test notification acknowledged",
        acknowledged: true,
        requestId: requestId,
        notificationType: "test",
      });
    } else {
      console.log(
        `[${requestId}] ❓ Unknown notification type: ${Object.keys(
          notificationData
        )}`
      );

      res.status(200).json({
        message: "Unknown notification type acknowledged",
        acknowledged: true,
        requestId: requestId,
        notificationType: "unknown",
      });
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Webhook error:`, error.message);
    res.status(200).json({
      message: "Error processing notification",
      error: error.message,
      acknowledged: true,
      requestId: requestId,
    });
  }
});

module.exports = router;

/**
 * Razorpay Purchase Routes
 * 
 * This file handles Razorpay subscription webhooks for enterprise and business plans.
 * 
 * The webhook dynamically updates either `enterpriseLimits` or `businessLimits` 
 * based on the `notes.plan_type` sent with the Razorpay subscription.
 * 
 * WEBHOOK EVENTS HANDLED:
 * - subscription.charged: When a subscription payment is successful
 * - subscription.activated: When a subscription is activated
 * - subscription.cancelled: When a subscription is cancelled
 * - subscription.halted: When a subscription is halted due to payment failures
 * - subscription.pending: When a subscription payment is pending
 * - subscription.resumed: When a subscription is resumed
 * 
 * NOTES STRUCTURE (sent from Razorpay Dashboard when creating subscription link):
 * - userId: MongoDB User ID (required)
 * - plan_type: "enterprise" or "business" (required)
 * - maxSites: Maximum number of active sites (optional, default: 1)
 * - maxEmployeesPerSite: For enterprise plans - employees per site limit (optional)
 * - maxTotalEmployees: For business plans - global employee limit (optional)
 * - isWhatsApp: "true" or "false" - WhatsApp feature flag (optional)
 * - isPDF: "true" or "false" - PDF export feature flag (optional)
 * - isExcel: "true" or "false" - Excel export feature flag (optional)
 * - isSupervisorAccess: "true" or "false" - Supervisor access feature flag (optional)
 * - isChangeTracking: "true" or "false" - Change tracking feature flag (optional)
 */

const express = require("express");
const router = express.Router();
const User = require("../models/Userschema");
const Site = require("../models/Siteschema");
const FailedWebhook = require("../models/FailedWebhookSchema");
const crypto = require("crypto");
const { authenticateToken } = require("../Middleware/auth");
const { authenticateSuperAdmin } = require("../Middleware/superAdminAuth");

require("dotenv").config();

// Function to activate all sites of User in case of plan upgrade
async function activateAllUserSites(userId) {
  try {
    await Site.updateMany({ owner: userId }, { $set: { isActive: true } });
    console.log(`[Razorpay] All sites activated for user: ${userId}`);
  } catch (error) {
    console.error("[Razorpay] Error activating user sites:", error);
  }
}

/**
 * Validate Razorpay Webhook Signature
 * Uses HMAC SHA256 to verify the webhook is genuinely from Razorpay
 * 
 * @param {string} body - Raw request body as string
 * @param {string} signature - x-razorpay-signature header value
 * @param {string} secret - Webhook secret from Razorpay Dashboard
 * @returns {boolean} - Whether signature is valid
 */
function validateWebhookSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  
  return expectedSignature === signature;
}

/**
 * Parse boolean values from Razorpay notes
 * Razorpay sends everything as strings in notes
 * 
 * @param {string} value - String value like "true" or "false"
 * @param {boolean} defaultValue - Default if value is undefined
 * @returns {boolean}
 */
function parseNoteBoolean(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === "true";
}

/**
 * Parse integer values from Razorpay notes
 * 
 * @param {string} value - String value like "10" or "100"
 * @param {number} defaultValue - Default if value is undefined or invalid
 * @returns {number}
 */
function parseNoteInteger(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get human-readable event name for logging
 * 
 * @param {string} event - Razorpay webhook event
 * @returns {string} - Human readable event name
 */
function getEventDisplayName(event) {
  const eventNames = {
    "subscription.charged": "SUBSCRIPTION_CHARGED",
    "subscription.activated": "SUBSCRIPTION_ACTIVATED",
    "subscription.cancelled": "SUBSCRIPTION_CANCELLED",
    "subscription.halted": "SUBSCRIPTION_HALTED",
    "subscription.pending": "SUBSCRIPTION_PENDING",
    "subscription.resumed": "SUBSCRIPTION_RESUMED",
    "subscription.paused": "SUBSCRIPTION_PAUSED",
    "subscription.completed": "SUBSCRIPTION_COMPLETED",
    "subscription.authenticated": "SUBSCRIPTION_AUTHENTICATED",
  };
  return eventNames[event] || event.toUpperCase().replace(/\./g, "_");
}

/**
 * Save failed webhook for manual review
 * This ensures no payment is lost even if processing fails
 */
async function saveFailedWebhook(requestId, event, failureReason, subscription, notes, payload) {
  try {
    // Try to extract customer contact info from various places in the payload
    const customerEmail = subscription?.customer_email 
      || payload?.payload?.payment?.entity?.email 
      || notes?.email 
      || null;
    const customerPhone = subscription?.customer_phone 
      || payload?.payload?.payment?.entity?.contact 
      || notes?.phone 
      || null;
    const customerName = notes?.customerName 
      || payload?.payload?.payment?.entity?.notes?.customer_name
      || null;
    
    // Try to get payment amount
    const paymentAmount = payload?.payload?.payment?.entity?.amount 
      || subscription?.paid_count > 0 ? subscription?.charge_at : null;

    const failedWebhook = new FailedWebhook({
      source: "razorpay",
      event: event,
      requestId: requestId,
      failureReason: failureReason,
      attemptedUserId: notes?.userId || null,
      subscriptionId: subscription?.id || null,
      customerId: subscription?.customer_id || null,
      planDetails: {
        planType: notes?.plan_type,
        maxSites: parseNoteInteger(notes?.maxSites, null),
        maxEmployeesPerSite: parseNoteInteger(notes?.maxEmployeesPerSite, null),
        maxTotalEmployees: parseNoteInteger(notes?.maxTotalEmployees, null),
      },
      customerContact: {
        email: customerEmail,
        phone: customerPhone,
        name: customerName,
      },
      paymentAmount: paymentAmount,
      rawPayload: payload,
      status: "pending",
    });
    
    await failedWebhook.save();
    console.log(`[${requestId}] 📝 Failed webhook saved for manual review (ID: ${failedWebhook._id})`);
    
    // Log customer contact if available for quick reference
    if (customerEmail || customerPhone) {
      console.log(`[${requestId}] 📞 Customer contact: ${customerEmail || 'N/A'} | ${customerPhone || 'N/A'}`);
    }
    
    return failedWebhook._id;
  } catch (error) {
    console.error(`[${requestId}] ❌ Failed to save failed webhook:`, error.message);
    return null;
  }
}

/**
 * WEBHOOK ENDPOINT
 * 
 * Receives webhook notifications from Razorpay and updates user plans accordingly.
 * This is the SINGLE SOURCE OF TRUTH for Razorpay subscription state changes.
 * 
 * Security: Validates x-razorpay-signature header using HMAC SHA256
 * 
 * @route POST /api/razorpay/webhook
 */
router.post("/webhook", async (req, res) => {
  const requestId = `rzp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] 🔔 Razorpay Webhook received`);

  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!secret) {
      console.error(`[${requestId}] ❌ RAZORPAY_WEBHOOK_SECRET not configured`);
      return res.status(500).json({ 
        status: "error", 
        message: "Webhook secret not configured" 
      });
    }

    // Get raw body for signature validation
    // Note: This requires express.raw() middleware for this route
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
      console.log(`[${requestId}] ✅ Body received as Buffer (correct)`);
    } else if (typeof req.body === "string") {
      rawBody = req.body;
      console.log(`[${requestId}] ⚠️ Body received as string`);
    } else {
      // Body was already parsed as JSON - this will cause signature mismatch!
      rawBody = JSON.stringify(req.body);
      console.log(`[${requestId}] ⚠️ Body was already parsed as JSON - signature may fail`);
      console.log(`[${requestId}] Body type: ${typeof req.body}, isBuffer: ${Buffer.isBuffer(req.body)}`);
    }

    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      console.error(`[${requestId}] ❌ Missing x-razorpay-signature header`);
      return res.status(400).json({ 
        status: "error", 
        message: "Missing signature header" 
      });
    }

    // Debug: Log signature details in development
    if (process.env.NODE_ENV === "development") {
      const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      console.log(`[${requestId}] 🔍 Debug - Received signature: ${signature.substring(0, 20)}...`);
      console.log(`[${requestId}] 🔍 Debug - Expected signature: ${expectedSig.substring(0, 20)}...`);
      console.log(`[${requestId}] 🔍 Debug - Body length: ${rawBody.length}`);
      console.log(`[${requestId}] 🔍 Debug - Secret length: ${secret.length}`);
    }

    // Validate webhook signature
    if (!validateWebhookSignature(rawBody, signature, secret)) {
      console.error(`[${requestId}] ❌ Invalid Razorpay webhook signature`);
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid signature" 
      });
    }

    console.log(`[${requestId}] ✅ Webhook signature validated`);

    // Parse body if it's still raw
    const payload = Buffer.isBuffer(req.body) 
      ? JSON.parse(rawBody) 
      : req.body;

    const event = payload.event;
    const subscription = payload.payload?.subscription?.entity;

    if (!subscription) {
      console.log(`[${requestId}] ⚠️ No subscription entity in payload, event: ${event}`);
      // Acknowledge non-subscription events
      return res.json({ status: "ok", message: "Event acknowledged" });
    }

    console.log(`[${requestId}] 📱 Event: ${getEventDisplayName(event)}, Subscription: ${subscription.id}`);

    const notes = subscription.notes || {};
    const userId = notes.userId;

    if (!userId) {
      console.error(`[${requestId}] ❌ No userId in subscription notes`);
      return res.status(400).json({ 
        status: "error", 
        message: "No userId found in notes" 
      });
    }

    // Handle different subscription events
    switch (event) {
      case "subscription.charged":
      case "subscription.activated":
      case "subscription.resumed":
        await handleSubscriptionActive(requestId, userId, subscription, notes, payload);
        break;

      case "subscription.cancelled":
        await handleSubscriptionCancelled(requestId, userId, subscription, notes, payload);
        break;

      case "subscription.halted":
        await handleSubscriptionHalted(requestId, userId, subscription, notes, payload);
        break;

      case "subscription.pending":
        await handleSubscriptionPending(requestId, userId, subscription, notes, payload);
        break;

      case "subscription.paused":
        await handleSubscriptionPaused(requestId, userId, subscription);
        break;

      case "subscription.authenticated":
        // Just acknowledge - this happens before first charge
        console.log(`[${requestId}] ℹ️ Subscription authenticated for user ${userId}`);
        break;

      default:
        console.log(`[${requestId}] ℹ️ Unhandled event: ${event}, acknowledging`);
    }

    console.log(`[${requestId}] ✅ Webhook processed successfully`);
    return res.json({ status: "ok" });

  } catch (error) {
    console.error(`[${requestId}] ❌ Webhook Processing Error:`, error);
    return res.status(500).json({ 
      status: "error", 
      message: "Internal Server Error" 
    });
  }
});

/**
 * Handle active subscription events (charged, activated, resumed)
 * Updates user plan, limits, and features based on notes
 */
async function handleSubscriptionActive(requestId, userId, subscription, notes, payload) {
  try {
    const planType = notes.plan_type; // "enterprise" or "business"

    if (!planType || !["enterprise", "business"].includes(planType)) {
      console.error(`[${requestId}] ❌ Invalid plan_type in notes: ${planType}`);
      await saveFailedWebhook(
        requestId,
        "subscription.activated/charged/resumed",
        `Invalid plan_type: ${planType}. Must be 'enterprise' or 'business'`,
        subscription,
        notes,
        payload
      );
      return { success: false, reason: "invalid_plan_type" };
    }

    // Calculate expiry from Razorpay's current_end (Unix timestamp in seconds)
    const newExpiryDate = subscription.current_end 
      ? new Date(subscription.current_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback: 30 days

    // Parse feature flags from notes
    const featuresConfig = {
      isWhatsApp: parseNoteBoolean(notes.isWhatsApp, true),
      isPDF: parseNoteBoolean(notes.isPDF, true),
      isExcel: parseNoteBoolean(notes.isExcel, true),
      isSupervisorAccess: parseNoteBoolean(notes.isSupervisorAccess, true),
      isChangeTracking: parseNoteBoolean(notes.isChangeTracking, true),
    };

    // Build update object
    let updateData = {
      $set: {
        plan: planType,
        planSource: "web_razorpay",
        planExpiresAt: newExpiryDate,
        planActivatedAt: new Date(),
        isPaymentVerified: true,
        isCancelled: false,
        isGrace: false,
        isTrial: false,
        graceExpiresAt: null,
        lastSiteUpdated: null, // Reset to allow immediate site updates
        
        // Store Razorpay subscription details
        "razorpayDetails.subscriptionId": subscription.id,
        "razorpayDetails.customerId": subscription.customer_id,
        "razorpayDetails.planId": subscription.plan_id,
        "razorpayDetails.status": subscription.status,
        "razorpayDetails.nextBillDate": newExpiryDate,
      }
    };

    // Apply plan-specific limits
    if (planType === "enterprise") {
      updateData.$set["enterpriseLimits"] = {
        maxActiveSites: parseNoteInteger(notes.maxSites, 10),
        maxEmployeesPerSite: parseNoteInteger(notes.maxEmployeesPerSite, 100),
        ...featuresConfig,
      };
      console.log(`[${requestId}] 📋 Enterprise limits: ${notes.maxSites} sites, ${notes.maxEmployeesPerSite} emp/site`);
    } else if (planType === "business") {
      updateData.$set["businessLimits"] = {
        maxActiveSites: parseNoteInteger(notes.maxSites, 10),
        maxTotalEmployees: parseNoteInteger(notes.maxTotalEmployees, 100),
        ...featuresConfig,
      };
      console.log(`[${requestId}] 📋 Business limits: ${notes.maxSites} sites, ${notes.maxTotalEmployees} total employees`);
    }

    // Execute database update
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updatedUser) {
      console.error(`[${requestId}] ❌ User not found: ${userId}`);
      // Save for manual review - user paid but we can't find them!
      await saveFailedWebhook(
        requestId,
        "subscription.activated/charged/resumed",
        `User not found with ID: ${userId}`,
        subscription,
        notes,
        { subscription, notes }
      );
      return { success: false, reason: "user_not_found" };
    }

    // Activate all user sites on successful plan activation
    await activateAllUserSites(userId);

    console.log(`[${requestId}] ✅ Updated ${planType} plan for user ${userId}, expires: ${newExpiryDate.toISOString()}`);
    return { success: true };

  } catch (error) {
    console.error(`[${requestId}] ❌ Error handling active subscription:`, error);
    // Save for manual review - unexpected error
    await saveFailedWebhook(
      requestId,
      "subscription.activated/charged/resumed",
      `Processing error: ${error.message}`,
      subscription,
      notes,
      { subscription, notes, error: error.message }
    );
    throw error;
  }
}

/**
 * Handle subscription cancelled event
 * Marks subscription as cancelled but keeps access until expiry
 */
async function handleSubscriptionCancelled(requestId, userId, subscription, notes, payload) {
  try {
    const updateData = {
      $set: {
        isCancelled: true,
        isPaymentVerified: false,
        "razorpayDetails.status": subscription.status,
      }
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updatedUser) {
      console.error(`[${requestId}] ❌ User not found: ${userId}`);
      await saveFailedWebhook(
        requestId,
        "subscription.cancelled",
        `User not found with ID: ${userId}`,
        subscription,
        notes,
        payload
      );
      return { success: false, reason: "user_not_found" };
    }

    console.log(`[${requestId}] ⚠️ Subscription cancelled for user ${userId}. Access until: ${updatedUser.planExpiresAt}`);
    return { success: true };

  } catch (error) {
    console.error(`[${requestId}] ❌ Error handling cancelled subscription:`, error);
    throw error;
  }
}

/**
 * Handle subscription halted event
 * Subscription halted due to repeated payment failures
 */
async function handleSubscriptionHalted(requestId, userId, subscription, notes, payload) {
  try {
    const updateData = {
      $set: {
        plan: "free",
        isPaymentVerified: false,
        isCancelled: false,
        isGrace: false,
        planExpiresAt: null,
        graceExpiresAt: null,
        "razorpayDetails.status": subscription.status,
      }
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updatedUser) {
      console.error(`[${requestId}] ❌ User not found: ${userId}`);
      await saveFailedWebhook(
        requestId,
        "subscription.halted",
        `User not found with ID: ${userId}`,
        subscription,
        notes,
        payload
      );
      return { success: false, reason: "user_not_found" };
    }

    console.log(`[${requestId}] 🛑 Subscription halted for user ${userId}. Reverted to free plan.`);
    return { success: true };

  } catch (error) {
    console.error(`[${requestId}] ❌ Error handling halted subscription:`, error);
    throw error;
  }
}

/**
 * Handle subscription pending event
 * Payment is pending, typically waiting for authentication
 */
async function handleSubscriptionPending(requestId, userId, subscription, notes, payload) {
  try {
    const updateData = {
      $set: {
        isPaymentVerified: false,
        "razorpayDetails.status": subscription.status,
      }
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData);

    if (!updatedUser) {
      console.error(`[${requestId}] ❌ User not found: ${userId}`);
      // Don't save for pending - not critical
    }

    console.log(`[${requestId}] ⏳ Subscription pending for user ${userId}`);

  } catch (error) {
    console.error(`[${requestId}] ❌ Error handling pending subscription:`, error);
    throw error;
  }
}

/**
 * Handle subscription paused event
 */
async function handleSubscriptionPaused(requestId, userId, subscription) {
  try {
    const updateData = {
      $set: {
        isPaymentVerified: false,
        "razorpayDetails.status": subscription.status,
      }
    };

    await User.findByIdAndUpdate(userId, updateData);

    console.log(`[${requestId}] ⏸️ Subscription paused for user ${userId}`);

  } catch (error) {
    console.error(`[${requestId}] ❌ Error handling paused subscription:`, error);
    throw error;
  }
}

/**
 * GET /api/razorpay/subscription-status
 * 
 * Returns current Razorpay subscription status for authenticated user
 * 
 * @route GET /api/razorpay/subscription-status
 * @access Private (requires authentication)
 */
router.get("/subscription-status", authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Only return Razorpay details if user's plan source is web_razorpay
    if (user.planSource !== "web_razorpay") {
      return res.status(200).json({
        message: "User is not on a Razorpay subscription",
        planSource: user.planSource,
        plan: user.plan,
      });
    }

    const response = {
      plan: user.plan,
      planSource: user.planSource,
      planExpiresAt: user.planExpiresAt,
      planActivatedAt: user.planActivatedAt,
      isPaymentVerified: user.isPaymentVerified,
      isCancelled: user.isCancelled,
      razorpayDetails: {
        subscriptionId: user.razorpayDetails?.subscriptionId,
        status: user.razorpayDetails?.status,
        nextBillDate: user.razorpayDetails?.nextBillDate,
      },
    };

    // Add limits based on plan type
    if (user.plan === "enterprise" && user.enterpriseLimits) {
      response.limits = {
        maxActiveSites: user.enterpriseLimits.maxActiveSites,
        maxEmployeesPerSite: user.enterpriseLimits.maxEmployeesPerSite,
      };
      response.features = {
        isWhatsApp: user.enterpriseLimits.isWhatsApp,
        isPDF: user.enterpriseLimits.isPDF,
        isExcel: user.enterpriseLimits.isExcel,
        isSupervisorAccess: user.enterpriseLimits.isSupervisorAccess,
        isChangeTracking: user.enterpriseLimits.isChangeTracking,
      };
    } else if (user.plan === "business" && user.businessLimits) {
      response.limits = {
        maxActiveSites: user.businessLimits.maxActiveSites,
        maxTotalEmployees: user.businessLimits.maxTotalEmployees,
        currentTotalEmployees: user.stats?.totalActiveLabors || 0,
      };
      response.features = {
        isWhatsApp: user.businessLimits.isWhatsApp,
        isPDF: user.businessLimits.isPDF,
        isExcel: user.businessLimits.isExcel,
        isSupervisorAccess: user.businessLimits.isSupervisorAccess,
        isChangeTracking: user.businessLimits.isChangeTracking,
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching Razorpay subscription status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/razorpay/admin/manual-update
 * 
 * Admin endpoint to manually update a user's Razorpay subscription details
 * Use this for troubleshooting or manual intervention
 * 
 * @route POST /api/razorpay/admin/manual-update
 * @access Private (Super Admin only)
 */
router.post("/admin/manual-update", authenticateSuperAdmin, async (req, res) => {
  try {
    const { 
      userId, 
      plan_type, 
      maxSites, 
      maxEmployeesPerSite, 
      maxTotalEmployees,
      planExpiresAt,
      isWhatsApp,
      isPDF,
      isExcel,
      isSupervisorAccess,
      isChangeTracking,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!plan_type || !["enterprise", "business"].includes(plan_type)) {
      return res.status(400).json({ error: "plan_type must be 'enterprise' or 'business'" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Build feature flags
    const featuresConfig = {
      isWhatsApp: isWhatsApp !== undefined ? isWhatsApp : true,
      isPDF: isPDF !== undefined ? isPDF : true,
      isExcel: isExcel !== undefined ? isExcel : true,
      isSupervisorAccess: isSupervisorAccess !== undefined ? isSupervisorAccess : true,
      isChangeTracking: isChangeTracking !== undefined ? isChangeTracking : true,
    };

    // Build update object
    let updateData = {
      $set: {
        plan: plan_type,
        planSource: "web_razorpay",
        planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        planActivatedAt: new Date(),
        isPaymentVerified: true,
        isCancelled: false,
        isGrace: false,
        isTrial: false,
        graceExpiresAt: null,
        lastSiteUpdated: null,
        "razorpayDetails.status": "active",
      }
    };

    if (plan_type === "enterprise") {
      updateData.$set["enterpriseLimits"] = {
        maxActiveSites: maxSites || 10,
        maxEmployeesPerSite: maxEmployeesPerSite || 100,
        ...featuresConfig,
      };
    } else if (plan_type === "business") {
      updateData.$set["businessLimits"] = {
        maxActiveSites: maxSites || 10,
        maxTotalEmployees: maxTotalEmployees || 100,
        ...featuresConfig,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    // Activate all sites
    await activateAllUserSites(userId);

    console.log(`[Admin] Manually updated ${plan_type} plan for user ${userId}`);

    return res.status(200).json({
      message: "User plan updated successfully",
      user: {
        id: updatedUser._id,
        plan: updatedUser.plan,
        planSource: updatedUser.planSource,
        planExpiresAt: updatedUser.planExpiresAt,
        enterpriseLimits: updatedUser.enterpriseLimits,
        businessLimits: updatedUser.businessLimits,
      }
    });

  } catch (error) {
    console.error("Error in manual update:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/razorpay/admin/failed-webhooks
 * 
 * List all failed webhooks that need manual review
 * 
 * @route GET /api/razorpay/admin/failed-webhooks
 * @access Private (Super Admin only)
 */
router.get("/admin/failed-webhooks", authenticateSuperAdmin, async (req, res) => {
  try {
    const { status = "pending", limit = 50, skip = 0 } = req.query;
    
    const query = {};
    if (status !== "all") {
      query.status = status;
    }
    
    const failedWebhooks = await FailedWebhook.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await FailedWebhook.countDocuments(query);
    
    return res.status(200).json({
      total,
      count: failedWebhooks.length,
      failedWebhooks: failedWebhooks.map(fw => ({
        id: fw._id,
        source: fw.source,
        event: fw.event,
        failureReason: fw.failureReason,
        attemptedUserId: fw.attemptedUserId,
        subscriptionId: fw.subscriptionId,
        customerId: fw.customerId,
        planDetails: fw.planDetails,
        customerContact: fw.customerContact, // Email/phone to reach customer
        paymentAmount: fw.paymentAmount,
        status: fw.status,
        createdAt: fw.createdAt,
        resolvedAt: fw.resolvedAt,
        resolvedBy: fw.resolvedBy,
        resolutionNotes: fw.resolutionNotes,
      }))
    });

  } catch (error) {
    console.error("Error fetching failed webhooks:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/razorpay/admin/resolve-webhook/:id
 * 
 * Manually resolve a failed webhook by linking it to correct user
 * 
 * @route POST /api/razorpay/admin/resolve-webhook/:id
 * @access Private (Super Admin only)
 */
router.post("/admin/resolve-webhook/:id", authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { correctUserId, action, notes } = req.body;
    
    const failedWebhook = await FailedWebhook.findById(id);
    if (!failedWebhook) {
      return res.status(404).json({ error: "Failed webhook not found" });
    }
    
    if (failedWebhook.status !== "pending") {
      return res.status(400).json({ error: "Webhook already resolved" });
    }

    // Action: "apply" - Apply the payment to the correct user
    if (action === "apply" && correctUserId) {
      const user = await User.findById(correctUserId);
      if (!user) {
        return res.status(404).json({ error: "Correct user not found" });
      }
      
      const planDetails = failedWebhook.planDetails;
      const subscription = failedWebhook.rawPayload?.subscription;
      
      // Build update based on plan type
      const planType = planDetails.planType;
      
      if (!planType || !["enterprise", "business"].includes(planType)) {
        return res.status(400).json({ error: "Invalid plan_type in failed webhook" });
      }
      
      let updateData = {
        $set: {
          plan: planType,
          planSource: "web_razorpay",
          planExpiresAt: subscription?.current_end 
            ? new Date(subscription.current_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          planActivatedAt: new Date(),
          isPaymentVerified: true,
          isCancelled: false,
          isGrace: false,
          isTrial: false,
          "razorpayDetails.subscriptionId": failedWebhook.subscriptionId,
          "razorpayDetails.customerId": failedWebhook.customerId,
          "razorpayDetails.status": "active",
        }
      };
      
      if (planType === "enterprise") {
        updateData.$set["enterpriseLimits"] = {
          maxActiveSites: planDetails.maxSites || 10,
          maxEmployeesPerSite: planDetails.maxEmployeesPerSite || 100,
          isWhatsApp: true,
          isPDF: true,
          isExcel: true,
          isSupervisorAccess: true,
          isChangeTracking: true,
        };
      } else {
        updateData.$set["businessLimits"] = {
          maxActiveSites: planDetails.maxSites || 10,
          maxTotalEmployees: planDetails.maxTotalEmployees || 100,
          isWhatsApp: true,
          isPDF: true,
          isExcel: true,
          isSupervisorAccess: true,
          isChangeTracking: true,
        };
      }
      
      await User.findByIdAndUpdate(correctUserId, updateData);
      await activateAllUserSites(correctUserId);
      
      // Mark webhook as resolved
      failedWebhook.status = "resolved";
      failedWebhook.resolvedAt = new Date();
      failedWebhook.resolvedBy = req.user?.email || "super_admin";
      failedWebhook.resolutionNotes = `Applied to user ${correctUserId}. ${notes || ""}`;
      await failedWebhook.save();
      
      console.log(`[Admin] Resolved failed webhook ${id} - applied to user ${correctUserId}`);
      
      return res.status(200).json({
        message: "Webhook resolved and payment applied to user",
        userId: correctUserId,
        planType: planType,
      });
    }
    
    // Action: "ignore" - Mark as ignored (e.g., duplicate, test, etc.)
    if (action === "ignore") {
      failedWebhook.status = "ignored";
      failedWebhook.resolvedAt = new Date();
      failedWebhook.resolvedBy = req.user?.email || "super_admin";
      failedWebhook.resolutionNotes = notes || "Marked as ignored";
      await failedWebhook.save();
      
      return res.status(200).json({
        message: "Webhook marked as ignored",
      });
    }
    
    // Action: "refund" - Mark for refund (manual refund via Razorpay Dashboard)
    if (action === "refund") {
      failedWebhook.status = "refunded";
      failedWebhook.resolvedAt = new Date();
      failedWebhook.resolvedBy = req.user?.email || "super_admin";
      failedWebhook.resolutionNotes = notes || "Marked for refund - process via Razorpay Dashboard";
      await failedWebhook.save();
      
      // Return info needed to process refund in Razorpay Dashboard
      return res.status(200).json({
        message: "Webhook marked for refund. Process refund manually in Razorpay Dashboard.",
        refundInfo: {
          subscriptionId: failedWebhook.subscriptionId,
          customerId: failedWebhook.customerId,
          customerEmail: failedWebhook.customerContact?.email,
          customerPhone: failedWebhook.customerContact?.phone,
          amount: failedWebhook.paymentAmount,
          razorpayDashboardUrl: "https://dashboard.razorpay.com/app/payments",
        },
        instructions: [
          "1. Go to Razorpay Dashboard → Payments",
          "2. Search by subscription ID or customer email/phone",
          "3. Find the payment and click 'Refund'",
          "4. Contact customer if needed using the contact info above",
        ]
      });
    }
    
    return res.status(400).json({ 
      error: "Invalid action. Use 'apply' (with correctUserId), 'ignore', or 'refund'" 
    });

  } catch (error) {
    console.error("Error resolving failed webhook:", error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

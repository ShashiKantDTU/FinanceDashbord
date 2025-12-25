# Plan System Complete Documentation

## Finance Dashboard - Subscription & Plan Management

This document provides comprehensive documentation for the plan and subscription system in the Finance Dashboard backend, covering both Google Play Billing and Razorpay payment integrations.

---

## Table of Contents

1. [Overview](#overview)
2. [Plan Types](#plan-types)
3. [Plan Limits Configuration](#plan-limits-configuration)
4. [User Schema - Plan Fields](#user-schema---plan-fields)
5. [Payment Sources](#payment-sources)
6. [Google Play Billing Integration](#google-play-billing-integration)
7. [Razorpay Integration](#razorpay-integration)
8. [Plan Enforcement Logic](#plan-enforcement-logic)
9. [Cron Jobs for Plan Management](#cron-jobs-for-plan-management)
10. [API Endpoints](#api-endpoints)
11. [Environment Variables](#environment-variables)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The Finance Dashboard uses a multi-tier subscription model with plans ranging from free to enterprise. Subscriptions can be purchased through:

1. **Google Play Billing** - For Android app users (via Google Play Store)
2. **Razorpay** - For web users and custom enterprise/business plans

Both payment systems use webhooks as the **single source of truth** for subscription state, with frontend verification providing provisional access.

### Architecture Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Device   │────▶│  Payment System │────▶│    Backend      │
│  (App/Web)      │     │ (Play/Razorpay) │     │   Webhooks      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   MongoDB       │
                                                │  (User Schema)  │
                                                └─────────────────┘
```

---

## Plan Types

| Plan | Display Name | Target Users |
|------|--------------|--------------|
| `free` | Haazri Basic | New users, basic tracking |
| `lite` | Haazri Lite | Small contractors |
| `pro` | Contractor Pro | Growing contractors |
| `premium` | Haazri Automate | Established contractors |
| `business` | Business Plan | Multi-site operations (global employee limit) |
| `enterprise` | Enterprise | Large organizations (per-site limits) |

---

## Plan Limits Configuration

**File:** `Backend/config/planLimits.js`

```javascript
const PLAN_LIMITS = {
  free: {
    maxSites: 1,
    maxEmployeesPerSite: 10,
    displayName: "Haazri Basic",
  },
  lite: {
    maxSites: 1,
    maxEmployeesPerSite: 17,
    displayName: "Haazri Lite",
  },
  pro: {
    maxSites: 3,
    maxEmployeesPerSite: 40,
    displayName: "Contractor Pro",
  },
  premium: {
    maxSites: 6,
    maxEmployeesPerSite: 80,
    displayName: "Haazri Automate",
  },
  business: {
    maxSites: 10,
    maxTotalEmployees: 100, // Total employees across ALL sites
    displayName: "Business Plan",
  },
  enterprise: {
    maxSites: 15,
    maxEmployeesPerSite: 200, // Fallback defaults
    displayName: "Enterprise",
  },
};
```

### Key Differences: Business vs Enterprise

| Aspect | Business Plan | Enterprise Plan |
|--------|---------------|-----------------|
| **Employee Limit Type** | Global (total across all sites) | Per-Site |
| **Limit Field** | `maxTotalEmployees` | `maxEmployeesPerSite` |
| **Customization** | Via `businessLimits` object | Via `enterpriseLimits` object |
| **Payment Source** | Razorpay (web) | Razorpay (web) |

---

## User Schema - Plan Fields

**File:** `Backend/models/Userschema.js`

### Core Plan Fields

```javascript
{
  // Current plan name
  plan: {
    type: String,
    enum: ["free", "lite", "pro", "premium", "business", "enterprise"],
    default: "free",
  },
  
  // When plan was activated
  planActivatedAt: { type: Date },
  
  // Billing cycle for subscriptions
  billing_cycle: { 
    type: String, 
    enum: ["monthly", "yearly"] 
  },
  
  // When plan expires
  planExpiresAt: { type: Date },
  
  // Where the plan was purchased
  planSource: {
    type: String,
    enum: ["google_play", "app_store", "web", "web_razorpay", "manual", "free"],
    default: null,
  },
  
  // Payment verification status
  isPaymentVerified: { type: Boolean, default: false },
  
  // Subscription state flags
  isTrial: { type: Boolean, default: false },
  isCancelled: { type: Boolean, default: false },
  isGrace: { type: Boolean, default: false },
  graceExpiresAt: { type: Date, default: null },
}
```

### Enterprise Custom Limits

```javascript
enterpriseLimits: {
  maxActiveSites: { type: Number, default: 10 },
  maxEmployeesPerSite: { type: Number, default: 100 },
  
  // Feature flags
  isWhatsApp: { type: Boolean, default: true },
  isPDF: { type: Boolean, default: true },
  isExcel: { type: Boolean, default: true },
  isSupervisorAccess: { type: Boolean, default: true },
  isChangeTracking: { type: Boolean, default: true },
}
```

### Business Custom Limits

```javascript
businessLimits: {
  maxActiveSites: { type: Number, default: 10 },
  maxTotalEmployees: { type: Number, default: 100 }, // GLOBAL limit
  
  // Feature flags
  isWhatsApp: { type: Boolean, default: true },
  isPDF: { type: Boolean, default: true },
  isExcel: { type: Boolean, default: true },
  isSupervisorAccess: { type: Boolean, default: true },
  isChangeTracking: { type: Boolean, default: true },
}
```

### Google Play Specific Fields

```javascript
{
  purchaseToken: { type: String, default: null },
  lastPurchaseToken: { type: String, default: null },
  
  planHistory: [{
    plan: String,
    purchasedAt: Date,
    expiresAt: Date,
    transactionId: String,
    platform: String, // "android", "ios", "web"
    source: String,   // "google_play", "razorpay", etc.
    isActive: Boolean,
    renewalToken: String,
    originalPurchaseToken: String,
    originalProductId: String,
    subscriptionId: String,
    regionCode: String,
    verificationData: {
      subscriptionState: String,
      startTime: Date,
    },
  }]
}
```

### Razorpay Specific Fields

```javascript
razorpayDetails: {
  customerId: { type: String, default: null },       // "cust_..."
  subscriptionId: { type: String, default: null },   // "sub_..."
  planId: { type: String, default: null },           // "plan_..."
  status: { type: String, default: null },           // "active", "cancelled", etc.
  nextBillDate: { type: Date, default: null },
}
```

---

## Payment Sources

| Source | Description | Webhook Endpoint |
|--------|-------------|------------------|
| `google_play` | Android Google Play Store | `/api/play-purchase/notifications` |
| `web_razorpay` | Razorpay web subscriptions | `/api/razorpay/webhook` |
| `app_store` | iOS App Store (future) | - |
| `web` | Legacy web payments | - |
| `manual` | Admin-assigned plans | - |
| `free` | Default free tier | - |

---

## Google Play Billing Integration

**File:** `Backend/Routes/playPurchase.js`

### Product ID Mapping

| Google Play Product ID | Internal Plan Name |
|------------------------|-------------------|
| `pro_monthly` | `pro` |
| `haazri_automate` | `premium` |
| `haazri_lite` / `lite_monthly` | `lite` |

### Webhook Notifications Handled

| Notification Type | Action |
|-------------------|--------|
| `SUBSCRIPTION_PURCHASED` (4) | Activate plan, verify with Google API |
| `SUBSCRIPTION_RENEWED` (2) | Extend expiry, verify with Google API |
| `SUBSCRIPTION_RESTARTED` (7) | Reactivate plan |
| `SUBSCRIPTION_RECOVERED` (1) | Recover from payment failure |
| `SUBSCRIPTION_CANCELED` (3) | Mark as cancelled (keeps access until expiry) |
| `SUBSCRIPTION_ON_HOLD` (5) | Mark payment verification failed |
| `SUBSCRIPTION_IN_GRACE_PERIOD` (6) | Set grace period, track end date |
| `SUBSCRIPTION_PAUSED` (10) | Mark as paused |
| `SUBSCRIPTION_EXPIRED` (13) | Revert to free plan |
| `SUBSCRIPTION_REVOKED` (12) | Immediate revert to free plan |

### Flow: Purchase → Activation

```
1. User purchases in app
2. App calls: POST /api/play-purchase/verify-android-purchase
   - Provisional access granted (isPaymentVerified: false)
   - All sites activated immediately
   
3. Google sends webhook: POST /api/play-purchase/notifications
   - Webhook authenticated via Google JWT
   - Subscription verified with Google API
   - isPaymentVerified set to true
   - planHistory entry added
```

### Stale Token Protection

The system protects against stale webhook notifications:

```javascript
if (notification.purchaseToken !== user.purchaseToken) {
  // Ignore - user has a newer subscription
  return { success: true, message: "Ignoring stale notification" };
}
```

---

## Razorpay Integration

**File:** `Backend/Routes/razorpayPurchase.js`

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `subscription.charged` | Activate/renew plan with custom limits |
| `subscription.activated` | Activate plan |
| `subscription.resumed` | Resume paused subscription |
| `subscription.cancelled` | Mark cancelled (access until expiry) |
| `subscription.halted` | Revert to free plan |
| `subscription.pending` | Mark payment pending |
| `subscription.paused` | Mark paused |

### Subscription Notes Structure

When creating a Razorpay subscription link, the following notes must be included:

#### For Enterprise Plans:

```json
{
  "userId": "MongoDB_User_ID",
  "plan_type": "enterprise",
  "maxSites": "15",
  "maxEmployeesPerSite": "200",
  "isWhatsApp": "true",
  "isPDF": "true",
  "isExcel": "true",
  "isSupervisorAccess": "true",
  "isChangeTracking": "true"
}
```

#### For Business Plans:

```json
{
  "userId": "MongoDB_User_ID",
  "plan_type": "business",
  "maxSites": "10",
  "maxTotalEmployees": "500",
  "isWhatsApp": "true",
  "isPDF": "true",
  "isExcel": "true",
  "isSupervisorAccess": "true",
  "isChangeTracking": "true"
}
```

### Webhook Signature Validation

```javascript
function validateWebhookSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  
  return expectedSignature === signature;
}
```

### Flow: Razorpay Subscription

```
1. Admin creates subscription link in Razorpay Dashboard
   - Adds notes with userId, plan_type, limits
   
2. User completes payment via link

3. Razorpay sends webhook: POST /api/razorpay/webhook
   - Signature validated via x-razorpay-signature header
   - notes parsed for plan_type (enterprise/business)
   - Appropriate limits object updated
   - All sites activated
```

---

## Plan Enforcement Logic

**File:** `Backend/Routes/EmployeeDetails.js`

### Employee Addition Limit Check

```javascript
// 1. Get user's plan
let plan = req.user.plan || "free";
const currentPlanLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

// 2. Business Plan: Check GLOBAL employee count
if (plan === "business") {
  const activeSites = await Site.find({
    owner: req.user.id,
    isActive: true,
  });
  
  const totalEmployees = await Employee.countDocuments({
    siteID: { $in: activeSites.map(s => s._id) },
    month: month,
    year: year,
  });
  
  const maxTotal = req.user.businessLimits?.maxTotalEmployees 
    || currentPlanLimits.maxTotalEmployees;
  
  if (totalEmployees >= maxTotal) {
    return res.status(403).json({
      message: `Maximum ${maxTotal} total employees reached`
    });
  }
}

// 3. Other Plans: Check PER-SITE employee count
else {
  const siteEmployees = await Employee.countDocuments({
    siteID: siteID,
    month: month,
    year: year,
  });
  
  let maxPerSite = currentPlanLimits.maxEmployeesPerSite;
  
  if (plan === "enterprise") {
    maxPerSite = req.user.enterpriseLimits?.maxEmployeesPerSite 
      || PLAN_LIMITS.enterprise.maxEmployeesPerSite;
  }
  
  if (siteEmployees >= maxPerSite) {
    return res.status(403).json({
      message: `Maximum ${maxPerSite} employees per site reached`
    });
  }
}
```

### Site Activation Limit Check

**File:** `Backend/Routes/dashboard.js`

```javascript
const plan = userdata.plan || "free";
const currentPlanLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

let maxSites = currentPlanLimits.maxSites;

// Enterprise uses custom limits
if (plan === 'enterprise') {
  maxSites = userdata.enterpriseLimits?.maxActiveSites 
    || PLAN_LIMITS.enterprise.maxSites;
}

// Business uses custom limits
if (plan === 'business') {
  maxSites = userdata.businessLimits?.maxActiveSites 
    || PLAN_LIMITS.business.maxSites;
}

const requestedActiveCount = selectedSites.length + newSites.length;

if (requestedActiveCount > maxSites) {
  return res.status(403).json({
    message: `Your ${plan} plan allows only ${maxSites} active sites.`
  });
}
```

---

## Cron Jobs for Plan Management

**File:** `Backend/services/cronJobs.js`

| Job Name | Schedule | Description |
|----------|----------|-------------|
| `expired-trials-cleanup` | Every 4 hours | Clean up expired trial subscriptions |
| `daily-subscription-cleanup` | 3 AM daily | Handle expired and grace period users |
| `finalize-provisional-google-play` | Every 2 hours | Verify provisional Google Play purchases |

### Expired Trials Cleanup

```javascript
async handleExpiredTrials() {
  const expiredUsers = await User.find({
    isTrial: true,
    planExpiresAt: { $lt: new Date() }
  });
  
  for (const user of expiredUsers) {
    await User.updateOne({ _id: user._id }, {
      $set: {
        plan: "free",
        isTrial: false,
        isPaymentVerified: false,
        planExpiresAt: null,
      }
    });
  }
}
```

### Provisional Purchase Finalizer

Safety net for when webhooks are delayed:

```javascript
async finalizeProvisionalGooglePlay() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 min old
  
  const provisionalUsers = await User.find({
    isPaymentVerified: false,
    planSource: 'google_play',
    purchaseToken: { $ne: null },
    updatedAt: { $lt: cutoff }
  }).limit(500);
  
  for (const user of provisionalUsers) {
    const verification = await verifyAndroidPurchase(
      "com.sitehaazri.app",
      user.purchaseToken
    );
    
    if (verification.success) {
      // Finalize the subscription
    }
  }
}
```

---

## API Endpoints

### Google Play Billing

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/play-purchase/verify-android-purchase` | POST | User Token | Verify purchase & grant provisional access |
| `/api/play-purchase/plan` | GET | User Token | Get current plan details |
| `/api/play-purchase/notifications` | POST | Google JWT | Receive Google Play webhooks |
| `/api/play-purchase/admin/manual-verify` | POST | Super Admin | Manually verify a purchase |

### Razorpay

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/razorpay/webhook` | POST | Signature | Receive Razorpay webhooks |
| `/api/razorpay/subscription-status` | GET | User Token | Get Razorpay subscription status |
| `/api/razorpay/admin/manual-update` | POST | Super Admin | Manually update plan limits |

### Response: GET /api/play-purchase/plan

```json
{
  "plan": "enterprise",
  "billing_cycle": "monthly",
  "planExpiry": "2025-01-25T00:00:00.000Z",
  "planActivatedAt": "2024-12-25T00:00:00.000Z",
  "planSource": "web_razorpay",
  "isPaymentVerified": true,
  "limits": {
    "maxActiveSites": 15,
    "maxEmployeesPerSite": 200
  },
  "isWhatsApp": true,
  "isPDF": true,
  "isExcel": true,
  "isSupervisorAccess": true,
  "isChangeTracking": true
}
```

---

## Environment Variables

```bash
# Google Play Billing
PLAY_BILLING_SERVICE_KEY='{"type":"service_account",...}'  # Google Cloud service account JSON
GOOGLE_WEBHOOK_AUDIENCE="your-google-cloud-project-id"

# Razorpay
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"

# Optional: Razorpay API (if using SDK for API calls)
RAZORPAY_KEY_ID="rzp_live_xxxx"
RAZORPAY_KEY_SECRET="your_key_secret"
```

---

## Troubleshooting

### Common Issues

#### 1. User not getting plan after payment

**Diagnosis:**
```javascript
// Check user's plan fields
const user = await User.findById(userId);
console.log({
  plan: user.plan,
  isPaymentVerified: user.isPaymentVerified,
  planSource: user.planSource,
  purchaseToken: user.purchaseToken?.substring(0, 20),
  razorpayDetails: user.razorpayDetails
});
```

**Solutions:**
- Google Play: Use `/api/play-purchase/admin/manual-verify` endpoint
- Razorpay: Use `/api/razorpay/admin/manual-update` endpoint

#### 2. Webhook not being received

**Check:**
- Webhook URL is accessible (HTTPS, ports 80/443)
- Server logs for incoming requests
- Razorpay/Google Play webhook logs in their dashboards

#### 3. Stale notification affecting new subscription

The system automatically ignores stale notifications by comparing purchase tokens. If issues persist:

```javascript
// Force update user's purchaseToken
await User.updateOne(
  { _id: userId },
  { $set: { purchaseToken: newToken, lastPurchaseToken: oldToken } }
);
```

#### 4. Enterprise/Business limits not applying

Verify the notes were correctly set in Razorpay:
```javascript
console.log(user.enterpriseLimits); // or businessLimits
```

### Debug Endpoints (Development Only)

```
GET /api/play-purchase/debug-user/:userId
```

Returns comprehensive subscription debugging information.

---

## Security Considerations

1. **Webhook Authentication**
   - Google Play: JWT verification with Google's public keys
   - Razorpay: HMAC-SHA256 signature verification

2. **Raw Body Middleware**
   - Both webhooks require raw body for signature verification
   - Configured in `server.js` before `express.json()`

3. **Stale Token Protection**
   - All notification handlers compare incoming token with stored token
   - Prevents old notifications from affecting new subscriptions

4. **Admin Endpoints**
   - Protected by `authenticateSuperAdmin` middleware
   - Only accessible to super admin users

---

## Summary

| Feature | Google Play | Razorpay |
|---------|-------------|----------|
| **Plans Supported** | free, lite, pro, premium | business, enterprise |
| **Limit Type** | Per-site (static) | Custom (per user) |
| **Webhook Auth** | Google JWT | HMAC-SHA256 |
| **Provisional Access** | Yes | No (webhook only) |
| **Custom Limits** | No | Yes (via notes) |
| **Feature Flags** | No | Yes |

---

*Last Updated: December 2024*

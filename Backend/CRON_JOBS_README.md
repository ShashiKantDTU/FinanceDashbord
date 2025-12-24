# Cron Jobs System

This document explains the cron job system implemented for handling user subscription expiry and grace periods with robust verification.

## Overview

The cron job system automatically handles three main scenarios:
1. **Expired Cancelled Users**: Users with `isCancelled: true` and `planExpiresAt < current date`
2. **Grace Period Expired Users**: Users with `isGrace: true` and `graceExpiresAt < current date` (with final verification)
3. **Stuck Grace Users**: Users who have been in grace period for too long (safety net)

## Cron Job Schedule

- **Expired Users Check**: Every hour `0 * * * *`
- **Grace Expired Check**: Every hour `0 * * * *` 
- **Stuck Grace Cleanup**: Daily at 2 AM `0 2 * * *`
- **Employee Counter Sync**: Sundays at 4 AM `0 4 * * 0` (Self-healing for Calculate-on-Write)

## Key Feature: Final Verification for Grace Period

The grace period cron job includes a **critical final verification step** that prevents race conditions:

### The Problem It Solves
When a user's grace period expires, there's a small window where:
1. The cron job finds the user (grace period ended)
2. But a delayed `SUBSCRIPTION_RECOVERED` webhook hasn't arrived yet
3. Without verification, the user would be incorrectly downgraded

### The Solution
Before downgrading any grace period user, the system:
1. Makes a final API call to Google Play Billing
2. Checks the **live subscription status**
3. If the subscription is actually active → Updates the user's plan
4. If the subscription is truly expired → Proceeds with downgrade

This makes the system bulletproof against webhook delays.

## What Each Job Does

### 1. Expired Users Job
- **Condition**: `isCancelled: true` AND `planExpiresAt < current date`
- **Actions**:
  - Downgrades user to `free` plan
  - Sets `isCancelled: false`
  - Clears `planExpiresAt`
  - Sets `isPaymentVerified: false`
  - Preserves `purchaseToken` in `lastPurchaseToken` for audit

### 2. Grace Expired Users Job (with Final Verification)
- **Condition**: `isGrace: true` AND `graceExpiresAt < current date`
- **Process**:
  1. **Final Verification**: Calls Google Play API to check live subscription status
  2. **If Active**: Updates user plan with new expiry date (recovery scenario)
  3. **If Expired**: Proceeds with downgrade to free plan
- **Recovery Actions** (if subscription is active):
  - Updates plan and billing cycle
  - Sets new expiry date from Google
  - Adds recovery entry to plan history
  - Resets grace period flags
- **Downgrade Actions** (if subscription is expired):
  - Downgrades user to `free` plan
  - Sets `isGrace: false`
  - Clears all subscription-related fields
  - Preserves audit trail

### 3. Stuck Grace Users Cleanup (Safety Net)
- **Condition**: `isGrace: true` AND (`graceExpiresAt < 7 days ago` OR `graceExpiresAt: null`)
- **Purpose**: Catches users who might be stuck in grace period due to system issues
- **Actions**: Same as Grace Expired Users Job with final verification

## API Endpoints

### Check Cron Job Status
```
GET /api/cron/status
```
Returns the status of all running cron jobs.

### Manual Triggers (for testing)
```
POST /api/cron/trigger/expired-users
POST /api/cron/trigger/grace-expired
POST /api/cron/trigger/stuck-grace
```

### Management
```
POST /api/cron/stop-all    # Stop all cron jobs
POST /api/cron/restart     # Restart all cron jobs
```

## Customization

To customize the actions performed by the cron jobs, edit the following methods in `Backend/services/cronJobs.js`:

- `processExpiredUser(user)` - Actions for expired cancelled users
- `processGraceExpiredUser(user)` - Actions for grace period expired users

### Example Customizations

You can add additional actions like:
- Send email notifications
- Log to audit trail
- Update related data
- Archive user data
- Send push notifications

```javascript
// Example: Add email notification
const { sendEmail } = require('../Utils/emailService');

async processExpiredUser(user) {
  // Existing logic...
  
  // Send notification email
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: 'Subscription Expired',
      text: 'Your subscription has expired and you have been moved to the free plan.'
    });
  }
  
  // Log the action
  console.log(`User ${user._id} subscription expired and downgraded to free plan`);
}
```

## Timezone Configuration

The cron jobs are configured to run in `Asia/Kolkata` timezone. To change this, modify the `timezone` property in the `scheduleJob` method.

## Monitoring

- All cron job activities are logged to the console
- Use the `/api/cron/status` endpoint to check if jobs are running
- Manual triggers are available for testing purposes

## Production Considerations

1. **Error Handling**: All errors are caught and logged without stopping the cron jobs
2. **Database Connections**: Uses existing MongoDB connection from the main server
3. **Memory Management**: Jobs are designed to process users in batches
4. **Logging**: Comprehensive logging for monitoring and debugging

## Testing

### Using the Test Script
```bash
node Backend/test-cron-grace.js
```

### Manual Testing Steps
1. **Create test users** with appropriate conditions
2. **Use manual triggers** to test without waiting for scheduled execution
3. **Check logs** for successful processing
4. **Verify database changes** after job execution

```bash
# Test expired users job
curl -X POST http://localhost:5000/api/cron/trigger/expired-users

# Test grace expired users job
curl -X POST http://localhost:5000/api/cron/trigger/grace-expired

# Test stuck grace cleanup
curl -X POST http://localhost:5000/api/cron/trigger/stuck-grace

# Check status
curl http://localhost:5000/api/cron/status
```

### Test Scenarios for Grace Period Verification

1. **Normal Expiry**: User in grace period with expired `graceExpiresAt` and expired Google subscription
   - Expected: User downgraded to free plan

2. **Last-Second Recovery**: User in grace period with expired `graceExpiresAt` but active Google subscription
   - Expected: User plan updated with new expiry date, grace period cleared

3. **Stuck Grace**: User in grace period for more than 7 days
   - Expected: Final verification performed, appropriate action taken

### Monitoring Logs

Look for these log patterns:
- `🔍 Final verification check for user` - Verification starting
- `🎉 User recovered! Updating plan` - Last-second recovery detected
- `❌ Final verification confirmed expiry` - Proceeding with downgrade
- `✅ User subscription recovered and updated` - Recovery completed
# API Call Tracking System - Complete Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [How It Works](#how-it-works)
4. [Configuration](#configuration)
5. [Implementation Details](#implementation-details)
6. [Management API](#management-api)
7. [Testing & Monitoring](#testing--monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What It Does
The API Call Tracking System monitors specific users' API activity over a 10-day period. When a tracked user reaches 50 API calls, the system **immediately executes a custom action** (e.g., database logging, email alerts, account flagging) and automatically removes them from tracking.

### Key Features
- ✅ **Non-blocking**: Fire-and-forget tracking doesn't delay API responses
- ✅ **Immediate execution**: Action runs instantly when threshold reached (no queue)
- ✅ **Race condition protection**: Guaranteed single execution even with concurrent requests
- ✅ **Auto-expiry**: Individual call counters expire after 10 days via Redis TTL
- ✅ **Auto-tracking**: New users automatically added to tracking on registration
- ✅ **Super Admin management**: Protected API for adding/removing/monitoring tracked users

### Use Cases
- Monitor suspicious or high-volume users
- Track new user onboarding behavior
- Detect potential API abuse
- Trigger interventions for specific user patterns

---

## System Architecture

### Redis Data Structure

The system uses **two separate Redis structures** for optimal performance:

#### 1. Tracking Set (Sorted Set)
```
Key: api:track:users
Type: ZSET (Sorted Set)
Members: Phone numbers (e.g., "+919876543210")
Scores: Expiry timestamps (Date.now() + 10 days in milliseconds)
Purpose: Master list of users being tracked
```

**Example:**
```
ZADD api:track:users 1748012345678 "+919876543210"
                      ↑ Expiry timestamp (score)
```

**Why Sorted Set?**
- Fast membership checks: `ZSCORE` = O(log N)
- Efficient expiry queries: `ZREMRANGEBYSCORE` removes expired users in one operation
- Enables sorting by expiry/call count for admin listing

**Important:** Sorted set members don't have per-member TTL. The entire key has TTL, but members need manual cleanup via cron job.

#### 2. Call Counters (Individual String Keys with TTL)
```
Key: api:calls:+919876543210
Type: STRING
Value: Integer (call count, e.g., "47")
TTL: 864000 seconds (10 days)
Purpose: Track individual user's API call count
```

**Example:**
```
SET api:calls:+919876543210 "1" EX 864000
INCR api:calls:+919876543210  # Atomic increment
```

**Why Separate Counters?**
- **Auto-expiry**: Individual keys support TTL (automatically deleted after 10 days)
- **Atomic increments**: `INCR` is thread-safe, prevents race conditions
- **Performance**: No need to update sorted set score on every API call

### Why This Two-Structure Design?

| Feature | Sorted Set | Individual Counters |
|---------|-----------|---------------------|
| Membership check | ✅ Fast (`ZSCORE`) | ❌ Requires `GET` + parse |
| Call counting | ❌ Score updates not atomic | ✅ `INCR` is atomic |
| Auto-expiry | ❌ No per-member TTL | ✅ Native TTL support |
| Expiry queries | ✅ `ZREMRANGEBYSCORE` | ❌ Need to check each key |
| Admin listing | ✅ Can sort by score | ❌ Would need to scan all keys |

**Trade-off:** Slight data duplication (phone in both structures), but massive gains in performance and correctness.

---

## How It Works

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER REGISTRATION (auth.js)                                  │
│    OTP/Firebase/Truecaller login → New user created             │
│    ↓                                                             │
│    addUserToTracking(phoneNumber) called (fire-and-forget)      │
│    ↓                                                             │
│    • ZADD api:track:users {expiry} {phone}                       │
│    • SETEX api:calls:{phone} 864000 0                            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. API REQUEST (all authenticated endpoints)                    │
│    Express middleware: apiCallTracker(req, res, next)           │
│    ↓                                                             │
│    Fire-and-forget async block starts (non-blocking)            │
│    ↓                                                             │
│    isUserBeingTracked(phoneNumber) → Check sorted set           │
│    • ZSCORE api:track:users {phone}                              │
│    • If score < now → expired, auto-remove, return false        │
│    • If not found → return false                                │
│    • If valid → return true                                     │
│    ↓                                                             │
│    If not tracked → Skip remaining logic                        │
│    If tracked → Continue ↓                                       │
│    ↓                                                             │
│    INCR api:calls:{phone} → Atomic increment (newCount)         │
│    EXPIRE api:calls:{phone} 864000 → Refresh TTL                │
│    ↓                                                             │
│    logToDatabase('api_call_tracked', {...}) → Non-blocking log  │
│    ↓                                                             │
│    Check: newCount >= 50? (threshold)                           │
│    ↓                                                             │
│    If < 50 → Continue tracking                                  │
│    If >= 50 → Threshold reached! ↓                              │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. THRESHOLD REACHED (Race Condition Prevention)                │
│    ↓                                                             │
│    🔴 CRITICAL: Remove user FIRST (before action)               │
│    ↓                                                             │
│    const removed = await removeUserFromTracking(phoneNumber)    │
│    • ZREM api:track:users {phone}                                │
│    • DEL api:calls:{phone}                                       │
│    • Returns true if removed, false if already gone             │
│    ↓                                                             │
│    If removed === false:                                         │
│      → Another request already handled this user                │
│      → Log "Already removed - skipping duplicate action"        │
│      → STOP (no action executed)                                │
│    ↓                                                             │
│    If removed === true:                                          │
│      → User successfully removed (this request won the race)    │
│      → Log "User removed - executing action NOW"                │
│      → Continue to action ↓                                      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. ACTION EXECUTION (executeThresholdAction)                    │
│    Fire-and-forget call (won't block API response)              │
│    ↓                                                             │
│    • logToDatabase('api_threshold_reached', {...})              │
│    • sendEmail(admin, alert) [optional, commented]              │
│    • updateUserFlag(userId, highApiUsage) [optional, commented] │
│    • sendWhatsAppMessage(phone, alert) [optional, commented]    │
│    ↓                                                             │
│    Action completes → User no longer tracked                    │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. PERIODIC CLEANUP (cronJobs.js)                               │
│    Every 6 hours: cleanupExpiredApiTracking()                   │
│    ↓                                                             │
│    cleanupExpiredUsers() from apiCallTracker.js                 │
│    ↓                                                             │
│    ZREMRANGEBYSCORE api:track:users 0 {now}                     │
│    → Removes all members with score < current timestamp         │
│    ↓                                                             │
│    Log: "Cleaned up X expired users"                            │
│                                                                  │
│    Note: Individual counters auto-expire via Redis TTL          │
│    (No cron needed for api:calls:{phone} keys)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Race Condition Prevention Example

**Scenario:** User makes 3 concurrent API requests when at 49 calls. All 3 requests increment counter simultaneously.

```
Time: T0 (Before requests)
├─ api:track:users: {"+919876543210": 1748012345678}
├─ api:calls:+919876543210: "49"

Time: T1 (3 concurrent requests arrive)
Request A ───┐
Request B ───┼─→ All start executing middleware
Request C ───┘

Time: T2 (All check tracking status)
Request A: isUserBeingTracked("+919876543210") → true
Request B: isUserBeingTracked("+919876543210") → true
Request C: isUserBeingTracked("+919876543210") → true

Time: T3 (All increment counter - ATOMIC)
Request A: INCR api:calls:+919876543210 → Returns 50
Request B: INCR api:calls:+919876543210 → Returns 51
Request C: INCR api:calls:+919876543210 → Returns 52

Time: T4 (All detect threshold reached)
Request A: newCount (50) >= 50 → true
Request B: newCount (51) >= 50 → true
Request C: newCount (52) >= 50 → true

Time: T5 (Race for removal - CRITICAL SECTION)
Request A: removeUserFromTracking("+919876543210")
           └─→ ZREM api:track:users "+919876543210" → Returns 1 (success)
           └─→ DEL api:calls:+919876543210 → Returns 1 (success)
           └─→ Returns true (removed successfully)

Request B: removeUserFromTracking("+919876543210")
           └─→ ZREM api:track:users "+919876543210" → Returns 0 (already gone)
           └─→ DEL api:calls:+919876543210 → Returns 0 (already gone)
           └─→ Returns false (already removed)

Request C: removeUserFromTracking("+919876543210")
           └─→ ZREM api:track:users "+919876543210" → Returns 0 (already gone)
           └─→ DEL api:calls:+919876543210 → Returns 0 (already gone)
           └─→ Returns false (already removed)

Time: T6 (Action execution decision)
Request A: removed === true
           └─→ "User removed - executing action NOW"
           └─→ executeThresholdAction(phone, 50, userInfo) ✅ EXECUTES

Request B: removed === false
           └─→ "Already removed - skipping duplicate action" ❌ SKIPS

Request C: removed === false
           └─→ "Already removed - skipping duplicate action" ❌ SKIPS

Result: Action executes EXACTLY ONCE (by Request A)
```

**Key Insight:** The "remove-first" pattern ensures:
1. Only the request that successfully removes the user executes the action
2. All other requests see `removed === false` and skip execution
3. Redis atomic operations (`ZREM`, `DEL`) guarantee no duplicates

---

## Configuration

### Constants (Backend/Middleware/apiCallTracker.js)

```javascript
const TRACKING_EXPIRY_DAYS = 10;              // Track users for 10 days
const TRACKING_EXPIRY_SECONDS = 864000;       // 10 days in seconds
const API_CALL_THRESHOLD = 50;                // Trigger action at 50 calls

const TRACKING_SET_KEY = 'api:track:users';   // Redis sorted set key
const CALL_COUNT_KEY_PREFIX = 'api:calls:';   // Redis counter prefix
```

### Cron Schedule (Backend/services/cronJobs.js)

```javascript
// Line 124: Cleanup job registration
this.scheduleJob('api-tracking-cleanup', '0 */6 * * *', this.cleanupExpiredApiTracking.bind(this));

// Cron expression: '0 */6 * * *'
// Meaning: At minute 0 of every 6th hour (00:00, 06:00, 12:00, 18:00)
```

**Why every 6 hours?**
- Sorted set members don't auto-expire (Redis limitation)
- Need periodic cleanup to remove expired entries
- 6 hours balances cleanup frequency vs performance
- Individual counters still auto-expire via TTL (no cron needed)

### Auto-Tracking on Registration (Backend/Routes/auth.js)

**Three integration points:**

1. **OTP Verification** (phone-only registration)
```javascript
// Line ~150: After creating new user
addUserToTracking(phoneNumber).catch(err => {
    console.error('Failed to add user to API tracking:', err.message);
});
```

2. **Firebase OTP Login** (Firebase authentication)
```javascript
// Line ~350: After creating new user from Firebase
addUserToTracking(phoneNumber).catch(err => {
    console.error('Failed to add user to API tracking:', err.message);
});
```

3. **Truecaller Login** (OAuth authentication)
```javascript
// Line ~550: After creating new user from Truecaller
addUserToTracking(phoneNumber).catch(err => {
    console.error('Failed to add user to API tracking:', err.message);
});
```

**Pattern:** Fire-and-forget `.catch()` to not block registration flow.

---

## Implementation Details

### Core Functions (Backend/Middleware/apiCallTracker.js)

#### 1. Add User to Tracking
```javascript
async function addUserToTracking(phoneNumber)
```
**Purpose:** Register a phone number for API call tracking.

**Operations:**
1. Calculate expiry timestamp: `Date.now() + (10 days in ms)`
2. Add to sorted set: `ZADD api:track:users {expiry} {phone}`
3. Initialize counter: `SETEX api:calls:{phone} 864000 0` (with 10-day TTL)

**Returns:** `true` if successful, `false` on error.

**Usage:**
```javascript
await addUserToTracking("+919876543210");
```

---

#### 2. Remove User from Tracking
```javascript
async function removeUserFromTracking(phoneNumber)
```
**Purpose:** Stop tracking a user and delete their call counter.

**Operations:**
1. Remove from sorted set: `ZREM api:track:users {phone}`
2. Delete counter: `DEL api:calls:{phone}`

**Returns:** 
- `true` if user was removed (both operations succeeded)
- `false` if user not found (already removed)

**Critical:** Return value used for race condition detection.

**Usage:**
```javascript
const removed = await removeUserFromTracking("+919876543210");
if (!removed) {
    console.log("User already removed by another process");
}
```

---

#### 3. Check if User is Tracked
```javascript
async function isUserBeingTracked(phoneNumber)
```
**Purpose:** Check if a phone number is currently being tracked.

**Operations:**
1. Get expiry timestamp: `ZSCORE api:track:users {phone}`
2. If not found → return `false`
3. If found, check expiry: `score > Date.now()`
   - If expired → remove from set (`ZREM`), return `false`
   - If valid → return `true`

**Returns:** Boolean.

**Auto-cleanup:** Automatically removes expired users during check.

**Usage:**
```javascript
const isTracked = await isUserBeingTracked("+919876543210");
```

---

#### 4. Get Call Count
```javascript
async function getUserCallCount(phoneNumber)
```
**Purpose:** Get current API call count for a user.

**Operations:**
1. Get counter value: `GET api:calls:{phone}`
2. Parse to integer (default 0 if not found)

**Returns:** Integer (call count).

**Usage:**
```javascript
const count = await getUserCallCount("+919876543210"); // Returns 47
```

---

#### 5. Execute Threshold Action
```javascript
async function executeThresholdAction(phoneNumber, callCount, userInfo)
```
**Purpose:** Execute custom action when user hits threshold.

**⚠️ IMPORTANT:** User should already be removed from tracking before calling this function.

**Current Implementation:**
- ✅ **Enabled:** Database logging via `logToDatabase('api_threshold_reached', {...})`
- 🔲 **Disabled (commented):** Email alerts, user account flagging, WhatsApp notifications

**Customization:**
Uncomment sections in function to enable additional actions:

```javascript
// 2. Email Alert (uncomment to enable)
const { sendEmail } = require('../Utils/emailService');
await sendEmail('admin@sitehaazri.in', {
    subject: `API Threshold Alert: ${phoneNumber}`,
    body: `User ${phoneNumber} made ${callCount} API calls.`
});

// 3. Flag User Account (uncomment to enable)
const User = require('../models/Userschema');
await User.findByIdAndUpdate(userInfo.id, {
    $set: { 
        highApiUsage: true,
        lastHighUsageAt: new Date(),
        apiCallCount: callCount
    }
});

// 4. WhatsApp Notification (uncomment to enable)
const { sendWhatsAppMessage } = require('../Utils/whatsappOtp');
await sendWhatsAppMessage(phoneNumber, 
    'Your account has high API activity. Contact support if unusual.'
);
```

**Usage:**
```javascript
// Only call after successful removal
const removed = await removeUserFromTracking(phoneNumber);
if (removed) {
    executeThresholdAction(phoneNumber, 50, {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
        email: req.user.email
    }).catch(err => console.error(err));
}
```

---

#### 6. Cleanup Expired Users
```javascript
async function cleanupExpiredUsers()
```
**Purpose:** Remove expired entries from sorted set (called by cron job).

**Operations:**
1. Get current timestamp: `const now = Date.now()`
2. Remove expired members: `ZREMRANGEBYSCORE api:track:users 0 {now}`
   - Removes all members with score (expiry) less than current time

**Returns:** Number of users removed.

**Note:** Individual counters auto-expire via Redis TTL (not affected by this cleanup).

**Usage:**
```javascript
const removed = await cleanupExpiredUsers();
console.log(`Cleaned up ${removed} expired users`);
```

---

#### 7. API Call Tracker Middleware
```javascript
function apiCallTracker(req, res, next)
```
**Purpose:** Express middleware to track API calls for monitored users.

**Execution Pattern:** Fire-and-forget (non-blocking).

**Flow:**
1. Check if `req.user.phoneNumber` exists (skip if not authenticated)
2. Start async block (doesn't await, returns `next()` immediately)
3. Inside async block:
   - Check if user is tracked
   - Increment counter atomically
   - Refresh counter TTL
   - Log to database (non-blocking)
   - Check threshold
   - If threshold reached:
     - Remove user first (race protection)
     - Execute action if removal successful
4. Call `next()` immediately (API response not delayed)

**Registration (Backend/server.js):**
```javascript
const { apiCallTracker } = require('./Middleware/apiCallTracker');
app.use(apiCallTracker); // After express.json(), before routes
```

**Performance:** Zero impact on API response time (fire-and-forget).

---

## Management API

### Authentication
All endpoints require Super Admin authentication:
```javascript
const { authenticateSuperAdmin } = require('../Middleware/superAdminAuth');
```

### Base Path
```
/api/super-admin/api-tracking
```

---

### 1. Add User to Tracking

**Endpoint:** `POST /api/super-admin/api-tracking/add`

**Request Body:**
```json
{
  "phoneNumber": "+919876543210"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User +919876543210 added to API tracking",
  "expiresAt": "2025-02-08T12:34:56.789Z"
}
```

**Response (Error - Invalid Format):**
```json
{
  "success": false,
  "message": "Invalid phone number format"
}
```

**Response (Error - Already Tracked):**
```json
{
  "success": false,
  "message": "User already being tracked"
}
```

---

### 2. Remove User from Tracking

**Endpoint:** `POST /api/super-admin/api-tracking/remove`

**Request Body:**
```json
{
  "phoneNumber": "+919876543210"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User +919876543210 removed from tracking"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "message": "User not found in tracking"
}
```

---

### 3. Bulk Add Users

**Endpoint:** `POST /api/super-admin/api-tracking/bulk-add`

**Request Body:**
```json
{
  "phoneNumbers": [
    "+919876543210",
    "+918765432109",
    "+917654321098"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk add completed",
  "results": {
    "total": 3,
    "added": 2,
    "skipped": 1,
    "details": [
      { "phoneNumber": "+919876543210", "success": true },
      { "phoneNumber": "+918765432109", "success": true },
      { "phoneNumber": "+917654321098", "success": false, "reason": "Already tracked" }
    ]
  }
}
```

---

### 4. Get User Status

**Endpoint:** `GET /api/super-admin/api-tracking/status/:phoneNumber`

**Example:** `GET /api/super-admin/api-tracking/status/%2B919876543210`

**Response (Tracked):**
```json
{
  "success": true,
  "phoneNumber": "+919876543210",
  "isBeingTracked": true,
  "apiCallCount": 47,
  "expiresAt": "2025-02-08T12:34:56.789Z",
  "thresholdReached": false,
  "remainingCalls": 3
}
```

**Response (Not Tracked):**
```json
{
  "success": true,
  "phoneNumber": "+919876543210",
  "isBeingTracked": false,
  "apiCallCount": 0,
  "thresholdReached": false
}
```

**Response (Expired):**
```json
{
  "success": true,
  "phoneNumber": "+919876543210",
  "isBeingTracked": false,
  "apiCallCount": 0,
  "thresholdReached": false,
  "note": "User was tracked but expired"
}
```

---

### 5. List All Tracked Users

**Endpoint:** `GET /api/super-admin/api-tracking/list`

**Query Parameters:**
- `sortBy` (optional): `callCount` or `expiry` (default: `callCount`)
- `order` (optional): `asc` or `desc` (default: `desc`)
- `limit` (optional): Number of results (default: 100)

**Example:** `GET /api/super-admin/api-tracking/list?sortBy=callCount&order=desc&limit=50`

**Response:**
```json
{
  "success": true,
  "totalTracked": 127,
  "returned": 50,
  "sortedBy": "callCount",
  "order": "desc",
  "users": [
    {
      "phoneNumber": "+919876543210",
      "apiCallCount": 47,
      "expiresAt": "2025-02-08T12:34:56.789Z",
      "daysRemaining": 8,
      "thresholdReached": false,
      "remainingCalls": 3
    },
    {
      "phoneNumber": "+918765432109",
      "apiCallCount": 35,
      "expiresAt": "2025-02-09T08:20:15.123Z",
      "daysRemaining": 9,
      "thresholdReached": false,
      "remainingCalls": 15
    }
    // ... more users
  ]
}
```

**Response (Empty):**
```json
{
  "success": true,
  "totalTracked": 0,
  "returned": 0,
  "users": []
}
```

---

## Testing & Monitoring

### Manual Testing

#### 1. Add Test User
```bash
curl -X POST http://localhost:3000/api/super-admin/api-tracking/add \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919999999999"}'
```

#### 2. Check Status
```bash
curl -X GET http://localhost:3000/api/super-admin/api-tracking/status/%2B919999999999 \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

#### 3. Simulate API Calls
Make authenticated API requests with the test user account. Each request increments the counter.

#### 4. Monitor Logs
Watch for these log messages:
```
🎯 Threshold reached for user +919999999999: 50 calls
🗑️ User +919999999999 removed from tracking - executing action NOW
⚡ Executing action for +919999999999: 50 API calls
✅ Action completed for +919999999999
```

#### 5. Verify Single Execution
Check database logs to confirm only ONE `api_threshold_reached` entry exists for the user.

---

### Redis Inspection

#### Check Sorted Set
```bash
# List all tracked users
redis-cli ZRANGE api:track:users 0 -1 WITHSCORES

# Count tracked users
redis-cli ZCARD api:track:users

# Check specific user
redis-cli ZSCORE api:track:users "+919999999999"
```

#### Check Call Counter
```bash
# Get call count
redis-cli GET "api:calls:+919999999999"

# Check TTL (seconds remaining)
redis-cli TTL "api:calls:+919999999999"
```

#### Manual Cleanup Test
```bash
# Remove expired entries (score < current timestamp)
redis-cli ZREMRANGEBYSCORE api:track:users 0 $(date +%s)000
```

---

### Database Monitoring

#### Check Tracking Logs
```javascript
// In MongoDB shell or via API
db.logs.find({ 
  type: 'api_call_tracked' 
}).sort({ timestamp: -1 }).limit(10);
```

**Sample Log Entry:**
```json
{
  "type": "api_call_tracked",
  "phoneNumber": "+919999999999",
  "userId": "683b167e47f3087645d8ba7f",
  "userName": "Test User",
  "callCount": 47,
  "method": "GET",
  "path": "/api/employee-details",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2025-01-29T10:15:30.456Z"
}
```

#### Check Threshold Actions
```javascript
db.logs.find({ 
  type: 'api_threshold_reached' 
}).sort({ timestamp: -1 });
```

**Sample Log Entry:**
```json
{
  "type": "api_threshold_reached",
  "phoneNumber": "+919999999999",
  "userId": "683b167e47f3087645d8ba7f",
  "userName": "Test User",
  "callCount": 50,
  "action": "immediate_execution",
  "timestamp": "2025-01-29T10:20:45.789Z"
}
```

**Verify Single Execution:**
```javascript
// Count should be 1 for each phone number
db.logs.aggregate([
  { $match: { type: 'api_threshold_reached' } },
  { $group: { _id: '$phoneNumber', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } } // Should return 0 documents
]);
```

---

### Performance Monitoring

#### Middleware Impact
The middleware is fire-and-forget, so it should have **zero impact** on API response times.

**Verify:**
1. Measure API response time with tracked user
2. Measure API response time with non-tracked user
3. Compare results (should be identical)

#### Redis Performance
Monitor Redis operations via `redis-cli`:
```bash
# Monitor all commands in real-time
redis-cli MONITOR

# Get operation statistics
redis-cli INFO commandstats

# Watch for INCR, ZREM, ZSCORE operations
```

#### Cron Job Performance
Check cron job logs for cleanup duration:
```
🧹 Cleaning up expired API tracking users...
✅ Cleaned up 15 expired users from API tracking [Duration: 23ms]
```

---

## Troubleshooting

### Issue 1: Action Executes Multiple Times

**Symptoms:**
- Multiple `api_threshold_reached` log entries for same user
- Multiple emails/notifications sent

**Diagnosis:**
```javascript
// Check database for duplicates
db.logs.aggregate([
  { $match: { type: 'api_threshold_reached' } },
  { $group: { _id: '$phoneNumber', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]);
```

**Possible Causes:**
1. **Race condition bug:** Check if `removeUserFromTracking()` is called before `executeThresholdAction()`
2. **Manual trigger:** Someone called `executeThresholdAction()` directly

**Solution:**
Verify middleware code follows this pattern:
```javascript
const removed = await removeUserFromTracking(phoneNumber);
if (!removed) {
    console.log('Already removed - skipping duplicate action');
    return;
}
executeThresholdAction(...).catch(err => {...});
```

---

### Issue 2: Users Not Removed After Threshold

**Symptoms:**
- User still in tracking list after hitting 50 calls
- Counter keeps incrementing beyond 50

**Diagnosis:**
```bash
# Check if user still in sorted set
redis-cli ZSCORE api:track:users "+919999999999"

# Check call count
redis-cli GET "api:calls:+919999999999"
```

**Possible Causes:**
1. **Error in removal logic:** Check logs for errors
2. **Redis connection issue:** Verify Redis is running

**Solution:**
```bash
# Manual cleanup
redis-cli ZREM api:track:users "+919999999999"
redis-cli DEL "api:calls:+919999999999"
```

---

### Issue 3: Counters Not Auto-Expiring

**Symptoms:**
- Old counters still exist in Redis after 10 days
- Redis memory usage grows indefinitely

**Diagnosis:**
```bash
# Check TTL on counter (should be 864000 seconds initially)
redis-cli TTL "api:calls:+919999999999"

# If returns -1: No TTL set (bug)
# If returns positive number: TTL is working
```

**Possible Causes:**
1. **Missing EXPIRE command:** Check if `EXPIRE` is called after `INCR`
2. **Redis persistence issue:** Check Redis configuration

**Solution:**
```javascript
// Ensure middleware refreshes TTL on each call
await redisClient.expire(callCountKey, TRACKING_EXPIRY_SECONDS);
```

---

### Issue 4: Cron Job Not Running

**Symptoms:**
- Expired users still in sorted set
- No cleanup logs in console

**Diagnosis:**
```bash
# Check if cron job is registered (Backend/server.js)
grep "cronJobService.startAll()" server.js

# Check cron job logs
# Should see: "🧹 Cleaning up expired API tracking users..." every 6 hours
```

**Possible Causes:**
1. **Cron service not started:** Check `cronJobService.startAll()` is called in `server.js`
2. **Error in cron job:** Check logs for errors

**Solution:**
```javascript
// Manual trigger (via API or terminal)
const { cleanupExpiredUsers } = require('./Middleware/apiCallTracker');
await cleanupExpiredUsers();
```

---

### Issue 5: New Users Not Auto-Tracked

**Symptoms:**
- New user registers but not in tracking list
- No error logs during registration

**Diagnosis:**
```bash
# Check auth.js for addUserToTracking() calls
grep -n "addUserToTracking" Backend/Routes/auth.js

# Should appear in 3 places: OTP verify, Firebase login, Truecaller login
```

**Possible Causes:**
1. **Missing integration:** `addUserToTracking()` not called in auth route
2. **Silent failure:** Error caught but not logged

**Solution:**
Ensure fire-and-forget pattern is used:
```javascript
addUserToTracking(phoneNumber).catch(err => {
    console.error('Failed to add user to API tracking:', err.message);
});
```

---

### Issue 6: Performance Degradation

**Symptoms:**
- API responses slower than usual
- High Redis latency

**Diagnosis:**
```bash
# Check Redis latency
redis-cli --latency

# Monitor Redis operations
redis-cli MONITOR

# Check sorted set size
redis-cli ZCARD api:track:users
```

**Possible Causes:**
1. **Large sorted set:** Too many tracked users (> 10,000)
2. **Network issues:** Redis connection problems
3. **Blocking operations:** Middleware not fire-and-forget

**Solution:**
1. Run manual cleanup: `cleanupExpiredUsers()`
2. Reduce tracking duration or threshold
3. Verify middleware uses async block without await

---

### Debug Logging

Enable verbose logging for troubleshooting:

**In apiCallTracker.js:**
```javascript
// Add at start of middleware
console.log(`📊 Tracking check: ${phoneNumber}, isTracked: ${isTracked}, count: ${newCount}`);
```

**In Redis operations:**
```javascript
// Log Redis commands
redisClient.on('connect', () => console.log('✅ Redis connected'));
redisClient.on('error', (err) => console.error('❌ Redis error:', err));
```

**In cron job:**
```javascript
// Log cron executions
console.log('⏰ Cron job started:', new Date().toISOString());
```

---

## Summary

### Key Takeaways

✅ **Non-blocking:** Fire-and-forget pattern ensures zero performance impact  
✅ **Immediate execution:** Actions run instantly (no queue, no delay)  
✅ **Race-protected:** Remove-first pattern guarantees single execution  
✅ **Auto-expiry:** Counters expire via Redis TTL, sorted set via cron  
✅ **Auto-tracking:** New users automatically added on registration  
✅ **Flexible actions:** Easy to customize threshold behavior  
✅ **Super Admin managed:** Protected API for monitoring and control  

### Architecture Highlights

- **Redis Sorted Set:** Master tracking list (manual cleanup needed)
- **Redis Counters:** Individual call counts (auto-expire via TTL)
- **Remove-First Pattern:** Critical for race condition prevention
- **Fire-and-Forget:** All tracking operations are non-blocking
- **Cron Cleanup:** Runs every 6 hours to remove expired sorted set members

### Files Involved

| File | Purpose |
|------|---------|
| `Backend/Middleware/apiCallTracker.js` | Core tracking system (middleware + utilities) |
| `Backend/Routes/apiTrackingManagement.js` | Super Admin management API |
| `Backend/Routes/auth.js` | Auto-tracking integration (3 registration flows) |
| `Backend/services/cronJobs.js` | Periodic cleanup job (every 6 hours) |
| `Backend/server.js` | Middleware and route registration |

### Configuration at a Glance

| Setting | Value | Location |
|---------|-------|----------|
| Tracking Duration | 10 days | `apiCallTracker.js` |
| API Call Threshold | 50 calls | `apiCallTracker.js` |
| Cleanup Schedule | Every 6 hours | `cronJobs.js` |
| Middleware Position | After `express.json()` | `server.js` |
| Management API Path | `/api/super-admin/api-tracking` | `server.js` |

---

**Last Updated:** January 29, 2025  
**Version:** 2.1 (Race-Protected Immediate Execution)  
**Author:** SiteHaazri Development Team

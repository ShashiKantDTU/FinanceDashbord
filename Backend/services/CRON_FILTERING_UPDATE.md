# Cron Job Filtering Update - Production Ready

## Overview
Updated all cron jobs to use production-ready filtering that only sends reports to premium/trial users with active sites, passing minimal user objects for security and efficiency.

## Changes Made

### 1. New Helper Method: `getEligibleUsersForReports()`

**Location:** `Backend/services/cronJobs.js` (lines ~470-510)

**Functionality:**
- Filters users by subscription plan: `['pro', 'premium', 'business']` OR `isTrial: true`
- Populates `site` array to check for active sites
- Returns user-site pairs with minimal user objects

**Return Format:**
```javascript
[
  {
    user: { 
      name: "John Doe",
      phoneNumber: "+919876543210", // Uses whatsAppReportPhone field
      calculationType: "default"     // or "special" for specific user
    },
    sites: ["siteId1", "siteId2"] // Array of active site IDs only
  }
]
```

**Important Field Mappings:**
- `phoneNumber` → Uses `user.whatsAppReportPhone` (NOT `user.phoneNumber`)
- Only sites with `isActive: true` are included
- Users must have `whatsAppReportsEnabled: true`

### 2. Updated Cron Jobs

All 6 cron jobs have been updated to use the new filtering pattern:

#### Weekly Reports
1. **Week 1 (8th)** - Days 1-7
2. **Week 2 (15th)** - Days 8-14
3. **Week 3 (22nd)** - Days 15-21
4. **Week 4 (29th)** - Days 22-28/29/30
5. **Feb 28 Special** - Non-leap years only

#### Monthly Report
6. **1st of Month** - Previous month's full report

### 3. Before vs After Comparison

#### OLD PATTERN ❌
```javascript
// Included ALL active users, even free plan users
const users = await User.find({ 
    isActive: true,
    sites: { $exists: true, $not: { $size: 0 } }
});

// Passed full user object with email (unnecessary)
for (const user of users) {
    for (const siteId of user.sites) {
        const userObject = {
            name: user.name,
            phoneNumber: user.phoneNumber,
            email: user.email  // ❌ Not needed
        };
        await sendWeeklyReport(userObject, siteId.toString());
    }
}
```

#### NEW PATTERN ✅
```javascript
// Only premium/trial users with active sites
const userSitePairs = await this.getEligibleUsersForReports();

if (userSitePairs.length === 0) {
    console.log('⏭️  No eligible users found');
    return;
}

// Minimal user object, pre-filtered active sites
for (const pair of userSitePairs) {
    for (const siteId of pair.sites) {
        await sendWeeklyReport(pair.user, siteId);
        // Rate limiting already included
    }
}
```

## Benefits

### 1. **Cost Reduction**
- Only sends reports to paying users (premium/business) or trial users
- Filters out free plan users (unless on trial)
- Filters out pro plan users (unless on trial)
- Reduces unnecessary API calls to WhatsApp, S3, PDF/Excel generation

### 2. **Compliance**
- Respects subscription boundaries
- No reports sent to inactive sites
- Proper user segmentation

### 3. **Security**
- Minimal user object (no email exposure)
- Only passes required fields: `name`, `phoneNumber` (from whatsAppReportPhone), `calculationType`
- Uses dedicated WhatsApp number field for privacy
- Reduces data leakage risks

### 4. **Performance**
- Pre-filtered active sites (no duplicate checks)
- Single database query with population
- Reduced memory footprint

### 5. **Scalability**
- Early exit if no eligible users
- Rate limiting: 1s (weekly), 1.5s (monthly)
- Ready for batching if needed

## Filtering Logic Details

### User Qualification Criteria
```javascript
{
  $or: [
    { plan: { $in: ['premium', 'business'] } }, // Premium or Business plans only
    { isTrial: true }                           // OR any user on trial
  ],
  site: { $exists: true, $not: { $size: 0 } }, // Must have sites
  whatsAppReportsEnabled: true                  // Must have WhatsApp reports enabled
}
```

**Eligible Users:**
- ✅ Premium plan users
- ✅ Business plan users  
- ✅ Trial users (any plan, as long as `isTrial: true`)

**NOT Eligible:**
- ❌ Free plan users (unless on trial)
- ❌ Pro plan users (unless on trial)
- ❌ Users with `whatsAppReportsEnabled: false`
- ❌ Users without any sites

### Site Qualification Criteria
- Must have `site` array populated
- Each site must have `isActive: true`

### Special User Handling
- User ID `683b167e47f3087645d8ba7f` gets `calculationType: 'special'`
- All other users get `calculationType: 'default'`

## Rate Limiting

### Weekly Reports
- 1 second delay between each report
- Prevents WhatsApp API rate limits

### Monthly Reports
- 1.5 second delay between each report
- More complex reports need slightly longer intervals

## Error Handling

Each cron job includes:
1. **Try-catch blocks** for entire job
2. **Individual error handling** per user/site
3. **Success/failure counters** for monitoring
4. **Detailed error logging** with user names and site IDs

## Testing Recommendations

### 1. Manual Trigger Tests
```javascript
// Add to cronJobs class for testing
async manualTestWeeklyReport() {
    console.log('🔧 Manual test: Weekly Report Week 1');
    await this.sendWeeklyReportWeek1();
}

async manualTestMonthlyReport() {
    console.log('🔧 Manual test: Monthly Report');
    await this.sendMonthlyReportAll();
}
```

### 2. Database Query Test
```javascript
// Test the filtering logic directly
const CronJobManager = require('./services/cronJobs');
const manager = new CronJobManager();
const results = await manager.getEligibleUsersForReports();
console.log('Eligible users:', results.length);
console.log('Sample:', results[0]);
```

### 3. Edge Cases to Test
- ✅ Free plan user (should be excluded)
- ✅ Pro plan user without trial (should be excluded)
- ✅ Pro plan user WITH trial (should be included)
- ✅ Premium user with WhatsApp reports disabled (should be excluded)
- ✅ Trial user with no active sites (should be excluded)
- ✅ Premium user with mix of active/inactive sites (only active sites included)
- ✅ User without whatsAppReportPhone (should handle gracefully)
- ✅ Special user 683b167e47f3087645d8ba7f (should get calculationType: 'special')
- ✅ February leap year detection (Feb 28 vs Feb 29 jobs)

## Production Deployment

### Environment Variables Required
```bash
MONGO_URI=<mongodb_connection_string>
REDIS_URL=<redis_connection_string>
AWS_ACCESS_KEY_ID=<aws_key>
AWS_SECRET_ACCESS_KEY=<aws_secret>
AWS_BUCKET_NAME=<s3_bucket>
WHATSAPP_ACCESS_TOKEN=<meta_business_token>
WHATSAPP_PHONE_NUMBER_ID=<phone_number_id>
```

### Monitoring Recommendations
1. Log success/failure counts to monitoring service
2. Alert on high failure rates (>10%)
3. Track execution time for performance regression
4. Monitor memory usage during large batches

## Future Scalability Enhancements

### 1. Batch Processing
If user base grows significantly (>1000 users):
```javascript
const BATCH_SIZE = 100;
for (let i = 0; i < userSitePairs.length; i += BATCH_SIZE) {
    const batch = userSitePairs.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(pair => processPair(pair)));
}
```

### 2. Queue System
Consider Bull/BullMQ for:
- Retry logic
- Job prioritization
- Distributed processing
- Better failure handling

### 3. Database Indexing
Ensure indexes exist:
```javascript
db.users.createIndex({ plan: 1, isTrial: 1 });
db.sites.createIndex({ isActive: 1 });
```

## Files Modified

1. `Backend/services/cronJobs.js`
   - Added `getEligibleUsersForReports()` method
   - Updated `sendWeeklyReportWeek1()` - Line ~510-570
   - Updated `sendWeeklyReportWeek2()` - Line ~575-635
   - Updated `sendWeeklyReportWeek3()` - Line ~640-700
   - Updated `sendWeeklyReportWeek4()` - Line ~705-765
   - Updated `sendWeeklyReportFeb28()` - Line ~770-830
   - Updated `sendMonthlyReportAll()` - Line ~835-895

## Validation Checklist

- ✅ All 6 cron jobs updated
- ✅ No old `User.find({ isActive: true })` patterns remaining
- ✅ No `email: user.email` in user objects
- ✅ All use `getEligibleUsersForReports()` helper
- ✅ All pass minimal user object: `{ name, phoneNumber, calculationType }`
- ✅ Early exit if no eligible users
- ✅ Rate limiting maintained (1s weekly, 1.5s monthly)
- ✅ Error handling preserved
- ✅ Success/failure counters working

## Rollback Plan

If issues arise, revert to previous filtering with:
```bash
git checkout HEAD~1 Backend/services/cronJobs.js
```

Note: Old pattern sent to all users - use only as emergency fallback.

---

**Last Updated:** 2025-01-XX
**Author:** Development Team
**Status:** ✅ Production Ready

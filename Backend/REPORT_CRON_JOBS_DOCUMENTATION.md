# Report Cron Jobs - Complete Documentation

## Overview
Automated report delivery system using cron jobs to send weekly and monthly reports via WhatsApp to all active users.

---

## Cron Job Schedule

### Weekly Reports

#### Week 1: Days 1-7
- **Schedule**: 8th day of every month at 2:00 AM
- **Cron Expression**: `0 2 8 * *`
- **Coverage**: Attendance and data from Day 1 to Day 7
- **Example**: On October 8th, sends report for October 1-7

#### Week 2: Days 8-14
- **Schedule**: 15th day of every month at 2:00 AM
- **Cron Expression**: `0 2 15 * *`
- **Coverage**: Attendance and data from Day 8 to Day 14
- **Example**: On October 15th, sends report for October 8-14

#### Week 3: Days 15-21
- **Schedule**: 22nd day of every month at 2:00 AM
- **Cron Expression**: `0 2 22 * *`
- **Coverage**: Attendance and data from Day 15 to Day 21
- **Example**: On October 22nd, sends report for October 15-21

#### Week 4: Days 22-28+
- **Schedule**: 29th day of every month at 2:00 AM
- **Cron Expression**: `0 2 29 * *`
- **Coverage**: Attendance and data from Day 22 to Day 28/29/30/31
- **Special Handling**: February handled by separate job
- **Example**: On October 29th, sends report for October 22-31

#### Special: February 28th
- **Schedule**: February 28th at 2:00 AM (non-leap years only)
- **Cron Expression**: `0 2 28 2 *`
- **Coverage**: February 22-28 (non-leap years)
- **Logic**: Automatically skips in leap years
- **Example**: In 2025 (non-leap), runs on Feb 28. In 2024 (leap), skips.

### Monthly Report

#### Previous Month Summary
- **Schedule**: 1st day of every month at 2:00 AM
- **Cron Expression**: `0 2 1 * *`
- **Coverage**: Complete previous month data
- **Example**: On November 1st, sends report for entire October

---

## Cron Expression Format

```
 ┌────────────── minute (0 - 59)
 │ ┌──────────── hour (0 - 23)
 │ │ ┌────────── day of month (1 - 31)
 │ │ │ ┌──────── month (1 - 12)
 │ │ │ │ ┌────── day of week (0 - 6) (Sunday to Saturday)
 │ │ │ │ │
 * * * * *
```

### Our Schedules Explained

| Job | Expression | Meaning |
|-----|-----------|---------|
| Week 1 | `0 2 8 * *` | At 2:00 AM on 8th of every month |
| Week 2 | `0 2 15 * *` | At 2:00 AM on 15th of every month |
| Week 3 | `0 2 22 * *` | At 2:00 AM on 22nd of every month |
| Week 4 | `0 2 29 * *` | At 2:00 AM on 29th of every month |
| Feb 28 | `0 2 28 2 *` | At 2:00 AM on 28th of February only |
| Monthly | `0 2 1 * *` | At 2:00 AM on 1st of every month |

---

## Implementation Details

### File Location
`Backend/services/cronJobs.js`

### Dependencies
```javascript
const { sendMonthlyReport, sendWeeklyReport } = require('../scripts/whatsappReport');
const siteSchema = require('../models/Siteschema');
const User = require('../models/Userschema');
```

### User Selection Criteria
```javascript
User.find({ 
    isActive: true,
    sites: { $exists: true, $not: { $size: 0 } }
})
```

**Filters**:
- Only active users (`isActive: true`)
- Users must have at least one site
- Sends report for each site the user owns

### Rate Limiting
- **Weekly Reports**: 1 second delay between each report
- **Monthly Reports**: 1.5 seconds delay between each report
- Prevents WhatsApp API rate limiting
- Ensures stable delivery

---

## Execution Flow

### Weekly Report Flow
```
Cron Triggers (e.g., Day 8 at 2 AM)
    ↓
Fetch all active users with sites
    ↓
For each user:
    For each site:
        ↓
        Fetch site data (employees, expenses)
        ↓
        Calculate weekly metrics
        ↓
        Generate PDF + Excel
        ↓
        Upload to S3
        ↓
        Send via WhatsApp template
        ↓
        Wait 1 second (rate limit)
    ↓
Log success/failure counts
```

### Monthly Report Flow
```
Cron Triggers (Day 1 at 2 AM)
    ↓
Calculate previous month & year
    ↓
Fetch all active users with sites
    ↓
For each user:
    For each site:
        ↓
        Fetch month data (employees, payouts, expenses)
        ↓
        Calculate monthly metrics
        ↓
        Generate PDF + Excel
        ↓
        Upload to S3
        ↓
        Send via WhatsApp template
        ↓
        Wait 1.5 seconds (rate limit)
    ↓
Log success/failure counts
```

---

## February Handling

### Problem
- Most months have 29+ days
- February has 28 days (non-leap) or 29 days (leap)
- Week 4 job on 29th won't run in non-leap February

### Solution
- **Leap Years** (2024, 2028, etc.): Week 4 job runs on Feb 29
- **Non-Leap Years** (2025, 2026, etc.): Special job runs on Feb 28
- Special job checks if it's a leap year and skips if true

### Leap Year Detection
```javascript
const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
```

### Examples
| Year | Type | Feb Days | Job That Runs |
|------|------|----------|---------------|
| 2024 | Leap | 29 | Week 4 (Feb 29) |
| 2025 | Non-Leap | 28 | Feb 28 Special |
| 2026 | Non-Leap | 28 | Feb 28 Special |
| 2028 | Leap | 29 | Week 4 (Feb 29) |

---

## Manual Testing

### Manual Trigger Methods

```javascript
// Weekly Reports
await cronJobService.manualTriggerWeeklyReportWeek1();
await cronJobService.manualTriggerWeeklyReportWeek2();
await cronJobService.manualTriggerWeeklyReportWeek3();
await cronJobService.manualTriggerWeeklyReportWeek4();

// Monthly Report
await cronJobService.manualTriggerMonthlyReport();
```

### Testing Routes (Add to cronRoutes.js if needed)
```javascript
router.post('/trigger/weekly-week1', async (req, res) => {
    await cronJobService.manualTriggerWeeklyReportWeek1();
    res.json({ success: true });
});

router.post('/trigger/monthly', async (req, res) => {
    await cronJobService.manualTriggerMonthlyReport();
    res.json({ success: true });
});
```

---

## Logging & Monitoring

### Console Output

#### Successful Execution
```
📊 Starting Weekly Report Week 1 (Days 1-7)...
📋 Found 125 active users with sites
✅ Weekly Report Week 1 completed: 230 sent, 5 failed
```

#### Error Handling
```
❌ Failed to send weekly report to John Doe for site 6870f208...: Template not found
❌ Error in sendWeeklyReportWeek1: Connection timeout
```

### Metrics Tracked
- Total users processed
- Total reports sent (success count)
- Total failures
- Execution time

---

## Error Handling

### User-Level Errors
- Logged with user name and site ID
- Job continues to next user
- Final count shows failures

### System-Level Errors
- Entire job fails and throws error
- Logged with error message
- Will retry on next scheduled run

### Common Errors
| Error | Cause | Solution |
|-------|-------|----------|
| Template not found | Template name mismatch | Check WHATSAPP_REPORT_TEMPLATE_NAME |
| No employees found | Empty site | Gracefully skipped |
| S3 upload failed | AWS credentials | Check AWS_* env variables |
| WhatsApp API error | Rate limit / Invalid number | Check rate limiting, phone format |

---

## Configuration

### Environment Variables Required
```env
# WhatsApp
META_ACCESS_TOKEN=your_token
META_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_REPORT_TEMPLATE_NAME=report

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your_bucket

# MongoDB
MONGO_URI=mongodb://...
```

### Timezone
```javascript
timezone: "Asia/Kolkata" // IST (UTC+5:30)
```

All times are in Indian Standard Time (IST).

---

## Calendar View

### Example: October 2025

| Date | Cron Job | Report Coverage |
|------|----------|-----------------|
| Oct 1 | Monthly | September 1-30 full report |
| Oct 8 | Week 1 | October 1-7 |
| Oct 15 | Week 2 | October 8-14 |
| Oct 22 | Week 3 | October 15-21 |
| Oct 29 | Week 4 | October 22-31 |
| Nov 1 | Monthly | October 1-31 full report |

### Example: February 2025 (Non-Leap)

| Date | Cron Job | Report Coverage |
|------|----------|-----------------|
| Feb 1 | Monthly | January 1-31 full report |
| Feb 8 | Week 1 | February 1-7 |
| Feb 15 | Week 2 | February 8-14 |
| Feb 22 | Week 3 | February 15-21 |
| **Feb 28** | **Feb 28 Special** | **February 22-28** |
| Mar 1 | Monthly | February 1-28 full report |

### Example: February 2024 (Leap)

| Date | Cron Job | Report Coverage |
|------|----------|-----------------|
| Feb 1 | Monthly | January 1-31 full report |
| Feb 8 | Week 1 | February 1-7 |
| Feb 15 | Week 2 | February 8-14 |
| Feb 22 | Week 3 | February 15-21 |
| **Feb 29** | **Week 4** | **February 22-29** |
| Mar 1 | Monthly | February 1-29 full report |

---

## Performance Considerations

### Load Distribution
- Jobs run at 2 AM (low traffic period)
- Different days prevent overlapping
- Rate limiting prevents API overload

### Estimated Duration
Assuming 100 users with 2 sites each (200 reports):
- With 1 second delay: ~3.3 minutes
- With 1.5 second delay: ~5 minutes

### Scalability
For larger user bases:
- Consider batch processing
- Implement queue system (Bull, BeeQueue)
- Distribute across multiple servers
- Increase rate limit delays if API errors occur

---

## Maintenance

### Adding New Cron Jobs
1. Define schedule in `init()` method
2. Create handler method
3. Add manual trigger method
4. Test with manual trigger
5. Monitor logs after first scheduled run

### Modifying Schedules
1. Update cron expression in `init()`
2. Restart service
3. Verify in logs: `📅 Scheduled job: [name] with schedule: [cron]`

### Disabling Cron Jobs
```javascript
// Comment out in init()
// this.scheduleJob('weekly-report-week1', '0 2 8 * *', this.sendWeeklyReportWeek1.bind(this));
```

---

## Troubleshooting

### Cron Not Running
✅ Check if cronJobs.init() is called in server.js
✅ Verify timezone setting
✅ Check server date/time with `date` command
✅ Review cron expression syntax

### Reports Not Sending
✅ Check WhatsApp template is approved
✅ Verify environment variables
✅ Test with manual trigger
✅ Check user has valid phone number
✅ Review S3 upload permissions

### Wrong Data in Reports
✅ Verify date calculation logic
✅ Check monthly vs weekly data fetching
✅ Test with specific date range manually

---

## Future Enhancements

### Planned Features
1. **Daily Reports**: Option for daily summaries
2. **Custom Schedules**: Per-user report preferences
3. **Retry Logic**: Automatic retry for failed sends
4. **Report Queue**: Background job queue for better scaling
5. **Email Reports**: Alternative delivery method
6. **SMS Notifications**: Backup notification channel
7. **Report Analytics**: Track open rates, download counts

### Optimization Opportunities
1. Parallel processing for multiple sites
2. Caching site data to reduce DB queries
3. Pre-generate reports and send in batches
4. Implement circuit breaker for WhatsApp API

---

## Support & Documentation

### Related Documentation
- `WHATSAPP_TEMPLATE_SETUP.md` - Template configuration
- `WEEKLY_REPORT_DOCUMENTATION.md` - Weekly report details
- `CRON_JOBS_README.md` - General cron job info

### Contact
For issues or questions about cron jobs:
- Check logs in console
- Review error messages
- Test with manual triggers
- Email: support@sitehaazri.com

---

## Summary

✅ **6 Cron Jobs** configured for automated reporting
✅ **Weekly Reports**: 4 jobs covering all weeks of the month
✅ **Monthly Reports**: 1 job for complete previous month
✅ **February Handling**: Special job for non-leap years
✅ **Rate Limited**: Prevents API overload
✅ **Error Tolerant**: Continues even if individual sends fail
✅ **Manual Testing**: All jobs can be triggered manually
✅ **Production Ready**: Timezone, logging, error handling included

The system ensures all users receive timely reports without manual intervention!

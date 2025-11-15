# Cron Job Monitoring API Guide

## Overview
This API helps you track **individual cron job executions** - see exactly what happened in the last cron job or any previous execution. Each execution is logged separately so you can track success/failures/skips for every run.

---

## Purpose
**Track individual cron job executions:**
- ✅ What happened in the **last cron job**?
- ✅ What happened in **any previous cron job**?
- ✅ All job types are **separated** for easy tracking
- ✅ See exact details: which users got reports, which failed, which were skipped

---

## Cron Jobs Structure

### 📅 Monthly Reports
- **Job Name**: `monthly`
- **Schedule**: 1st of every month at 2:00 AM
- **Coverage**: Previous month's complete data
- **Example**: On January 1st, sends December report

### 📅 Weekly Reports

#### Week 1
- **Job Name**: `weekly-week1`
- **Schedule**: 8th of every month at 2:00 AM
- **Coverage**: Days 1-7 of current month

#### Week 2
- **Job Name**: `weekly-week2`
- **Schedule**: 15th of every month at 2:00 AM
- **Coverage**: Days 8-14 of current month

#### Week 3
- **Job Name**: `weekly-week3`
- **Schedule**: 22nd of every month at 2:00 AM
- **Coverage**: Days 15-21 of current month

#### Week 4
- **Job Name**: `weekly-week4`
- **Schedule**: 29th of every month at 2:00 AM
- **Coverage**: Days 22-28 of current month

#### February Special
- **Job Name**: `weekly-feb28`
- **Schedule**: 28th of February at 2:00 AM (non-leap years)
- **Coverage**: Backup for Week 4 in February

---

## API Endpoints

### 1. Get Recent Cron Job Executions

**Endpoint**: `GET /api/usage/cron-jobs`

**Description**: Get list of recent cron job executions (all types or specific type). Each execution is separate - you can see exactly what happened in each one.

**Authentication**: Requires Super Admin authentication

**Query Parameters**:
- `limit` (optional, default: 50) - Number of executions to return
- `jobType` (optional) - Filter by specific job type:
  - `monthly` - Only monthly reports
  - `weekly-week1` - Only week 1 reports
  - `weekly-week2` - Only week 2 reports
  - `weekly-week3` - Only week 3 reports
  - `weekly-week4` - Only week 4 reports
  - `weekly-feb28` - Only Feb 28 reports

**Example Requests**:
```bash
# Get last 20 cron job executions (all types mixed)
GET /api/usage/cron-jobs?limit=20

# Get last 10 monthly report executions only
GET /api/usage/cron-jobs?jobType=monthly&limit=10

# Get last 15 week 1 executions only
GET /api/usage/cron-jobs?jobType=weekly-week1&limit=15
```

**Response Structure**:
```json
{
  "success": true,
  "message": "Showing last 20 cron job executions (all types)",
  "latestExecution": {
    "_id": "673abc123def456789012345",
    "jobName": "weekly-week1",
    "jobDescription": "Week 1 report - Runs on 8th of every month at 2 AM",
    "coverage": "Days 1-7 of current month",
    "executionDate": "2025-11-08T02:00:00.000Z",
    "status": "completed",
    "totalUsers": 150,
    "totalSites": 320,
    "successCount": 315,
    "failureCount": 2,
    "skippedCount": 3,
    "successRate": "99.37",
    "executionTime": 45230,
    "executionTimeFormatted": "45.23s",
    "completedAt": "2025-11-08T02:00:45.230Z",
    "metadata": {
      "month": 11,
      "year": 2025,
      "weekNumber": 1
    },
    "createdAt": "2025-11-08T02:00:00.123Z"
  },
  "totalReturned": 20,
  "executions": [
    {
      "_id": "673abc123def456789012345",
      "jobName": "weekly-week1",
      "jobDescription": "Week 1 report - Runs on 8th of every month at 2 AM",
      "coverage": "Days 1-7 of current month",
      "executionDate": "2025-11-08T02:00:00.000Z",
      "status": "completed",
      "totalUsers": 150,
      "totalSites": 320,
      "successCount": 315,
      "failureCount": 2,
      "skippedCount": 3,
      "successRate": "99.37",
      "executionTime": 45230,
      "executionTimeFormatted": "45.23s",
      "completedAt": "2025-11-08T02:00:45.230Z",
      "metadata": {
        "month": 11,
        "year": 2025,
        "weekNumber": 1
      },
      "createdAt": "2025-11-08T02:00:00.123Z"
    },
    {
      "_id": "673abc123def456789012346",
      "jobName": "monthly",
      "jobDescription": "Monthly report - Runs on 1st of every month at 2 AM",
      "coverage": "Previous month complete data",
      "executionDate": "2025-11-01T02:00:00.000Z",
      "status": "completed",
      "totalUsers": 148,
      "totalSites": 318,
      "successCount": 310,
      "failureCount": 5,
      "skippedCount": 3,
      "successRate": "98.41",
      "executionTime": 52340,
      "executionTimeFormatted": "52.34s",
      "completedAt": "2025-11-01T02:00:52.340Z",
      "metadata": {
        "month": 10,
        "year": 2025
      },
      "createdAt": "2025-11-01T02:00:00.234Z"
    }
    // ... more executions
  ],
  "availableJobTypes": [
    "monthly",
    "weekly-week1",
    "weekly-week2",
    "weekly-week3",
    "weekly-week4",
    "weekly-feb28"
  ],
  "jobTypeDescriptions": {
    "monthly": {
      "description": "Monthly report - Runs on 1st of every month at 2 AM",
      "schedule": "0 2 1 * *",
      "coverage": "Previous month complete data"
    },
    "weekly-week1": {
      "description": "Week 1 report - Runs on 8th of every month at 2 AM",
      "schedule": "0 2 8 * *",
      "coverage": "Days 1-7 of current month"
    }
    // ... other job types
  }
}
```

---

### 2. Get Detailed Execution Info (What Exactly Happened)

**Endpoint**: `GET /api/usage/cron-jobs/:id`

**Description**: Get complete details about a specific cron job execution - see exactly what happened: which users received reports, which failed, which were skipped, and why.

**Use this to answer**: "What exactly happened in the last cron job?" or "What went wrong in that execution?"

**Authentication**: Requires Super Admin authentication

**Path Parameters**:
- `id` - MongoDB ObjectId of the cron job execution

**Example Request**:
```bash
GET /api/usage/cron-jobs/673abc123def456789012345
```

**Response Structure**:
```json
{
  "success": true,
  "cronJob": {
    "_id": "673abc123def456789012345",
    "jobName": "monthly",
    "executionDate": "2025-11-01T02:00:00.000Z",
    "status": "completed",
    "totalUsers": 150,
    "totalSites": 320,
    "successCount": 315,
    "failureCount": 2,
    "skippedCount": 3,
    "executionTime": 45230,
    "completedAt": "2025-11-01T02:00:45.230Z",
    "metadata": {
      "month": 10,
      "year": 2025
    },
    "createdAt": "2025-11-01T02:00:00.123Z",
    "updatedAt": "2025-11-01T02:00:45.456Z"
  },
  "userSummary": [
    {
      "userName": "John Doe",
      "phoneNumber": "+919876543210",
      "totalSites": 5,
      "successfulSites": 5,
      "failedSites": 0,
      "skippedSites": 0,
      "successRate": "100.00",
      "userDetails": {
        "email": "john@example.com",
        "plan": "pro",
        "isTrial": false,
        "planActivatedAt": "2025-01-15T10:30:00.000Z"
      }
    }
    // ... more users
  ],
  "successfulReports": [
    {
      "userName": "John Doe",
      "phoneNumber": "+919876543210",
      "siteId": "site123",
      "siteName": "Construction Site A",
      "timestamp": "2025-11-01T02:00:15.000Z",
      "userDetails": {
        "email": "john@example.com",
        "plan": "pro",
        "isTrial": false,
        "planActivatedAt": "2025-01-15T10:30:00.000Z"
      }
    }
    // ... more successful reports
  ],
  "skippedReports": [
    {
      "userName": "Jane Smith",
      "phoneNumber": "+919876543211",
      "siteId": "site456",
      "siteName": "Site B",
      "reason": "No data available for period",
      "timestamp": "2025-11-01T02:00:20.000Z",
      "userDetails": {
        "email": "jane@example.com",
        "plan": "basic",
        "isTrial": false,
        "planActivatedAt": "2025-02-01T12:00:00.000Z"
      }
    }
    // ... more skipped reports
  ],
  "failures": [
    {
      "userName": "Bob Wilson",
      "phoneNumber": "+919876543212",
      "siteId": "site789",
      "siteName": "Site C",
      "error": "WhatsApp API timeout",
      "timestamp": "2025-11-01T02:00:25.000Z",
      "userDetails": {
        "email": "bob@example.com",
        "plan": "pro",
        "isTrial": false,
        "planActivatedAt": "2025-03-10T09:15:00.000Z"
      }
    }
    // ... more failures
  ],
  "statistics": {
    "totalReports": 320,
    "successRate": "98.44",
    "failureRate": "0.63",
    "skipRate": "0.94",
    "executionTimeFormatted": "45.23s"
  }
}
```

---

### 3. Get User's Cron Job Reports

**Endpoint**: `GET /api/usage/cron-jobs/user/:phone`

**Description**: Get all cron job reports for a specific user, showing which reports they received, failed, or were skipped.

**Authentication**: Requires Super Admin authentication

**Path Parameters**:
- `phone` - User's phone number (with country code)

**Query Parameters**:
- `period` (optional, default: 'month') - Time period filter
  - Options: `today`, `yesterday`, `week`, `month`, `3months`
- `startDate` (optional) - Custom start date (YYYY-MM-DD)
- `endDate` (optional) - Custom end date (YYYY-MM-DD)

**Example Request**:
```bash
GET /api/usage/cron-jobs/user/+919876543210?period=month
```

**Response Structure**:
```json
{
  "success": true,
  "period": {
    "type": "month",
    "startDate": "2025-10-15T00:00:00.000Z",
    "endDate": "2025-11-15T23:59:59.999Z"
  },
  "user": {
    "name": "John Doe",
    "phoneNumber": "+919876543210",
    "email": "john@example.com",
    "plan": "pro",
    "isTrial": false,
    "planActivatedAt": "2025-01-15T10:30:00.000Z",
    "registeredAt": "2025-01-10T08:00:00.000Z"
  },
  "summary": {
    "totalCronJobs": 5,
    "totalReports": 25,
    "totalSuccessful": 24,
    "totalSkipped": 0,
    "totalFailed": 1,
    "successRate": "96.00"
  },
  "reports": [
    {
      "jobId": "673abc123def456789012345",
      "jobName": "monthly",
      "executionDate": "2025-11-01T02:00:00.000Z",
      "status": "completed",
      "metadata": {
        "month": 10,
        "year": 2025
      },
      "userSummary": {
        "userName": "John Doe",
        "phoneNumber": "+919876543210",
        "totalSites": 5,
        "successfulSites": 5,
        "failedSites": 0,
        "skippedSites": 0
      },
      "successful": [
        {
          "siteId": "site123",
          "siteName": "Construction Site A",
          "timestamp": "2025-11-01T02:00:15.000Z"
        }
        // ... more sites
      ],
      "skipped": [],
      "failures": [],
      "counts": {
        "successful": 5,
        "skipped": 0,
        "failed": 0,
        "total": 5
      }
    }
    // ... more cron job executions
  ]
}
```

---

## Usage Examples

### Example 1: Check What Happened in Last Cron Job
```bash
# Get the most recent cron job execution (any type)
curl -X GET "http://localhost:5000/api/usage/cron-jobs?limit=1" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"

# Response will show the latestExecution with all details
```

### Example 2: Check Last 5 Monthly Reports
```bash
# See the last 5 monthly report executions only
curl -X GET "http://localhost:5000/api/usage/cron-jobs?jobType=monthly&limit=5" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

### Example 3: See Exactly What Happened in a Specific Execution
```bash
# Get complete details - who got reports, who failed, who was skipped
curl -X GET "http://localhost:5000/api/usage/cron-jobs/673abc123def456789012345" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"

# This shows:
# - All successful reports (which users, which sites)
# - All failures (with error messages)
# - All skipped reports (with reasons)
```

### Example 4: Check All Weekly Week 1 Executions
```bash
# Get last 20 executions of week 1 reports
curl -X GET "http://localhost:5000/api/usage/cron-jobs?jobType=weekly-week1&limit=20" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

### Example 5: Track User's Report Delivery History
```bash
# See all reports sent/failed/skipped for a specific user
curl -X GET "http://localhost:5000/api/usage/cron-jobs/user/+919876543210?period=3months" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

---

## Common Use Cases

### 🔍 "What happened in the last cron job?"
```bash
GET /api/usage/cron-jobs?limit=1
```
Look at `latestExecution` - it shows status, success/failure counts, execution time.

For complete details (who got reports, who failed):
```bash
GET /api/usage/cron-jobs/{_id}
```

### 🔍 "What happened in yesterday's weekly report?"
```bash
# First, get recent weekly executions
GET /api/usage/cron-jobs?jobType=weekly-week1&limit=5

# Find the execution from yesterday, copy its _id
# Then get full details
GET /api/usage/cron-jobs/{_id}
```

### 🔍 "Why did reports fail for some users?"
```bash
# Get execution details
GET /api/usage/cron-jobs/{_id}

# Check the "failures" array - it shows:
# - Which users failed
# - Which sites failed
# - Error messages for each failure
```

### 🔍 "Show me all monthly reports from last 6 months"
```bash
GET /api/usage/cron-jobs?jobType=monthly&limit=6
```

### 🔍 "Did a specific user get their report?"
```bash
GET /api/usage/cron-jobs/user/+919876543210?period=week

# Shows all reports for that user:
# - Successful deliveries
# - Failed deliveries
# - Skipped reports
```

---

## Response Fields Explained

### Job Execution Object
- `_id`: Unique identifier for the execution
- `executionDate`: When the cron job started
- `status`: Current status (`started`, `completed`, `failed`)
- `totalUsers`: Number of users processed
- `totalSites`: Total number of sites processed
- `successCount`: Number of reports successfully sent
- `failureCount`: Number of reports that failed
- `skippedCount`: Number of reports skipped (no data, etc.)
- `executionTime`: Duration in milliseconds
- `completedAt`: When the job finished
- `metadata`: Additional info (month, year, weekNumber)

### Statistics Object
- `totalExecutions`: Total times this job has run
- `completedExecutions`: Successfully completed runs
- `failedExecutions`: Failed runs
- `totalReportsSent`: Total successful reports across all runs
- `totalReportsFailed`: Total failed reports across all runs
- `totalReportsSkipped`: Total skipped reports across all runs
- `avgExecutionTime`: Average time per execution (ms)
- `lastExecution`: Most recent execution date
- `successRate`: Percentage of successful reports

---

## Error Responses

### 503 - Service Unavailable
```json
{
  "success": false,
  "message": "Cron job logging not available"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "message": "Cron job log not found"
}
// or
{
  "success": false,
  "message": "User not found"
}
```

### 500 - Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message"
}
```

---

## Best Practices

1. **Monitor All Job Types**: Check both monthly and weekly reports regularly
2. **Track Failure Patterns**: Look for recurring failures by user or site
3. **Performance Monitoring**: Watch execution times to detect slowdowns
4. **User-Specific Debugging**: Use the user endpoint to diagnose individual issues
5. **Success Rate Tracking**: Monitor success rates to ensure quality of service

---

## Notes

- All dates are in ISO 8601 format with UTC timezone
- Phone numbers include country code (e.g., +91 for India)
- Execution times are in milliseconds
- Large detail arrays (successfulReports, failures, etc.) are excluded from list views for performance
- Super Admin authentication is required for all endpoints

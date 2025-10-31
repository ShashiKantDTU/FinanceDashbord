# System Tests

Tests for core system functionality like API tracking, configuration management, and cron jobs.

## Files in This Directory

### test-api-tracking.js
**Purpose**: Test Redis-based API call tracking middleware  
**What it tests**:
- Adding users to tracking
- Removing users from tracking
- Checking if user is being tracked
- Getting call counts
- API rate limiting logic

**Usage**:
```bash
node tests/system/test-api-tracking.js
```

**Dependencies**: Redis (must be running)

---

### test-config-update.js
**Purpose**: Verify WhatsApp template config file updates  
**What it tests**:
- Reading current config
- Updating media IDs
- Persisting changes to config file
- Config file integrity

**Usage**:
```bash
node tests/system/test-config-update.js
```

**Tests**: `config/whatsappTemplateConfig.js` update mechanism

---

### test-cron-trigger.js
**Purpose**: Manually trigger scheduled cron jobs for testing  
**What it tests**:
- Weekly report jobs (Week 1-4)
- Monthly report jobs
- Cron job execution logic
- Report generation at scheduled times

**Usage**:
```bash
# Trigger specific job
node tests/system/test-cron-trigger.js week1
node tests/system/test-cron-trigger.js month
ly
node tests/system/test-cron-trigger.js all-weekly

# Interactive mode
node tests/system/test-cron-trigger.js
```

**Available jobs**:
- `week1` - Weekly Report Week 1 (Days 1-7)
- `week2` - Weekly Report Week 2 (Days 8-14)
- `week3` - Weekly Report Week 3 (Days 15-21)
- `week4` - Weekly Report Week 4 (Days 22-28+)
- `monthly` - Monthly Report (previous month)
- `all-weekly` - All 4 weekly reports

**Dependencies**: MongoDB, cron job service

---

## Running System Tests

### Run All System Tests (Future)
```bash
# Once integrated into main test runner
node run-tests.js --system-tests
```

### Run Individual Test
```bash
# Direct execution
node tests/system/test-api-tracking.js
node tests/system/test-config-update.js
node tests/system/test-cron-trigger.js monthly
```

## Prerequisites

- **Redis**: Required for API tracking tests
- **MongoDB**: Required for cron trigger tests
- **Environment Variables**: All required env vars in `.env`

## When to Run These Tests

- **API Tracking**: After changes to rate limiting or Redis logic
- **Config Update**: After modifying template config mechanism
- **Cron Trigger**: To test scheduled reports manually before deploying

## Integration Notes

These tests can be integrated into the main `run-tests.js` menu as:
- Option: "System Tests"
- Submenu with individual system test options

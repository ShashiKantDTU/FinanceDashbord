# Cron Job Routes Guide

This documentation details the API endpoints for managing and triggering cron jobs in the backend. These routes are protected and accessible only to **Super Admin** users.

---

## Authentication

All cron job routes require **Super Admin authentication**.
This matches the authentication system used in the usage API (`Routes/usage.js`).

**Middleware**: `authenticateSuperAdmin`
**Required Header**: `Authorization: Bearer <SUPER_ADMIN_JWT>`

Users must obtain a super admin token via the restricted login endpoint before accessing these routes.

---

## Base Path

All routes are mounted at: `/api/cron`

---

## Status Endpoint

### `GET /api/cron/status`

Get the current status of all scheduled cron jobs.

**Response**:
```json
{
  "success": true,
  "jobs": {
    "expiredUsersJob": "running",
    "graceExpiredJob": "running",
    "weeklyReportJob": "stopped"
  },
  "timestamp": "2024-05-20T10:00:00.000Z"
}
```

---

## Manual Trigger Endpoints

These endpoints allow manual execution of cron jobs for testing or immediate processing.

### User Management Triggers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/trigger/expired-users` | POST | Triggers the check for users with expired plans |
| `/api/cron/trigger/grace-expired` | POST | Triggers the check for users whose grace period has ended |

**Response Example**:
```json
{
  "success": true,
  "message": "Expired users check triggered successfully",
  "timestamp": "2024-05-20T10:05:00.000Z"
}
```

### Report Generation Triggers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/trigger/weekly-week1` | POST | Weekly Report: Days 1-7 |
| `/api/cron/trigger/weekly-week2` | POST | Weekly Report: Days 8-14 |
| `/api/cron/trigger/weekly-week3` | POST | Weekly Report: Days 15-21 |
| `/api/cron/trigger/weekly-week4` | POST | Weekly Report: Days 22-28+ |
| `/api/cron/trigger/monthly-report` | POST | Monthly Report (Previous Month) |

---

## Maintenance Endpoints

### `POST /api/cron/stop-all`

Stops all scheduled cron jobs. Useful during maintenance or updates.

### `POST /api/cron/restart`

Restarts all cron jobs. Useful after configuration changes.

### `POST /api/cron/trigger/counter-sync`

Manually triggers the "Calculate-on-Write" counter synchronization. This runs in the background.

**Response**:
```json
{
  "success": true,
  "message": "Counter sync started in background. Check CronJobLog for results.",
  "timestamp": "2024-05-20T10:10:00.000Z"
}
```

---

## Integration with Frontend

To invoke these routes from the Super Admin Dashboard:

1. Ensure the user is logged in as a Super Admin.
2. Include the `Authorization` header with the JWT token in every request.
3. Handle standard HTTP success (200) and error (401, 403, 500) codes.

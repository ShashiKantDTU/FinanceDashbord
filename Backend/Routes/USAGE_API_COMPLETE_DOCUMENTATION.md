# 📊 Usage Analytics API - Complete Documentation

## Overview
Complete API reference for all usage analytics endpoints. These APIs provide comprehensive insights into backend performance, user behavior, and system health.

---

## 🔐 Authentication
All endpoints require:
- **JWT Token**: Valid Bearer token in `Authorization` header
- **Admin Role**: Most endpoints require Admin role (except `/my-stats`)

---

## 📋 Table of Contents
1. [Dashboard Overview](#1-dashboard-overview)
2. [User-Endpoint Analytics](#2-user-endpoint-analytics)
3. [New Users Tracking](#3-new-users-tracking)
4. [User Activity Detail](#4-user-activity-detail)
5. [System Performance](#5-system-performance)
6. [My Stats](#6-my-stats-legacy)
7. [Health Check](#7-health-check)
8. [Cleanup Logs](#8-cleanup-logs)

---

## 1. Dashboard Overview

**Endpoint**: `GET /api/usage/dashboard`

**Description**: High-level system overview with top users and traffic patterns.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | `week` | Time period: `today`, `yesterday`, `week`, `month`, `3months` |

### Request Example
```bash
GET /api/usage/dashboard?period=week
Authorization: Bearer YOUR_TOKEN
```

### Response Schema
```json
{
  "success": true,
  "period": {
    "type": "week",
    "startDate": "2025-09-26T00:00:00.000Z",
    "endDate": "2025-10-03T12:34:56.789Z"
  },
  "summary": {
    "totalRequests": 15432,
    "totalDataBytes": 52428800,
    "uniqueUsers": 234,
    "uniqueEndpoints": 42,
    "avgRequestsPerUser": 66
  },
  "topUsers": [
    {
      "phone": "+919876543210",
      "name": "John Doe",
      "totalRequests": 1250,
      "totalDataBytes": 4200000,
      "endpointCount": 15
    }
  ],
  "hourlyDistribution": [
    {
      "hour": 0,
      "requests": 45
    },
    {
      "hour": 1,
      "requests": 23
    }
  ]
}
```

### Response Fields

#### `period` object
- `type` (string): Period type used
- `startDate` (ISO date): Start of period
- `endDate` (ISO date): End of period

#### `summary` object
- `totalRequests` (number): Total API requests in period
- `totalDataBytes` (number): Total data transferred in bytes
- `uniqueUsers` (number): Count of unique users
- `uniqueEndpoints` (number): Count of unique endpoints accessed
- `avgRequestsPerUser` (number): Average requests per user

#### `topUsers` array
- `phone` (string): User's phone number
- `name` (string): User's current name (always up-to-date)
- `totalRequests` (number): User's total requests
- `totalDataBytes` (number): User's total data usage
- `endpointCount` (number): Number of unique endpoints accessed

#### `hourlyDistribution` array
- `hour` (number): Hour of day (0-23)
- `requests` (number): Requests in that hour

---

## 2. User-Endpoint Analytics

**Endpoint**: `GET /api/usage/user-endpoint-analytics`

**Description**: Shows which endpoints each user accessed with detailed timing information. Perfect for understanding user behavior patterns.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | `week` | Predefined period: `today`, `yesterday`, `week`, `month`, `3months` |
| `startDate` | string | No | - | Custom start date (YYYY-MM-DD). Use with `endDate` |
| `endDate` | string | No | - | Custom end date (YYYY-MM-DD). Use with `startDate` |

**Note**: If both `startDate` and `endDate` are provided, `period` is ignored.

### Request Examples

**Predefined Period:**
```bash
GET /api/usage/user-endpoint-analytics?period=week
Authorization: Bearer YOUR_TOKEN
```

**Custom Date Range:**
```bash
GET /api/usage/user-endpoint-analytics?startDate=2025-10-02&endDate=2025-10-08
Authorization: Bearer YOUR_TOKEN
```

### Response Schema
```json
{
  "success": true,
  "period": {
    "type": "custom",
    "startDate": "2025-10-02T00:00:00.000Z",
    "endDate": "2025-10-08T23:59:59.999Z",
    "totalDays": 7
  },
  "summary": {
    "totalUsers": 156,
    "totalRequests": 8934,
    "uniqueEndpoints": 28,
    "avgRequestsPerUser": 57,
    "avgRequestsPerDay": 1276
  },
  "users": [
    {
      "phone": "+919876543210",
      "name": "John Doe",
      "email": "john@example.com",
      "plan": "premium",
      "totalRequests": 450,
      "totalDataBytes": 1500000,
      "uniqueEndpoints": 12,
      "firstActivity": "2025-10-02T08:30:00.000Z",
      "lastActivity": "2025-10-08T18:45:00.000Z",
      "endpoints": [
        {
          "endpoint": "/api/employees",
          "method": "GET",
          "requestCount": 156,
          "totalDataBytes": 650000,
          "avgResponseSize": 4167,
          "firstAccess": "2025-10-02T08:30:00.000Z",
          "lastAccess": "2025-10-08T17:20:00.000Z",
          "successRate": 98.72,
          "recentTimestamps": [
            "2025-10-08T17:20:00.000Z",
            "2025-10-08T16:15:00.000Z",
            "2025-10-08T14:30:00.000Z"
          ]
        }
      ]
    }
  ]
}
```

### Response Fields

#### `period` object
- `type` (string): `custom` or predefined period name
- `startDate` (ISO date): Start of period
- `endDate` (ISO date): End of period
- `totalDays` (number): Number of days in period

#### `summary` object
- `totalUsers` (number): Total users who made requests
- `totalRequests` (number): Total requests across all users
- `uniqueEndpoints` (number): Unique endpoints accessed
- `avgRequestsPerUser` (number): Average requests per user
- `avgRequestsPerDay` (number): Average requests per day

#### `users` array (sorted by totalRequests DESC)
- `phone` (string): User's phone number
- `name` (string): User's current name
- `email` (string): User's email
- `plan` (string): User's subscription plan
- `totalRequests` (number): User's total requests in period
- `totalDataBytes` (number): Total data transferred
- `uniqueEndpoints` (number): Unique endpoints accessed
- `firstActivity` (ISO date): First request timestamp
- `lastActivity` (ISO date): Last request timestamp
- `endpoints` (array): Detailed endpoint breakdown (see below)

#### `endpoints` array (per user, sorted by requestCount DESC)
- `endpoint` (string): API endpoint path
- `method` (string): HTTP method (GET, POST, etc.)
- `requestCount` (number): Times accessed
- `totalDataBytes` (number): Data transferred
- `avgResponseSize` (number): Average response size in bytes
- `firstAccess` (ISO date): First time accessed
- `lastAccess` (ISO date): Last time accessed
- `successRate` (number): Success rate percentage (200-299 status)
- `recentTimestamps` (array): Last 10 access timestamps (newest first)

---

## 3. New Users Tracking

**Endpoint**: `GET /api/usage/new-users`

**Description**: Track new users based on their first API usage. A user is "new" if they have NO logs before the selected period.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | `week` | Predefined period: `today`, `yesterday`, `week`, `month`, `3months` |
| `startDate` | string | No | - | Custom start date (YYYY-MM-DD) |
| `endDate` | string | No | - | Custom end date (YYYY-MM-DD) |

### Request Examples

**Today's new users:**
```bash
GET /api/usage/new-users?period=today
Authorization: Bearer YOUR_TOKEN
```

**Custom range (marketing campaign):**
```bash
GET /api/usage/new-users?startDate=2025-10-01&endDate=2025-10-15
Authorization: Bearer YOUR_TOKEN
```

### Response Schema
```json
{
  "success": true,
  "period": {
    "type": "week",
    "startDate": "2025-09-26T00:00:00.000Z",
    "endDate": "2025-10-03T23:59:59.999Z",
    "totalDays": 7
  },
  "summary": {
    "newUsersCount": 23,
    "totalActiveUsers": 234,
    "activeUsersBeforePeriod": 211,
    "growthRate": 10.9,
    "avgNewUsersPerDay": 3.29
  },
  "newUsers": [
    {
      "phone": "+919876543210",
      "name": "John Doe",
      "email": "john@example.com",
      "plan": "premium",
      "planActivatedAt": "2025-10-01T10:00:00.000Z",
      "registeredAt": "2025-10-01T09:00:00.000Z",
      "siteCount": 3,
      "supervisorCount": 5,
      "firstApiUsage": "2025-10-02T08:30:00.000Z",
      "firstEndpoint": "/api/dashboard",
      "firstMethod": "GET",
      "requestsInPeriod": 145,
      "totalRequests": 145
    }
  ],
  "dailyBreakdown": [
    {
      "date": "2025-10-02",
      "count": 8,
      "users": [
        {
          "phone": "+919876543210",
          "name": "John Doe",
          "plan": "premium"
        }
      ]
    }
  ]
}
```

### Response Fields

#### `period` object
- `type` (string): Period type
- `startDate` (ISO date): Start of period
- `endDate` (ISO date): End of period
- `totalDays` (number): Days in period

#### `summary` object
- `newUsersCount` (number): Count of new users
- `totalActiveUsers` (number): Total users ever made a request
- `activeUsersBeforePeriod` (number): Active users before this period
- `growthRate` (number): Growth rate percentage
- `avgNewUsersPerDay` (number): Average new users per day

#### `newUsers` array (sorted by firstApiUsage DESC)
- `phone` (string): User's phone number
- `name` (string): User's name (or phone if name not set)
- `email` (string): User's email
- `plan` (string): Subscription plan
- `planActivatedAt` (ISO date): When plan was activated
- `registeredAt` (ISO date): When user registered
- `siteCount` (number): Number of sites user has
- `supervisorCount` (number): Number of supervisors
- `firstApiUsage` (ISO date): First API call timestamp
- `firstEndpoint` (string): First endpoint accessed
- `firstMethod` (string): HTTP method of first request
- `requestsInPeriod` (number): Requests made in selected period
- `totalRequests` (number): Total requests ever made

#### `dailyBreakdown` array
- `date` (string): Date (YYYY-MM-DD)
- `count` (number): New users on this date
- `users` (array): List of users with phone, name, plan

---

## 4. User Activity Detail

**Endpoint**: `GET /api/usage/user-activity/:phone`

**Description**: Complete activity history for a specific user with endpoint breakdown.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `phone` | string | **Yes** | - | User's phone number (URL parameter) |
| `period` | string | No | `week` | Time period: `today`, `yesterday`, `week`, `month`, `3months` |

**Note**: Phone number must be URL encoded (e.g., `+919876543210` → `%2B919876543210`)

### Request Example
```bash
GET /api/usage/user-activity/%2B919876543210?period=week
Authorization: Bearer YOUR_TOKEN
```

### Response Schema
```json
{
  "success": true,
  "period": {
    "type": "week",
    "startDate": "2025-09-26T00:00:00.000Z",
    "endDate": "2025-10-03T12:34:56.789Z"
  },
  "user": {
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "plan": "premium",
    "registeredAt": "2025-01-15T10:00:00.000Z",
    "planActivatedAt": "2025-01-15T10:05:00.000Z"
  },
  "summary": {
    "totalRequests": 1250,
    "totalDataBytes": 4200000,
    "uniqueEndpoints": 15,
    "firstRequest": "2025-09-26T09:15:00.000Z",
    "lastRequest": "2025-10-03T11:45:00.000Z",
    "avgRequestsPerDay": 178.57
  },
  "endpointBreakdown": [
    {
      "endpoint": "/api/employees",
      "method": "GET",
      "requestCount": 456,
      "totalDataBytes": 2100000,
      "avgResponseSize": 4605.26,
      "lastAccessed": "2025-10-03T11:45:00.000Z",
      "successRate": 99.12
    }
  ],
  "dailyActivity": [
    {
      "date": "2025-09-26",
      "requests": 145,
      "dataBytes": 580000
    }
  ],
  "recentActivity": [
    {
      "endpoint": "/api/employees/update",
      "method": "PUT",
      "status": 200,
      "responseSize": 1234,
      "timestamp": "2025-10-03T11:45:00.000Z"
    }
  ]
}
```

### Response Fields

#### `period` object
- `type` (string): Period type
- `startDate` (ISO date): Start of period
- `endDate` (ISO date): End of period

#### `user` object
- `name` (string): User's name
- `phone` (string): User's phone number
- `email` (string): User's email
- `plan` (string): Subscription plan
- `registeredAt` (ISO date): Registration date
- `planActivatedAt` (ISO date): Plan activation date

#### `summary` object
- `totalRequests` (number): Total requests in period
- `totalDataBytes` (number): Total data transferred
- `uniqueEndpoints` (number): Unique endpoints accessed
- `firstRequest` (ISO date): First request in period
- `lastRequest` (ISO date): Last request in period
- `avgRequestsPerDay` (number): Average daily requests

#### `endpointBreakdown` array (sorted by requestCount DESC)
- `endpoint` (string): API endpoint
- `method` (string): HTTP method
- `requestCount` (number): Times accessed
- `totalDataBytes` (number): Data transferred
- `avgResponseSize` (number): Average response size
- `lastAccessed` (ISO date): Last access time
- `successRate` (number): Success rate percentage

#### `dailyActivity` array
- `date` (string): Date (YYYY-MM-DD)
- `requests` (number): Requests on this date
- `dataBytes` (number): Data transferred on this date

#### `recentActivity` array (last 50 requests, newest first)
- `endpoint` (string): API endpoint
- `method` (string): HTTP method
- `status` (number): HTTP status code
- `responseSize` (number): Response size in bytes
- `timestamp` (ISO date): Request timestamp

### Error Responses

**User not found:**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

## 5. System Performance

**Endpoint**: `GET /api/usage/system-performance`

**Description**: Overall backend health and performance metrics.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | `week` | Time period: `today`, `yesterday`, `week`, `month`, `3months` |

### Request Example
```bash
GET /api/usage/system-performance?period=today
Authorization: Bearer YOUR_TOKEN
```

### Response Schema
```json
{
  "success": true,
  "period": {
    "type": "today",
    "startDate": "2025-10-03T00:00:00.000Z",
    "endDate": "2025-10-03T12:34:56.789Z",
    "totalDays": 1
  },
  "performance": {
    "totalRequests": 2456,
    "avgRequestsPerDay": 2456,
    "totalDataTransferred": 8388608,
    "avgResponseSize": 3416,
    "activeUsers": 89,
    "activeEndpoints": 24,
    "statusDistribution": {
      "success": 2398,
      "clientError": 45,
      "serverError": 13,
      "successRate": 97.64,
      "errorRate": 2.36
    }
  },
  "hourlyLoad": [
    {
      "hour": 0,
      "requests": 45,
      "avgResponseSize": 3200.50
    }
  ],
  "slowestEndpoints": [
    {
      "endpoint": "/api/reports/pdf",
      "avgResponseSize": 524288,
      "maxResponseSize": 1048576,
      "requestCount": 23
    }
  ]
}
```

### Response Fields

#### `period` object
- `type` (string): Period type
- `startDate` (ISO date): Start of period
- `endDate` (ISO date): End of period
- `totalDays` (number): Days in period

#### `performance` object
- `totalRequests` (number): Total requests
- `avgRequestsPerDay` (number): Average daily requests
- `totalDataTransferred` (number): Total bytes transferred
- `avgResponseSize` (number): Average response size
- `activeUsers` (number): Unique active users
- `activeEndpoints` (number): Unique endpoints accessed
- `statusDistribution` (object): Status code breakdown

#### `statusDistribution` object
- `success` (number): 2xx status codes count
- `clientError` (number): 4xx status codes count
- `serverError` (number): 5xx status codes count
- `successRate` (number): Success percentage
- `errorRate` (number): Error percentage

#### `hourlyLoad` array
- `hour` (number): Hour of day (0-23)
- `requests` (number): Requests in hour
- `avgResponseSize` (number): Average response size

#### `slowestEndpoints` array (top 10)
- `endpoint` (string): API endpoint
- `avgResponseSize` (number): Average response size
- `maxResponseSize` (number): Maximum response size
- `requestCount` (number): Times accessed

---

## 6. My Stats (Legacy)

**Endpoint**: `GET /api/usage/my-stats`

**Description**: Get current user's own usage statistics.

**Authentication**: Requires any authenticated user (not Admin-only)

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `days` | number | No | 30 | Number of days to look back |

### Request Example
```bash
GET /api/usage/my-stats?days=30
Authorization: Bearer YOUR_TOKEN
```

### Response Schema
```json
{
  "success": true,
  "data": {
    "period": "Last 30 days",
    "usage": {
      "totalRequests": 1250,
      "totalDataBytes": 4200000,
      "uniqueEndpoints": 15,
      "avgResponseSize": 3360
    },
    "limits": {
      "withinLimits": true,
      "usage": {
        "totalRequests": 1250,
        "totalDataBytes": 4200000
      },
      "limits": {
        "requestsPerMonth": 10000,
        "dataPerMonth": 104857600
      },
      "percentageUsed": {
        "requests": 12.5,
        "data": 4.0
      }
    },
    "plan": "premium"
  }
}
```

### Response Fields

#### `data` object
- `period` (string): Time period description
- `usage` (object): Usage statistics
- `limits` (object): Plan limits and usage
- `plan` (string): User's subscription plan

---

## 7. Health Check

**Endpoint**: `GET /api/usage/health`

**Description**: Check logging database connection health.

### Parameters
None

### Request Example
```bash
GET /api/usage/health
Authorization: Bearer YOUR_TOKEN
```

### Response Schema
```json
{
  "success": true,
  "data": {
    "loggingDatabase": {
      "connected": true,
      "database": "SitehaazriLogs",
      "collection": "Sitehaazrilogs",
      "modelAvailable": true,
      "documentCount": 1543210
    }
  }
}
```

### Response Fields

#### `loggingDatabase` object
- `connected` (boolean): Database connection status
- `database` (string): Database name
- `collection` (string): Collection name
- `modelAvailable` (boolean): If model is configured
- `documentCount` (number): Total log documents

---

## 8. Cleanup Logs

**Endpoint**: `POST /api/usage/cleanup`

**Description**: Delete old usage logs to free up space.

### Parameters (Request Body)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `daysToKeep` | number | No | 90 | Number of days to keep (delete older) |

### Request Example
```bash
POST /api/usage/cleanup
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "daysToKeep": 90
}
```

### Response Schema
```json
{
  "success": true,
  "message": "Cleaned up 15423 old usage logs",
  "deletedCount": 15423,
  "cutoffDate": "2025-07-05T12:34:56.789Z"
}
```

### Response Fields
- `success` (boolean): Operation status
- `message` (string): Success message
- `deletedCount` (number): Number of logs deleted
- `cutoffDate` (ISO date): Cutoff date used

---

## 🚨 Common Error Responses

### Database Not Configured
```json
{
  "success": false,
  "message": "Usage tracking not available: Logging database not configured"
}
```
**Status Code**: 503

### Unauthorized
```json
{
  "error": "Access denied. No token provided."
}
```
**Status Code**: 401

### Forbidden
```json
{
  "error": "Access denied. Insufficient permissions."
}
```
**Status Code**: 403

### Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```
**Status Code**: 500

---

## 📊 Quick Reference Table

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/usage/dashboard` | GET | Admin | System overview |
| `/api/usage/user-endpoint-analytics` | GET | Admin | User-endpoint mapping with timing |
| `/api/usage/new-users` | GET | Admin | Track new users |
| `/api/usage/user-activity/:phone` | GET | Admin | Individual user details |
| `/api/usage/system-performance` | GET | Admin | System health metrics |
| `/api/usage/my-stats` | GET | User | Own usage stats |
| `/api/usage/health` | GET | Admin | Database health |
| `/api/usage/cleanup` | POST | Admin | Delete old logs |

---

## 💡 Common Use Cases

### 1. Daily Monitoring Dashboard
```bash
# Overview
GET /api/usage/dashboard?period=today

# System health
GET /api/usage/system-performance?period=today

# New users today
GET /api/usage/new-users?period=today
```

### 2. User Behavior Analysis
```bash
# See which endpoints users are hitting
GET /api/usage/user-endpoint-analytics?period=week

# Drill down to specific user
GET /api/usage/user-activity/%2B919876543210?period=week
```

### 3. Performance Optimization
```bash
# Find slowest endpoints
GET /api/usage/system-performance?period=month

# See which users hit them most
GET /api/usage/user-endpoint-analytics?period=month
```

### 4. Custom Date Range Analysis
```bash
# Marketing campaign (Oct 1-15)
GET /api/usage/new-users?startDate=2025-10-01&endDate=2025-10-15

# Specific week analysis
GET /api/usage/user-endpoint-analytics?startDate=2025-10-02&endDate=2025-10-08
```

---

## 🎯 Best Practices

1. **Use Custom Dates for Specific Analysis**: When analyzing campaigns or specific events, use `startDate` and `endDate` parameters.

2. **Monitor System Performance Daily**: Call `/system-performance?period=today` every morning to catch issues early.

3. **Track User Onboarding**: Use `/new-users` to understand user acquisition trends.

4. **Investigate Heavy Users**: Use `/user-endpoint-analytics` to identify power users and optimize their experience.

5. **Regular Cleanup**: Run `/cleanup` monthly to keep database size manageable.

6. **URL Encode Phone Numbers**: Always URL encode phone numbers when using them in URL paths.

---

## 📚 Related Documentation

- **USAGE_API_UPDATES.md** - Recent changes and updates
- **USAGE_SYSTEM_ARCHITECTURE.md** - System architecture and data flow
- **USAGE_SYSTEM_REDESIGN.md** - Why we redesigned the system

---

**Last Updated**: October 3, 2025  
**API Version**: 2.0

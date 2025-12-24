# Change Tracking & History API Guide

Base URL: `[Backend_URL]/api/change-tracking`

This guide covers endpoints for tracking, retrieving, and analyzing changes made to employee records (attendance, payments, etc.). It documents both the optimized tracking system and detailed viewing routes.

---

## 1. Get Employee Change History

**Endpoint:** `/employee/:employeeID`
**Method:** `GET`
**Query Params:**
- `siteID` (Required)
- `page` (Default: 1)
- `limit` (Default: 20)
- `sortBy` (Default: `timestamp`)
- `sortOrder` (`asc` or `desc`)
- `fromDate`, `toDate` (Date filters)
- `year`, `month` (Numeric filters)

### Response Structure

```json
{
  "success": true,
  "records": [
    {
      "_id": "651f...",
      "siteID": "651f...",
      "employeeID": "EMP042",
      "field": "attendance",
      "fieldDisplayName": "Attendance",
      "changeType": "modified", // "added", "modified", "removed"
      "changeDescription": "Attendance updated for 15/10/2023",
      "changedBy": "Admin User",
      "timestamp": "2023-10-15T10:30:00.000Z",
      "changeData": {
        "from": "A",
        "to": "P",
        "date": "2023-10-15"
      },
      "metadata": {
        "displayMessage": "Attendance marked as Present by Admin User",
        "isAttendanceChange": true
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalRecords": 98,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 2. Get Recent Changes (Dashboard)

**Endpoint:** `/recent-changes`
**Method:** `GET` (from `detailedChangeTracking.js`)
**Query Params:** `siteID`, `limit`, `page`, `search`, `dateRange` ('today', 'yesterday', '7days', 'thisMonth')

### Use Case
Fetched by the Admin Dashboard to show the "Activity Log" feed.

### Response Structure

To support the UI, changes are grouped by time period.

```json
{
  "success": true,
  "data": {
    "groupedByTime": {
      "today": [ { /* change object */ } ],
      "yesterday": [],
      "thisWeek": [],
      "older": []
    },
    "allChanges": [ /* flat list for other views */ ]
  }
}
```

---

## 3. Update Employee (with Tracking)

**Endpoint:** `/employee/:employeeID/update`
**Method:** `PUT`

General-purpose update endpoint that logs changes automatically.

**Request Body:**
```json
{
  "month": 10,
  "year": 2023,
  "siteID": "...",
  "updateData": {
    "rate": 600,
    "name": "New Name"
  },
  "remark": "Correction of rate"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee information updated",
  "data": {
    "updatedFields": ["rate", "name"],
    "optimizedTracking": {
      "changesTracked": 2, // Number of field changes logged
      "systemType": "optimized"
    }
  }
}
```

---

## 4. Mobile API Endpoints

Specialized endpoints for the mobile app to ensure simple, atomic updates with tracking.

### A. Mark Attendance (Mobile)
**Endpoint:** `/employee/mobapi/attendance/update`
**Method:** `PUT`

**Request Body:**
```json
{
  "employeeId": "EMP042",
  "siteID": "...",
  "attendance": "P", // "P", "A", "P4" (overtime), etc.
  "date": {
    "date": 12,
    "month": 10,
    "year": 2023
  }
}
```
> [!IMPORTANT]
> Mobile attendance updates are restricted to the **last 3 days** only.

### B. Add Payout (Mobile)
**Endpoint:** `/employee/mobapi/addpayout`
**Method:** `PUT`

**Request Body:**
```json
{
  "empid": "EMP042",
  "siteID": "...",
  "month": "10",
  "year": "2023",
  "updateData": {
    "value": 500,
    "date": "2023-10-12", // ISO date string
    "remark": "Advance payment"
  }
}
```

---

## 5. Batch Operations

### Patch Attendance (Bulk)
**Endpoint:** `/attendance/patch-update`
**Method:** `PUT`

Used for "Mark All Present" or bulk editing features.

**Request Body:**
```json
{
  "month": "2023-10",
  "siteID": "...",
  "updates": [
    { "employeeID": "EMP01", "day": 10, "newValue": "P" },
    { "employeeID": "EMP02", "day": 10, "newValue": "A" }
  ]
}
```

**Behavior:**
- Performs a highly optimized bulk write to MongoDB.
- Creates **ONE single aggregated log entry** for the entire batch to avoid cluttering the history.

---

## 6. Statistics

**Endpoint:** `/statistics`
**Method:** `GET`
**Query Params:** `siteID`, `fromDate`, `toDate`

Returns count of changes grouped by field type (e.g., "How many attendance changes vs payment changes happened this week?").

```json
{
  "statistics": [
    { "_id": "attendance", "count": 150 },
    { "_id": "payouts", "count": 5 }
  ]
}
```

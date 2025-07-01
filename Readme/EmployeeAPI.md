# 👥 Employee Management API Documentation

Complete documentation for all employee-related endpoints in the Finance Dashboard Backend API.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Employee Data Structure](#employee-data-structure)
3. [Employee Routes](#employee-routes)
   - [Create Employee](#1-create-employee)
   - [Delete Employee](#2-delete-employee)
   - [Import Employees](#3-import-employees)
   - [Get Employees with Pending Payouts](#4-get-employees-with-pending-payouts)
   - [Get All Employees](#5-get-all-employees)
   - [Get Available for Import](#6-get-available-for-import)
4. [Optimized Employee Routes](#optimized-employee-routes)
   - [Update Employee (Optimized)](#7-update-employee-optimized)
   - [Bulk Update (Optimized)](#8-bulk-update-optimized)
   - [Get Change History](#9-get-change-history)
5. [Error Handling](#error-handling)
6. [Frontend Integration Examples](#frontend-integration-examples)

---

## 🏗️ Overview

**Base URL:** `http://localhost:5000`

**Route Prefixes:**
- Standard Employee Routes: `/api/employee`
- Optimized Employee Routes: `/api/employee-optimized`

**Authentication:** All routes require JWT token in Authorization header.

**Content Type:** `application/json`

---

## 📊 Employee Data Structure

### Core Employee Schema

```javascript
{
  // BASIC INFORMATION
  "empid": "EMP001",              // Auto-generated (EMP001, EMP002, etc.)
  "name": "John Doe",             // Employee name
  "rate": 650,                    // Daily wage rate
  "month": 7,                     // Month (1-12)
  "year": 2025,                   // Year
  "siteID": "6833ff004bd307e45abbfb41", // Site reference
  
  // PAYMENT DATA
  "payouts": [                    // Money paid to employee
    {
      "value": 5000,
      "remark": "Salary payment",
      "date": "2025-07-15T10:30:00.000Z",
      "createdBy": "admin@company.com"
    }
  ],
  "additional_req_pays": [        // Additional money owed to employee
    {
      "value": 1500,
      "remark": "Overtime bonus",
      "date": "2025-07-20T10:30:00.000Z",
      "createdBy": "admin@company.com"
    }
  ],
  
  // ATTENDANCE DATA
  "attendance": ["P", "P8", "A", "P4", "P"], // P=Present, A=Absent, P8=Present+8hrs overtime
  
  // CALCULATED FIELDS
  "wage": 13000,                  // Total wage earned (calculated)
  "closing_balance": 8500,        // Amount owed to employee
  "carry_forwarded": {            // Balance from previous month
    "value": 0,
    "remark": "Initial setup",
    "date": "2025-07-01T00:00:00.000Z"
  },
  
  // METADATA
  "createdBy": "admin@company.com",
  "recalculationneeded": false,
  "attendanceHistory": {}
}
```

### Attendance Code System

| Code | Meaning | Example |
|------|---------|---------|
| `P` | Present (8 hours) | Normal working day |
| `P4` | Present + 4 hours overtime | Worked 12 hours total |
| `A` | Absent | Did not work |
| `A7` | Absent but 7 hours worked | Partial day work |

---

## 🔧 Employee Routes

### 1. Create Employee

**Endpoint:** `POST /api/employee/addemployee`

**Description:** Creates a new employee with auto-generated employee ID and initializes all required fields.

#### Request Details

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt-token>"
}
```

**Request Body:**
```json
{
  "name": "John Doe",
  "siteID": "6833ff004bd307e45abbfb41",
  "wage": 650,
  "month": 7,
  "year": 2025
}
```

#### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ Yes | Employee full name |
| `siteID` | string | ✅ Yes | Site ObjectId where employee works |
| `wage` | number | ✅ Yes | Daily wage rate (must be > 0) |
| `month` | number | ❌ No | Month (1-12), defaults to current month |
| `year` | number | ❌ No | Year, defaults to current year |

#### Response Examples

**✅ Successful Creation:**
```json
{
  "success": true,
  "data": {
    "employee": {
      "_id": "66a1b2c3d4e5f6789012345",
      "empid": "EMP003",
      "name": "John Doe",
      "rate": 650,
      "month": 7,
      "year": 2025,
      "siteID": "6833ff004bd307e45abbfb41",
      "payouts": [],
      "wage": 0,
      "additional_req_pays": [],
      "attendance": [],
      "closing_balance": 0,
      "carry_forwarded": {
        "value": 0,
        "remark": "Initial setup - new employee",
        "date": "2025-07-01T10:30:00.000Z"
      },
      "createdBy": "admin@company.com",
      "attendanceHistory": {},
      "recalculationneeded": false
    },
    "changeTracking": {
      "optimized": true,
      "changeLogEntries": 15,
      "changesRecorded": 15
    },
    "metadata": {
      "month": 7,
      "year": 2025,
      "rate": 650,
      "siteID": "6833ff004bd307e45abbfb41",
      "createdBy": "admin@company.com"
    }
  },
  "message": "Employee John Doe (EMP003) created successfully for 7/2025 by admin@company.com"
}
```

**❌ Error Responses:**

```json
// 400 Bad Request - Missing name
{
  "success": false,
  "error": "Employee name is required and cannot be empty."
}

// 400 Bad Request - Invalid wage
{
  "success": false,
  "error": "Wage must be provided and must be greater than 0."
}

// 409 Conflict - Employee exists
{
  "success": false,
  "error": "Employee EMP003 already exists for 7/2025."
}
```

#### How It Works

1. **Auto-ID Generation:** System finds the highest existing EMP number and assigns next sequential ID
2. **Validation:** Validates all required fields and business rules
3. **Default Values:** Sets current month/year if not provided, initializes empty arrays
4. **Change Tracking:** Records employee creation with full audit trail
5. **Response:** Returns complete employee object with metadata

#### Frontend Implementation

```javascript
const createEmployee = async (employeeData) => {
  try {
    const response = await fetch('http://localhost:5000/api/employee/addemployee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        name: employeeData.name,
        siteID: employeeData.siteID,
        wage: employeeData.dailyRate,
        month: employeeData.month || new Date().getMonth() + 1,
        year: employeeData.year || new Date().getFullYear()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Employee created:', result.data.employee.empid);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to create employee:', error);
    throw error;
  }
};

// Usage example
createEmployee({
  name: "John Doe",
  siteID: "6833ff004bd307e45abbfb41",
  dailyRate: 650
}).then(data => {
  console.log('New employee created:', data.employee.empid);
}).catch(error => {
  alert('Error creating employee: ' + error.message);
});
```

---

### 2. Delete Employee

**Endpoint:** `DELETE /api/employee/deleteemployee`

**Description:** Deletes employee record(s) with option to delete all historical data or just current month.

#### Request Details

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt-token>"
}
```

**Request Body:**
```json
{
  "empid": "EMP003",
  "name": "John Doe",
  "month": 7,
  "year": 2025,
  "deletePreviousMonth": false
}
```

#### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `empid` | string | ✅ Yes | Employee ID to delete |
| `name` | string | ✅ Yes | Employee name (for confirmation) |
| `month` | number | ✅ Yes | Target month (1-12) |
| `year` | number | ✅ Yes | Target year |
| `deletePreviousMonth` | boolean | ❌ No | If true, deletes ALL employee records across all months |

#### Response Examples

**✅ Successful Deletion (Current Month Only):**
```json
{
  "success": true,
  "data": {
    "deletedEmployees": [
      {
        "empid": "EMP003",
        "name": "John Doe",
        "month": 7,
        "year": 2025,
        "siteID": "6833ff004bd307e45abbfb41"
      }
    ],
    "changeTracking": [
      {
        "month": 7,
        "year": 2025,
        "optimized": true,
        "changeLogEntries": 15,
        "siteID": "6833ff004bd307e45abbfb41"
      }
    ],
    "deletionMetadata": {
      "empid": "EMP003",
      "name": "John Doe",
      "targetMonth": 7,
      "targetYear": 2025,
      "deletePreviousMonth": false,
      "deletedBy": "admin@company.com",
      "deletionDate": "2025-07-01T10:30:00.000Z",
      "totalRecordsDeleted": 1
    }
  },
  "message": "Employee John Doe (EMP003) deleted for 7/2025. 1 record deleted."
}
```

**✅ Successful Deletion (All Historical Data):**
```json
{
  "success": true,
  "data": {
    "deletedEmployees": [
      {
        "empid": "EMP003",
        "name": "John Doe",
        "month": 6,
        "year": 2025,
        "siteID": "6833ff004bd307e45abbfb41"
      },
      {
        "empid": "EMP003",
        "name": "John Doe", 
        "month": 7,
        "year": 2025,
        "siteID": "6833ff004bd307e45abbfb41"
      }
    ],
    "changeTracking": [
      {
        "month": 6,
        "year": 2025,
        "optimized": true,
        "changeLogEntries": 15,
        "siteID": "6833ff004bd307e45abbfb41"
      },
      {
        "month": 7,
        "year": 2025,
        "optimized": true,
        "changeLogEntries": 15,
        "siteID": "6833ff004bd307e45abbfb41"
      }
    ],
    "deletionMetadata": {
      "empid": "EMP003",
      "name": "John Doe",
      "targetMonth": 7,
      "targetYear": 2025,
      "deletePreviousMonth": true,
      "deletedBy": "admin@company.com",
      "deletionDate": "2025-07-01T10:30:00.000Z",
      "totalRecordsDeleted": 2
    }
  },
  "message": "Employee John Doe (EMP003) completely deleted from the system including all historical data. 2 records deleted."
}
```

#### Frontend Implementation

```javascript
const deleteEmployee = async (deleteData) => {
  try {
    const response = await fetch('http://localhost:5000/api/employee/deleteemployee', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(deleteData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Employee deleted:', result.message);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to delete employee:', error);
    throw error;
  }
};

// Usage examples
// Delete only current month data
deleteEmployee({
  empid: "EMP003",
  name: "John Doe",
  month: 7,
  year: 2025,
  deletePreviousMonth: false
});

// Delete all historical data
deleteEmployee({
  empid: "EMP003", 
  name: "John Doe",
  month: 7,
  year: 2025,
  deletePreviousMonth: true
});
```

---

### 3. Import Employees

**Endpoint:** `POST /api/employee/importemployees`

**Description:** Imports employees from a previous month to current month, with options to preserve balances and additional payments.

#### Request Details

**Request Body:**
```json
{
  "sourceMonth": 6,
  "sourceYear": 2025,
  "targetMonth": 7,
  "targetYear": 2025,
  "siteID": "6833ff004bd307e45abbfb41",
  "employeeIDs": ["EMP001", "EMP002", "EMP003"],
  "preserveCarryForward": true,
  "preserveAdditionalPays": false
}
```

#### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceMonth` | number | ✅ Yes | Source month (1-12) |
| `sourceYear` | number | ✅ Yes | Source year |
| `targetMonth` | number | ✅ Yes | Target month (1-12) |
| `targetYear` | number | ✅ Yes | Target year |
| `siteID` | string | ✅ Yes | Site ID |
| `employeeIDs` | array | ✅ Yes | Array of employee IDs to import |
| `preserveCarryForward` | boolean | ❌ No | Carry forward closing balance (default: false) |
| `preserveAdditionalPays` | boolean | ❌ No | Copy additional_req_pays (default: false) |

#### Response Example

```json
{
  "success": true,
  "data": {
    "importResults": [
      {
        "empid": "EMP001",
        "name": "Rajesh Kumar",
        "sourceMonth": 6,
        "sourceYear": 2025,
        "targetMonth": 7,
        "targetYear": 2025,
        "carryForwardAmount": 5500,
        "rate": 576,
        "success": true
      },
      {
        "empid": "EMP002",
        "name": "Priya Sharma", 
        "sourceMonth": 6,
        "sourceYear": 2025,
        "targetMonth": 7,
        "targetYear": 2025,
        "carryForwardAmount": 0,
        "rate": 861,
        "success": true
      }
    ],
    "changeTrackingResults": [
      {
        "empid": "EMP001",
        "optimized": true,
        "changeLogEntries": 15,
        "success": true
      },
      {
        "empid": "EMP002",
        "optimized": true,
        "changeLogEntries": 15,
        "success": true
      }
    ],
    "summary": {
      "totalRequested": 2,
      "successfulImports": 2,
      "failedImports": 0,
      "totalCarryForward": 5500,
      "preserveCarryForward": true,
      "preserveAdditionalPays": false
    }
  },
  "message": "Successfully imported 2 employees from 6/2025 to 7/2025"
}
```

#### Frontend Implementation

```javascript
const importEmployees = async (importData) => {
  try {
    const response = await fetch('http://localhost:5000/api/employee/importemployees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(importData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Import completed:', result.data.summary);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
};

// Usage example
importEmployees({
  sourceMonth: 6,
  sourceYear: 2025,
  targetMonth: 7,
  targetYear: 2025,
  siteID: "6833ff004bd307e45abbfb41",
  employeeIDs: ["EMP001", "EMP002", "EMP003"],
  preserveCarryForward: true,
  preserveAdditionalPays: false
}).then(data => {
  console.log(`Imported ${data.summary.successfulImports} employees`);
});
```

---

### 4. Get Employees with Pending Payouts

**Endpoint:** `GET /api/employee/employeewithpendingpayouts`

**Description:** Retrieves employees who have pending payouts (closing_balance > 0) for a specific month.

#### Request Details

**Query Parameters:**
```
GET /api/employee/employeewithpendingpayouts?month=7&year=2025&siteID=6833ff004bd307e45abbfb41
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | number | ✅ Yes | Month (1-12) |
| `year` | number | ✅ Yes | Year |
| `siteID` | string | ✅ Yes | Site ID |

#### Response Example

```json
{
  "success": true,
  "data": [
    {
      "empid": "EMP001",
      "name": "Rajesh Kumar",
      "rate": 576,
      "month": 7,
      "year": 2025,
      "totalWage": 14500,
      "totalPayouts": 6000,
      "carryForward": 0,
      "closing_balance": 8500,
      "totalAttendance": 22,
      "totalDays": 31,
      "totalovertime": 25,
      "overtimeDays": 5,
      "totalAdditionalReqPays": 2000,
      "hasPendingPayouts": true,
      "needsRecalculation": false,
      "attendance": ["P", "P8", "A", "P4", "P"],
      "payouts": [
        {
          "value": 6000,
          "remark": "Partial payment",
          "date": "2025-07-15T10:30:00.000Z",
          "createdBy": "admin@company.com"
        }
      ],
      "additional_req_pays": [
        {
          "value": 2000,
          "remark": "Overtime bonus",
          "date": "2025-07-20T10:30:00.000Z",
          "createdBy": "admin@company.com"
        }
      ]
    }
  ],
  "message": "Found 1 employees with pending payouts for 7/2025",
  "totalProcessed": 15,
  "withPendingPayouts": 1
}
```

#### Frontend Implementation

```javascript
const getEmployeesWithPendingPayouts = async (month, year, siteID) => {
  try {
    const params = new URLSearchParams({
      month: month.toString(),
      year: year.toString(),
      siteID: siteID
    });
    
    const response = await fetch(
      `http://localhost:5000/api/employee/employeewithpendingpayouts?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to fetch employees with pending payouts:', error);
    throw error;
  }
};

// Usage example
getEmployeesWithPendingPayouts(7, 2025, "6833ff004bd307e45abbfb41")
  .then(employees => {
    console.log(`Found ${employees.length} employees with pending payouts`);
    employees.forEach(emp => {
      console.log(`${emp.name} (${emp.empid}): ₹${emp.closing_balance} pending`);
    });
  });
```

---

### 5. Get All Employees

**Endpoint:** `GET /api/employee/allemployees`

**Description:** Retrieves all employees for a month, including those with zero balance (for administrative purposes).

#### Request Details

**Query Parameters:**
```
GET /api/employee/allemployees?month=7&year=2025&siteID=6833ff004bd307e45abbfb41
```

#### Response Example

```json
{
  "success": true,
  "data": [
    {
      "empid": "EMP001",
      "name": "Rajesh Kumar",
      "rate": 576,
      "totalWage": 14500,
      "totalPayouts": 14500,
      "carryForward": 0,
      "closing_balance": 0,
      "totalAttendance": 22,
      "totalDays": 31,
      "totalovertime": 25,
      "overtimeDays": 5,
      "totalAdditionalReqPays": 2000,
      "hasPendingPayouts": false,
      "needsRecalculation": false
    },
    {
      "empid": "EMP002",
      "name": "Priya Sharma",
      "rate": 861,
      "totalWage": 18000,
      "totalPayouts": 12000,
      "carryForward": 0,
      "closing_balance": 6000,
      "hasPendingPayouts": true
    }
  ],
  "summary": {
    "total": 15,
    "withPendingPayouts": 3,
    "withZeroBalance": 12,
    "withErrors": 0
  },
  "message": "Found 15 employees for 7/2025"
}
```

---

### 6. Get Available for Import

**Endpoint:** `GET /api/employee/availableforimport`

**Description:** Gets list of employees available for import from a source month to target month.

#### Request Details

**Query Parameters:**
```
GET /api/employee/availableforimport?sourceMonth=6&sourceYear=2025&targetMonth=7&targetYear=2025&siteID=6833ff004bd307e45abbfb41
```

#### Response Example

```json
{
  "success": true,
  "data": [
    {
      "empid": "EMP001",
      "name": "Rajesh Kumar",
      "rate": 576,
      "closing_balance": 5500,
      "createdBy": "admin@company.com",
      "availableForImport": true,
      "alreadyExistsInTarget": false
    },
    {
      "empid": "EMP002", 
      "name": "Priya Sharma",
      "rate": 861,
      "closing_balance": 0,
      "createdBy": "admin@company.com",
      "availableForImport": false,
      "alreadyExistsInTarget": true
    }
  ],
  "summary": {
    "totalEmployees": 15,
    "availableForImport": 12,
    "alreadyExistInTarget": 3,
    "sourceMonth": 6,
    "sourceYear": 2025,
    "targetMonth": 7,
    "targetYear": 2025,
    "siteID": "6833ff004bd307e45abbfb41"
  },
  "message": "Found 15 employees from 6/2025. 12 available for import to 7/2025"
}
```

---

## 🚀 Optimized Employee Routes

### 7. Update Employee (Optimized)

**Endpoint:** `PUT /api/employee-optimized/update-optimized`

**Description:** Updates employee data with optimized change tracking system for better performance.

#### Request Details

**Request Body:**
```json
{
  "empid": "EMP001",
  "month": 7,
  "year": 2025,
  "siteID": "6833ff004bd307e45abbfb41",
  "remark": "Monthly attendance update",
  "updateData": {
    "attendance": ["P", "P8", "A", "P4", "P"],
    "payouts": [
      {
        "value": 5000,
        "remark": "Salary payment",
        "date": "2025-07-15",
        "createdBy": "admin@company.com"
      }
    ],
    "additional_req_pays": [
      {
        "value": 1000,
        "remark": "Bonus",
        "date": "2025-07-20"
      }
    ]
  }
}
```

#### Response Example

```json
{
  "success": true,
  "message": "Employee EMP001 updated successfully with 3 changes tracked",
  "data": {
    "employee": {
      "empid": "EMP001",
      "name": "Rajesh Kumar",
      "attendance": ["P", "P8", "A", "P4", "P"],
      "closing_balance": 6000,
      "totalWage": 15500
    },
    "changeTracking": {
      "entriesCreated": 3,
      "trackingEnabled": true,
      "systemType": "optimized"
    },
    "metadata": {
      "updatedBy": "admin@company.com",
      "updateTime": "2025-07-01T10:30:00.000Z",
      "fieldsUpdated": ["attendance", "payouts", "additional_req_pays"],
      "remark": "Monthly attendance update"
    }
  }
}
```

#### Frontend Implementation

```javascript
const updateEmployeeOptimized = async (updateData) => {
  try {
    const response = await fetch('http://localhost:5000/api/employee-optimized/update-optimized', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Employee updated:', result.data.changeTracking);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Update failed:', error);
    throw error;
  }
};

// Usage example
updateEmployeeOptimized({
  empid: "EMP001",
  month: 7,
  year: 2025,
  siteID: "6833ff004bd307e45abbfb41",
  remark: "Attendance and payment update",
  updateData: {
    attendance: ["P", "P8", "A", "P4", "P"],
    payouts: [
      {
        value: 5000,
        remark: "Salary payment",
        date: "2025-07-15"
      }
    ]
  }
});
```

---

### 8. Bulk Update (Optimized)

**Endpoint:** `PUT /api/employee-optimized/bulk-update-optimized`

**Description:** Updates multiple employees in a single request with optimized change tracking.

#### Request Body

```json
{
  "updates": [
    {
      "empid": "EMP001",
      "month": 7,
      "year": 2025,
      "siteID": "6833ff004bd307e45abbfb41",
      "remark": "Bulk attendance update",
      "updateData": {
        "attendance": ["P", "P8", "A", "P4", "P"]
      }
    },
    {
      "empid": "EMP002",
      "month": 7,
      "year": 2025,
      "siteID": "6833ff004bd307e45abbfb41", 
      "remark": "Payment update",
      "updateData": {
        "payouts": [
          {
            "value": 8000,
            "remark": "Monthly salary",
            "date": "2025-07-15"
          }
        ]
      }
    }
  ]
}
```

#### Response Example

```json
{
  "success": true,
  "message": "Bulk update completed: 2 successful, 0 failed",
  "data": {
    "results": [
      {
        "empid": "EMP001",
        "success": true,
        "changesTracked": 1,
        "message": "Employee EMP001 updated successfully"
      },
      {
        "empid": "EMP002", 
        "success": true,
        "changesTracked": 1,
        "message": "Employee EMP002 updated successfully"
      }
    ],
    "summary": {
      "totalProcessed": 2,
      "successful": 2,
      "failed": 0,
      "totalChangesTracked": 2
    },
    "metadata": {
      "updatedBy": "admin@company.com",
      "updateTime": "2025-07-01T10:30:00.000Z",
      "systemType": "optimized"
    }
  }
}
```

---

### 9. Get Change History

**Endpoint:** `GET /api/employee-optimized/change-history/:empid`

**Description:** Retrieves detailed change history for an employee using optimized tracking.

#### Request Details

**URL Parameters:**
- `empid`: Employee ID (required)

**Query Parameters:**
```
GET /api/employee-optimized/change-history/EMP001?siteID=6833ff004bd307e45abbfb41&month=7&year=2025&field=attendance&limit=50&page=1
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `siteID` | string | ❌ No | Filter by site ID |
| `month` | number | ❌ No | Filter by month |
| `year` | number | ❌ No | Filter by year |
| `field` | string | ❌ No | Filter by field (attendance, payouts, additional_req_pays) |
| `limit` | number | ❌ No | Results per page (default: 50) |
| `page` | number | ❌ No | Page number (default: 1) |

#### Response Example

```json
{
  "success": true,
  "empid": "EMP001",
  "siteID": "6833ff004bd307e45abbfb41",
  "fields": {
    "attendance": {
      "success": true,
      "records": [
        {
          "field": "attendance",
          "changeType": "updated",
          "description": "Attendance updated for July 2025",
          "displayMessage": "Attendance changed from 20 days to 22 days",
          "changedBy": "admin@company.com",
          "timestamp": "2025-07-01T10:30:00.000Z",
          "remark": "Monthly attendance update"
        }
      ]
    },
    "payouts": {
      "success": true,
      "records": [
        {
          "field": "payouts",
          "changeType": "created",
          "description": "New payout added: ₹5000 - Salary payment",
          "changedBy": "admin@company.com",
          "timestamp": "2025-07-01T10:30:00.000Z"
        }
      ]
    },
    "additional_req_pays": {
      "success": true,
      "records": []
    }
  },
  "summary": {
    "totalRecords": 2,
    "fieldsWithChanges": 2
  }
}
```

#### Frontend Implementation

```javascript
const getEmployeeChangeHistory = async (empid, filters = {}) => {
  try {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `http://localhost:5000/api/employee-optimized/change-history/${empid}?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to fetch change history:', error);
    throw error;
  }
};

// Usage example
getEmployeeChangeHistory("EMP001", {
  siteID: "6833ff004bd307e45abbfb41",
  month: 7,
  year: 2025,
  limit: 20
}).then(history => {
  console.log(`Found ${history.summary.totalRecords} changes`);
  
  // Process attendance changes
  if (history.fields.attendance.records.length > 0) {
    console.log('Attendance changes:', history.fields.attendance.records);
  }
  
  // Process payment changes
  if (history.fields.payouts.records.length > 0) {
    console.log('Payment changes:', history.fields.payouts.records);
  }
});
```

---

## ⚠️ Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message",
  "details": {
    "field": "value",
    "context": "additional info"
  }
}
```

### Common HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Employee created successfully |
| `400` | Bad Request | Invalid input data |
| `401` | Unauthorized | Authentication required or failed |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Employee/resource not found |
| `409` | Conflict | Employee already exists |
| `500` | Internal Server Error | Server or database errors |

### Error Examples

```javascript
// Handle API errors properly
const handleEmployeeOperation = async (operation) => {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    if (error.status === 401) {
      // Redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.status === 409) {
      // Employee already exists
      alert('Employee already exists for this month');
    } else if (error.status === 404) {
      // Employee not found
      alert('Employee not found');
    } else {
      // Generic error
      console.error('Operation failed:', error.message);
      alert('Operation failed: ' + error.message);
    }
  }
};
```

---

## 🔧 Frontend Integration Examples

### Complete Employee Management Component

```javascript
class EmployeeManager {
  constructor(token, baseURL = 'http://localhost:5000') {
    this.token = token;
    this.baseURL = baseURL;
  }

  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  }

  // Create new employee
  async createEmployee(employeeData) {
    return this.apiRequest('/api/employee/addemployee', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
  }

  // Update employee (optimized)
  async updateEmployee(updateData) {
    return this.apiRequest('/api/employee-optimized/update-optimized', {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  // Delete employee
  async deleteEmployee(deleteData) {
    return this.apiRequest('/api/employee/deleteemployee', {
      method: 'DELETE',
      body: JSON.stringify(deleteData)
    });
  }

  // Get employees with pending payouts
  async getEmployeesWithPendingPayouts(month, year, siteID) {
    const params = new URLSearchParams({ month, year, siteID });
    return this.apiRequest(`/api/employee/employeewithpendingpayouts?${params}`);
  }

  // Get all employees
  async getAllEmployees(month, year, siteID) {
    const params = new URLSearchParams({ month, year, siteID });
    return this.apiRequest(`/api/employee/allemployees?${params}`);
  }

  // Import employees
  async importEmployees(importData) {
    return this.apiRequest('/api/employee/importemployees', {
      method: 'POST',
      body: JSON.stringify(importData)
    });
  }

  // Get change history
  async getChangeHistory(empid, filters = {}) {
    const params = new URLSearchParams(filters);
    return this.apiRequest(`/api/employee-optimized/change-history/${empid}?${params}`);
  }

  // Bulk update employees
  async bulkUpdateEmployees(updates) {
    return this.apiRequest('/api/employee-optimized/bulk-update-optimized', {
      method: 'PUT',
      body: JSON.stringify({ updates })
    });
  }
}

// Usage example
const employeeManager = new EmployeeManager(localStorage.getItem('token'));

// Create employee
const newEmployee = await employeeManager.createEmployee({
  name: "John Doe",
  siteID: "6833ff004bd307e45abbfb41",
  wage: 650,
  month: 7,
  year: 2025
});

// Update employee attendance
await employeeManager.updateEmployee({
  empid: "EMP001",
  month: 7,
  year: 2025,
  siteID: "6833ff004bd307e45abbfb41",
  updateData: {
    attendance: ["P", "P8", "A", "P4", "P"]
  }
});

// Get employees with pending payouts
const pendingEmployees = await employeeManager.getEmployeesWithPendingPayouts(7, 2025, "6833ff004bd307e45abbfb41");
```

---

## 🎯 Best Practices

### 1. Authentication
Always include JWT token in Authorization header for all requests.

### 2. Error Handling
Implement proper error handling for all API calls with appropriate user feedback.

### 3. Data Validation
Validate data on frontend before sending to API to provide immediate feedback.

### 4. Performance
Use optimized routes (`/api/employee-optimized`) for better performance with change tracking.

### 5. Bulk Operations
Use bulk update endpoints when updating multiple employees to reduce API calls.

### 6. Change Tracking
Leverage change history endpoints to provide audit trails and transparency.

---

## 📞 Support

For questions or issues with employee routes:
1. Check error responses for specific details
2. Verify JWT token validity and permissions
3. Ensure request body format matches documentation
4. Check network connectivity and server status

---

*Last updated: July 1, 2025*
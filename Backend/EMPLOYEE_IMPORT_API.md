# Employee Import Endpoints Documentation

This document describes the new endpoints added to import employees from previous months while preserving their employee IDs.

## Endpoints

### 1. Import Employees from Previous Month

**POST** `/api/employee/importemployees`

Imports employees from a previous month to a new month while preserving their employee IDs. This prevents the creation of new employee IDs when transitioning to a new month.

#### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body
```json
{
  "sourceMonth": 11,           // Required: Source month (1-12)
  "sourceYear": 2024,          // Required: Source year
  "targetMonth": 12,           // Required: Target month (1-12)
  "targetYear": 2024,          // Required: Target year
  "siteID": "site_object_id",  // Required: Site ID (MongoDB ObjectId)
  "employeeIds": [             // Optional: Specific employee IDs to import
    "EMP001",                  // If empty or not provided, imports all employees
    "EMP002"
  ],
  "preserveCarryForward": true,    // Optional: Whether to carry forward balance (default: true)
  "preserveAdditionalPays": false  // Optional: Whether to carry forward additional payments (default: false)
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "importResults": [
      {
        "empid": "EMP001",
        "name": "John Doe",
        "sourceMonth": 11,
        "sourceYear": 2024,
        "targetMonth": 12,
        "targetYear": 2024,
        "carryForwardAmount": 5000,
        "rate": 500,
        "success": true
      }
    ],
    "changeTracking": [
      {
        "empid": "EMP001",
        "serialNumber": "CT001234",
        "success": true
      }
    ],
    "summary": {
      "totalEmployeesProcessed": 2,
      "successfulImports": 2,
      "failedImports": 0,
      "totalCarryForwardAmount": 8500,
      "sourceMonth": 11,
      "sourceYear": 2024,
      "targetMonth": 12,
      "targetYear": 2024,
      "siteID": "site_object_id",
      "importedBy": "user@example.com",
      "importDate": "2024-12-01T10:30:00.000Z",
      "preserveCarryForward": true,
      "preserveAdditionalPays": false
    }
  },
  "message": "Successfully imported 2 employees from 11/2024 to 12/2024"
}
```

#### Error Responses

**400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "error": "Source month/year and target month/year are required."
}
```

**409 Conflict** - Employees already exist in target month
```json
{
  "success": false,
  "error": "Some employees already exist in 12/2024",
  "details": {
    "existingEmployeeIds": ["EMP001", "EMP002"],
    "message": "Please remove existing employees first or choose different employee IDs to import."
  }
}
```

**404 Not Found** - No employees found in source month
```json
{
  "success": false,
  "error": "No employees found for 11/2024 at site site_object_id."
}
```

### 2. Get Available Employees for Import

**GET** `/api/employee/availableforimport`

Gets a list of employees available for import from a specific month/year, showing which ones can be imported and which already exist in the target month.

#### Headers
```
Authorization: Bearer <JWT_TOKEN>
```

#### Query Parameters
```
sourceMonth=11           // Required: Source month (1-12)
sourceYear=2024          // Required: Source year
targetMonth=12           // Optional: Target month for availability check
targetYear=2024          // Optional: Target year for availability check
siteID=site_object_id    // Required: Site ID
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "empid": "EMP001",
      "name": "John Doe",
      "rate": 500,
      "closing_balance": 5000,
      "createdBy": "admin@example.com",
      "availableForImport": true,
      "alreadyExistsInTarget": false
    },
    {
      "empid": "EMP002",
      "name": "Jane Smith",
      "rate": 600,
      "closing_balance": 3500,
      "createdBy": "admin@example.com",
      "availableForImport": false,
      "alreadyExistsInTarget": true
    }
  ],
  "summary": {
    "totalEmployees": 2,
    "availableForImport": 1,
    "alreadyExistInTarget": 1,
    "sourceMonth": 11,
    "sourceYear": 2024,
    "targetMonth": 12,
    "targetYear": 2024,
    "siteID": "site_object_id"
  },
  "message": "Found 2 employees from 11/2024. 1 available for import to 12/2024"
}
```

## Features

### Key Benefits

1. **Preserve Employee IDs**: Employees keep their original IDs when moved to new months
2. **Carry Forward Balances**: Option to carry forward outstanding balances from previous month
3. **Selective Import**: Import specific employees or all employees from a month
4. **Conflict Prevention**: Prevents importing employees that already exist in target month
5. **Change Tracking**: All imports are tracked for audit purposes
6. **Flexible Options**: Control whether to preserve additional payments and carry forwards

### Import Process

1. **Validation**: Validates all input parameters and date ranges
2. **Conflict Check**: Ensures no employees already exist in target month
3. **Data Preparation**: Prepares new employee records with:
   - Same employee ID (empid)
   - Same name and rate
   - New month/year
   - Optional carry forward balance
   - Fresh attendance and payouts arrays
   - Preserved additional payments (if selected)
4. **Change Tracking**: Records all import operations for audit trail
5. **Response**: Returns detailed results including success/failure status

### Use Cases

1. **Monthly Transition**: Import all employees when starting a new month
2. **Selective Migration**: Import specific employees who continue working
3. **Balance Carry Forward**: Ensure outstanding payments carry to new month
4. **Site Management**: Import employees for specific sites only

## Error Handling

The endpoints include comprehensive error handling for:
- Invalid date ranges
- Missing required fields
- Conflicting employee records
- Database connection issues
- Change tracking failures

All errors include detailed messages and relevant context for debugging.

## Authentication

Both endpoints require valid JWT authentication token in the Authorization header. The token provides the user context for audit trails and change tracking.

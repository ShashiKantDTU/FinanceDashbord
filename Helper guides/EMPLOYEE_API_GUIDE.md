# Employee Details API Guide

Base URL: `[Backend_URL]/api/employee`

This guide details the **Employee Details** endpoints, focusing on the data structure and meaning of the response fields.

---

## 1. Get All Employees (Optimized)

**Endpoint:** `/allemployees-optimized`
**Method:** `GET`
**Query Params:** `month`, `year`, `siteID`

### Responses Breakdown

The API returns a `data` array containing employee objects. Here is the detailed explanation of the key fields in each employee object.

#### Response Structure

```json
{
  "success": true,
  "data": [
    {
      "_id": "651f...",
      "empid": "EMP042",
      "name": "Rajesh Kumar",
      "rate": 500,
      
      // --- CORE ARRAYS (RAW DATA) ---
      "attendance": ["P", "P", "A", "P4", "P", ...], // Array of 31 strings (Days 1-31)
      "payouts": [
        {
          "value": 2000,
          "date": "2023-10-05T00:00:00.000Z",
          "remark": "Advance Cash",
          "createdBy": "admin@example.com"
        }
      ],
      "additional_req_pays": [
        {
          "value": 1000,
          "date": "2023-10-25T00:00:00.000Z",
          "remark": "Diwali Bonus",
          "createdBy": "admin@example.com"
        }
      ],
      "carry_forwarded": {
        "value": 2000,
        "remark": "Balance from Sept",
        "date": "2023-10-01..."
      },

      // --- CALCULATED FINANCIALS ---
      "totalWage": 13500,          // Calculated: (Total Days + Overtime Days) * Daily Rate
      "totalPayouts": 5000,        // Sum of all 'payouts' array entries
      "totalAdditionalReqPays": 1000, // Sum of 'additional_req_pays' (Bonuses/Allowances)
      "carryForward": 2000,        // Extracted from carry_forwarded.value
      
      "closing_balance": 11500,    // Net Payable: (TotalWage + Additional + CarryForward) - Payouts
      
      // --- ATTENDANCE METRICS ---
      "totalAttendance": 27,       // Total payable units (Days + Overtime Units)
      "totalDays": 25,             // Physical days present (Count of 'P' or similar in attendance)
      "totalovertime": 16,         // Total overtime HOURS
      "overtimeDays": 2,           // Converted overtime UNITS (e.g., 16 hours / 8 = 2 days)
      
      // --- STATUS FLAGS ---
      "hasPendingPayouts": true,   // true if closing_balance != 0
      "recalculationneeded": false // true if data might be stale (trigger re-fetch if true)
    }
  ],
  "summary": {
    "total": 1,
    "withPendingPayouts": 1,
    "withZeroBalance": 0
  }
}
```

### Field Definitions & Business Logic

| Field | Type | Description & Formula |
| :--- | :--- | :--- |
| **`rate`** | Number | The daily wage set for the employee. |
| **`attendance`**| Array[String]| **Daily Logs**. A 31-item array representing attendance for each day of the month. Index 0 = Day 1. Values: "P" (Present), "A" (Absent), "P4" (Present + 4hrs OT), etc. |
| **`payouts`** | Array[Obj] | **Advances**. List of payments given to the employee *during* the month. Includes `value`, `date`, `remark`, `createdBy`. |
| **`additional_req_pays`**| Array[Obj] | **Bonuses**. List of extra additions to wage (e.g., Travel allowance, Bonus). Includes `value`, `date`, `remark`. |
| **`totalDays`** | Number | **Physical Presence**. usageTracker counts "P" (Present) and "H" (Half-day) based on your specific logic (e.g., 'P' = 1, 'H' = 0.5 dates). |
| **`totalovertime`** | Number | **Raw Hours**. The sum of all overtime hours recorded (e.g., "P4" = 4 hours OT). |
| **`overtimeDays`** | Number | **Converted Units**. Converts raw hours into payable day-equivalents. <br> *Default Formula:* `totalovertime / 8` |
| **`totalAttendance`** | Number | **Total Payable Units**. <br> *Formula:* `totalDays + overtimeDays` |
| **`totalWage`** | Number | **Gross Earnings** for the current month excluding extras. <br> *Formula:* `totalAttendance * rate` |
| **`carryForward`** | Number | **Previous Dues**. Unpaid balance brought forward from the previous month (Alias for `carry_forwarded.value`). |
| **`totalAdditionalReqPays`**| Number | **Extras**. Sum of values in the `additional_req_pays` array. |
| **`totalPayouts`** | Number | **Paid Amount**. Sum of values in the `payouts` array. |
| **`closing_balance`** | Number | **Net Payable**. The final amount currently due to the employee. <br> *Formula:* `(totalWage + totalAdditionalReqPays + carryForward) - totalPayouts` |

---

## 2. Add Employee

**Endpoint:** `/addemployee`
**Method:** `POST`

### Request & Response

**Request:**
```json
{
  "name": "Amit Singh",
  "siteID": "651f...",
  "wage": 600,
  "month": 10,
  "year": 2023
}
```

**Response Data (`data` object):**

| Field | Meaning |
| :--- | :--- |
| `employee` | The created database record. Note that `empid` (e.g., "EMP043") is auto-generated strictly sequentially. |
| `changeTracking` | Confirmation that this action was logged in the audit trail. |

---

## 3. Import Employees

**Endpoint:** `/importemployees`
**Method:** `POST`

This endpoint copies employee profiles from a past month to a new month.

### Key Logic
- **Carry Forward**: If `preserveCarryForward: true`, the `closing_balance` of the *source* month becomes the `carry_forwarded.value` of the *target* month.
- **Duplicate Check**: Will NOT import employees who already exist in the target month (returns a 409 error or partial success list).

### Response Data (`summary` object):

| Field | Meaning |
| :--- | :--- |
| `successfulImports` | Count of employees successfully copied. |
| `failedImports` | Count of skipped employees (usually due to duplication). |
| `totalCarryForwardAmount`| Total value of debt moved to the new month. |

---

## 4. Get Single Employee (Detailed)

**Endpoint:** `/employee/:siteID/:empid/:month/:year`
**Method:** `GET`

Returns the **exact same structure** as the list view, but for a single ID.

**Validations:**
- **Free Plan**: Can only access *Current Month* and *Previous Month*. Older data returns `403 Forbidden`.
- **404**: Returned if employee exists in OTHER months but not the requested month.

---

## 5. Pending Attendance

**Endpoint:** `/employeewithpendingattendance`
**Method:** `GET`

Returns specific lists to help supervisors know who needs attendance marked.

### Response Structure
```json
{
  "data": {
    "pendingEmployees": [
      { "empid": "EMP01", "name": "Ravi" } // Have NOT been marked for this date
    ],
    "markedEmployees": [
      { "empid": "EMP02", "name": "Sita" } // HAVE been marked for this date
    ]
  }
}
```
**Use Case:** Display a "Who is missing?" list on the dashboard for today's date.

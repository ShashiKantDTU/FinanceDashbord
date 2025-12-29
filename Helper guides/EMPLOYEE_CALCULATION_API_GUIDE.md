# Employee Calculation API Guide

## Endpoint: Get Employee Details with Calculations

```
GET /api/employee/employee/:siteID/:empid/:month/:year
```

### Authentication
- Requires Bearer token in Authorization header
- Free plan users can only access current and previous month data

---

## Response Structure

### Complete Response Example

```json
{
  // ============================================
  // DATABASE FIELDS (from Employee Schema)
  // ============================================
  "_id": "64a1b2c3d4e5f6789012345",
  "name": "Ramesh Kumar",
  "empid": "EMP001",
  "rate": 800,                    // Daily rate (₹/day)
  "overtime_rate": 50,            // Hourly overtime rate (₹/hour) - NEW FIELD
  "label": "Mason",
  "month": 12,
  "year": 2025,
  "siteID": "64a1b2c3d4e5f6789012346",
  
  "attendance": ["P", "P8", "P", "A", "P4", ...],  // P=Present, A=Absent, P8=Present+8hrs OT
  "payouts": [
    { "value": 500, "remark": "Advance", "date": "2025-12-10", "createdBy": "admin@example.com" }
  ],
  "additional_req_pays": [
    { "value": 200, "remark": "Bonus", "date": "2025-12-15", "createdBy": "admin@example.com" }
  ],
  "carry_forwarded": {
    "value": 1500,
    "remark": "Balance from Nov 2025",
    "date": "2025-12-01"
  },
  "notes": {},
  "createdBy": "admin@example.com",
  "createdAt": "2025-12-01T00:00:00.000Z",
  "updatedAt": "2025-12-29T10:30:00.000Z",
  
  // ============================================
  // CALCULATED FIELDS (Backward Compatible)
  // ============================================
  "wage": 17200,                  // Total calculated wage
  "totalWage": 17200,             // Alias for wage (backward compatibility)
  "closing_balance": 18400,       // Final balance = wage + additional - payouts + carryForward
  
  "totalPayouts": 500,            // Sum of all payouts
  "carryForward": 1500,           // Previous month's closing balance
  "totalAdditionalReqPays": 200,  // Sum of all additional payments
  
  "totalAttendance": 20,          // Effective attendance (days or days+OT equivalent)
  "totalDays": 20,                // Actual days marked Present
  "totalovertime": 16,            // Total overtime hours worked
  "overtimeDays": 0,              // Overtime converted to days (0 if overtime_rate is used)
  
  // ============================================
  // NEW: CALCULATION BREAKDOWN (for detailed display)
  // ============================================
  "calculationBreakdown": {
    "regularWage": 16000,         // rate × totalDays = 800 × 20
    "overtimePay": 800,           // overtime_rate × totalOvertime = 50 × 16
    "overtimeRate": 50,           // The hourly rate used (null if not set)
    "hasOvertimeRate": true,      // Whether separate overtime rate was used
    "calculationMethod": "overtime_rate",  // 'overtime_rate', 'default', or 'special'
    "formula": "wage = (rate × totalDays) + (overtime_rate × totalOvertime)"
  },
  
  // ============================================
  // STATUS FLAGS
  // ============================================
  "hasPendingPayouts": true,      // closing_balance !== 0
  "needsRecalculation": false     // Whether recalculation is pending
}
```

---

## 🧮 How Employee Salary is Calculated (Simple Explanation)

### Step 1: Calculate Total Wage

There are **2 ways** to calculate wage, depending on whether the employee has an overtime rate set:

---

### 📌 Option A: Employee HAS Overtime Rate

> Use this when `overtime_rate` is set (greater than 0)

**Think of it like this:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   TOTAL WAGE  =  (Daily Rate × Days Worked)                │
│                  +                                          │
│                  (Overtime Rate per Hour × Overtime Hours) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Real Example:**
```
👷 Employee: Ramesh
💵 Daily Rate: ₹800/day
⏰ Overtime Rate: ₹50/hour
📅 Days Present: 20 days
🕐 Overtime Hours: 16 hours

Step 1: Regular Pay = ₹800 × 20 days = ₹16,000
Step 2: Overtime Pay = ₹50 × 16 hours = ₹800
Step 3: Total Wage = ₹16,000 + ₹800 = ₹16,800 ✅
```

---

### 📌 Option B: Employee has NO Overtime Rate

> Use this when `overtime_rate` is 0, empty, or not set

**Think of it like this:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   First, convert overtime hours to "extra days":           │
│   Extra Days = Overtime Hours ÷ 8                          │
│                                                             │
│   Then calculate wage:                                      │
│   TOTAL WAGE = Daily Rate × (Days Worked + Extra Days)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Real Example:**
```
👷 Employee: Suresh
💵 Daily Rate: ₹800/day
⏰ Overtime Rate: Not Set (₹0)
📅 Days Present: 20 days
🕐 Overtime Hours: 16 hours

Step 1: Convert overtime to days = 16 hours ÷ 8 = 2 extra days
Step 2: Total Days = 20 + 2 = 22 days
Step 3: Total Wage = ₹800 × 22 = ₹17,600 ✅
```

---

### Step 2: Calculate Final Balance (Closing Balance)

After calculating wage, we need to find out how much money the employee should get (or owes):

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   CLOSING BALANCE =                                         │
│                                                             │
│       Total Wage (what they earned this month)             │
│     + Previous Balance (money pending from last month)     │
│     + Additional Payments (bonus, dues, etc.)              │
│     - Advances Already Paid (money already given)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Real Example:**
```
👷 Employee: Ramesh
💰 Total Wage: ₹16,800
📦 Previous Balance (Carry Forward): ₹1,500
➕ Bonus/Additional: ₹200
➖ Advances Paid: ₹500

Closing Balance = ₹16,800 + ₹1,500 + ₹200 - ₹500
                = ₹18,000 ✅

This means Ramesh should receive ₹18,000 at the end of the month.
```

---

### Quick Summary Table

| Situation | How Overtime is Paid |
|-----------|---------------------|
| Overtime Rate is SET (e.g., ₹50/hr) | Paid separately: `₹50 × overtime hours` |
| Overtime Rate is NOT SET (₹0) | Converted to days: `overtime hours ÷ 8` then paid at daily rate |

---

## Frontend Integration Guide

### 1. Simple Wage Display (Basic)

```jsx
// Just show the final numbers - simplest approach
<div>
  <p>Total Wage: ₹{employee.wage.toLocaleString()}</p>
  <p>Closing Balance: ₹{employee.closing_balance.toLocaleString()}</p>
</div>
```

### 2. Show Wage Breakdown to User

```jsx
const WageBreakdown = ({ employee }) => {
  const breakdown = employee.calculationBreakdown;
  
  // Check: Does this employee have a separate overtime rate?
  if (breakdown?.hasOvertimeRate) {
    // YES - Show overtime paid separately
    return (
      <div className="wage-breakdown">
        <h4>💰 How wage was calculated:</h4>
        
        {/* Line 1: Regular pay */}
        <p>
          Regular Pay: ₹{employee.rate}/day × {employee.totalDays} days 
          = <strong>₹{breakdown.regularWage.toLocaleString()}</strong>
        </p>
        
        {/* Line 2: Overtime pay */}
        <p>
          Overtime Pay: ₹{breakdown.overtimeRate}/hour × {employee.totalovertime} hours 
          = <strong>₹{breakdown.overtimePay.toLocaleString()}</strong>
        </p>
        
        {/* Line 3: Total */}
        <p className="total">
          <strong>Total Wage = ₹{employee.wage.toLocaleString()}</strong>
        </p>
      </div>
    );
  }
  
  // NO overtime rate - Show overtime converted to days
  return (
    <div className="wage-breakdown">
      <h4>💰 How wage was calculated:</h4>
      
      <p>Daily Rate: ₹{employee.rate}/day</p>
      <p>Days Present: {employee.totalDays} days</p>
      <p>
        Overtime: {employee.totalovertime} hours 
        = {employee.overtimeDays.toFixed(1)} extra days
      </p>
      <p>Total Days: {employee.totalAttendance.toFixed(1)} days</p>
      
      <p className="total">
        <strong>
          Total Wage = ₹{employee.rate} × {employee.totalAttendance.toFixed(1)} 
          = ₹{employee.wage.toLocaleString()}
        </strong>
      </p>
    </div>
  );
};
```

### 3. Full Salary Slip / Balance Card

```jsx
const SalarySlip = ({ employee }) => {
  const breakdown = employee.calculationBreakdown;
  
  return (
    <div className="salary-slip">
      <h3>Salary Slip: {employee.name}</h3>
      
      {/* SECTION 1: Wage Earned */}
      <div className="section">
        <h4>💵 Wage Earned This Month</h4>
        
        {breakdown?.hasOvertimeRate ? (
          // With overtime rate
          <table>
            <tr>
              <td>Regular Pay ({employee.totalDays} days × ₹{employee.rate})</td>
              <td>₹{breakdown.regularWage.toLocaleString()}</td>
            </tr>
            <tr>
              <td>Overtime Pay ({employee.totalovertime} hrs × ₹{breakdown.overtimeRate})</td>
              <td>₹{breakdown.overtimePay.toLocaleString()}</td>
            </tr>
            <tr className="subtotal">
              <td><strong>Total Wage</strong></td>
              <td><strong>₹{employee.wage.toLocaleString()}</strong></td>
            </tr>
          </table>
        ) : (
          // Without overtime rate
          <table>
            <tr>
              <td>Days Worked</td>
              <td>{employee.totalDays} days</td>
            </tr>
            <tr>
              <td>Overtime ({employee.totalovertime} hrs ÷ 8)</td>
              <td>+ {employee.overtimeDays.toFixed(1)} days</td>
            </tr>
            <tr>
              <td>Total ({employee.totalAttendance.toFixed(1)} days × ₹{employee.rate})</td>
              <td><strong>₹{employee.wage.toLocaleString()}</strong></td>
            </tr>
          </table>
        )}
      </div>
      
      {/* SECTION 2: Money Added */}
      <div className="section">
        <h4>➕ Added to Balance</h4>
        <table>
          <tr>
            <td>Wage Earned</td>
            <td>+ ₹{employee.wage.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Previous Month Balance</td>
            <td>+ ₹{employee.carryForward.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Bonus / Additional Payments</td>
            <td>+ ₹{employee.totalAdditionalReqPays.toLocaleString()}</td>
          </tr>
        </table>
      </div>
      
      {/* SECTION 3: Money Deducted */}
      <div className="section">
        <h4>➖ Deducted from Balance</h4>
        <table>
          <tr>
            <td>Advances Already Paid</td>
            <td>- ₹{employee.totalPayouts.toLocaleString()}</td>
          </tr>
        </table>
      </div>
      
      {/* SECTION 4: Final Amount */}
      <div className="section final">
        <h4>📊 Final Balance (Amount to Pay)</h4>
        <p className="calculation">
          ₹{employee.wage.toLocaleString()} 
          + ₹{employee.carryForward.toLocaleString()} 
          + ₹{employee.totalAdditionalReqPays.toLocaleString()} 
          - ₹{employee.totalPayouts.toLocaleString()}
        </p>
        <p className="result">
          <strong>= ₹{employee.closing_balance.toLocaleString()}</strong>
        </p>
        
        {employee.closing_balance > 0 && (
          <p className="note">👆 Pay this amount to the employee</p>
        )}
        {employee.closing_balance < 0 && (
          <p className="note">👆 Employee owes this amount (advance taken)</p>
        )}
        {employee.closing_balance === 0 && (
          <p className="note">✅ All dues cleared!</p>
        )}
      </div>
    </div>
  );
};
```

### 4. Simple Overtime Display

```jsx
const OvertimeInfo = ({ employee }) => {
  const breakdown = employee.calculationBreakdown;
  
  return (
    <div>
      <p>⏰ Overtime: {employee.totalovertime} hours</p>
      
      {breakdown?.hasOvertimeRate ? (
        // Has overtime rate - show hourly pay
        <p>
          💰 Overtime Pay: ₹{breakdown.overtimeRate}/hour × {employee.totalovertime} hours 
          = <strong>₹{breakdown.overtimePay.toLocaleString()}</strong>
        </p>
      ) : (
        // No overtime rate - show conversion to days
        <p>
          📅 Converted to: {employee.overtimeDays.toFixed(1)} extra days 
          (paid at ₹{employee.rate}/day)
        </p>
      )}
    </div>
  );
};
```

---

## Response Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `wage` | Number | Total calculated wage |
| `totalWage` | Number | Alias for `wage` (backward compatibility) |
| `closing_balance` | Number | Final balance after all calculations |
| `totalDays` | Number | Days marked as Present |
| `totalovertime` | Number | Total overtime hours |
| `overtimeDays` | Number | Overtime converted to days (0 if using overtime_rate) |
| `totalAttendance` | Number | Effective attendance for wage calculation |
| `totalPayouts` | Number | Sum of all advances/payouts |
| `totalAdditionalReqPays` | Number | Sum of all additional payments |
| `carryForward` | Number | Previous month's closing balance |
| `calculationBreakdown.regularWage` | Number | Base wage from daily rate × days |
| `calculationBreakdown.overtimePay` | Number | Overtime compensation amount |
| `calculationBreakdown.overtimeRate` | Number/null | Hourly overtime rate used |
| `calculationBreakdown.hasOvertimeRate` | Boolean | Whether separate OT rate was used |
| `calculationBreakdown.calculationMethod` | String | `'overtime_rate'` or `'default'` |
| `calculationBreakdown.formula` | String | Human-readable formula used |

---

## Backward Compatibility Notes

1. **`totalWage`** field is kept as an alias for `wage` - old frontend code will still work
2. **`overtimeDays`** is 0 when using `overtime_rate` method (overtime is paid separately)
3. **All existing fields** remain unchanged in structure and meaning
4. **New `calculationBreakdown` object** is additive - old code can safely ignore it
5. **Free plan restrictions** remain unchanged

---

## Error Responses

### 404 - Employee Not Found
```json
{
  "success": false,
  "error": "No data found.",
  "message": "No data found for employee EMP001 - 12/2025 at site 64a1b2c3..."
}
```

### 403 - Plan Restriction (Free Users)
```json
{
  "success": false,
  "message": "Free plan users can only access data from the current and previous month...",
  "error": "Historical data access restricted",
  "details": {
    "requestedMonth": "6/2025",
    "allowedRange": "Current and previous month only",
    "upgradeRequired": true
  }
}
```

### 500 - Server Error
```json
{
  "success": false,
  "error": "Error fetching employee data.",
  "message": "Database connection failed"
}
```

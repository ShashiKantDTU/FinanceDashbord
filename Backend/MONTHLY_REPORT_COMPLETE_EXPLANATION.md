# 📊 MONTHLY REPORT GENERATION - COMPLETE PROCESS EXPLAINED

## 🎯 Overview

The monthly report generation system automatically creates and sends **PDF** and **Excel** payroll reports to eligible users via WhatsApp on the **1st day of every month at 2 AM IST** for the previous month.

---

## 🔄 COMPLETE FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│  CRON JOB TRIGGER                                               │
│  Schedule: '0 2 1 * *' (1st day, 2 AM IST)                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. sendMonthlyReportAll()                                      │
│     • Calculate previous month/year (IST timezone)              │
│     • Get eligible users                                        │
│     • Create cron job log entry                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. getEligibleUsersForReports()                                │
│     • Query users: premium/business/trial plans                 │
│     • Filter: whatsAppReportsEnabled = true                     │
│     • Filter: only active sites                                 │
│     • Return: user-site pairs                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. FOR EACH USER → FOR EACH SITE                               │
│     Loop through all user-site combinations                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. sendMonthlyReport(user, siteId, month, year)                │
│     • Validate parameters                                       │
│     • Normalize phone number (remove +)                         │
│     • Fetch site details                                        │
│     • Generate PDF report ──────────┐                          │
│     • Generate Excel report ────────┤                          │
│     • Upload both to S3 ────────────┤                          │
│     • Send via WhatsApp template ───┘                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ├──────> PARALLEL PATHS
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐        ┌──────────────────┐
│  PDF GENERATION  │        │ EXCEL GENERATION │
└──────────────────┘        └──────────────────┘
        │                           │
        │                           │
        ▼                           ▼
   (Continue to detailed flows below)
```

---

## 📝 DETAILED STEP-BY-STEP PROCESS

### **STEP 1: CRON JOB INITIALIZATION**

**File:** `services/cronJobs.js`  
**Function:** `init()`  
**Line:** ~120

```javascript
// Scheduled on 1st day of every month at 2 AM IST
this.scheduleJob('monthly-report', '0 2 1 * *', this.sendMonthlyReportAll.bind(this));
```

**What it does:**
- Uses `node-cron` to schedule the job
- **Cron Pattern:** `'0 2 1 * *'`
  - Minute: 0
  - Hour: 2
  - Day of Month: 1
  - Month: * (every month)
  - Day of Week: * (any day)
- Binds to `sendMonthlyReportAll()` method

---

### **STEP 2: MONTHLY REPORT COORDINATOR**

**File:** `services/cronJobs.js`  
**Function:** `sendMonthlyReportAll()`  
**Lines:** 1387-1543

#### **2.1 Calculate Previous Month (IST Timezone)**

```javascript
const { getISTDate } = require('../Utils/WeeklyReportUtils');
const now = getISTDate(); // Get current time in IST
const previousMonth = now.getMonth(); // 0-11 (January = 0)
const year = previousMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
const month = previousMonth === 0 ? 12 : previousMonth;
```

**Why IST?**
- Cron runs at 2 AM IST on Nov 1
- Server in UTC shows Oct 31 @ 8:30 PM
- Must use IST date to get correct month

**Example:**
- If today is Nov 1, 2025 at 2 AM IST
- `previousMonth` = 10 (November - 1 = October)
- `month` = 10, `year` = 2025
- **Report for:** October 2025

#### **2.2 Create Log Entry**

```javascript
const logId = await this.createCronJobLog('monthly-report', { month, year });
```

**What it creates:**
- Document in `CronJobLog` collection
- Tracks: start time, status, parameters
- Used for monitoring and debugging

#### **2.3 Get Eligible Users**

```javascript
const userSitePairs = await this.getEligibleUsersForReports();
```

**Returns:** Array of objects like:
```javascript
[
  {
    user: {
      name: "Sunny Poddar",
      phoneNumber: "+919354739451",
      calculationType: "default"
    },
    sites: ["507f1f77bcf86cd799439011", "507f191e810c19729de860ea"]
  },
  // ... more users
]
```

#### **2.4 Loop Through Users and Sites**

```javascript
for (const pair of userSitePairs) {
    for (const siteId of pair.sites) {
        // Send report for this user-site combination
        const result = await sendMonthlyReport(pair.user, siteId, month, year);
        
        // Track success/failure/skipped
        if (result.skipped) {
            skippedCount++;
        } else {
            successCount++;
        }
        
        // Delay to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
}
```

**Key Points:**
- Each user can have multiple sites
- Each site gets a separate report
- 1.5 second delay between sends (WhatsApp API rate limit)
- Tracks detailed logs for each attempt

#### **2.5 Update Log with Results**

```javascript
await this.updateCronJobLog(logId, {
    status: 'completed',
    totalUsers: userSitePairs.length,
    totalSites: totalSites,
    successCount,
    failureCount,
    skippedCount,
    successfulReports: [ /* array of successful sends */ ],
    skippedReports: [ /* array of skipped sends */ ],
    failures: [ /* array of failures */ ],
    userSummary: [ /* per-user statistics */ ],
    executionTime: Date.now() - startTime
});
```

---

### **STEP 3: GET ELIGIBLE USERS**

**File:** `services/cronJobs.js`  
**Function:** `getEligibleUsersForReports()`  
**Lines:** 545-589

#### **3.1 Query Database for Eligible Users**

```javascript
const users = await User.find({
    $or: [
        { plan: { $in: ['premium', 'business'] } }, // Premium or business plans
        { isTrial: true }, // OR users on trial (any plan)
    ],
    site: { $exists: true, $not: { $size: 0 } }, // Must have at least one site
    whatsAppReportsEnabled: true // User must have enabled WhatsApp reports
}).populate('site'); // Load site details (to check isActive)
```

**Eligibility Criteria:**
1. **Plan:** Premium OR Business OR Trial
2. **Has Sites:** At least one site assigned
3. **WhatsApp Enabled:** `whatsAppReportsEnabled = true`
4. **Site is Active:** Filter out inactive sites

#### **3.2 Filter Active Sites**

```javascript
for (const user of users) {
    // Only include active sites
    const activeSites = user.site.filter(site => site.isActive === true);
    
    if (activeSites.length > 0) {
        userSitePairs.push({
            user: {
                name: user.name,
                phoneNumber: user.whatsAppReportPhone, // Use WhatsApp phone, not regular
                calculationType: 'default'
            },
            sites: activeSites.map(site => site._id.toString())
        });
    }
}
```

**Important:**
- Uses `whatsAppReportPhone` (not regular `phoneNumber`)
- Only active sites are included
- Each user-site pair becomes one report

---

### **STEP 4: SEND MONTHLY REPORT**

**File:** `scripts/whatsappReport.js`  
**Function:** `sendMonthlyReport(userObject, siteId, month, year)`  
**Lines:** 386-538

#### **4.1 Validate Parameters**

```javascript
// Check required fields
if (!userObject || !userObject.phoneNumber || !userObject.name) {
    throw new Error('Invalid user object');
}

if (!siteId || !month || !year) {
    throw new Error('Missing required parameters');
}

// Validate ranges
if (month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12');
}

if (year < 2020 || year > 2030) {
    throw new Error('Year must be between 2020 and 2030');
}
```

#### **4.2 Normalize Phone Number**

```javascript
phoneNumber = userObject.phoneNumber.trim();
if (phoneNumber.startsWith('+')) {
    phoneNumber = phoneNumber.substring(1); // Remove + prefix
}
```

**Why?**
- DB stores: `+919354739451`
- Meta WhatsApp API needs: `919354739451` (no +)

#### **4.3 Fetch Site Details**

```javascript
const site = await siteSchema.findById(siteId);
const siteName = site ? site.sitename : 'Unknown Site';
```

#### **4.4 Format Period**

```javascript
const monthNames = ['January', 'February', ... 'December'];
const period = `${monthNames[month - 1]} ${year}`;
// Example: "October 2025"
```

#### **4.5 Generate PDF Report**

```javascript
const pdfUrl = await generateAndUploadReportPdf(userObject, siteId, month, year);
const pdfFilename = `Monthly_Report_${month}_${year}_${userObject.name.replace(/\s+/g, '_')}.pdf`;
```

**See:** "PDF Generation Flow" section below

#### **4.6 Generate Excel Report**

```javascript
const excelResult = await generateAndUploadReportExcel(userObject, siteId, month, year);
const excelFilename = `Monthly_Report_Excel_${month}_${year}_${userObject.name.replace(/\s+/g, '_')}.xlsx`;
```

**See:** "Excel Generation Flow" section below

#### **4.7 Send PDF via WhatsApp Template**

```javascript
const templateName = process.env.WHATSAPP_REPORT_TEMPLATE_NAME || 'report_delivery';
const pdfParams = [
    userObject.name,      // {{1}} - User name
    'Monthly',            // {{2}} - Report type
    period,               // {{3}} - Period (e.g., "October 2025")
    siteName,             // {{4}} - Site name
    'PDF'                 // {{5}} - File type
];

await sendMetaTemplateWithDocument(
    phoneNumber,
    templateName,
    pdfParams,
    pdfUrl,
    pdfFilename
);
```

**WhatsApp Template Structure:**
```
Hello {{1}},

Your {{2}} report for {{3}} at {{4}} is ready!

File Type: {{5}}
[Document attachment]

Best regards,
Site Haazri Team
```

#### **4.8 Send Excel via WhatsApp Template**

```javascript
const excelParams = [
    userObject.name,
    'Monthly',
    period,
    siteName,
    'Excel'
];

await sendMetaTemplateWithDocument(
    phoneNumber,
    templateName,
    excelParams,
    excelResult.url,
    excelFilename
);
```

#### **4.9 Return Success**

```javascript
return {
    success: true,
    message: `✅ Monthly report sent successfully to ${userObject.name}`,
    reportType: 'monthly',
    user: userObject.name,
    phone: phoneNumber,
    period: period,
    siteId: siteId
};
```

#### **4.10 Error Handling**

```javascript
catch (error) {
    // Handle "no employees found" gracefully
    if (error.message.includes('No employees found')) {
        return {
            success: false,
            skipped: true,
            reason: 'no_employees'
        };
    }
    
    // Try fallback text message
    try {
        const fallbackMessage = `Hello ${userObject.name},\n\nWe encountered an issue sending your monthly report...`;
        await sendMetaTextMessage(phoneNumber, fallbackMessage);
    } catch (fallbackError) {
        console.error('Fallback message also failed');
    }
    
    return {
        success: false,
        error: error.message
    };
}
```

---

## 📄 PDF GENERATION FLOW

### **Function:** `generateAndUploadReportPdf()`

**File:** `scripts/whatsappReport.js`  
**Lines:** 152-192

```
generateAndUploadReportPdf(user, siteID, month, year)
    │
    ▼
generatePaymentReportPdf(user, siteID, month, year)
    │
    ├─> fetchEmployeeData(siteID, month, year, calculationType)
    │       │
    │       └─> MongoDB Aggregation Pipeline
    │               • Filter by site, month, year
    │               • Calculate totals (payouts, attendance, overtime)
    │               • Calculate wages and balances
    │               • Return processed employee data
    │
    ├─> fetchSiteInfo(siteID)
    │       └─> Get site name from database
    │
    ├─> Create PDF Document (PDFKit)
    │       ├─> generateHeader(doc, reportData)
    │       │       • Site name, month, year
    │       │       • Report title
    │       │       • Logo (if any)
    │       │
    │       ├─> generateEmployeeTable(doc, reportData)
    │       │       • Summary table with all employees
    │       │       • Columns: ID, Name, Present, Overtime, Rate,
    │       │         Gross, Advances, Bonus, Prev Balance, Final Payment
    │       │       • Totals row at bottom
    │       │
    │       └─> generateIndividualEmployeeDetails(doc, reportData)
    │               • Detailed page for each employee
    │               • Breakdown of advances, bonus, attendance
    │               • Calendar view with attendance marks
    │               • Previous balance carry-forward details
    │
    ├─> Save PDF to temp file
    │
    ├─> Upload to AWS S3
    │       • Bucket: process.env.AWS_BUCKET_NAME
    │       • Key: filename with timestamp
    │       • ContentType: 'application/pdf'
    │
    ├─> Generate signed URL (expires in default time)
    │
    ├─> Delete temp file
    │
    └─> Return: { buffer, filename, siteName, employeeCount }
```

### **Key Function:** `fetchEmployeeData()`

**File:** `Routes/pdfReports.js`  
**Lines:** 20-120

**MongoDB Aggregation Pipeline:**

```javascript
[
    // Stage 1: Filter Documents
    {
        $match: {
            siteID: ObjectId(siteID),
            month: parseInt(month),
            year: parseInt(year)
        }
    },
    
    // Stage 2: Calculate Totals
    {
        $addFields: {
            totalPayouts: { $sum: "$payouts.value" },
            totalAdditionalReqPays: { $sum: "$additional_req_pays.value" },
            carryForward: { $ifNull: ["$carry_forwarded.value", 0] },
            
            // Count 'P' attendance (Present days)
            totalDays: {
                $size: {
                    $filter: {
                        input: "$attendance",
                        as: "att",
                        cond: { $regexMatch: { input: "$$att", regex: /^P/ } }
                    }
                }
            },
            
            // Sum overtime hours
            totalovertime: {
                $sum: {
                    $map: {
                        input: "$attendance",
                        as: "att",
                        in: { /* extract overtime from "PO2", "PO4" etc */ }
                    }
                }
            }
        }
    },
    
    // Stage 3: Calculate Overtime Days
    {
        $addFields: {
            overtimeDays: {
                $cond: {
                    if: { $eq: [calculationType, 'special'] },
                    then: {
                        // Special: 8h = 1.0 day, 4h = 0.4 day
                        $add: [
                            { $floor: { $divide: ["$totalovertime", 8] } },
                            { $divide: [{ $mod: ["$totalovertime", 8] }, 10] }
                        ]
                    },
                    else: {
                        // Default: Simple division by 8
                        { $divide: ["$totalovertime", 8] }
                    }
                }
            }
        }
    },
    
    // Stage 4: Calculate Final Values
    {
        $addFields: {
            totalAttendance: { $add: ["$totalDays", "$overtimeDays"] },
            
            // Wage = Rate × Total Attendance
            totalWage: { 
                $multiply: ["$rate", { $add: ["$totalDays", "$overtimeDays"] }] 
            },
            
            // Closing Balance = (Wage + Bonus + Prev Balance) - Advances
            closing_balance: {
                $subtract: [
                    {
                        $add: [
                            { $multiply: ["$rate", { $add: ["$totalDays", "$overtimeDays"] }] },
                            "$totalAdditionalReqPays",
                            "$carryForward"
                        ]
                    },
                    "$totalPayouts"
                ]
            }
        }
    }
]
```

**What it returns:**
```javascript
[
    {
        _id: ObjectId,
        empid: "EMP001",
        name: "John Doe",
        rate: 500,
        totalDays: 25,
        totalovertime: 16,
        overtimeDays: 2,
        totalAttendance: 27,
        totalWage: 13500,
        totalPayouts: 5000,
        totalAdditionalReqPays: 1000,
        carryForward: 2000,
        closing_balance: 11500,
        payouts: [ { date: "2025-10-05", value: 2000 }, ... ],
        additional_req_pays: [ { date: "2025-10-15", value: 1000 } ],
        attendance: ["P", "P", "PO2", "A", ...],
        carry_forwarded: { month: 9, year: 2025, value: 2000 }
    },
    // ... more employees
]
```

### **PDF Structure:**

**Page 1: Summary Table**
```
┌─────────────────────────────────────────────────────┐
│  SITE NAME - OCTOBER 2025                           │
│  MONTHLY PAYROLL REPORT                             │
├─────────────────────────────────────────────────────┤
│ ID  | Name    | Days | OT  | Rate | Gross | Adv... │
├─────────────────────────────────────────────────────┤
│ 001 | John    |  25  | 2.0 |  500 | 13500 | 5000...│
│ 002 | Jane    |  26  | 1.5 |  550 | 15125 | 6000...│
│ ...                                                  │
├─────────────────────────────────────────────────────┤
│ TOTALS:             │ 28625 | 11000 | 2000 | ...   │
└─────────────────────────────────────────────────────┘
```

**Page 2+: Individual Employee Details**
```
┌─────────────────────────────────────────────────────┐
│  JOHN DOE (EMP001)                                  │
├─────────────────────────────────────────────────────┤
│  Gross: 13500 | Advances: 5000 | Bonus: 1000       │
│  Prev Balance: 2000 | FINAL: 11500                  │
├─────────────────────────────────────────────────────┤
│  ADVANCES       │ BONUS           │ ATTENDANCE      │
│  ─────────      │ ─────           │ ──────────      │
│  05 Oct: 2000   │ 15 Oct: 1000    │ Days: 25        │
│  12 Oct: 3000   │                 │ OT: 16h (2.0d)  │
│  Total: 5000    │ Total: 1000     │ Total: 27       │
├─────────────────────────────────────────────────────┤
│  CALENDAR VIEW:                                     │
│   1  2  3  4  5  6  7                              │
│   P  P  P  A  P  P  P                              │
│   8  9  10 11 12 13 14                             │
│   PO2 P  P  P  P  A  P                             │
│   ... (full month)                                  │
└─────────────────────────────────────────────────────┘
```

---

## 📊 EXCEL GENERATION FLOW

### **Function:** `generateAndUploadReportExcel()`

**File:** `scripts/whatsappReport.js`  
**Lines:** 198-248

```
generateAndUploadReportExcel(user, siteID, month, year)
    │
    ▼
generateFullPayrollReportWithRealData({ siteID, month, year, calculationType })
    │
    ├─> fetchEmployeeData(siteID, month, year, calculationType)
    │       └─> Same MongoDB aggregation as PDF
    │
    ├─> fetchSiteInfo(siteID)
    │
    ├─> Create Excel Workbook (ExcelJS)
    │       ├─> SHEET 1: Summary
    │       │       • Site info, month, year
    │       │       • Employee count, total calculations
    │       │       • Summary statistics
    │       │
    │       ├─> SHEET 2: Employees Table
    │       │       • All employees in table format
    │       │       • Same columns as PDF summary
    │       │       • Color-coded rows (alternating)
    │       │       • Auto-filter enabled
    │       │
    │       └─> SHEET 3-N: Individual Employee Details
    │               • One sheet per employee
    │               • Detailed breakdown
    │               • Attendance, advances, bonus
    │               • Formulas for calculations
    │
    ├─> Generate Excel buffer
    │
    ├─> Upload to AWS S3
    │       • ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    │
    ├─> Generate signed URL
    │
    └─> Return: { url, filename }
```

### **Excel Structure:**

**Sheet 1: Summary**
```
┌──────────────────────────────────────┐
│  SITE HAAZRI PAYROLL REPORT          │
│  Site: ABC Construction              │
│  Period: October 2025                │
├──────────────────────────────────────┤
│  Total Employees: 45                 │
│  Total Gross Payment: Rs. 675,000    │
│  Total Advances: Rs. 245,000         │
│  Total Bonus: Rs. 35,000             │
│  Net Payable: Rs. 465,000            │
└──────────────────────────────────────┘
```

**Sheet 2: All Employees**
```
┌────┬────────┬──────┬────┬──────┬────────┬─────────┬───────┐
│ ID │ Name   │ Days │ OT │ Rate │ Gross  │ Advanc. │ Final │
├────┼────────┼──────┼────┼──────┼────────┼─────────┼───────┤
│001 │ John   │  25  │2.0 │ 500  │ 13500  │  5000   │ 11500 │
│002 │ Jane   │  26  │1.5 │ 550  │ 15125  │  6000   │ 10125 │
│... │        │      │    │      │        │         │       │
└────┴────────┴──────┴────┴──────┴────────┴─────────┴───────┘
```

**Sheet 3-N: Individual Sheets**
```
Sheet "John Doe (EMP001)":
┌──────────────────────────────────────┐
│  EMPLOYEE: John Doe                  │
│  ID: EMP001                          │
├──────────────────────────────────────┤
│  CALCULATION BREAKDOWN:              │
│  Days Present: 25                    │
│  Overtime Hours: 16                  │
│  Overtime Days: 2.0                  │
│  Total Attendance: 27                │
│  Daily Rate: Rs. 500                 │
│  Gross Payment: Rs. 13,500           │
├──────────────────────────────────────┤
│  DEDUCTIONS & ADDITIONS:             │
│  Advances: Rs. 5,000                 │
│  Bonus: Rs. 1,000                    │
│  Previous Balance: Rs. 2,000         │
├──────────────────────────────────────┤
│  FINAL PAYMENT: Rs. 11,500           │
└──────────────────────────────────────┘

ADVANCES TABLE:
┌────────────┬─────────┐
│ Date       │ Amount  │
├────────────┼─────────┤
│ 05-Oct-25  │  2,000  │
│ 12-Oct-25  │  3,000  │
├────────────┼─────────┤
│ TOTAL      │  5,000  │
└────────────┴─────────┘

ATTENDANCE:
[Full calendar with P, A, PO2, etc.]
```

---

## 📤 WHATSAPP MESSAGE SENDING

### **Function:** `sendMetaTemplateWithDocument()`

**File:** `scripts/whatsappReport.js`  
**Lines:** 97-150

```javascript
async function sendMetaTemplateWithDocument(
    recipientNumber,  // "919354739451"
    templateName,     // "report_delivery"
    templateParams,   // ["Sunny", "Monthly", "October 2025", "ABC Site", "PDF"]
    documentUrl,      // S3 signed URL
    filename          // "Monthly_Report_10_2025_Sunny_Poddar.pdf"
) {
    const url = `https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`;
    
    const payload = {
        messaging_product: 'whatsapp',
        to: recipientNumber,
        type: 'template',
        template: {
            name: templateName,
            language: { code: 'en' },
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'document',
                            document: {
                                link: documentUrl,
                                filename: filename
                            }
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: templateParams.map(text => ({
                        type: 'text',
                        text: text
                    }))
                }
            ]
        }
    };
    
    const headers = {
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    };
    
    const response = await axios.post(url, payload, { headers });
    return response.data;
}
```

**WhatsApp API Call:**
```
POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages

Headers:
  Authorization: Bearer {ACCESS_TOKEN}
  Content-Type: application/json

Body:
{
  "messaging_product": "whatsapp",
  "to": "919354739451",
  "type": "template",
  "template": {
    "name": "report_delivery",
    "language": { "code": "en" },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "document",
            "document": {
              "link": "https://s3.aws.com/signed-url...",
              "filename": "Monthly_Report_10_2025.pdf"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Sunny Poddar" },
          { "type": "text", "text": "Monthly" },
          { "type": "text", "text": "October 2025" },
          { "type": "text", "text": "ABC Site" },
          { "type": "text", "text": "PDF" }
        ]
      }
    ]
  }
}
```

**User Receives:**
```
─────────────────────────────
Hello Sunny Poddar,

Your Monthly report for October 2025 
at ABC Site is ready!

File Type: PDF

📄 Monthly_Report_10_2025_Sunny_Poddar.pdf

[Download Document]

Best regards,
Site Haazri Team
─────────────────────────────
```

---

## 🗄️ DATABASE STRUCTURE

### **Employee Schema:**

```javascript
{
  _id: ObjectId,
  empid: "EMP001",
  name: "John Doe",
  siteID: ObjectId("site_id"),
  month: 10,
  year: 2025,
  rate: 500,
  
  attendance: [
    "P",      // Present
    "P",
    "PO2",    // Present with 2h overtime
    "A",      // Absent
    "PO4",    // Present with 4h overtime
    // ... 31 days
  ],
  
  payouts: [
    {
      date: ISODate("2025-10-05"),
      value: 2000,
      remark: "Advance for Diwali"
    },
    {
      date: ISODate("2025-10-12"),
      value: 3000,
      remark: "Emergency advance"
    }
  ],
  
  additional_req_pays: [
    {
      date: ISODate("2025-10-15"),
      value: 1000,
      remark: "Performance bonus"
    }
  ],
  
  carry_forwarded: {
    month: 9,
    year: 2025,
    value: 2000,
    remark: "Balance from September"
  }
}
```

### **User Schema (Eligibility):**

```javascript
{
  _id: ObjectId,
  name: "Sunny Poddar",
  phoneNumber: "+919354739451",
  whatsAppReportPhone: "+919354739451",
  whatsAppReportsEnabled: true,
  
  plan: "premium",  // or "business", "pro", "free"
  isTrial: false,
  
  site: [
    ObjectId("site1"),
    ObjectId("site2")
  ]
}
```

### **Site Schema:**

```javascript
{
  _id: ObjectId,
  sitename: "ABC Construction Site",
  isActive: true,
  owner: ObjectId("user_id")
}
```

### **Cron Job Log Schema:**

```javascript
{
  _id: ObjectId,
  jobName: "monthly-report",
  executionDate: ISODate("2025-11-01T02:00:00Z"),
  status: "completed",
  
  totalUsers: 45,
  totalSites: 78,
  successCount: 75,
  failureCount: 2,
  skippedCount: 1,
  
  successfulReports: [
    {
      userName: "Sunny Poddar",
      phoneNumber: "+919354739451",
      siteId: "507f1f77bcf86cd799439011",
      siteName: "ABC Site",
      timestamp: ISODate("2025-11-01T02:05:23Z")
    },
    // ... more
  ],
  
  failures: [
    {
      userName: "John Smith",
      phoneNumber: "+919876543210",
      siteId: "507f191e810c19729de860ea",
      siteName: "XYZ Site",
      error: "WhatsApp API rate limit exceeded",
      timestamp: ISODate("2025-11-01T02:45:12Z")
    }
  ],
  
  executionTime: 3456000 // milliseconds
}
```

---

## ⏱️ TIMING AND PERFORMANCE

### **Execution Timeline:**

```
2:00:00 AM IST - Cron triggers
2:00:01 AM     - Calculate previous month
2:00:02 AM     - Query eligible users (45 users found)
2:00:03 AM     - Start processing first user

For Each User-Site Pair:
  ├─ Fetch employees (MongoDB): ~200-500ms
  ├─ Generate PDF: ~1-2 seconds
  ├─ Upload PDF to S3: ~500ms-1s
  ├─ Generate Excel: ~1-2 seconds
  ├─ Upload Excel to S3: ~500ms-1s
  ├─ Send PDF via WhatsApp: ~300-800ms
  ├─ Send Excel via WhatsApp: ~300-800ms
  └─ Delay (rate limit): 1.5 seconds
  
  Total per site: ~6-10 seconds

If 78 sites total:
  78 × 7 seconds (avg) = 546 seconds = ~9 minutes

2:09:00 AM IST - All reports sent
```

### **Rate Limiting:**

1. **WhatsApp API:**
   - Limit: ~80-100 messages/minute
   - Our delay: 1.5 seconds = ~40 messages/minute
   - **We stay well within limits** ✅

2. **MongoDB:**
   - Aggregation pipeline optimized
   - Uses indexes on: siteID, month, year
   - Typical query time: 200-500ms

3. **AWS S3:**
   - Upload speed depends on file size
   - PDF: ~300KB-2MB
   - Excel: ~100KB-500KB
   - Signed URLs generated instantly

---

## 🔄 ERROR HANDLING

### **Graceful Degradation:**

```javascript
// Level 1: No employees found
if (employees.length === 0) {
    throw new Error('No employees found');
    // Caught as "skipped" - not an error
}

// Level 2: Report generation fails
catch (error) {
    if (error.message.includes('No employees')) {
        return { skipped: true, reason: 'no_employees' };
    }
    // Continue to Level 3
}

// Level 3: WhatsApp sending fails
catch (error) {
    // Try fallback text message
    try {
        await sendMetaTextMessage(phone, fallbackMessage);
    } catch (fallbackError) {
        // Log but don't throw - job continues
        console.error('Fallback failed');
    }
    
    return { success: false, error: error.message };
}

// Level 4: Entire cron job fails
catch (error) {
    // Log to database
    await updateCronJobLog(logId, {
        status: 'failed',
        error: error.message
    });
    // Don't crash - next month will try again
}
```

### **Retry Strategy:**

- **No automatic retries** for individual sends
- **Next month** will try again for failed users
- **Manual trigger** available via API for debugging

---

## 📊 MONITORING AND LOGGING

### **What Gets Logged:**

1. **Cron Job Execution:**
   - Start time, end time, duration
   - Total users, total sites
   - Success/failure/skipped counts

2. **Per-User Details:**
   - User name, phone number
   - Each site attempted
   - Success/failure reason
   - Timestamp

3. **Console Logs:**
   ```
   📊 Starting Monthly Report for all users...
   📅 Sending reports for: 10/2025 (Previous month from IST date)
   📋 Found 45 eligible users (premium/business/trial)
   ✅ Prepared 45 user-site pairs with active sites
   📅 Sending monthly report for Sunny Poddar - 10/2025 - Site: 507f...
   📄 Generating PDF report...
   🔍 Generating PDF report for site 507f..., 10/2025...
   📊 Found 35 employees
   ✅ PDF report generated successfully: ABC_Site_10_2025_2025-11-01...
   📊 Generating Excel report...
   📤 Sending PDF report via WhatsApp template...
   📤 Sending Excel report via WhatsApp template...
   ✅ Monthly report sent successfully to Sunny Poddar
   ...
   ✅ Monthly Report completed: 75 sent, 2 failed, 1 skipped
   ```

### **Accessing Logs:**

**Via Database:**
```javascript
// Get latest monthly report log
db.cronjoblogs.find({ jobName: 'monthly-report' })
  .sort({ executionDate: -1 })
  .limit(1);
```

**Via API:**
```bash
GET /api/usage/cron-jobs?jobName=monthly-report&limit=10
```

**Console:**
- All logs are also written to console
- Can be redirected to file: `node server.js >> logs.txt 2>&1`

---

## 🎯 COMPLETE FUNCTION CALL TREE

```
cronJobs.init()
└─> scheduleJob('monthly-report', '0 2 1 * *', sendMonthlyReportAll)
    └─> sendMonthlyReportAll()
        ├─> getISTDate()                    [WeeklyReportUtils]
        ├─> createCronJobLog()              [CronJobLog model]
        ├─> getEligibleUsersForReports()
        │   └─> User.find().populate()      [MongoDB query]
        │
        └─> FOR EACH user-site pair:
            └─> sendMonthlyReport(user, siteId, month, year)  [whatsappReport.js]
                ├─> siteSchema.findById()   [Get site name]
                │
                ├─> generateAndUploadReportPdf(user, siteId, month, year)
                │   └─> generatePaymentReportPdf(user, siteId, month, year)  [pdfReports.js]
                │       ├─> fetchEmployeeData(siteId, month, year, calculationType)
                │       │   └─> employeeSchema.aggregate()  [MongoDB aggregation]
                │       │       ├─> Stage 1: $match (filter)
                │       │       ├─> Stage 2: $addFields (calculate totals)
                │       │       ├─> Stage 3: $addFields (overtime days)
                │       │       └─> Stage 4: $addFields (final values)
                │       │
                │       ├─> fetchSiteInfo(siteId)
                │       │   └─> siteSchema.findById()
                │       │
                │       ├─> PDFDocument.create()             [PDFKit]
                │       ├─> generateHeader(doc, reportData)
                │       ├─> generateEmployeeTable(doc, reportData)
                │       ├─> generateIndividualEmployeeDetails(doc, reportData)
                │       │   ├─> FOR EACH employee:
                │       │   │   ├─> calculateEmployeeDetailSectionHeight()
                │       │   │   ├─> generateEmployeeDetailSection()
                │       │   │   │   ├─> Draw header
                │       │   │   │   ├─> Draw summary box
                │       │   │   │   ├─> Draw three columns:
                │       │   │   │   │   ├─> Advances table
                │       │   │   │   │   ├─> Bonus table
                │       │   │   │   │   └─> Attendance info
                │       │   │   │   └─> Draw calendar
                │       │   │   └─> Check page break, add page if needed
                │       │   └─> NEXT employee
                │       │
                │       ├─> doc.end()
                │       ├─> fs.writeFileSync()               [Save to temp]
                │       ├─> s3Client.send(PutObjectCommand)  [Upload to S3]
                │       ├─> getSignedUrl()                   [Get download link]
                │       ├─> fs.unlinkSync()                  [Delete temp file]
                │       └─> RETURN { buffer, filename, ... }
                │
                ├─> generateAndUploadReportExcel(user, siteId, month, year)
                │   └─> generateFullPayrollReportWithRealData()  [generatePayrollWithRealData.js]
                │       ├─> fetchEmployeeData()              [Same as PDF]
                │       ├─> fetchSiteInfo()
                │       ├─> ExcelJS.Workbook.create()
                │       ├─> createSummarySheet()
                │       ├─> createEmployeesTableSheet()
                │       ├─> FOR EACH employee:
                │       │   └─> createIndividualEmployeeSheet()
                │       │       ├─> Add employee info
                │       │       ├─> Add calculation breakdown
                │       │       ├─> Add advances table
                │       │       ├─> Add bonus table
                │       │       └─> Add attendance calendar
                │       │
                │       ├─> workbook.xlsx.writeBuffer()
                │       ├─> s3Client.send(PutObjectCommand)
                │       ├─> getSignedUrl()
                │       └─> RETURN { url, filename }
                │
                ├─> sendMetaTemplateWithDocument(phone, template, pdfParams, pdfUrl, pdfFilename)
                │   └─> axios.post(WhatsApp API)
                │       ├─> Send template with PDF document
                │       └─> RETURN message_id
                │
                ├─> sendMetaTemplateWithDocument(phone, template, excelParams, excelUrl, excelFilename)
                │   └─> axios.post(WhatsApp API)
                │       ├─> Send template with Excel document
                │       └─> RETURN message_id
                │
                └─> RETURN { success: true, ... }
```

---

## 🚀 SUMMARY

### **The Entire Process in One Sentence:**

Every month on the 1st at 2 AM IST, a cron job fetches all eligible users (premium/business/trial with WhatsApp enabled), generates PDF and Excel payroll reports for each of their active sites by aggregating employee data from MongoDB, uploads both files to AWS S3, and sends them via WhatsApp template messages with a 1.5-second delay between sends.

### **Key Points:**

1. **Automatic:** Runs without manual intervention
2. **Scheduled:** 1st of every month at 2 AM IST
3. **Eligible Users:** Premium, Business, or Trial plans
4. **Multi-Site:** Each user gets reports for all their sites
5. **Dual Format:** Both PDF (detailed) and Excel (editable)
6. **WhatsApp Delivery:** Uses Meta's template messaging
7. **Rate Limited:** 1.5s delay between sends
8. **Error Handling:** Graceful degradation with fallbacks
9. **Logged:** Complete audit trail in database
10. **Optimized:** MongoDB aggregation, S3 storage, efficient PDF/Excel generation

### **Processing Time:**

- **Single Report:** ~6-10 seconds
- **100 Sites:** ~10-15 minutes
- **500 Sites:** ~50-80 minutes

**The system is production-ready and handles ~80 sites in under 10 minutes!** ✅

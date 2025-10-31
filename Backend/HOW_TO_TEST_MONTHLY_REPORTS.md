# 📋 How to Test Monthly Report Generation

## Overview
This guide explains how to test the **NEW** monthly PDF generation with financial data (expenses, payments, profit/loss) using the existing test script.

---

## 🎯 What the Test Does

The `test-report-functions.js` script tests the complete monthly report flow:

1. ✅ Connects to MongoDB database
2. ✅ Generates **PDF report** with financial data (NEW features)
3. ✅ Generates **Excel report** with financial data (NEW features)
4. ✅ Uploads both files to AWS S3
5. ✅ Sends reports via WhatsApp Cloud API
6. ✅ Uses real user data and site data from database

---

## 📂 Test Script Location

```
Backend/test-report-functions.js
```

---

## 🔧 Prerequisites

### 1. Environment Variables (`.env` file)
Make sure your `.env` file has:

```env
# MongoDB
MONGO_URI=mongodb://your-connection-string

# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_BUCKET_NAME=your-bucket

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-token
WHATSAPP_REPORT_TEMPLATE_NAME=report_delivery
```

### 2. Test Data Configuration

The script uses this test configuration (edit in the file if needed):

```javascript
const testUser = {
    name: "Sunny Poddar",
    email: "sunnypoddar1919@gmail.com",
    phoneNumber: "+919354739451",  // WhatsApp number
    // ... (full user object from MongoDB)
};

const testSiteId = "68ee282b41993bb4a9485e06";  // Site ID to test
const testMonth = 10;  // October
const testYear = 2025;
```

### 3. Database Must Have:
- ✅ Site with ID `68ee282b41993bb4a9485e06` (or change to your site ID)
- ✅ Employees for that site in October 2025
- ✅ **Site expenses** for October 2025 (optional, will test NEW feature)
- ✅ **Site payments** for October 2025 (optional, will test NEW feature)

---

## 🚀 How to Run the Test

### **Option 1: Test Monthly Report Only** (Recommended)

From the `Backend` directory:

```bash
# PowerShell
cd Backend
node test-report-functions.js
```

This will:
- Show usage examples
- NOT run tests automatically (by default)

### **Option 2: Run Tests Programmatically**

Edit `test-report-functions.js` and uncomment line 222:

```javascript
// Uncomment the line below to run the tests
runAllTests();  // ← Remove the // comment
```

Then run:

```bash
node test-report-functions.js
```

### **Option 3: Test in Node REPL (Interactive)**

```bash
# Start Node REPL
node

# Then type these commands:
const { testMonthlyReport } = require('./test-report-functions');
testMonthlyReport();
```

### **Option 4: Use Node's `-e` Flag (One-liner)**

```bash
node -e "require('./test-report-functions').testMonthlyReport()"
```

---

## 📊 What Gets Tested

### **Monthly Report Test** (`testMonthlyReport()`)

**Steps:**
1. Connects to MongoDB
2. Calls `sendMonthlyReport(testUser, testSiteId, testMonth, testYear)`
3. Inside `sendMonthlyReport()`:
   - Calls `generateAndUploadReportPdf()` 
     - **Calls `generatePaymentReportPdf()` ← YOUR NEW CODE** 🎉
     - Fetches employees, **expenses**, **payments** ← NEW
     - Generates PDF with **financial summary**, **expenses**, **payments** ← NEW
     - Uploads to S3
   - Calls `generateAndUploadReportExcel()`
     - **Calls `generateFullPayrollReportWithRealData()` ← YOUR NEW CODE** 🎉
     - Fetches employees, **expenses**, **payments** ← NEW
     - Generates Excel with **5 sheets** (3 new sheets) ← NEW
     - Uploads to S3
   - Sends PDF via WhatsApp template
   - Sends Excel via WhatsApp template
4. Returns result with S3 URLs and delivery status
5. Closes database connection

---

## 📤 Expected Output

### **Console Output:**

```
🧪 Testing Monthly Report Function...

📅 Sending monthly report for Sunny Poddar - 10/2025 - Site: 68ee282b41993bb4a9485e06
📄 Generating PDF report...
🔍 Fetching employee data for site 68ee282b41993bb4a9485e06...
📊 Found 15 employees
💰 Found 12 expenses (Total: ₹45,000)                    ← NEW!
💵 Found 5 payments (Total: ₹2,50,000)                    ← NEW!
📈 Profit/Loss: +₹1,85,000 (Profit)                      ← NEW!
📄 Generating PDF with financial data...                  ← NEW!
✅ PDF generated successfully: /tmp/report-123.pdf
☁️  Uploading PDF to S3...
✅ PDF uploaded: https://your-bucket.s3.amazonaws.com/...

📊 Generating Excel report...
🔍 Fetching employee data...
📊 Found 15 employees
💰 Found 12 expenses (Total: ₹45,000)                    ← NEW!
💵 Found 5 payments (Total: ₹2,50,000)                    ← NEW!
📊 Creating Financial Summary Sheet...                    ← NEW!
📊 Creating Site Expenses Sheet...                        ← NEW!
📊 Creating Payments Received Sheet...                    ← NEW!
✅ Excel generated successfully
☁️  Uploading Excel to S3...
✅ Excel uploaded: https://your-bucket.s3.amazonaws.com/...

📤 Sending PDF report via WhatsApp template...
✅ PDF sent to +919354739451
📤 Sending Excel report via WhatsApp template...
✅ Excel sent to +919354739451

Monthly Report Result: {
  "success": true,
  "pdfUrl": "https://...",
  "excelUrl": "https://...",
  "deliveryStatus": {
    "pdf": "delivered",
    "excel": "delivered"
  }
}

==================================================
```

---

## 🧪 Customizing the Test

### **Change Test Site ID:**

Edit line 72 in `test-report-functions.js`:

```javascript
const testSiteId = "YOUR_SITE_ID_HERE";
```

### **Change Month/Year:**

Edit lines 73-74:

```javascript
const testMonth = 11;  // November
const testYear = 2025;
```

### **Change Test User:**

Replace the entire `testUser` object (lines 20-70) with your user data.

**Find user in MongoDB:**

```javascript
// In MongoDB Compass or mongosh:
db.users.findOne({ email: "your-email@example.com" })
```

---

## 🔍 Verifying NEW Features Work

### **1. Check Console Logs**

Look for these NEW log messages:

```
💰 Found X expenses (Total: ₹XX,XXX)
💵 Found X payments (Total: ₹XX,XXX)
📈 Profit/Loss: +₹XX,XXX (Profit/Loss)
📊 Creating Financial Summary Sheet...
📊 Creating Site Expenses Sheet...
📊 Creating Payments Received Sheet...
```

### **2. Download and Open PDF**

From S3 URL in output, download PDF and check:

- ✅ **Page 1**: Financial Summary (Money in/out, Profit/Loss) ← NEW
- ✅ **Page 2**: Employee table (existing)
- ✅ **Pages 3-N**: Site Expenses section with category breakdown ← NEW
- ✅ **Pages N+1**: Payments Received section ← NEW
- ✅ **Pages N+2-End**: Individual employee details (existing)

### **3. Download and Open Excel**

From S3 URL in output, download Excel and check:

- ✅ **Sheet 1**: Financial Summary with colored boxes ← NEW
- ✅ **Sheet 2**: Monthly Attendance (existing)
- ✅ **Sheet 3**: Employee Details (existing)
- ✅ **Sheet 4**: Site Expenses with category breakdown ← NEW
- ✅ **Sheet 5**: Payments Received ← NEW

---

## ❌ Troubleshooting

### **Issue 1: "Failed to connect to database"**

**Solution:** Check `MONGO_URI` in `.env` file

```bash
# Test MongoDB connection
node -e "require('mongoose').connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test').then(() => console.log('✅ Connected')).catch(e => console.log('❌ Error:', e.message))"
```

### **Issue 2: "Site not found"**

**Solution:** Change `testSiteId` to a valid site ID from your database

```javascript
// Find sites in MongoDB
db.sites.find({}).limit(5)
```

### **Issue 3: "No expenses found" / "No payments found"**

**This is OK!** The new code handles empty data gracefully:
- If no expenses → Skips expense section
- If no payments → Skips payment section
- Profit/Loss still calculated based on employee data

**To test with data:**

```javascript
// Add test expense in MongoDB
db.siteexpenses.insertOne({
    siteID: "68ee282b41993bb4a9485e06",
    value: 5000,
    category: "Materials",
    date: new Date("2025-10-15"),
    remark: "Test expense",
    createdBy: "test@example.com"
});

// Add test payment
db.sitepayments.insertOne({
    siteID: "68ee282b41993bb4a9485e06",
    value: 50000,
    date: new Date("2025-10-15"),
    remark: "Test payment",
    receivedBy: "test@example.com"
});
```

### **Issue 4: "WhatsApp delivery failed"**

**Solution:** Check WhatsApp API credentials:

```bash
# Test WhatsApp API access
curl -X GET "https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}" \
  -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}"
```

### **Issue 5: "S3 upload failed"**

**Solution:** Check AWS credentials and bucket permissions

---

## 🎯 Quick Test Checklist

Before running test:
- [ ] `.env` file has all required variables
- [ ] MongoDB is accessible
- [ ] Test site exists in database
- [ ] Test site has employees for test month
- [ ] (Optional) Test site has expenses for test month
- [ ] (Optional) Test site has payments for test month
- [ ] AWS S3 credentials are valid
- [ ] WhatsApp API credentials are valid

After running test:
- [ ] Console shows "✅ PDF generated successfully"
- [ ] Console shows "✅ Excel generated successfully"
- [ ] Console shows expense/payment counts (if data exists)
- [ ] Console shows "✅ PDF sent to..." 
- [ ] Console shows "✅ Excel sent to..."
- [ ] Result object has `success: true`
- [ ] Downloaded PDF has financial summary page
- [ ] Downloaded Excel has 5 sheets (not 2)

---

## 🔗 Related Files

**Test Scripts:**
- `Backend/test-report-functions.js` - Main test script
- `Backend/test-financial-data.js` - Tests data fetching only
- `Backend/test-cron-trigger.js` - Tests cron job trigger

**Production Code:**
- `Backend/scripts/whatsappReport.js` - Report orchestration
- `Backend/Routes/pdfReports.js` - PDF generation (NEW CODE)
- `Backend/Utils/generatePayrollWithRealData.js` - Excel generation (NEW CODE)

**Documentation:**
- `FINAL_IMPLEMENTATION_SUMMARY.md` - Complete feature summary
- `DATA_FLOW_VERIFICATION.md` - Schema verification

---

## 🎉 Success Criteria

✅ Test passes if:
1. Script runs without errors
2. PDF is generated and uploaded to S3
3. Excel is generated and uploaded to S3
4. Both files are sent via WhatsApp
5. Console logs show expense/payment data (if exists in database)
6. Downloaded files open correctly
7. PDF has 4-6 sections (depending on data)
8. Excel has 5 sheets

---

## 🚀 Next Steps After Successful Test

1. ✅ Test with different sites
2. ✅ Test with site having no expenses
3. ✅ Test with site having no payments
4. ✅ Test with multiple months
5. ✅ Verify calculations are accurate
6. ✅ Check WhatsApp message delivery
7. ✅ Monitor cron job on 1st of next month
8. ✅ Collect user feedback

---

## 📞 Need Help?

If test fails, check:
1. Console error messages
2. MongoDB connection
3. AWS S3 permissions
4. WhatsApp API credentials
5. Site data exists for test month

For detailed error logs, run with:

```bash
NODE_DEBUG=* node test-report-functions.js
```

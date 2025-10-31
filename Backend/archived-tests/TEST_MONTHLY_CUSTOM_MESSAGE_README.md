# 📋 Monthly Report Custom Message Test Script

## Overview

This test script sends monthly payroll reports via WhatsApp using **custom messages** instead of pre-approved templates. This is useful for testing within the 24-hour customer service window.

## File Location
```
Backend/test-monthly-report-custom-message.js
```

## Purpose

- **Test Environment**: Send reports to test phone numbers without template approval
- **24-Hour Window**: Works within WhatsApp's 24-hour customer service window
- **Custom Messages**: Full control over message content and formatting
- **Development**: Test report generation and delivery flow

## How It Works

### Message Flow
1. **Welcome Message** - Introduces the report with details
2. **PDF Document** - Sends detailed payroll report with caption
3. **Excel Document** - Sends Excel data file with caption  
4. **Closing Message** - Confirms delivery and offers support

### Technical Flow
```
Connect to MongoDB
    ↓
Generate PDF Report (pdfReports.js)
    ↓
Upload PDF to S3 (7-day presigned URL)
    ↓
Generate Excel Report (generatePayrollWithRealData.js)
    ↓
Upload Excel to S3 (7-day presigned URL)
    ↓
Send WhatsApp Messages:
  1. Welcome text message
  2. PDF document message
  3. Excel document message
  4. Closing text message
    ↓
Close Database Connection
```

## Usage

### Run the Test
```bash
cd Backend
node test-monthly-report-custom-message.js
```

### Expected Output
```
🧪 Testing Monthly Report with Custom Message (24-hour window)
======================================================================

✅ Connected to MongoDB

📋 Test Parameters:
   User: Sunny Poddar
   Phone: 919354739451
   Site ID: 68ee282b41993bb4a9485e06
   Period: 10/2025

🏗️  Fetching site details...
   Site Name: Test Site

📄 Step 1: Generating PDF Report...
   ✅ PDF generated: Test_Site_10_2025_2025-10-28_12-34-56.pdf
   📊 Employees: 15

☁️  Step 2: Uploading PDF to S3...
   📤 Uploading PDF to S3...
   ✅ PDF uploaded successfully
   ✅ PDF URL generated (expires in 7 days)

📊 Step 3: Generating Excel Report...
   ✅ Excel generated: Monthly_Report_Excel_10_2025_Sunny_Poddar.xlsx

☁️  Step 4: Uploading Excel to S3...
   📤 Uploading Excel to S3...
   ✅ Excel uploaded successfully
   ✅ Excel URL generated (expires in 7 days)

💬 Step 5: Sending welcome message...
   📤 Sending WhatsApp text message...
   ✅ Text message sent successfully
   ✅ Welcome message sent

📄 Step 6: Sending PDF Report...
   📤 Sending WhatsApp document: PDF...
   ✅ Document sent successfully
   ✅ PDF document sent

📊 Step 7: Sending Excel Report...
   📤 Sending WhatsApp document: Excel...
   ✅ Document sent successfully
   ✅ Excel document sent

💬 Step 8: Sending closing message...
   📤 Sending WhatsApp text message...
   ✅ Text message sent successfully
   ✅ Closing message sent

======================================================================
✅ TEST COMPLETED SUCCESSFULLY!

📋 Summary:
   User: Sunny Poddar
   Phone: 919354739451
   Period: October 2025
   Site: Test Site
   Employees: 15
   Messages Sent: 4 (2 text + 2 documents)
======================================================================

🔌 Database connection closed

✅ Test script completed successfully!
```

## Configuration

### Test Parameters (Editable)
```javascript
const testUser = {
    "_id": "685ea4b3d1d66ef1033d6782",
    "name": "Sunny Poddar",
    "email": "sunnypoddar1919@gmail.com",
    "phoneNumber": "+919354739451", // ⚠️ Change to your test number
    "calculationType": "default"
};

const testSiteId = "68ee282b41993bb4a9485e06"; // ⚠️ Change to your site ID
const testMonth = 10; // October
const testYear = 2025;
```

### Required Environment Variables
```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/finance-dashboard

# AWS S3 (for file uploads)
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name

# Meta WhatsApp API
META_ACCESS_TOKEN=your-whatsapp-access-token
META_PHONE_NUMBER_ID=your-phone-number-id
```

## Message Templates

### Welcome Message
```
Hello [Name]! 👋

Your monthly payroll report is ready for:
📅 Period: [Month Year]
🏗️  Site: [Site Name]
👥 Employees: [Count]

You will receive 2 files:
📄 PDF Report (detailed)
📊 Excel Report (data)

These reports are valid for 7 days.
```

### Document Captions

**PDF Caption:**
```
📄 Monthly Payment Report - PDF
Period: [Month Year]
Site: [Site Name]
```

**Excel Caption:**
```
📊 Monthly Payment Report - Excel
Period: [Month Year]
Site: [Site Name]
```

### Closing Message
```
✅ Reports sent successfully!

Both PDF and Excel reports have been delivered.

Need help? Reply to this message or contact support.

Thank you for using Site Haazri! 🙏
```

## Important Notes

### ⚠️ 24-Hour Window Limitation
- Custom messages only work within WhatsApp's 24-hour customer service window
- The user must have sent a message to your WhatsApp Business number within the last 24 hours
- Outside this window, you **MUST** use pre-approved message templates

### 🔐 Security
- S3 presigned URLs expire after 7 days
- Phone numbers are sanitized (+ prefix removed)
- All uploads are temporary and should be cleaned up

### 📊 Reports Generated
- **PDF Report**: Detailed payroll report with tables and financial summary
- **Excel Report**: Raw data in spreadsheet format for further analysis

## Differences from Template-Based Sending

| Feature | Custom Message (This Script) | Template-Based |
|---------|----------------------------|----------------|
| **Approval Required** | ❌ No | ✅ Yes (Meta approval) |
| **24hr Window** | ✅ Required | ❌ Not required |
| **Message Content** | 🎨 Fully customizable | 🔒 Fixed template |
| **Use Case** | Testing, customer service | Production, bulk sending |
| **Setup Time** | ⚡ Immediate | ⏳ 1-3 days approval |

## Troubleshooting

### Error: "Message failed to send"
**Cause**: Outside 24-hour window or invalid phone number
**Solution**: 
- Ensure user messaged your WhatsApp Business number within last 24 hours
- Verify phone number format (e.g., 919354739451, not +919354739451)

### Error: "No employees found"
**Cause**: No employee data for the specified month/year/site
**Solution**: 
- Check if employees exist in database for that period
- Verify siteId is correct
- Ensure month/year values are valid

### Error: "S3 upload failed"
**Cause**: Invalid AWS credentials or bucket name
**Solution**:
- Verify AWS environment variables in .env
- Check S3 bucket exists and has correct permissions
- Ensure IAM user has PutObject permission

### Error: "MongoDB connection failed"
**Cause**: Database not running or incorrect URI
**Solution**:
- Check MongoDB is running
- Verify MONGO_URI in .env file
- Test connection with mongosh

## Production vs Testing

### Use This Script For:
- ✅ Testing report generation locally
- ✅ Sending to test phone numbers (within 24hr window)
- ✅ Debugging report content and formatting
- ✅ Development and QA environments

### Use Template-Based Script For:
- ✅ Production automated reports
- ✅ Bulk sending to multiple users
- ✅ Scheduled/cron job reports
- ✅ Outside 24-hour window

## Related Files

- **Main Report Script**: `Backend/scripts/whatsappReport.js`
- **PDF Generator**: `Backend/Routes/pdfReports.js`
- **Excel Generator**: `Backend/Utils/generatePayrollWithRealData.js`
- **Template Test**: `Backend/test-report-functions.js`

## Support

For issues or questions:
1. Check console output for detailed error messages
2. Verify all environment variables are set
3. Ensure database connection is working
4. Check WhatsApp API credentials and phone number format

---

**Last Updated**: October 28, 2025
**Script Version**: 1.0
**Tested With**: Node.js v18+, MongoDB 6.0+

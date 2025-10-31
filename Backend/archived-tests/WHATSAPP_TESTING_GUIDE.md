# 📨 WhatsApp Report Testing - Quick Reference Guide

## Two Testing Approaches

### 1️⃣ Template-Based Testing (Production Mode)
**File**: `test-report-functions.js`

```bash
node test-report-functions.js
# OR
node -e "require('./test-report-functions').testMonthlyReport()"
```

**Uses**: Pre-approved WhatsApp message templates
**Best For**: Testing production flow with approved templates
**Requires**: Template approval from Meta (1-3 days)
**Window**: Works anytime (no 24hr restriction)

---

### 2️⃣ Custom Message Testing (Development Mode)
**File**: `test-monthly-report-custom-message.js`

```bash
node test-monthly-report-custom-message.js
```

**Uses**: Custom WhatsApp text and document messages
**Best For**: Quick testing without template approval
**Requires**: User message within last 24 hours
**Window**: Only within 24-hour customer service window

---

## Quick Comparison

| Feature | Template-Based | Custom Message |
|---------|----------------|----------------|
| **Approval Needed** | ✅ Yes (Meta) | ❌ No |
| **Setup Time** | ⏳ 1-3 days | ⚡ Immediate |
| **24hr Window** | ❌ Not required | ✅ Required |
| **Message Format** | 🔒 Fixed template | 🎨 Fully customizable |
| **Use Case** | Production | Testing/Development |
| **Bulk Send** | ✅ Yes | ❌ No (rate limited) |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## When to Use Each

### Use Template-Based (`test-report-functions.js`) When:
- ✅ Testing production deployment flow
- ✅ You have approved templates
- ✅ Testing scheduled/automated reports
- ✅ Testing bulk sends to multiple users
- ✅ Outside 24-hour window

### Use Custom Message (`test-monthly-report-custom-message.js`) When:
- ✅ Quick testing without template approval
- ✅ Template is pending approval
- ✅ Testing on development/staging
- ✅ Testing message content variations
- ✅ Within 24-hour window (user messaged you recently)

---

## Message Flow Comparison

### Template-Based Flow
```
Generate Reports
    ↓
Upload to S3
    ↓
Send Template Message with:
  - Document in header
  - Formatted body with parameters
    ↓
✅ Done (1 message per report)
```

### Custom Message Flow
```
Generate Reports
    ↓
Upload to S3
    ↓
Send Multiple Messages:
  1. Welcome text
  2. PDF document with caption
  3. Excel document with caption
  4. Closing text
    ↓
✅ Done (4 messages per report)
```

---

## Environment Variables Required

Both scripts need:
```bash
# Database
MONGO_URI=mongodb://localhost:27017/finance-dashboard

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=your-bucket

# WhatsApp API
META_ACCESS_TOKEN=EAAJ...
META_PHONE_NUMBER_ID=123456789
```

**Additional for Template-Based:**
```bash
WHATSAPP_REPORT_TEMPLATE_NAME=report_delivery
```

---

## Test User Configuration

Edit the test parameters in each file:

### Template-Based (test-report-functions.js)
```javascript
const testUser = {
    "_id": { "$oid": "685ea4b3d1d66ef1033d6782" },
    "name": "Sunny Poddar",
    "email": "sunnypoddar1919@gmail.com",
    "phoneNumber": "+919354739451"
};

const testSiteId = "68ee282b41993bb4a9485e06";
const testMonth = 10;
const testYear = 2025;
```

### Custom Message (test-monthly-report-custom-message.js)
```javascript
const testUser = {
    "_id": "685ea4b3d1d66ef1033d6782",
    "name": "Sunny Poddar",
    "email": "sunnypoddar1919@gmail.com",
    "phoneNumber": "+919354739451"
};

const testSiteId = "68ee282b41993bb4a9485e06";
const testMonth = 10;
const testYear = 2025;
```

---

## Common Issues & Solutions

### Issue: "Template not found"
**Script**: Template-Based
**Cause**: Template not approved or wrong name
**Solution**: Use Custom Message script while waiting for approval

### Issue: "Message failed - outside 24hr window"
**Script**: Custom Message
**Cause**: User hasn't messaged you within 24 hours
**Solution**: 
1. Have user send a message to your WhatsApp Business number
2. OR use Template-Based script

### Issue: "No employees found"
**Script**: Both
**Cause**: No data for specified period
**Solution**: 
- Check database for employee records
- Verify month/year/siteId parameters
- Use different test month with actual data

### Issue: "S3 upload failed"
**Script**: Both
**Cause**: AWS credentials or permissions issue
**Solution**:
- Verify AWS credentials in .env
- Check S3 bucket exists
- Ensure IAM user has PutObject permission

---

## Testing Workflow

### Development Phase
```
1. Start with Custom Message script
   ↓
2. Test report generation
   ↓
3. Verify WhatsApp delivery
   ↓
4. Debug any issues
```

### Pre-Production Phase
```
1. Submit templates for approval
   ↓
2. Wait 1-3 days for approval
   ↓
3. Test with Template-Based script
   ↓
4. Verify production flow
```

### Production Deployment
```
Use Template-Based in production:
- Automated/scheduled reports
- Bulk sends
- Reliable delivery
```

---

## Quick Commands

### Run Template-Based Test
```bash
cd Backend
node -e "require('./test-report-functions').testMonthlyReport()"
```

### Run Custom Message Test
```bash
cd Backend
node test-monthly-report-custom-message.js
```

### Run All Template Tests
```bash
cd Backend
node -e "require('./test-report-functions').runAllTests()"
```

---

## Output Comparison

### Template-Based Output (Compact)
```
🧪 Testing Monthly Report Function...
✅ Connected to MongoDB
📅 Sending monthly report...
📄 Generating PDF report...
📊 Generating Excel report...
📤 Sending via WhatsApp template...
✅ Monthly report sent successfully
```

### Custom Message Output (Detailed)
```
🧪 Testing Monthly Report with Custom Message...
✅ Connected to MongoDB
📄 Step 1: Generating PDF Report...
☁️  Step 2: Uploading PDF to S3...
📊 Step 3: Generating Excel Report...
☁️  Step 4: Uploading Excel to S3...
💬 Step 5: Sending welcome message...
📄 Step 6: Sending PDF Report...
📊 Step 7: Sending Excel Report...
💬 Step 8: Sending closing message...
✅ TEST COMPLETED SUCCESSFULLY!
```

---

## Best Practices

### For Testing
1. ✅ Always test with real data from database
2. ✅ Use test phone numbers first
3. ✅ Check WhatsApp received messages
4. ✅ Verify file downloads work
5. ✅ Test error handling

### For Production
1. ✅ Use Template-Based approach
2. ✅ Monitor delivery rates
3. ✅ Handle errors gracefully
4. ✅ Log all send attempts
5. ✅ Clean up S3 files after expiry

---

## Documentation Links

- **Template-Based**: `test-report-functions.js`
- **Custom Message**: `test-monthly-report-custom-message.js`
- **Custom Message Guide**: `TEST_MONTHLY_CUSTOM_MESSAGE_README.md`
- **Main Report Script**: `scripts/whatsappReport.js`
- **PDF Generator**: `Routes/pdfReports.js`

---

**Quick Decision Guide**:
- Need to test NOW? → Use **Custom Message** ⚡
- Have approved templates? → Use **Template-Based** ✅
- In production? → Use **Template-Based** 🚀
- Template pending approval? → Use **Custom Message** 🔧

---

*Last Updated: October 28, 2025*

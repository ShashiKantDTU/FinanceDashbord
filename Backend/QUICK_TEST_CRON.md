# 🚀 Quick Test Reference - Cron Jobs

## Option 1: Command Line Test (Easiest!)

```bash
# Test Weekly Report Week 1
node Backend/test-cron-trigger.js week1

# Test Weekly Report Week 2
node Backend/test-cron-trigger.js week2

# Test Monthly Report
node Backend/test-cron-trigger.js monthly

# Test ALL Weekly Reports at once
node Backend/test-cron-trigger.js all-weekly
```

**No authentication needed! Direct script execution.**

---

## Option 2: API Endpoints (For Production Testing)

**Base URL:** `http://localhost:3000/api/cron/trigger/`

**Authentication Required:** Bearer Token (admin only: +919354739451)

```bash
# Test Weekly Week 1
curl -X POST http://localhost:3000/api/cron/trigger/weekly-week1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Weekly Week 2
curl -X POST http://localhost:3000/api/cron/trigger/weekly-week2 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Monthly
curl -X POST http://localhost:3000/api/cron/trigger/monthly-report \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ What Gets Tested?

When you run either test:

1. **User Filtering** ✅
   - Only premium/business plan users (`plan: 'premium'` or `plan: 'business'`)
   - OR trial users (any plan with `isTrial: true`)
   - Must have `whatsAppReportsEnabled: true`
   - Only active sites (`isActive: true`)
   - Uses `whatsAppReportPhone` field for WhatsApp delivery

2. **Report Generation** ✅
   - PDF creation
   - Excel creation (5 sheets)

3. **File Upload** ✅
   - Upload to S3
   - Get signed URLs

4. **WhatsApp Delivery** ✅
   - Template message
   - Download links

5. **Logging** ✅
   - Success count
   - Failure count
   - Individual errors

---

## 📋 Quick Commands

```bash
# From project root directory

# Test Week 1 (Days 1-7)
node Backend/test-cron-trigger.js week1

# Test Week 2 (Days 8-14)
node Backend/test-cron-trigger.js week2

# Test Week 3 (Days 15-21)
node Backend/test-cron-trigger.js week3

# Test Week 4 (Days 22-28+)
node Backend/test-cron-trigger.js week4

# Test Monthly Report
node Backend/test-cron-trigger.js monthly

# Test ALL 4 Weekly Reports
node Backend/test-cron-trigger.js all-weekly
```

---

## 🔍 What to Look For

### Console Output:
```
✅ MongoDB connected
📊 Starting Weekly Report Week 1 (Days 1-7)...
📋 Found X eligible user-site pairs
✅ Sent report to [User Name] for site [Site ID]
✅ Weekly Report Week 1 completed: X sent, Y failed
```

### Expected Results:
- ✅ Reports sent to premium/trial users only
- ✅ WhatsApp messages received
- ✅ PDF & Excel files downloadable
- ✅ No errors in console

---

## 🐛 Common Issues

**"No eligible users found"**
→ No premium/business plan users OR trial users with active sites
→ Check: 
```javascript
db.users.find({ 
  $or: [
    { plan: { $in: ['premium', 'business'] } }, 
    { isTrial: true }
  ],
  whatsAppReportsEnabled: true
})
```

**"WhatsApp API error"**
→ Check WHATSAPP_ACCESS_TOKEN in .env
→ Verify template "report" exists

**"S3 upload failed"**
→ Check AWS credentials in .env
→ Verify bucket permissions

---

## 📚 Full Guides

- **Detailed Testing:** `Backend/CRON_TEST_GUIDE.md`
- **API Documentation:** `Backend/Routes/cronRoutes.js`
- **Filtering Logic:** `Backend/services/CRON_FILTERING_UPDATE.md`

---

**Recommended:** Start with `node Backend/test-cron-trigger.js week1`

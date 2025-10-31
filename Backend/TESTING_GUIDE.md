# 🧪 WhatsApp Report Testing - Unified Test Suite

## Overview

A **consolidated, maintainable testing framework** for all WhatsApp report functionality. This replaces multiple scattered test files with a single, organized system.

## 🎯 Problem Solved

**Before**: Multiple test files scattered everywhere
- `test-report-functions.js`
- `test-monthly-report-custom-message.js`
- `test-whatsapp-templates.js`
- Hard to maintain, duplicated code, confusing to use

**After**: Organized test suite with clean structure
- Single entry point (`run-tests.js`)
- Shared utilities (no duplication)
- Interactive CLI menu
- Easy to extend

## 📁 New Structure

```
Backend/
├── run-tests.js                          # ⭐ Main test runner (START HERE)
├── tests/
│   ├── monthly-report-tests.js           # Monthly report tests
│   ├── weekly-report-tests.js            # Weekly report tests
│   ├── template-validation-tests.js      # Template validation
│   └── utils/
│       ├── test-config.js                # ⚙️  Edit test parameters here
│       └── test-helpers.js               # Shared utilities
│
└── [OLD FILES - Can be archived/deleted]
    ├── test-report-functions.js          # ❌ Old
    ├── test-monthly-report-custom-message.js  # ❌ Old
    └── test-whatsapp-templates.js        # ❌ Old
```

## 🚀 Quick Start

### Interactive Mode (Recommended)

```bash
cd Backend
node run-tests.js
```

You'll see a beautiful menu:

```
╔════════════════════════════════════════════════════════════════╗
║          🧪 WhatsApp Report Test Suite                        ║
╚════════════════════════════════════════════════════════════════╝

📅 MONTHLY REPORTS
  1. Monthly Report - Template Mode (Production)
  2. Monthly Report - Custom Message Mode (24hr window)

📊 WEEKLY REPORTS
  3. Weekly Report - Template Mode (Production)
  4. Weekly Report - Custom Message Mode (24hr window)

🔍 VALIDATION & DIAGNOSTICS
  5. Validate WhatsApp Templates
  6. Test PDF Generation Only
  7. Test Excel Generation Only
  8. Test S3 Upload

⚙️  CONFIGURATION
  9. View Current Test Configuration
  10. Edit Test Parameters

🚀 BULK TESTS
  11. Run All Template Tests
  12. Run All Custom Message Tests
  13. Run Complete Test Suite

  0. Exit

Select an option (0-13):
```

### Command-Line Mode (Quick)

```bash
# List available commands
node run-tests.js --list

# Run specific tests
node run-tests.js --monthly          # Monthly template test
node run-tests.js --monthly-custom   # Monthly custom message
node run-tests.js --weekly           # Weekly template test
node run-tests.js --validate         # Validate templates
node run-tests.js --pdf              # Test PDF only
node run-tests.js --excel            # Test Excel only

# Run bulk tests
node run-tests.js --all-template     # All template tests
node run-tests.js --all-custom       # All custom tests
node run-tests.js --all              # Complete suite
```

## ⚙️  Configuration

### Edit Test Parameters

Open `tests/utils/test-config.js`:

```javascript
module.exports = {
    testUser: {
        name: "Your Name",
        phoneNumber: "+919876543210",  // ⚠️ EDIT THIS
        email: "your@email.com"
    },
    
    testSiteId: "YOUR_SITE_ID_HERE",   // ⚠️ EDIT THIS
    testMonth: 10,                      // October
    testYear: 2025,
    testWeek: 2,
    
    // ... other config
};
```

### Required Environment Variables

Already in your `.env`:
```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/finance-dashboard

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=your-bucket

# WhatsApp API
META_ACCESS_TOKEN=EAAJ...
META_PHONE_NUMBER_ID=123456789
WHATSAPP_REPORT_TEMPLATE_NAME=report_delivery
```

## 📊 Available Tests

### Monthly Reports

| Test | Mode | Command | Description |
|------|------|---------|-------------|
| **Template** | Production | `--monthly` | Uses approved WhatsApp template |
| **Custom** | Development | `--monthly-custom` | Custom messages (24hr window) |

### Weekly Reports

| Test | Mode | Command | Description |
|------|------|---------|-------------|
| **Template** | Production | `--weekly` | Uses approved WhatsApp template |
| **Custom** | Development | `--weekly-custom` | Custom messages (24hr window) |

### Validation & Diagnostics

| Test | Command | Description |
|------|---------|-------------|
| **Validate Templates** | `--validate` | Check env vars, API connection, templates |
| **PDF Generation** | `--pdf` | Test PDF generation only (no WhatsApp) |
| **Excel Generation** | `--excel` | Test Excel generation only (no WhatsApp) |
| **S3 Upload** | `--s3` | Test AWS S3 upload functionality |

### Bulk Tests

| Test | Command | Description |
|------|---------|-------------|
| **All Template Tests** | `--all-template` | Run all production template tests |
| **All Custom Tests** | `--all-custom` | Run all custom message tests |
| **Complete Suite** | `--all` | Run every available test |

## 🎨 Features

### ✅ Consolidated Code
- All test utilities in one place (`tests/utils/test-helpers.js`)
- No code duplication
- Shared database connection, S3 upload, WhatsApp sending

### ✅ Beautiful CLI
- Color-coded output (green ✅, red ❌, yellow ⚠️)
- Interactive menu system
- Clear progress indicators

### ✅ Organized Structure
- Tests grouped by category (monthly, weekly, validation)
- Easy to find and run specific tests
- Clear separation of concerns

### ✅ Easy to Extend
- Add new test in appropriate file
- Register in `run-tests.js` menu
- Shared utilities automatically available

### ✅ Production-Ready
- Proper error handling
- Database cleanup (always closes connection)
- Detailed logging and results

## 🔧 Adding New Tests

### Step 1: Add Test Function

Edit appropriate test file (e.g., `tests/monthly-report-tests.js`):

```javascript
async function testMyNewFeature() {
    try {
        console.log('🧪 Testing my new feature...');
        
        // Your test code here
        
        return {
            success: true,
            message: 'Test passed',
            details: { /* optional */ }
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

// Export it
module.exports = {
    // ... existing exports
    testMyNewFeature
};
```

### Step 2: Register in Menu

Edit `run-tests.js`:

```javascript
// Add to menu display
console.log('  14. My New Feature Test');

// Add to switch statement
case '14':
    console.log('🧪 Running: My New Feature Test');
    result = await monthlyTests.testMyNewFeature();
    break;
```

### Step 3: Add Command-Line Option

```javascript
const commandMap = {
    // ... existing commands
    '--my-test': '14'
};
```

Done! Your test is now accessible via menu and command-line.

## 📝 Test Result Format

All tests return standardized results:

```javascript
{
    success: true/false,           // Test outcome
    message: "Description",        // What happened
    details: {                     // Optional extra info
        key: value
    }
}
```

## 🎯 Migration Guide

### Migrating from Old Tests

**Old Way** (test-report-functions.js):
```javascript
const { testMonthlyReport } = require('./test-report-functions');
await testMonthlyReport();
```

**New Way** (unified suite):
```bash
node run-tests.js --monthly
# OR interactive menu option 1
```

### What to Do with Old Files

**Option 1: Archive** (Recommended)
```bash
mkdir Backend/old-tests
mv Backend/test-report-functions.js Backend/old-tests/
mv Backend/test-monthly-report-custom-message.js Backend/old-tests/
mv Backend/test-whatsapp-templates.js Backend/old-tests/
```

**Option 2: Delete** (If confident)
```bash
rm Backend/test-report-functions.js
rm Backend/test-monthly-report-custom-message.js
rm Backend/test-whatsapp-templates.js
```

## 🐛 Troubleshooting

### "Module not found" error
```bash
# Make sure you're in Backend directory
cd Backend
node run-tests.js
```

### Database connection fails
```bash
# Check MongoDB is running
mongosh --eval "db.runCommand({ ping: 1 })"

# Check MONGO_URI in .env
echo $MONGO_URI  # Linux/Mac
echo %MONGO_URI% # Windows
```

### WhatsApp message fails
```bash
# Validate your setup first
node run-tests.js --validate

# Check the detailed error output
# Most common issues:
# - Invalid phone number format
# - Template not approved
# - Outside 24-hour window (for custom messages)
```

### S3 upload fails
```bash
# Check AWS credentials
node run-tests.js --s3

# Verify environment variables
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - AWS_S3_BUCKET_NAME
```

## 📚 Examples

### Example 1: Quick Monthly Test
```bash
cd Backend
node run-tests.js --monthly
```

### Example 2: Test PDF Generation
```bash
node run-tests.js --pdf
```

### Example 3: Validate Setup
```bash
node run-tests.js --validate
```

### Example 4: Run All Tests
```bash
node run-tests.js --all
```

## 🔥 Benefits Over Old System

| Feature | Old System | New System |
|---------|-----------|------------|
| **Entry Points** | 3+ scattered files | 1 unified runner |
| **Code Duplication** | High | Zero |
| **Maintainability** | Difficult | Easy |
| **Documentation** | Scattered | Centralized |
| **User Experience** | Confusing | Clean CLI |
| **Extensibility** | Hard | Simple |
| **Error Handling** | Inconsistent | Standardized |
| **Test Organization** | None | By category |

## 🎓 Best Practices

1. **Always validate first**: Run `--validate` before other tests
2. **Edit config file**: Don't hardcode test parameters
3. **Use interactive mode**: For exploration and manual testing
4. **Use CLI mode**: For automation and CI/CD
5. **Check results**: Review the "details" section for insights

## 📞 Support

If you encounter issues:

1. Run validation: `node run-tests.js --validate`
2. Check test config: `tests/utils/test-config.js`
3. Verify environment variables in `.env`
4. Review console output for specific errors

---

**Version**: 1.0  
**Last Updated**: October 28, 2025  
**Maintains Compatibility**: All existing functionality preserved  
**Zero Breaking Changes**: Old scripts still work (but deprecated)

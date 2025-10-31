# 📁 Test Suite Organization

Complete overview of all test files organized by category.

## Directory Structure

```
tests/
├── utils/                          # Shared utilities
│   ├── test-config.js             # Test configuration
│   └── test-helpers.js            # Common functions
│
├── monthly-report-tests.js         # Monthly report tests
├── weekly-report-tests.js          # Weekly report tests
├── template-validation-tests.js    # Template validation
│
├── system/                         # System functionality tests
│   ├── test-api-tracking.js       # API rate limiting
│   ├── test-config-update.js      # Config file updates
│   └── test-cron-trigger.js       # Cron job testing
│
├── integrations/                   # External service tests
│   ├── test-media-expiry.js       # WhatsApp media expiry
│   └── test-smart-retry.js        # Retry mechanism
│
└── data/                           # Data & report tests
    ├── test-financial-data.js      # Financial data fetching
    └── test-pdf-generation.js      # PDF generation
```

## Test Categories

### 🚀 Main Tests (Root Level)
**Integrated into `run-tests.js` menu**

| File | Purpose | Command | Status |
|------|---------|---------|--------|
| `monthly-report-tests.js` | Monthly report testing | `--monthly` / `--monthly-custom` | ✅ Integrated |
| `weekly-report-tests.js` | Weekly report testing | `--weekly` / `--weekly-custom` | ✅ Integrated |
| `template-validation-tests.js` | Template validation | `--validate` | ✅ Integrated |

### ⚙️ System Tests (`tests/system/`)
**Core system functionality**

| File | Purpose | Direct Command | Integration |
|------|---------|----------------|-------------|
| `test-api-tracking.js` | Redis API tracking | `node tests/system/test-api-tracking.js` | 📝 Pending |
| `test-config-update.js` | Config file updates | `node tests/system/test-config-update.js` | 📝 Pending |
| `test-cron-trigger.js` | Manual cron trigger | `node tests/system/test-cron-trigger.js [job]` | 📝 Pending |

### 🔌 Integration Tests (`tests/integrations/`)
**External service integrations**

| File | Purpose | Direct Command | Integration |
|------|---------|----------------|-------------|
| `test-media-expiry.js` | WhatsApp media expiry | `node tests/integrations/test-media-expiry.js` | 📝 Pending |
| `test-smart-retry.js` | Smart retry mechanism | `node tests/integrations/test-smart-retry.js` | 📝 Pending |

### 📊 Data Tests (`tests/data/`)
**Data fetching and PDF generation**

| File | Purpose | Direct Command | Integration |
|------|---------|----------------|-------------|
| `test-financial-data.js` | Financial data queries | `node tests/data/test-financial-data.js` | 📝 Pending |
| `test-pdf-generation.js` | PDF generation | `node tests/data/test-pdf-generation.js` | ✅ Option 6 |

### 🛠️ Utilities (`tests/utils/`)
**Shared code and configuration**

| File | Purpose | Edit |
|------|---------|------|
| `test-config.js` | Test parameters | ✏️ Edit test values here |
| `test-helpers.js` | Shared utilities | 🔒 Do not edit |

## Quick Reference

### Run Main Test Suite
```bash
# Interactive menu (recommended)
node run-tests.js

# Specific test via command-line
node run-tests.js --monthly
node run-tests.js --validate
node run-tests.js --pdf
```

### Run System Tests
```bash
# API tracking
node tests/system/test-api-tracking.js

# Config updates
node tests/system/test-config-update.js

# Cron trigger (with job name)
node tests/system/test-cron-trigger.js monthly
node tests/system/test-cron-trigger.js week1
```

### Run Integration Tests
```bash
# Media expiry check
node tests/integrations/test-media-expiry.js

# Smart retry test
node tests/integrations/test-smart-retry.js
```

### Run Data Tests
```bash
# Financial data
node tests/data/test-financial-data.js

# PDF generation
node tests/data/test-pdf-generation.js
# OR use main menu
node run-tests.js
# Select option 6
```

## Test Status

### ✅ Fully Integrated (8 tests)
- Monthly Report - Template
- Monthly Report - Custom Message
- Weekly Report - Template
- Weekly Report - Custom Message
- Template Validation
- PDF Generation Only
- Excel Generation Only
- S3 Upload Test

### 📝 Pending Integration (5 tests)
- API Tracking Test
- Config Update Test
- Cron Trigger Test
- Media Expiry Test
- Smart Retry Test
- Financial Data Test

## Configuration

### Edit Test Parameters
```bash
# Open test config file
nano tests/utils/test-config.js

# Edit these values:
testUser: { phoneNumber, name, email }
testSiteId: "your_site_id"
testMonth: 10
testYear: 2025
```

### View Current Config
```bash
node run-tests.js
# Select option 9: View Current Test Configuration
```

## Dependencies by Test

### MongoDB Required
- ✅ Monthly/Weekly reports
- ✅ PDF generation
- ✅ Financial data
- ✅ Cron trigger

### Redis Required
- ✅ API tracking

### WhatsApp API Required
- ✅ Template validation
- ✅ Monthly/Weekly reports (send)
- ✅ Media expiry
- ✅ Smart retry

### AWS S3 Required
- ✅ Monthly/Weekly reports (upload)
- ✅ S3 upload test

## Adding Tests to Main Menu

### Step 1: Create/Move Test File
```bash
# Place in appropriate category
tests/system/your-test.js
tests/integrations/your-test.js
tests/data/your-test.js
```

### Step 2: Export Test Function
```javascript
async function testYourFeature() {
    // Test code
    return { success: true, message: 'Passed' };
}

module.exports = {
    testYourFeature
};
```

### Step 3: Add to run-tests.js
```javascript
// Import
const yourTests = require('./tests/system/your-test');

// Add menu item
console.log('  14. Your Feature Test');

// Add case handler
case '14':
    result = await yourTests.testYourFeature();
    break;
```

## Best Practices

### 1. Use Appropriate Category
- **System**: Core functionality, cron jobs, configs
- **Integrations**: External APIs, third-party services
- **Data**: Database queries, report generation

### 2. Follow Naming Convention
```bash
test-feature-name.js          # Descriptive kebab-case
```

### 3. Return Standardized Results
```javascript
return {
    success: true/false,
    message: "Description",
    details: { /* optional */ }
};
```

### 4. Add Documentation
Create README.md in test directory explaining:
- What it tests
- How to run it
- Required dependencies
- Expected output

### 5. Use Shared Utilities
```javascript
const { 
    connectToDatabase,
    uploadToS3,
    sendWhatsAppText
} = require('./utils/test-helpers');
```

## Troubleshooting

### Test Not Found
```bash
# Check file exists
ls tests/system/test-name.js

# Check exports
node -e "console.log(require('./tests/system/test-name'))"
```

### Database Connection Fails
```bash
# Check MongoDB running
mongosh --eval "db.runCommand({ ping: 1 })"

# Check MONGO_URI
echo $MONGO_URI
```

### Redis Connection Fails
```bash
# Check Redis running
redis-cli ping

# Should return: PONG
```

## Documentation

- **Main Guide**: `TESTING_GUIDE.md` - Complete testing documentation
- **Migration**: `MIGRATION_CHECKLIST.md` - Migration from old tests
- **System Tests**: `tests/system/README.md`
- **Integration Tests**: `tests/integrations/README.md`
- **Data Tests**: `tests/data/README.md`

## Statistics

- **Total Test Files**: 13
- **Integrated Tests**: 8
- **Pending Integration**: 5
- **Test Categories**: 4
- **Utility Files**: 2

## Next Steps

1. **Try the test suite**: `node run-tests.js`
2. **Update config**: Edit `tests/utils/test-config.js`
3. **Run a test**: Select from menu or use CLI
4. **Explore categories**: Check README in each directory
5. **Add your tests**: Follow integration guide above

---

**Last Updated**: October 28, 2025  
**Maintained By**: Development Team  
**Status**: ✅ Organized & Ready

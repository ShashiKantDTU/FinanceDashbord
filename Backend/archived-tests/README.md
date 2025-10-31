# Archived Test Files

**Date Archived**: October 28, 2025

## Files in This Directory

These test files have been **replaced by the unified test system** and are archived for reference only.

### Replaced Files

1. **test-report-functions.js**
   - **Replaced by**: `run-tests.js` with `tests/monthly-report-tests.js` and `tests/weekly-report-tests.js`
   - **Old usage**: `node test-report-functions.js`
   - **New usage**: `node run-tests.js --monthly` or `node run-tests.js --weekly`

2. **test-monthly-report-custom-message.js**
   - **Replaced by**: `run-tests.js` with `tests/monthly-report-tests.js`
   - **Old usage**: `node test-monthly-report-custom-message.js`
   - **New usage**: `node run-tests.js --monthly-custom`

3. **test-whatsapp-templates.js**
   - **Replaced by**: `run-tests.js` with `tests/template-validation-tests.js`
   - **Old usage**: `node test-whatsapp-templates.js`
   - **New usage**: `node run-tests.js --validate`

## Why These Were Archived

- ❌ **Code duplication**: Each file had its own database connection, S3 upload, and WhatsApp sending logic
- ❌ **Hard to maintain**: Changes needed to be replicated across multiple files
- ❌ **Confusing**: Multiple entry points made it unclear which test to run
- ❌ **No organization**: Tests scattered across multiple files

## New Unified System

All testing is now consolidated in:

```
Backend/
├── run-tests.js                    # Main entry point
└── tests/
    ├── monthly-report-tests.js     # Monthly tests
    ├── weekly-report-tests.js      # Weekly tests
    ├── template-validation-tests.js # Template validation
    └── utils/
        ├── test-config.js          # Configuration
        └── test-helpers.js         # Shared utilities
```

### Benefits

- ✅ **Single entry point**: `node run-tests.js`
- ✅ **No duplication**: All shared code in utilities
- ✅ **Interactive CLI**: Beautiful menu interface
- ✅ **Well organized**: Tests grouped by category
- ✅ **Easy to extend**: Clear patterns for adding tests

## Migration Guide

See `../MIGRATION_CHECKLIST.md` for complete migration instructions.

## Can These Be Deleted?

**Yes**, once you've confirmed the new system works correctly. These files are kept as:
- Reference during transition period
- Backup in case of issues
- Historical record of old implementation

**To delete permanently**:
```bash
# After confirming new system works
rm -rf archived-tests/
```

## Documentation

- **Main Guide**: `../TESTING_GUIDE.md`
- **Migration**: `../MIGRATION_CHECKLIST.md`
- **Quick Start**: Run `node ../run-tests.js`

---

**Note**: These archived files are **no longer maintained** and should not be used for new development.

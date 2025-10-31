# Data & Report Tests

Tests for data fetching, PDF generation, and financial calculations.

## Files in This Directory

### test-financial-data.js
**Purpose**: Verify financial data fetching functions  
**What it tests**:
- Site expense data fetching
- Site payment data fetching
- Employee data retrieval
- Date range filtering
- Data aggregation and calculations
- MongoDB queries

**Usage**:
```bash
node tests/data/test-financial-data.js
```

**What it validates**:
- Correct date range for month/year
- Proper data aggregation
- Category-wise expense breakdown
- Payment totals
- Employee wage calculations

**Test Coverage**:
- `fetchSiteExpenses()` - Get all expenses for a month
- `fetchSitePayments()` - Get all payments for a month
- `fetchEmployeeData()` - Get employee payroll data
- Date filtering accuracy
- Currency calculations

**Dependencies**: MongoDB with sample data

---

### test-pdf-generation.js
**Purpose**: Test complete PDF report generation  
**What it tests**:
- PDF document creation
- Report header generation
- Financial summary tables
- Employee details rendering
- Page layout and formatting
- File generation and saving

**Usage**:
```bash
node tests/data/test-pdf-generation.js
```

**What it generates**:
- Complete monthly payment report PDF
- Saves to `temp/` directory
- Includes all report sections:
  - Header with site info
  - Financial summary
  - Employee table
  - Expense breakdown
  - Payment list
  - Individual employee details

**Output**:
```
📄 Testing PDF Generation...
   Site: Test Site Name
   Month: October 2025
   Employees: 15
   
✅ PDF generated: Monthly_Report_10_2025.pdf
   Size: 234 KB
   Location: temp/Monthly_Report_10_2025.pdf
```

**Configuration**:
Uses test config from `tests/utils/test-config.js`

**Note**: This is similar to the PDF test in the main test suite but can be run standalone for debugging specific PDF issues.

---

## Running Data Tests

### Run Individual Test
```bash
# Financial data fetching
node tests/data/test-financial-data.js

# PDF generation
node tests/data/test-pdf-generation.js
```

### Integrated with Main Test Runner
```bash
# Already available in main menu
node run-tests.js
# Select option 6: Test PDF Generation Only
```

## Prerequisites

### MongoDB
- Active MongoDB connection
- Sample data in database:
  - Sites
  - Employees
  - Expenses
  - Payments

### Environment Variables
```bash
MONGO_URI=mongodb://localhost:27017/finance-dashboard
```

## When to Run These Tests

### Financial Data Test
- After modifying data fetching queries
- When adding new financial calculations
- Before deploying changes to report logic
- When troubleshooting incorrect totals

### PDF Generation Test
- After updating PDF layout
- When fixing rendering issues
- Before production deployment
- When adding new report sections

## Test Data Requirements

For meaningful tests, your database should have:

**Sites**:
```javascript
{
  _id: "valid_site_id",
  sitename: "Test Site",
  isActive: true
}
```

**Employees** (for test month/year):
```javascript
{
  siteID: "valid_site_id",
  month: 10,
  year: 2025,
  name: "Employee Name",
  rate: 500,
  attendance: [...],
  // ... other fields
}
```

**Expenses**:
```javascript
{
  siteID: "valid_site_id",
  date: "2025-10-15",
  amount: 5000,
  category: "Materials",
  // ... other fields
}
```

**Payments**:
```javascript
{
  siteID: "valid_site_id",
  date: "2025-10-20",
  amount: 50000,
  // ... other fields
}
```

## Common Issues

### No Data Found
**Symptom**: "No employees found" or "No financial data"  
**Solution**:
- Check database connection
- Verify site ID exists
- Ensure data exists for test month/year
- Update test config with valid site ID

### PDF Generation Fails
**Symptom**: "Cannot generate PDF" error  
**Solution**:
- Check if `temp/` directory exists
- Verify PDFKit dependencies installed
- Ensure sufficient disk space
- Check file permissions

### Incorrect Calculations
**Symptom**: Totals don't match expected values  
**Solution**:
- Verify date range calculations
- Check MongoDB query filters
- Review wage calculation logic
- Ensure PRECISION constant is used

## Debugging Tips

### Enable Verbose Logging
Most tests have console.log statements. To see detailed output:
```bash
node tests/data/test-financial-data.js
```

### Check Generated PDFs
PDFs are saved to `Backend/temp/` directory:
```bash
ls Backend/temp/
# Open the generated PDF to verify content
```

### Verify Data in Database
```bash
mongosh
use finance-dashboard
db.employees.find({ siteID: ObjectId("your_site_id"), month: 10, year: 2025 })
db.siteExpenses.find({ siteID: ObjectId("your_site_id") })
```

## Integration with Main Test Suite

Both tests are already integrated:

- **PDF Generation**: Option 6 in main menu
- **Financial Data**: Can be added as Option 16

To add Financial Data test to main menu:
```javascript
// In run-tests.js
case '16':
    console.log('📊 Running: Financial Data Test');
    result = await require('./tests/data/test-financial-data')();
    break;
```

## Best Practices

1. **Use Test Data**: Don't test with production site IDs
2. **Clean Temp Files**: Regularly clean `temp/` directory
3. **Verify Calculations**: Always check totals manually
4. **Test Edge Cases**: Empty data, single employee, large datasets
5. **Monitor Performance**: Note PDF generation time for large reports

## Related Documentation

- `Backend/PDFKIT_COMPLETE_GUIDE.md` - PDF generation guide
- `Backend/PDF_CRITICAL_FIXES_COMPLETED.md` - Recent PDF improvements
- `Backend/Routes/pdfReports.js` - Main PDF generation code
- `Backend/Utils/Jobs.js` - Financial calculation logic

# PDF Reports API Documentation

## Endpoint: Generate Employee Payment Report

**URL:** `POST /api/reports/generate-payment-report`

**Description:** Generates a comprehensive PDF report containing employee payment information with individual employee details.

### Authentication
- Requires valid JWT token
- User must have access to the specified site

### Request Body

```json
{
  "siteID": "64b0f4c1a8e6f5d2c9a1b2c3",
  "month": 8,
  "year": 2025
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `siteID` | String | Yes | MongoDB ObjectId of the site |
| `month` | Number | Yes | Month number (1-12) |
| `year` | Number | Yes | Year (2020-2030) |

### Response

**Success (200):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="Employee_Payment_Report_[SiteName]_[Month]_[Year]_[Date].pdf"`
- Body: PDF file binary data

**Error Responses:**

```json
// 400 - Bad Request
{
  "success": false,
  "error": "siteID, month, and year are required."
}

// 403 - Forbidden
{
  "success": false,
  "error": "Forbidden. You do not have access to this site."
}

// 404 - Not Found
{
  "success": false,
  "error": "No employees found for 8/2025 at site Main Office"
}

// 500 - Internal Server Error
{
  "success": false,
  "error": "Error generating PDF report.",
  "message": "Detailed error message"
}
```

### Access Control

#### Supervisor Access
- Can only generate reports for their assigned site
- Supervisor's site is automatically validated against the requested siteID

#### Admin Access
- Can generate reports for any site they have access to
- Site access is validated against the admin's permitted sites

### PDF Report Contents

#### 1. Summary Table
- Employee ID, Name, Present Days, Overtime Hours
- Daily Rate, Gross Payment, Advances, Bonus
- Previous Balance, Final Payment
- Color-coded financial data for easy reading

#### 2. Individual Employee Details
For each employee, the report includes:

- **Basic Information:**
  - Daily rate, present days, overtime hours
  - Total wage calculation
  - Final payment amount

- **Advances/Payouts:**
  - Date, amount, and remark for each advance
  - Chronological listing of all payouts

- **Additional Payments/Bonuses:**
  - Date, amount, and remark for each bonus
  - All additional payments with full details

- **Carry Forward Information:**
  - Previous month balance
  - Carry forward date and remarks

- **Attendance Summary:**
  - Total attendance entries count

### Example Usage

#### JavaScript/Frontend
```javascript
const response = await fetch('/api/reports/generate-payment-report', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    siteID: '64b0f4c1a8e6f5d2c9a1b2c3',
    month: 8,
    year: 2025
  })
});

if (response.ok) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Employee_Payment_Report.pdf';
  a.click();
}
```

#### cURL
```bash
curl -X POST "http://localhost:5000/api/reports/generate-payment-report" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "siteID": "64b0f4c1a8e6f5d2c9a1b2c3",
    "month": 8,
    "year": 2025
  }' \
  --output employee_report.pdf
```

### Performance Notes

- The endpoint uses the optimized aggregation pipeline for fast data retrieval
- PDF generation is done in-memory for better performance
- Temporary files are automatically cleaned up after response
- Large datasets (100+ employees) may take 5-10 seconds to generate

### Data Sources

- **Employee Data:** Uses the same optimized aggregation as `/allemployees-optimized`
- **Site Information:** Fetched from Site collection
- **Calculations:** Handles both 'default' and 'special' calculation types
- **Currency:** Formatted as "Rs. XX.XX"

### File Naming Convention

Generated PDF files follow this naming pattern:
```
Employee_Payment_Report_[SiteName]_[Month]_[Year]_[Date].pdf
```

Example: `Employee_Payment_Report_Main_Office_8_2025_2025-08-23.pdf`

### Error Handling

The endpoint includes comprehensive error handling for:
- Invalid site access permissions
- Missing or invalid parameters
- Database connection issues
- PDF generation failures
- File system errors

All errors are logged on the server for debugging purposes.

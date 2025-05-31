# PowerShell Test Commands for Employee Import Endpoints
# Replace the placeholder values with actual data from your system

# Configuration
$BASE_URL = "http://localhost:5000/api"
$JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MzM4NmMyM2YzZTI2OTY2ZDU0NWNmYiIsImVtYWlsIjoibWVAMTIzLmNvbSIsIm5hbWUiOiJtZSIsImlhdCI6MTc0ODYyMDkwMywiZXhwIjoxNzQ4NzA3MzAzfQ.WDxjBbGY1Og6WdsSUZfuPQB82wDjOTTl_FPgOwruCp4"  # Replace with actual JWT token
$SITE_ID = "6833ff004bd307e45abbfb41"  # Replace with actual site ID

# Test 1: Get available employees for import
Write-Host "Test 1: Getting available employees for import..." -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $JWT_TOKEN"
    "Content-Type" = "application/json"
}

$params = @{
    sourceMonth = 11
    sourceYear = 2024
    targetMonth = 12
    targetYear = 2024
    siteID = $SITE_ID
}

$query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
$availableUrl = "$BASE_URL/employee/availableforimport?$query"

try {
    $response = Invoke-RestMethod -Uri $availableUrl -Method GET -Headers $headers
    Write-Host "Available employees response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error getting available employees: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "="*50 + "`n"

# Test 2: Import all employees from previous month
Write-Host "Test 2: Importing all employees from previous month..." -ForegroundColor Green

$importAllBody = @{
    sourceMonth = 11
    sourceYear = 2024
    targetMonth = 12
    targetYear = 2024
    siteID = $SITE_ID
    preserveCarryForward = $true
    preserveAdditionalPays = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/employee/importemployees" -Method POST -Headers $headers -Body $importAllBody
    Write-Host "Import all employees response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error importing all employees: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorContent = $reader.ReadToEnd()
        Write-Host "Error details: $errorContent" -ForegroundColor Red
    }
}

Write-Host "`n" + "="*50 + "`n"

# Test 3: Import specific employees
Write-Host "Test 3: Importing specific employees..." -ForegroundColor Green

$importSpecificBody = @{
    sourceMonth = 11
    sourceYear = 2024
    targetMonth = 12
    targetYear = 2024
    siteID = $SITE_ID
    employeeIds = @("EMP001", "EMP002", "EMP003")  # Replace with actual employee IDs
    preserveCarryForward = $true
    preserveAdditionalPays = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/employee/importemployees" -Method POST -Headers $headers -Body $importSpecificBody
    Write-Host "Import specific employees response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error importing specific employees: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorContent = $reader.ReadToEnd()
        Write-Host "Error details: $errorContent" -ForegroundColor Red
    }
}

Write-Host "`n" + "="*50 + "`n"

# Test 4: Error handling example (invalid month)
Write-Host "Test 4: Testing error handling with invalid data..." -ForegroundColor Green

$invalidBody = @{
    sourceMonth = 13  # Invalid month
    sourceYear = 2024
    targetMonth = 12
    targetYear = 2024
    siteID = $SITE_ID
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/employee/importemployees" -Method POST -Headers $headers -Body $invalidBody
    Write-Host "Unexpected success with invalid data:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Expected error with invalid data: $($_.Exception.Message)" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorContent = $reader.ReadToEnd()
        Write-Host "Error details: $errorContent" -ForegroundColor Yellow
    }
}

Write-Host "`n" + "="*50 + "`n"

# Instructions
Write-Host "Instructions:" -ForegroundColor Cyan
Write-Host "1. Replace `$JWT_TOKEN with your actual JWT token" -ForegroundColor White
Write-Host "2. Replace `$SITE_ID with your actual site ObjectId" -ForegroundColor White
Write-Host "3. Update employee IDs in Test 3 with actual employee IDs" -ForegroundColor White
Write-Host "4. Make sure your backend server is running on localhost:5000" -ForegroundColor White
Write-Host "5. Run each test section individually if needed" -ForegroundColor White

# Alternative using curl (if preferred)
Write-Host "`nAlternative using curl:" -ForegroundColor Magenta
Write-Host @"
# Get available employees
curl -X GET "$BASE_URL/employee/availableforimport?sourceMonth=11&sourceYear=2024&targetMonth=12&targetYear=2024&siteID=$SITE_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"

# Import all employees
curl -X POST "$BASE_URL/employee/importemployees" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceMonth": 11,
    "sourceYear": 2024,
    "targetMonth": 12,
    "targetYear": 2024,
    "siteID": "$SITE_ID",
    "preserveCarryForward": true,
    "preserveAdditionalPays": false
  }'
"@ -ForegroundColor Gray

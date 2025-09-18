# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Backend (Node.js/Express)
```bash
# Start development server with auto-reload
cd Backend
npm run dev

# Start production server
npm start

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, etc.
```

### Frontend (React + Vite)
```bash
# Start development server
cd Frontend
npm run dev

# Start dev server accessible from network
npm run dev:network

# Build for production
npm run build

# Build for development
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview

# Preview accessible from network
npm run preview:network

# Install dependencies
npm install
```

### Data Utilities
```bash
# Insert dummy employee data (for testing)
cd InssetDummyData
npm install
node insertDummyData.js
```

## Architecture Overview

This is a comprehensive employee payroll management system with sophisticated change tracking and automated calculation capabilities.

### High-Level Structure

**Backend (Node.js/Express)**
- `server.js` - Main server with MongoDB, Redis, email service, and cron job initialization
- `Routes/` - API endpoints for employees, change tracking, authentication, reports
- `models/` - MongoDB schemas (Employee, ChangeTracking, Site, User)
- `Utils/` - Core business logic (Jobs.js for calculations, ChangeTracker.js)
- `Middleware/` - Authentication, usage tracking
- `services/` - Cron jobs for subscription management

**Frontend (React + Vite)**
- `src/App.jsx` - Main routing with protected routes and auth context
- `Pages/` - Main application pages (Home, SitePage, Attendance, Payments, ChangeTracking)
- `components/` - Reusable UI components including notification system

### Key Architectural Patterns

#### Employee Data Flow & Calculations
The system implements a sophisticated calculation engine with automatic corrections:

1. **Core Calculation Logic** (`Utils/Jobs.js`)
   - Processes attendance strings ("P", "P8", "A", "P4") into days and overtime
   - Calculates wages: `rate × (totalDays + overtimeDays)`
   - Computes closing balance: `totalWage - totalPayouts + additionalPays + carryForward`
   - Handles carry-forward balances between months

2. **Change Tracking System** (`Utils/ChangeTracker.js`)
   - Deep comparison of employee data changes
   - Tracks ADDED, MODIFIED, REMOVED field changes with full audit trail
   - Serial number generation for frontend tracking
   - Optimized to track only current month, cascade-mark future months

3. **Automatic Correction Process**
   - `FetchlatestData()` triggers recalculation if `recalculationneeded = true`
   - Processes months chronologically to maintain carry-forward integrity
   - Updates carry-forward values from previous month's closing balance

#### Real-Time Notification System
Implemented in `components/NotificationIcon.jsx` and `ChangeTrackingPanel.jsx`:
- Real-time badge count showing changes in last 24 hours
- Sliding panel with search and filtering capabilities
- Auto-refresh every 30 seconds
- Multiple navigation entry points (notification icon → quick view → detailed analysis)

#### Cron Job System
Automated subscription and user management:
- Handles expired cancelled users and grace period management
- Final verification system prevents race conditions with webhook delays
- Makes live API calls to Google Play Billing before downgrading users
- Comprehensive logging and error handling

### Database Schema Patterns

#### Employee Schema (`models/EmployeeSchema.js`)
- Compound unique index: `empid + month + year`
- Calculated fields: `closing_balance`, `wage`
- Arrays for attendance, payouts, additional payments
- `recalculationneeded` flag for cascade corrections

#### Change Tracking Schema
- Auto-increment serial numbers for frontend display
- Detailed change arrays with field paths and old/new values
- Summary statistics per change record

### API Architecture

#### Employee Management APIs
- `GET /employee/employeewithpendingpayouts` - Returns employees with closing_balance > 0
- `GET /employee/allemployees` - Administrative view of all employees
- `POST /employee/addemployeesimple` - Create new employee with auto-ID assignment

#### Change Tracking APIs
- `PUT /change-tracking/employee/:employeeID/update` - Update employee with optimized tracking
- `GET /change-tracking/employee/:employeeID` - Paginated change history
- `PUT /change-tracking/attendance/updateattendance` - Bulk attendance update (all-or-nothing)

### Development Considerations

#### Environment Setup
- MongoDB connection required
- Redis for OTP/caching features
- Email service configuration for password resets
- JWT secret for authentication
- CORS configured for multiple frontend URLs

#### Attendance System
The system uses string-based attendance tracking:
- `"P"` = Present (1 day)
- `"P4"` = Present with 4 hours (0.5 days)
- `"P8"` = Present with 8 hours overtime (1.5 days)
- `"A"` = Absent (0 days)

#### Change Tracking Implementation
When updating employee data:
1. Track changes only for the month being edited
2. Mark future months with `recalculationneeded = true`
3. Trigger immediate recalculation for current month
4. Use `findDeepDifferences()` for accurate change detection

#### Frontend State Management
- AuthContext for user authentication
- Protected routes throughout application
- Toast notifications for user feedback
- Real-time notification system with badge counts

### Testing and Debugging

#### Manual API Testing
```bash
# Test employee endpoints
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/employee/employeewithpendingpayouts?month=5&year=2025&siteID=SITE001"

# Test change tracking
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"siteID":"SITE001","month":5,"year":2025,"updateData":{"rate":550},"correctedBy":"test_user"}' \
  http://localhost:5000/api/change-tracking/employee/EMP001/update
```

#### Development Database
Use `InssetDummyData/insertDummyData.js` to populate with realistic test data:
- 250 employees across multiple months
- Varied attendance patterns, payouts, and additional payments
- Realistic wage calculations and balance scenarios

## Working with This Codebase

### Adding New Features
- Follow the existing pattern: Route → Controller → Utils → Model
- Use ChangeTracker.js for any employee data modifications
- Implement proper error handling and validation
- Update CORS origins in server.js for new frontend URLs

### Debugging Calculation Issues
1. Check attendance array format and parsing in `Utils/Jobs.js`
2. Verify rate and date calculations
3. Trace carry-forward logic between months
4. Use change tracking history to identify data modification patterns

### Frontend Development
- Use protected routes for authenticated areas
- Implement proper loading states and error handling
- Follow existing notification patterns for real-time updates
- Maintain responsive design principles (desktop/tablet/mobile)

### Performance Considerations
- Employee queries are optimized with proper indexing
- Change tracking uses efficient deep comparison algorithms
- Bulk operations (like attendance updates) use transactions
- Frontend implements pagination and search filtering
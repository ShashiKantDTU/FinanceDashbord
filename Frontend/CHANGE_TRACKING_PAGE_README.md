# Change Tracking Page - Detailed Monthly View

## Overview
The Change Tracking page provides a comprehensive monthly view of all site-related changes with advanced analytics, filtering, and export capabilities.

## Features

### 📊 **Monthly Analytics Dashboard**
- **Statistics Overview**: Quick summary cards showing total changes, affected employees, high priority items, and total payouts
- **Visual Hierarchy**: Changes organized by priority (High, Medium, Low) with color-coded indicators
- **Timeline Organization**: Changes grouped by day within the selected month

### 🗓️ **Month Navigation**
- **Previous/Next Month**: Easy navigation between months using arrow buttons
- **Current Month Display**: Clear indication of the selected month and year
- **Smooth Transitions**: Professional animations between month changes

### 🔍 **Advanced Filtering & Search**
- **Text Search**: Search by employee ID, description, or author name
- **Type Filtering**: Filter by change type (Attendance, Payouts, Bonus)
- **Priority Filtering**: Filter by priority level (High, Medium, Low, All)
- **Real-time Results**: Instant filtering without page refresh

### 📈 **Data Visualization**
- **Priority Indicators**: Visual priority bars on the left side of change items
- **Color-coded Categories**: Different colors for attendance, payouts, and bonus changes
- **Professional Icons**: Context-appropriate icons for each change type
- **Highlighted Values**: Special formatting for monetary amounts and attendance status

### 📊 **Statistics Cards**
1. **Total Changes**: Overall count of changes for the month
2. **Employees Affected**: Number of unique employees with changes
3. **High Priority**: Count of high-priority changes requiring attention
4. **Total Payouts**: Sum of all payout-related changes in rupees

### 📄 **Export Functionality**
- **CSV Export**: Export filtered data as CSV file
- **Formatted Data**: Includes date, time, employee ID, action, field, description, author, and priority
- **Dynamic Filename**: Auto-generated filename with month and year

### 🎨 **Professional Design**
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile devices
- **Dark Theme Integration**: Matches the project's professional finance dashboard theme
- **Smooth Animations**: Professional transitions and hover effects
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## Page Structure

### Header Section
- **Back Button**: Navigate back to the previous page
- **Page Title**: "Change Tracking" with site name
- **Export Button**: Download data as CSV (disabled when no data)
- **Refresh Button**: Manual data refresh with loading animation

### Month Navigation
- **Previous Month Button**: Navigate to previous month
- **Current Month Display**: Shows selected month and year with calendar icon
- **Next Month Button**: Navigate to next month

### Filter Controls
- **Search Bar**: Text input for searching changes
- **Type Filter**: Dropdown for filtering by change type
- **Priority Filter**: Dropdown for filtering by priority level

### Statistics Dashboard
- Four professional stat cards showing key metrics

### Daily Changes Display
- **Day Groups**: Changes organized by date within the month
- **Day Headers**: Show date with day of week and change count
- **Change Items**: Detailed view of each change with:
  - Priority indicator
  - Change type icon
  - Employee information
  - Timestamp
  - Description
  - Highlighted data (amounts, attendance status)
  - Author information
  - Action badges

## Usage

### Navigation
1. Access from SitePage using the "Detailed View" button next to the notification icon
2. URL format: `/change-tracking/{siteID}`

### Filtering Data
1. Use the search bar to find specific changes by text
2. Select filter options from the dropdown menus
3. Filters work in combination for precise results

### Exporting Data
1. Apply desired filters
2. Click the "Export CSV" button
3. File will be downloaded with format: `change-tracking-{year}-{month}.csv`

## API Integration

### Endpoints Used
- `GET /api/sites/{siteID}` - Fetch site information
- `GET /api/change-tracking/range` - Fetch changes for date range with parameters:
  - `siteID`: Site identifier
  - `startDate`: First day of selected month
  - `endDate`: Last day of selected month
  - `limit`: Maximum number of records (default: 1000)

### Data Processing
- **Priority Calculation**: Automatic priority assignment based on change type and field
- **Data Parsing**: Extraction of monetary values and attendance information
- **Timeline Grouping**: Organization of changes by date for better readability

## Technical Implementation

### Key Technologies
- **React 18**: Functional components with hooks
- **React Router**: URL routing and navigation
- **CSS Modules**: Component-scoped styling
- **React Icons**: Professional icon library
- **Date Manipulation**: JavaScript Date objects for month navigation

### Performance Optimizations
- **useMemo**: Expensive calculations cached for better performance
- **useCallback**: Function memoization to prevent unnecessary re-renders
- **Efficient Filtering**: Client-side filtering for instant results
- **Lazy Loading**: Components only load when needed

### Responsive Design
- **Mobile-first**: Designed for mobile devices first, then enhanced for larger screens
- **Flexible Grid**: CSS Grid and Flexbox for responsive layouts
- **Touch-friendly**: Buttons and controls optimized for touch interfaces

## Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Future Enhancements
- 📊 Chart visualizations for change trends
- 📱 PWA support for mobile app-like experience
- 🔔 Real-time notifications for new changes
- 📧 Email export functionality
- 🔍 Advanced search with regex support
- 📅 Custom date range selection

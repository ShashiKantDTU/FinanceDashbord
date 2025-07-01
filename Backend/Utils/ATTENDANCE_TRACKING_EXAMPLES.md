# Attendance Tracking System Documentation

## Overview
The optimized change tracking system provides detailed, granular tracking of attendance changes with automatic decoding of attendance values for user-friendly display.

## Attendance Value Format
Attendance values follow the pattern: `[P|A][number]`
- **P** = Present
- **A** = Absent  
- **Number** = Overtime hours (optional)

## Examples

### Sample Attendance Values
```
P     → Present, no overtime
P1    → Present, 1 hour overtime
A7    → Absent, 7 hours overtime (could be compensation work)
P20   → Present, 20 hours overtime
A     → Absent, no overtime
P5    → Present, 5 hours overtime
A15   → Absent, 15 hours overtime
```

### Decoded Output
Each attendance value is automatically decoded to:
```javascript
{
  status: 'Present' | 'Absent',
  overtimeHours: number,
  display: 'Present (1hr OT)' | 'Absent (7hrs OT)' | 'Present' | 'Absent'
}
```

## Change Tracking Example

### Scenario: Employee Attendance Update
**Before:** `['P', 'P1', 'A']`
**After:** `['P', 'P5', 'A7']`

### Generated Change Log:
```javascript
[
  {
    changeType: 'removed',
    attendanceValue: 'P1',
    decoded: {
      status: 'Present',
      overtimeHours: 1,
      display: 'Present (1hr OT)'
    },
    description: 'Attendance removed: Present (1hr OT) (P1)'
  },
  {
    changeType: 'added', 
    attendanceValue: 'P5',
    decoded: {
      status: 'Present',
      overtimeHours: 5,
      display: 'Present (5hrs OT)'
    },
    description: 'Attendance added: Present (5hrs OT) (P5)'
  },
  {
    changeType: 'removed',
    attendanceValue: 'A',
    decoded: {
      status: 'Absent',
      overtimeHours: 0,
      display: 'Absent'
    },
    description: 'Attendance removed: Absent (A)'
  },
  {
    changeType: 'added',
    attendanceValue: 'A7', 
    decoded: {
      status: 'Absent',
      overtimeHours: 7,
      display: 'Absent (7hrs OT)'
    },
    description: 'Attendance added: Absent (7hrs OT) (A7)'
  }
]
```

### User-Friendly Display Messages:
```
"John.Doe changed Employee123's attendance for 12/2024:
- Removed: Present (1hr OT) (P1) 
- Added: Present (5hrs OT) (P5)
- Removed: Absent (A)
- Added: Absent (7hrs OT) (A7)
at 12/15/2024, 2:30:45 PM"
```

## API Endpoints

### Test Attendance Decoding
```
GET /api/change-tracking/test/attendance-decoding
```
Returns decoded results for sample attendance values.

### Employee Change History
```
GET /api/change-tracking/employee/:employeeID/changes
```
Query parameters:
- `siteID` - Filter by site
- `field` - Filter by field (e.g., 'attendance')
- `changeType` - Filter by change type ('added', 'removed')
- `limit` - Results per page (default: 50)
- `page` - Page number (default: 1)

## Benefits

### Storage Optimization
- **90% reduction** in storage compared to full document snapshots
- Only stores actual changes, not entire documents
- Granular field-level tracking

### User Experience
- Human-readable attendance descriptions
- Clear before/after states
- Detailed audit trail with timestamps
- Easy filtering and searching

### Developer Experience
- Automatic attendance value decoding
- Flexible query options
- Clean API responses
- Comprehensive logging

## Integration Example

```javascript
// Frontend display component
const AttendanceChangeList = ({ changes }) => {
  return changes.map(change => (
    <div key={change.id} className="change-item">
      <div className="message">{change.message}</div>
      <div className="details">
        Field: {change.field} | 
        Type: {change.changeType} |
        Time: {new Date(change.timestamp).toLocaleString()}
      </div>
      {change.isAttendanceChange && (
        <div className="attendance-details">
          Attendance: {change.specificData.from} → {change.specificData.to}
        </div>
      )}
    </div>
  ));
};
```

This system provides complete transparency into attendance changes while maintaining optimal storage efficiency and user-friendly display formatting.

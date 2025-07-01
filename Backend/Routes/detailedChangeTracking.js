/**
 * Example API Routes for Detailed Change Tracking
 * 
 * These routes demonstrate how to fetch and display the detailed change tracking data
 * in a user-friendly format for the frontend.
 */

const express = require('express');
const router = express.Router();
const OptimizedChangeTracking = require('../models/OptimizedChangeTrackingSchema');
const { decodeAttendanceValue } = require('../Utils/OptimizedChangeTracker');

// Get detailed change history for an employee
router.get('/employee/:employeeID/changes', async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { siteID, limit = 50, page = 1, field, changeType } = req.query;
        
        const query = { employeeID };
        if (siteID) query.siteID = siteID;
        if (field) query.field = field;
        if (changeType) query.changeType = changeType;
        
        const skip = (page - 1) * limit;
        
        const [changes, totalCount] = await Promise.all([
            OptimizedChangeTracking.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            OptimizedChangeTracking.countDocuments(query)
        ]);
        
        // Format for frontend display
        const formattedChanges = changes.map(change => ({
            id: change._id,
            message: change.metadata.displayMessage,
            field: change.fieldDisplayName,
            changeType: change.changeType,
            description: change.changeDescription,
            timestamp: change.timestamp,
            changedBy: change.changedBy,
            remark: change.remark,
            period: `${change.month}/${change.year}`,
            isAttendanceChange: change.metadata.isAttendanceChange,
            isPaymentChange: change.metadata.isPaymentChange,
            specificData: {
                date: change.changeData.date,
                item: change.changeData.item,
                changedFields: change.changeData.changedFields,
                from: change.changeData.from,
                to: change.changeData.to
            }
        }));
        
        res.json({
            success: true,
            data: formattedChanges,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalRecords: totalCount,
                hasNext: page < Math.ceil(totalCount / limit),
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching employee change history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch change history',
            error: error.message
        });
    }
});

// Get attendance changes specifically for an employee
router.get('/employee/:employeeID/attendance-changes', async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { siteID, limit = 50, fromDate, toDate } = req.query;
        
        const query = {
            employeeID,
            field: 'attendance'
        };
        
        if (siteID) query.siteID = siteID;
        if (fromDate || toDate) {
            query.timestamp = {};
            if (fromDate) query.timestamp.$gte = new Date(fromDate);
            if (toDate) query.timestamp.$lte = new Date(toDate);
        }
        
        const attendanceChanges = await OptimizedChangeTracking.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();
        
        // Group by date for easier frontend display
        const changesByDate = {};
        attendanceChanges.forEach(change => {
            const date = change.changeData.date;
            if (!changesByDate[date]) {
                changesByDate[date] = [];
            }
            changesByDate[date].push({
                changeType: change.changeType,
                description: change.changeDescription,
                changedBy: change.changedBy,
                timestamp: change.timestamp,
                remark: change.remark,
                displayMessage: change.metadata.displayMessage
            });
        });
        
        res.json({
            success: true,
            data: {
                employeeID,
                totalChanges: attendanceChanges.length,
                changesByDate,
                chronologicalChanges: attendanceChanges.map(change => ({
                    date: change.changeData.date,
                    changeType: change.changeType,
                    description: change.changeDescription,
                    displayMessage: change.metadata.displayMessage,
                    changedBy: change.changedBy,
                    timestamp: change.timestamp
                }))
            }
        });
        
    } catch (error) {
        console.error('Error fetching attendance changes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance changes',
            error: error.message
        });
    }
});

// Get payment changes specifically for an employee
router.get('/employee/:employeeID/payment-changes', async (req, res) => {
    try {
        const { employeeID } = req.params;
        const { siteID, limit = 50, month, year, paymentType = 'payouts' } = req.query;
        
        const query = {
            employeeID,
            field: paymentType // 'payouts' or 'additional_req_pays'
        };
        
        if (siteID) query.siteID = siteID;
        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);
        
        const paymentChanges = await OptimizedChangeTracking.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();
        
        // Format payment changes with detailed information
        const formattedPaymentChanges = paymentChanges.map(change => {
            const item = change.changeData.item || {};
            return {
                id: change._id,
                changeType: change.changeType,
                description: change.changeDescription,
                displayMessage: change.metadata.displayMessage,
                paymentDetails: {
                    value: item.value || 0,
                    remark: item.remark || 'No remark',
                    date: item.date || null,
                    createdBy: item.createdBy || null
                },
                changedFields: change.changeData.changedFields || null,
                changedBy: change.changedBy,
                timestamp: change.timestamp,
                remark: change.remark,
                period: `${change.month}/${change.year}`
            };
        });
        
        res.json({
            success: true,
            data: {
                employeeID,
                paymentType,
                totalChanges: paymentChanges.length,
                changes: formattedPaymentChanges,
                summary: {
                    added: formattedPaymentChanges.filter(c => c.changeType === 'added').length,
                    removed: formattedPaymentChanges.filter(c => c.changeType === 'removed').length,
                    modified: formattedPaymentChanges.filter(c => c.changeType === 'modified').length
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching payment changes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment changes',
            error: error.message
        });
    }
});

// Get all recent changes across the system (for admin dashboard)
router.get('/recent-changes', async (req, res) => {
    try {
        const { siteID, limit = 50, page = 1, field, changedBy, changeType, search, dateRange, startDate, endDate } = req.query; // Added pagination and search support
        
        const query = {};
        if (siteID) query.siteID = siteID;
        if (field && field !== 'all') query.field = field;
        if (changeType && changeType !== 'all') query.changeType = changeType;
        if (changedBy && changedBy !== 'all') query.changedBy = changedBy;
        
        // Add search functionality
        if (search && search.trim() !== '') {
            query.$or = [
                { employeeID: { $regex: search, $options: 'i' } },
                { changeDescription: { $regex: search, $options: 'i' } },
                { changedBy: { $regex: search, $options: 'i' } },
                { 'metadata.displayMessage': { $regex: search, $options: 'i' } }
            ];
        }
        
        // Add date range filtering
        if (dateRange || startDate || endDate) {
            query.timestamp = {};
            
            if (dateRange && dateRange !== 'all') {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                switch (dateRange) {
                    case '1day':
                    
                        query.timestamp.$gte = today;
                        break;
                    case 'yesterday':
                        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                        query.timestamp.$gte = yesterday;
                        query.timestamp.$lt = today;
                        break;
                    case '7days':
                    
                        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        query.timestamp.$gte = weekAgo;
                        break;
                    case 'thisMonth':
                    
                        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                        query.timestamp.$gte = monthStart;
                        break;
                    case 'custom':
                        // For custom, we rely on startDate and endDate parameters
                        break;
                    default:
                        // Don't add timestamp filter for unknown values
                        delete query.timestamp;
                        break;
                }
            }
            
            // Custom date range - only apply if we have valid dates
            if (startDate) {
                try {
                    query.timestamp = query.timestamp || {};
                    query.timestamp.$gte = new Date(startDate);
                } catch (e) {
                    console.warn('Invalid startDate provided:', startDate);
                }
            }
            if (endDate) {
                try {
                    query.timestamp = query.timestamp || {};
                    // Add one day to endDate to include the entire end day
                    const endDateTime = new Date(endDate);
                    endDateTime.setDate(endDateTime.getDate() + 1);
                    query.timestamp.$lt = endDateTime;
                } catch (e) {
                    console.warn('Invalid endDate provided:', endDate);
                }
            }
            
            // If timestamp object is empty, remove it to avoid the casting error
            if (Object.keys(query.timestamp).length === 0) {
                delete query.timestamp;
            }
        }
        
        console.log('MongoDB query:', JSON.stringify(query, null, 2));
        
        // Parse and validate pagination parameters
        const parsedLimit = Math.min(parseInt(limit) || 50, 100); // Max 100 per page
        const parsedPage = Math.max(parseInt(page) || 1, 1); // Min page 1
        const skip = (parsedPage - 1) * parsedLimit;
        
        // Get both the changes and total count for pagination
        const [recentChanges, totalCount] = await Promise.all([
            OptimizedChangeTracking.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            OptimizedChangeTracking.countDocuments(query)
        ]);
        
        // Group by time periods for dashboard display (only for current page)
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const grouped = {
            today: [],
            yesterday: [],
            thisWeek: [],
            older: []
        };
        
        recentChanges.forEach(change => {
            const changeDate = new Date(change.timestamp);
            if (changeDate >= today) {
                grouped.today.push(change);
            } else if (changeDate >= yesterday) {
                grouped.yesterday.push(change);
            } else if (changeDate >= thisWeek) {
                grouped.thisWeek.push(change);
            } else {
                grouped.older.push(change);
            }
        });
        
        res.json({
            success: true,
            data: {
                totalChanges: totalCount,
                currentPageChanges: recentChanges.length,
                groupedByTime: grouped,
                allChanges: recentChanges.map(change => ({
                    id: change._id,
                    displayMessage: change.metadata?.displayMessage,
                    employeeID: change.employeeID,
                    field: change.field, // Use raw field name for filtering compatibility
                    fieldDisplayName: change.fieldDisplayName, // Keep display name separately
                    changeType: change.changeType,
                    changedBy: change.changedBy,
                    timestamp: change.timestamp,
                    remark: change.remark, // Added missing remark field
                    isAttendanceChange: change.metadata?.isAttendanceChange,
                    isPaymentChange: change.metadata?.isPaymentChange,
                    description: change.changeDescription
                }))
            },
            pagination: {
                currentPage: parsedPage,
                totalPages: Math.ceil(totalCount / parsedLimit),
                totalRecords: totalCount,
                recordsPerPage: parsedLimit,
                hasNext: parsedPage < Math.ceil(totalCount / parsedLimit),
                hasPrev: parsedPage > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching recent changes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent changes',
            error: error.message
        });
    }
});

// Test endpoint for attendance value decoding
router.get('/test/attendance-decoding', async (req, res) => {
    try {
        // Sample attendance values as mentioned by user
        const testAttendanceValues = ['P', 'P1', 'A7', 'P20', 'A', 'P5', 'A15'];
        
        const decodedResults = testAttendanceValues.map(value => ({
            originalValue: value,
            decoded: decodeAttendanceValue(value)
        }));
        
        res.json({
            success: true,
            message: 'Attendance value decoding test results',
            data: {
                testValues: decodedResults,
                explanation: {
                    'P': 'Present with no overtime',
                    'P1': 'Present with 1 hour overtime',
                    'A7': 'Absent with 7 hours overtime (could be previous/next day work)',
                    'P20': 'Present with 20 hours overtime',
                    format: 'P/A followed by optional number for overtime hours'
                }
            }
        });
        
    } catch (error) {
        console.error('Error in attendance decoding test:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test attendance decoding',
            error: error.message
        });
    }
});

module.exports = router;

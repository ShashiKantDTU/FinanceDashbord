const express = require('express');
const router = express.Router();
const ApiUsageLog = require('../models/ApiUsageLog');
const User = require('../models/Userschema');
const { authenticateAndTrack } = require('../Middleware/usageTracker');
const { authorizeRole } = require('../Middleware/auth');
const { getUserUsageStats, checkUsageLimits } = require('../Middleware/usageTracker');
const { logConnection } = require('../config/logDatabase');

/**
 * Helper function to calculate date range based on period or custom dates
 * @param {string} period - 'today', 'yesterday', 'week', 'month', '3months'
 * @param {string} customStartDate - Optional custom start date (YYYY-MM-DD)
 * @param {string} customEndDate - Optional custom end date (YYYY-MM-DD)
 * @returns {Object} { startDate, endDate }
 */
const getDateRange = (period, customStartDate = null, customEndDate = null) => {
    // If custom dates are provided, use them
    if (customStartDate && customEndDate) {
        const startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0); // Start of day
        
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        
        return { startDate, endDate };
    }

    // Otherwise use predefined periods
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate, endDate;

    switch (period) {
        case 'today':
            startDate = today;
            endDate = new Date();
            break;
        case 'yesterday':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 1);
            endDate = today;
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date();
            break;
        case 'month':
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 1);
            endDate = new Date();
            break;
        case '3months':
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 3);
            endDate = new Date();
            break;
        default:
            // Default to last 7 days
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date();
    }

    return { startDate, endDate };
};

// GET /api/usage/dashboard
// NEW: Performance-focused dashboard with time period filtering
// Query params: period (today, yesterday, week, month, 3months)
router.get('/dashboard', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        const period = req.query.period || 'week';
        const { startDate, endDate } = getDateRange(period);

        // Get total requests in the period
        const totalStats = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    uniqueUsers: { $addToSet: '$userPhone' },
                    uniqueEndpoints: { $addToSet: '$endpoint' }
                }
            }
        ]);

        // Get all users by request count (no limit)
        // Note: We group by phone only, then lookup latest name from User collection
        const allUsers = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$userPhone',  // Group by phone only
                    mainUserId: { $first: '$mainUserId' },  // Get user ID for lookup
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    uniqueEndpoints: { $addToSet: '$endpoint' }
                }
            },
            {
                $sort: { totalRequests: -1 }
            }
            // No limit - return all users
        ]);

        // Lookup latest names from User collection
        // Try both by ID and by phone number for maximum coverage
        const userIds = allUsers.map(u => u.mainUserId).filter(Boolean);
        const userPhones = allUsers.map(u => u._id).filter(Boolean);
        
        const users = await User.find({
            $or: [
                { _id: { $in: userIds } },
                { phoneNumber: { $in: userPhones } }
            ]
        }).select('_id name phoneNumber');
        
        // Create maps for both ID and phone lookups
        const userMapById = new Map(users.map(u => [u._id.toString(), u]));
        const userMapByPhone = new Map(users.map(u => [u.phoneNumber, u]));

        // Merge latest names with usage data
        const allUsersWithNames = allUsers.map(user => {
            let userName = null;
            
            // Try to get user by ID first
            if (user.mainUserId) {
                const foundUser = userMapById.get(user.mainUserId.toString());
                if (foundUser) {
                    userName = foundUser.name || foundUser.phoneNumber;
                }
            }
            
            // Fallback: try to get user by phone number
            if (!userName && user._id) {
                const foundUser = userMapByPhone.get(user._id);
                if (foundUser) {
                    userName = foundUser.name || foundUser.phoneNumber;
                }
            }
            
            // Final fallback: use phone number from logs
            if (!userName) {
                userName = user._id || 'Unknown';
            }
            
            return {
                phone: user._id,
                name: userName,
                totalRequests: user.totalRequests,
                totalDataBytes: user.totalDataBytes,
                endpointCount: user.uniqueEndpoints.length
            };
        });

        // Get hourly distribution for the period
        const hourlyDistribution = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $hour: '$timestamp' },
                    requests: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    hour: '$_id',
                    requests: 1
                }
            },
            {
                $sort: { hour: 1 }
            }
        ]);

        const stats = totalStats[0] || {
            totalRequests: 0,
            totalDataBytes: 0,
            uniqueUsers: [],
            uniqueEndpoints: []
        };

        res.json({
            success: true,
            period: {
                type: period,
                startDate,
                endDate
            },
            summary: {
                totalRequests: stats.totalRequests,
                totalDataBytes: stats.totalDataBytes,
                uniqueUsers: stats.uniqueUsers.length,
                uniqueEndpoints: stats.uniqueEndpoints.length,
                avgRequestsPerUser: stats.uniqueUsers.length > 0 
                    ? Math.round(stats.totalRequests / stats.uniqueUsers.length) 
                    : 0,
                totalUsersInResponse: allUsersWithNames.length
            },
            users: allUsersWithNames,  // Changed from 'topUsers' to 'users' and returns ALL users
            hourlyDistribution
        });

    } catch (error) {
        console.error('Error fetching usage dashboard data:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
});

// GET /api/usage/user-endpoint-analytics
// NEW: Shows which endpoints each user accessed with detailed timing
// Perfect for understanding user behavior and endpoint usage patterns
// Query params: 
//   - period (today, yesterday, week, month, 3months) OR
//   - startDate (YYYY-MM-DD) + endDate (YYYY-MM-DD) for custom range
router.get('/user-endpoint-analytics', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        // Support both period and custom date range
        const period = req.query.period || 'week';
        const customStartDate = req.query.startDate;
        const customEndDate = req.query.endDate;
        
        const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);

        // Step 1: Get all users who made requests in the period with their endpoint usage
        const userEndpointData = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        phone: '$userPhone',
                        endpoint: '$endpoint',
                        method: '$method'
                    },
                    mainUserId: { $first: '$mainUserId' },
                    requestCount: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    avgResponseSize: { $avg: '$responseSizeBytes' },
                    firstAccess: { $min: '$timestamp' },
                    lastAccess: { $max: '$timestamp' },
                    statusCodes: { $push: '$status' },
                    timestamps: { $push: '$timestamp' }
                }
            },
            {
                $sort: { '_id.phone': 1, requestCount: -1 }
            }
        ]);

        // Step 2: Get user details for all users
        const userPhones = [...new Set(userEndpointData.map(d => d._id.phone))].filter(Boolean);
        const users = await User.find({ 
            phoneNumber: { $in: userPhones } 
        }).select('_id name phoneNumber email plan');
        
        const userMap = new Map(users.map(u => [u.phoneNumber, u]));

        // Step 3: Group by user and calculate per-user statistics
        const usersMap = new Map();

        for (const data of userEndpointData) {
            const phone = data._id.phone;
            if (!phone) continue;

            if (!usersMap.has(phone)) {
                const user = userMap.get(phone);
                usersMap.set(phone, {
                    phone: phone,
                    name: user ? (user.name || phone) : phone,
                    email: user ? user.email : null,
                    plan: user ? user.plan : 'unknown',
                    totalRequests: 0,
                    totalDataBytes: 0,
                    uniqueEndpoints: 0,
                    firstActivity: null,
                    lastActivity: null,
                    endpoints: []
                });
            }

            const userStats = usersMap.get(phone);
            
            // Calculate success rate for this endpoint
            const successCount = data.statusCodes.filter(code => code >= 200 && code < 300).length;
            const successRate = (successCount / data.requestCount * 100).toFixed(2);

            // Add endpoint details
            userStats.endpoints.push({
                endpoint: data._id.endpoint,
                method: data._id.method,
                requestCount: data.requestCount,
                totalDataBytes: data.totalDataBytes,
                avgResponseSize: Math.round(data.avgResponseSize),
                firstAccess: data.firstAccess,
                lastAccess: data.lastAccess,
                successRate: parseFloat(successRate),
                // Sample of recent timestamps (last 10)
                recentTimestamps: data.timestamps.slice(-10).sort((a, b) => b - a)
            });

            // Update user totals
            userStats.totalRequests += data.requestCount;
            userStats.totalDataBytes += data.totalDataBytes;
            userStats.uniqueEndpoints = userStats.endpoints.length;
            
            if (!userStats.firstActivity || data.firstAccess < userStats.firstActivity) {
                userStats.firstActivity = data.firstAccess;
            }
            if (!userStats.lastActivity || data.lastAccess > userStats.lastActivity) {
                userStats.lastActivity = data.lastAccess;
            }
        }

        // Convert to array and sort by total requests (most active first)
        const usersArray = Array.from(usersMap.values()).sort((a, b) => 
            b.totalRequests - a.totalRequests
        );

        // Step 4: Calculate summary statistics
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
        const totalRequests = usersArray.reduce((sum, u) => sum + u.totalRequests, 0);
        const totalUsers = usersArray.length;
        
        // Get unique endpoints across all users
        const allEndpoints = new Set();
        userEndpointData.forEach(d => allEndpoints.add(`${d._id.method} ${d._id.endpoint}`));

        res.json({
            success: true,
            period: {
                type: customStartDate && customEndDate ? 'custom' : period,
                startDate,
                endDate,
                totalDays
            },
            summary: {
                totalUsers,
                totalRequests,
                uniqueEndpoints: allEndpoints.size,
                avgRequestsPerUser: totalUsers > 0 ? Math.round(totalRequests / totalUsers) : 0,
                avgRequestsPerDay: Math.round(totalRequests / totalDays)
            },
            users: usersArray
        });

    } catch (error) {
        console.error('Error fetching user endpoint analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/usage/new-users
// NEW: Track new users based on their first API usage
// A user is "new" in a period if they have NO logs before that period
// Query params: 
//   - period (today, yesterday, week, month, 3months) OR
//   - startDate (YYYY-MM-DD) + endDate (YYYY-MM-DD) for custom range
router.get('/new-users', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        // Support both period and custom date range
        const period = req.query.period || 'week';
        const customStartDate = req.query.startDate; // Format: YYYY-MM-DD
        const customEndDate = req.query.endDate;     // Format: YYYY-MM-DD
        
        const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);

        // Step 1: Get all unique users who made requests in the selected period
        const usersInPeriod = await ApiUsageLog.distinct('userPhone', {
            timestamp: { $gte: startDate, $lte: endDate }
        });

        // Step 2: For each user, check if they have ANY logs before the period started
        // If NO logs before startDate = NEW USER
        const newUserPhones = [];
        
        for (const phone of usersInPeriod) {
            if (!phone) continue; // Skip null/undefined phones
            
            // Check if this user has any logs before the period
            const oldLogCount = await ApiUsageLog.countDocuments({
                userPhone: phone,
                timestamp: { $lt: startDate }
            });
            
            // If no old logs, this is a new user in this period
            if (oldLogCount === 0) {
                newUserPhones.push(phone);
            }
        }

        // Step 3: Get user details from User collection for the new users
        const newUsersFromDB = await User.find({
            phoneNumber: { $in: newUserPhones }
        }).select('name phoneNumber email createdAt plan planActivatedAt site supervisors').sort({ createdAt: -1 });

        // Create a map for quick lookup
        const userMap = new Map(newUsersFromDB.map(u => [u.phoneNumber, u]));

        // Step 4: Get their first request timestamp and request count from logs
        const newUsersWithDetails = await Promise.all(
            newUserPhones.map(async (phone) => {
                const user = userMap.get(phone);
                
                // Get first log for this user
                const firstLog = await ApiUsageLog.findOne({
                    userPhone: phone
                }).sort({ timestamp: 1 }).select('timestamp endpoint method');

                // Get total requests by this user in the period
                const requestsInPeriod = await ApiUsageLog.countDocuments({
                    userPhone: phone,
                    timestamp: { $gte: startDate, $lte: endDate }
                });

                // Get total requests ever by this user
                const totalRequests = await ApiUsageLog.countDocuments({
                    userPhone: phone
                });

                return {
                    phone: phone,
                    name: user ? (user.name || phone) : phone,
                    email: user ? user.email : null,
                    plan: user ? user.plan : 'unknown',
                    planActivatedAt: user ? user.planActivatedAt : null,
                    registeredAt: user ? user.createdAt : null,
                    siteCount: user ? (user.site ? user.site.length : 0) : 0,
                    supervisorCount: user ? (user.supervisors ? user.supervisors.length : 0) : 0,
                    firstApiUsage: firstLog ? firstLog.timestamp : null,
                    firstEndpoint: firstLog ? firstLog.endpoint : null,
                    firstMethod: firstLog ? firstLog.method : null,
                    requestsInPeriod,
                    totalRequests
                };
            })
        );

        // Sort by first API usage (most recent first)
        newUsersWithDetails.sort((a, b) => {
            if (!a.firstApiUsage) return 1;
            if (!b.firstApiUsage) return -1;
            return b.firstApiUsage - a.firstApiUsage;
        });

        // Step 5: Get daily breakdown of new users (by first API usage)
        const dailyMap = new Map();

        for (const userDetail of newUsersWithDetails) {
            if (userDetail.firstApiUsage) {
                const dateStr = userDetail.firstApiUsage.toISOString().split('T')[0]; // YYYY-MM-DD
                
                if (!dailyMap.has(dateStr)) {
                    dailyMap.set(dateStr, { date: dateStr, count: 0, users: [] });
                }
                
                const dayData = dailyMap.get(dateStr);
                dayData.count++;
                dayData.users.push({
                    phone: userDetail.phone,
                    name: userDetail.name,
                    plan: userDetail.plan
                });
            }
        }

        // Convert map to array and sort by date
        const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => 
            a.date.localeCompare(b.date)
        );

        // Step 6: Calculate summary statistics
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
        const avgNewUsersPerDay = (newUserPhones.length / totalDays).toFixed(2);

        // Get total unique users who have ever made a request
        const totalActiveUsers = await ApiUsageLog.distinct('userPhone');
        const activeUsersBeforePeriod = totalActiveUsers.filter(phone => !newUserPhones.includes(phone)).length;
        
        const growthRate = activeUsersBeforePeriod > 0 
            ? ((newUserPhones.length / activeUsersBeforePeriod) * 100).toFixed(2)
            : '0.00';

        res.json({
            success: true,
            period: {
                type: customStartDate && customEndDate ? 'custom' : period,
                startDate,
                endDate,
                totalDays
            },
            summary: {
                newUsersCount: newUserPhones.length,
                totalActiveUsers: totalActiveUsers.length,
                activeUsersBeforePeriod,
                growthRate: parseFloat(growthRate),
                avgNewUsersPerDay: parseFloat(avgNewUsersPerDay)
            },
            newUsers: newUsersWithDetails,
            dailyBreakdown
        });

    } catch (error) {
        console.error('Error fetching new users data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/usage/user-activity/:phone
// NEW: Detailed activity tracker for a specific user
// Shows all requests made by a user and breakdown by endpoint
router.get('/user-activity/:phone', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        const userPhone = req.params.phone;
        const period = req.query.period || 'week';
        const { startDate, endDate } = getDateRange(period);

        // Get user details
        const user = await User.findOne({ phoneNumber: userPhone })
            .select('name phoneNumber email plan createdAt planActivatedAt');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get total activity summary
        const activitySummary = await ApiUsageLog.aggregate([
            {
                $match: {
                    userPhone: userPhone,
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    uniqueEndpoints: { $addToSet: '$endpoint' },
                    firstRequest: { $min: '$timestamp' },
                    lastRequest: { $max: '$timestamp' }
                }
            }
        ]);

        // Get endpoint-wise breakdown
        const endpointBreakdown = await ApiUsageLog.aggregate([
            {
                $match: {
                    userPhone: userPhone,
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        endpoint: '$endpoint',
                        method: '$method'
                    },
                    requestCount: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    avgResponseSize: { $avg: '$responseSizeBytes' },
                    lastAccessed: { $max: '$timestamp' },
                    statusCodes: { $push: '$status' }
                }
            },
            {
                $project: {
                    _id: 0,
                    endpoint: '$_id.endpoint',
                    method: '$_id.method',
                    requestCount: 1,
                    totalDataBytes: 1,
                    avgResponseSize: { $round: ['$avgResponseSize', 2] },
                    lastAccessed: 1,
                    // Calculate success rate
                    successRate: {
                        $multiply: [
                            {
                                $divide: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: '$statusCodes',
                                                as: 'code',
                                                cond: { $and: [{ $gte: ['$$code', 200] }, { $lt: ['$$code', 300] }] }
                                            }
                                        }
                                    },
                                    { $size: '$statusCodes' }
                                ]
                            },
                            100
                        ]
                    }
                }
            },
            {
                $sort: { requestCount: -1 }
            }
        ]);

        // Get recent activity (last 50 requests)
        const recentActivity = await ApiUsageLog.find({
            userPhone: userPhone,
            timestamp: { $gte: startDate, $lte: endDate }
        })
        .select('endpoint method status responseSizeBytes timestamp')
        .sort({ timestamp: -1 })
        .limit(50);

        // Get daily activity pattern
        const dailyActivity = await ApiUsageLog.aggregate([
            {
                $match: {
                    userPhone: userPhone,
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$timestamp'
                        }
                    },
                    requests: { $sum: 1 },
                    dataBytes: { $sum: '$responseSizeBytes' }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    requests: 1,
                    dataBytes: 1
                }
            },
            {
                $sort: { date: 1 }
            }
        ]);

        const summary = activitySummary[0] || {
            totalRequests: 0,
            totalDataBytes: 0,
            uniqueEndpoints: [],
            firstRequest: null,
            lastRequest: null
        };

        res.json({
            success: true,
            period: {
                type: period,
                startDate,
                endDate
            },
            user: {
                name: user.name,
                phone: user.phoneNumber,
                email: user.email,
                plan: user.plan,
                registeredAt: user.createdAt,
                planActivatedAt: user.planActivatedAt
            },
            summary: {
                totalRequests: summary.totalRequests,
                totalDataBytes: summary.totalDataBytes,
                uniqueEndpoints: summary.uniqueEndpoints.length,
                firstRequest: summary.firstRequest,
                lastRequest: summary.lastRequest,
                avgRequestsPerDay: (summary.totalRequests / Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))).toFixed(2)
            },
            endpointBreakdown,
            dailyActivity,
            recentActivity: recentActivity.map(activity => ({
                endpoint: activity.endpoint,
                method: activity.method,
                status: activity.status,
                responseSize: activity.responseSizeBytes,
                timestamp: activity.timestamp
            }))
        });

    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/usage/system-performance
// NEW: Overall system performance metrics
// Query params: period (today, yesterday, week, month, 3months)
router.get('/system-performance', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        const period = req.query.period || 'week';
        const { startDate, endDate } = getDateRange(period);

        // Get overall performance metrics
        const performanceMetrics = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    avgResponseSize: { $avg: '$responseSizeBytes' },
                    // Status code breakdown
                    successCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gte: ['$status', 200] }, { $lt: ['$status', 300] }] },
                                1,
                                0
                            ]
                        }
                    },
                    clientErrorCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gte: ['$status', 400] }, { $lt: ['$status', 500] }] },
                                1,
                                0
                            ]
                        }
                    },
                    serverErrorCount: {
                        $sum: {
                            $cond: [
                                { $gte: ['$status', 500] },
                                1,
                                0
                            ]
                        }
                    },
                    uniqueUsers: { $addToSet: '$userPhone' },
                    uniqueEndpoints: { $addToSet: '$endpoint' }
                }
            }
        ]);

        // Get load distribution by hour
        const hourlyLoad = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $hour: '$timestamp' },
                    requests: { $sum: 1 },
                    avgResponseSize: { $avg: '$responseSizeBytes' }
                }
            },
            {
                $project: {
                    _id: 0,
                    hour: '$_id',
                    requests: 1,
                    avgResponseSize: { $round: ['$avgResponseSize', 2] }
                }
            },
            {
                $sort: { hour: 1 }
            }
        ]);

        // Get slowest endpoints (by response size as proxy for performance)
        const slowestEndpoints = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$endpoint',
                    avgResponseSize: { $avg: '$responseSizeBytes' },
                    maxResponseSize: { $max: '$responseSizeBytes' },
                    requestCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    endpoint: '$_id',
                    avgResponseSize: { $round: ['$avgResponseSize', 2] },
                    maxResponseSize: 1,
                    requestCount: 1
                }
            },
            {
                $sort: { avgResponseSize: -1 }
            },
            {
                $limit: 10
            }
        ]);

        const metrics = performanceMetrics[0] || {
            totalRequests: 0,
            totalDataBytes: 0,
            avgResponseSize: 0,
            successCount: 0,
            clientErrorCount: 0,
            serverErrorCount: 0,
            uniqueUsers: [],
            uniqueEndpoints: []
        };

        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

        res.json({
            success: true,
            period: {
                type: period,
                startDate,
                endDate,
                totalDays
            },
            performance: {
                totalRequests: metrics.totalRequests,
                avgRequestsPerDay: (metrics.totalRequests / totalDays).toFixed(2),
                totalDataTransferred: metrics.totalDataBytes,
                avgResponseSize: Math.round(metrics.avgResponseSize),
                activeUsers: metrics.uniqueUsers.length,
                activeEndpoints: metrics.uniqueEndpoints.length,
                // Status code distribution
                statusDistribution: {
                    success: metrics.successCount,
                    clientError: metrics.clientErrorCount,
                    serverError: metrics.serverErrorCount,
                    successRate: ((metrics.successCount / metrics.totalRequests) * 100).toFixed(2),
                    errorRate: (((metrics.clientErrorCount + metrics.serverErrorCount) / metrics.totalRequests) * 100).toFixed(2)
                }
            },
            hourlyLoad,
            slowestEndpoints
        });

    } catch (error) {
        console.error('Error fetching system performance:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// LEGACY ENDPOINTS (kept for backward compatibility)

// GET /api/usage/my-stats
// Get current user's usage statistics
router.get('/my-stats', authenticateAndTrack, async (req, res) => {
    try {
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 30;

        const stats = await getUserUsageStats(userId, days);
        const limits = await checkUsageLimits(userId, req.user.plan);

        res.json({
            success: true,
            data: {
                period: `Last ${days} days`,
                usage: stats,
                limits: limits,
                plan: req.user.plan
            }
        });
    } catch (error) {
        console.error('Error fetching user usage stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// DEPRECATED ENDPOINTS - Use new endpoints instead
// /api/usage/endpoint-stats -> Use /api/usage/endpoints-analytics
// /api/usage/plan-usage -> Not needed (removed plan-based grouping)
// /api/usage/real-time -> Use /api/usage/system-performance with period=today

// POST /api/usage/cleanup
// Clean up old usage logs (admin only)
router.post('/cleanup', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        const daysToKeep = parseInt(req.body.daysToKeep) || 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await ApiUsageLog.deleteMany({
            timestamp: { $lt: cutoffDate }
        });

        res.json({
            success: true,
            message: `Cleaned up ${result.deletedCount} old usage logs`,
            deletedCount: result.deletedCount,
            cutoffDate: cutoffDate
        });
    } catch (error) {
        console.error('Error cleaning up usage logs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/usage/health
// Check logging database connection health
router.get('/health', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        const health = {
            loggingDatabase: {
                connected: false,
                database: null,
                collection: null,
                modelAvailable: !!ApiUsageLog
            }
        };

        if (logConnection && logConnection.readyState === 1) {
            health.loggingDatabase.connected = true;
            health.loggingDatabase.database = logConnection.db.databaseName;
            health.loggingDatabase.collection = 'Sitehaazrilogs';

            // Test a simple query to verify the collection is accessible
            if (ApiUsageLog) {
                const count = await ApiUsageLog.countDocuments();
                health.loggingDatabase.documentCount = count;
            }
        }

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        console.error('Error checking usage database health:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking database health',
            error: error.message
        });
    }
});

module.exports = router;

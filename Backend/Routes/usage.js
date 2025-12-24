const express = require('express');
const router = express.Router();
const ApiUsageLog = require('../models/ApiUsageLog');
const CronJobLog = require('../models/CronJobLogSchema');
const User = require('../models/Userschema');
const Employee = require('../models/EmployeeSchema');
const Site = require('../models/Siteschema');
const { authenticateAndTrack } = require('../Middleware/usageTracker');
const { getUserUsageStats, checkUsageLimits } = require('../Middleware/usageTracker');
const { logConnection } = require('../config/logDatabase');
const { authenticateSuperAdmin } = require('../Middleware/superAdminAuth');

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
// Query params: period (today, yesterday, week, month, 3months) and custom date range (startDate, endDate)
router.get('/dashboard', authenticateSuperAdmin, async (req, res) => {
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
                    uniqueEndpoints: { $addToSet: '$endpoint' },
                    // Calculate active days by collecting unique date strings
                    activeDaysSet: {
                        $addToSet: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$timestamp'
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    // Convert the set to count for activeDays
                    activeDays: { $size: '$activeDaysSet' }
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
        })
        .select('_id name phoneNumber plan isTrial acquisition stats site')
        .populate({
            path: 'site',
            select: 'sitename stats.employeeCount isActive'
        });
        
        // Create maps for both ID and phone lookups
        const userMapById = new Map(users.map(u => [u._id.toString(), u]));
        const userMapByPhone = new Map(users.map(u => [u.phoneNumber, u]));

        // Merge latest names with usage data
        const allUsersWithNames = allUsers.map(user => {
            let userName = null;
            let userPlan = 'unknown';
            let isTrial = false;
            let acquisition = null;
            let totalSites = 0;
            let totalLaborers = 0;
            let sites = [];
            
            // Helper to extract stats from found user
            const extractUserStats = (foundUser) => {
                userName = foundUser.name || foundUser.phoneNumber;
                userPlan = foundUser.plan || 'unknown';
                isTrial = foundUser.isTrial || false;
                acquisition = foundUser.acquisition || null;
                // [Optimized] Read directly from Calculate-on-Write cache
                totalLaborers = foundUser.stats?.totalActiveLabors || 0;
                totalSites = foundUser.site ? foundUser.site.length : 0;
                
                // Map specific site counts if available
                if (foundUser.site && foundUser.site.length > 0) {
                    sites = foundUser.site.map(s => ({
                        sitename: s.sitename,
                        count: s.stats?.employeeCount || 0, // [Optimized] Cached site count
                        isActive: s.isActive
                    }));
                }
            };

            // Try to get user by ID first
            if (user.mainUserId) {
                const foundUser = userMapById.get(user.mainUserId.toString());
                if (foundUser) {
                    extractUserStats(foundUser);
                }
            }
            
            // Fallback: try to get user by phone number
            if (!userName && user._id) {
                const foundUser = userMapByPhone.get(user._id);
                if (foundUser) {
                    extractUserStats(foundUser);
                }
            }
            
            // Final fallback: use phone number from logs
            if (!userName) {
                userName = user._id || 'Unknown';
            }
            
            return {
                phone: user._id,
                name: userName,
                plan: userPlan,
                isTrial: isTrial,
                acquisition: acquisition,
                totalSites: totalSites,       // NEW: Site count
                totalLaborers: totalLaborers, // NEW: Cached employee count
                sites: sites,                 // NEW: Per-site breakdown
                totalRequests: user.totalRequests,
                totalDataBytes: user.totalDataBytes,
                endpointCount: user.uniqueEndpoints.length,
                activeDays: user.activeDays || 0
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

        // Get daily active users breakdown
        const dailyActiveUsers = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    uniqueUsers: { $addToSet: '$userPhone' }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id.date',
                    activeUsers: { $size: '$uniqueUsers' }
                }
            },
            {
                $sort: { date: 1 }
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
            hourlyDistribution,
            dailyActiveUsers
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
router.get('/user-endpoint-analytics', authenticateSuperAdmin, async (req, res) => {
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
        }).select('_id name phoneNumber email plan isTrial acquisition');
        
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
                    isTrial: user ? (user.isTrial || false) : false,
                    acquisition: user ? user.acquisition : null,
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
// OPTIMIZED: Uses aggregation pipelines to minimize database queries
router.get('/new-users', authenticateSuperAdmin, async (req, res) => {
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

        // OPTIMIZATION: Single aggregation to find new users and get all their stats
        // This replaces the previous approach of looping through users individually
        const newUsersAggregation = await ApiUsageLog.aggregate([
            {
                // Get all logs grouped by user with their first timestamp
                $group: {
                    _id: '$userPhone',
                    firstTimestamp: { $min: '$timestamp' },
                    totalRequests: { $sum: 1 },
                    requestsInPeriod: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $gte: ['$timestamp', startDate] },
                                    { $lte: ['$timestamp', endDate] }
                                ]},
                                1,
                                0
                            ]
                        }
                    },
                    firstEndpoint: { $first: '$endpoint' },
                    firstMethod: { $first: '$method' }
                }
            },
            {
                // Filter to only users whose first timestamp is >= startDate (new users)
                // AND who have activity in the period
                $match: {
                    firstTimestamp: { $gte: startDate },
                    requestsInPeriod: { $gt: 0 }
                }
            },
            {
                // Sort by first timestamp (most recent first)
                $sort: { firstTimestamp: -1 }
            }
        ]);

        // Extract phone numbers for user lookup
        const newUserPhones = newUsersAggregation.map(u => u._id).filter(Boolean);

        // Get user details from User collection (single query)
        const newUsersFromDB = await User.find({
            phoneNumber: { $in: newUserPhones }
        })
        .select('name phoneNumber email createdAt plan planActivatedAt site supervisors isTrial acquisition stats')
        .populate({
            path: 'site',
            select: 'sitename stats.employeeCount isActive'
        });

        // Create a map for quick lookup
        const userMap = new Map(newUsersFromDB.map(u => [u.phoneNumber, u]));

        // Create a map for aggregation data
        const aggDataMap = new Map(newUsersAggregation.map(u => [u._id, u]));

        // Combine user details with aggregation data
        const newUsersWithDetails = newUserPhones.map(phone => {
            const user = userMap.get(phone);
            const aggData = aggDataMap.get(phone);
            
            // [Optimized] Read sites and stats from cache
            const sites = user && user.site ? user.site.map(s => ({
                sitename: s.sitename,
                count: s.stats?.employeeCount || 0,
                isActive: s.isActive
            })) : [];

            return {
                phone: phone,
                name: user ? (user.name || phone) : phone,
                email: user ? user.email : null,
                plan: user ? user.plan : 'unknown',
                isTrial: user ? (user.isTrial || false) : false,
                acquisition: user ? user.acquisition : null,
                planActivatedAt: user ? user.planActivatedAt : null,
                registeredAt: user ? user.createdAt : null,
                siteCount: user ? (user.site ? user.site.length : 0) : 0,
                supervisorCount: user ? (user.supervisors ? user.supervisors.length : 0) : 0,
                totalLaborers: user ? (user.stats?.totalActiveLabors || 0) : 0, // NEW: Cached employee count
                sites: sites, // NEW: Per-site breakdown
                firstApiUsage: aggData.firstTimestamp,
                firstEndpoint: aggData.firstEndpoint,
                firstMethod: aggData.firstMethod,
                requestsInPeriod: aggData.requestsInPeriod,
                totalRequests: aggData.totalRequests
            };
        });

        // OPTIMIZATION: Build daily breakdown from aggregation data (no additional queries)
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
                    plan: userDetail.plan,
                    isTrial: userDetail.isTrial
                });
            }
        }

        // Convert map to array and sort by date
        const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => 
            a.date.localeCompare(b.date)
        );

        // Calculate summary statistics
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
        const avgNewUsersPerDay = (newUserPhones.length / totalDays).toFixed(2);

        // OPTIMIZATION: Get total active users count with a single aggregation
        const totalActiveUsersCount = await ApiUsageLog.aggregate([
            {
                $group: {
                    _id: '$userPhone'
                }
            },
            {
                $count: 'total'
            }
        ]);

        const totalActiveUsers = totalActiveUsersCount[0]?.total || 0;
        const activeUsersBeforePeriod = totalActiveUsers - newUserPhones.length;
        
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
                totalActiveUsers: totalActiveUsers,
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
router.get('/user-activity/:phone', authenticateSuperAdmin, async (req, res) => {
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
            .select('name phoneNumber email plan createdAt planActivatedAt isTrial acquisition');

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
        .limit(2000);

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
                isTrial: user.isTrial || false,
                acquisition: user.acquisition || null,
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
router.get('/system-performance', authenticateSuperAdmin, async (req, res) => {
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

// ============================================
// CRON JOB MONITORING ENDPOINTS
// ============================================
// Purpose: Track what happened in each individual cron job execution
// - View latest/previous cron job executions separately
// - See exactly what happened in each execution
// - All job types separated for easy tracking

// GET /api/usage/cron-jobs
// Get list of all recent cron job executions (all types mixed, sorted by date)
// Each execution is separate - you can see exactly what happened in each one
// Query params: 
//   - limit (default: 50) - number of recent executions to return
//   - jobType (optional) - filter by specific job type: 'monthly', 'weekly-week1', 'weekly-week2', 'weekly-week3', 'weekly-week4', 'weekly-feb28'
router.get('/cron-jobs', authenticateSuperAdmin, async (req, res) => {
    try {
        // Check if cron job logging is configured
        if (!CronJobLog) {
            return res.status(503).json({
                success: false,
                message: 'Cron job logging not available'
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const jobType = req.query.jobType; // Optional filter

        // Build query
        const query = {};
        if (jobType) {
            query.jobName = jobType;
        }

        // Get all cron job executions sorted by most recent first
        const cronExecutions = await CronJobLog.find(query)
            .sort({ executionDate: -1 })
            .limit(limit)
            .select('-successfulReports -skippedReports -failures'); // Exclude details for list view

        // Get job type descriptions
        const jobDescriptions = {
            'monthly': {
                description: 'Monthly report - Runs on 1st of every month at 2 AM',
                schedule: '0 2 1 * *',
                coverage: 'Previous month complete data'
            },
            'weekly-week1': {
                description: 'Week 1 report - Runs on 8th of every month at 2 AM',
                schedule: '0 2 8 * *',
                coverage: 'Days 1-7 of current month'
            },
            'weekly-week2': {
                description: 'Week 2 report - Runs on 15th of every month at 2 AM',
                schedule: '0 2 15 * *',
                coverage: 'Days 8-14 of current month'
            },
            'weekly-week3': {
                description: 'Week 3 report - Runs on 22nd of every month at 2 AM',
                schedule: '0 2 22 * *',
                coverage: 'Days 15-21 of current month'
            },
            'weekly-week4': {
                description: 'Week 4 report - Runs on 29th of every month at 2 AM',
                schedule: '0 2 29 * *',
                coverage: 'Days 22-28 of current month'
            },
            'weekly-feb28': {
                description: 'February Week 4 - Runs on 28th Feb at 2 AM (non-leap years)',
                schedule: '0 2 28 2 *',
                coverage: 'Backup for Week 4 in February'
            }
        };

        // Format executions with job descriptions
        const formattedExecutions = cronExecutions.map(job => {
            const jobInfo = jobDescriptions[job.jobName] || {
                description: job.jobName,
                schedule: 'N/A',
                coverage: 'N/A'
            };

            return {
                _id: job._id,
                jobName: job.jobName,
                jobDescription: jobInfo.description,
                coverage: jobInfo.coverage,
                executionDate: job.executionDate,
                status: job.status,
                totalUsers: job.totalUsers,
                totalSites: job.totalSites,
                successCount: job.successCount,
                failureCount: job.failureCount,
                skippedCount: job.skippedCount,
                successRate: job.successCount + job.failureCount > 0
                    ? ((job.successCount / (job.successCount + job.failureCount)) * 100).toFixed(2)
                    : '0.00',
                executionTime: job.executionTime,
                executionTimeFormatted: job.executionTime > 1000 
                    ? `${(job.executionTime / 1000).toFixed(2)}s`
                    : `${job.executionTime}ms`,
                completedAt: job.completedAt,
                metadata: job.metadata,
                createdAt: job.createdAt
            };
        });

        // Get the latest execution for quick reference
        const latestExecution = formattedExecutions[0] || null;

        res.json({
            success: true,
            message: jobType 
                ? `Showing last ${limit} executions of ${jobType}`
                : `Showing last ${limit} cron job executions (all types)`,
            latestExecution: latestExecution,
            totalReturned: formattedExecutions.length,
            executions: formattedExecutions,
            availableJobTypes: Object.keys(jobDescriptions),
            jobTypeDescriptions: jobDescriptions
        });

    } catch (error) {
        console.error('Error fetching cron job logs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /api/usage/cron-jobs/:id
// Get detailed information about a specific cron job execution
// Includes all successful reports, failures, and user details
router.get('/cron-jobs/:id', authenticateSuperAdmin, async (req, res) => {
    try {
        // Check if cron job logging is configured
        if (!CronJobLog) {
            return res.status(503).json({
                success: false,
                message: 'Cron job logging not available'
            });
        }

        const jobId = req.params.id;

        // Get the cron job log
        const cronJob = await CronJobLog.findById(jobId);

        if (!cronJob) {
            return res.status(404).json({
                success: false,
                message: 'Cron job log not found'
            });
        }

        // Extract unique phone numbers from all reports
        const phoneNumbers = new Set();
        
        if (cronJob.successfulReports) {
            cronJob.successfulReports.forEach(report => {
                if (report.phoneNumber) phoneNumbers.add(report.phoneNumber);
            });
        }
        
        if (cronJob.skippedReports) {
            cronJob.skippedReports.forEach(report => {
                if (report.phoneNumber) phoneNumbers.add(report.phoneNumber);
            });
        }
        
        if (cronJob.failures) {
            cronJob.failures.forEach(failure => {
                if (failure.phoneNumber) phoneNumbers.add(failure.phoneNumber);
            });
        }

        // Get user details from User collection
        const users = await User.find({
            phoneNumber: { $in: Array.from(phoneNumbers) }
        }).select('name phoneNumber email plan isTrial planActivatedAt acquisition');

        // Create a map for quick lookup
        const userMap = new Map(users.map(u => [u.phoneNumber, u]));

        // Enrich reports with user details
        const enrichedSuccessfulReports = cronJob.successfulReports?.map(report => {
            const user = userMap.get(report.phoneNumber);
            return {
                userName: report.userName,
                phoneNumber: report.phoneNumber,
                siteId: report.siteId,
                siteName: report.siteName,
                timestamp: report.timestamp,
                userDetails: user ? {
                    email: user.email,
                    plan: user.plan,
                    isTrial: user.isTrial,
                    planActivatedAt: user.planActivatedAt,
                    acquisition: user.acquisition
                } : null
            };
        }) || [];

        const enrichedSkippedReports = cronJob.skippedReports?.map(report => {
            const user = userMap.get(report.phoneNumber);
            return {
                userName: report.userName,
                phoneNumber: report.phoneNumber,
                siteId: report.siteId,
                siteName: report.siteName,
                reason: report.reason,
                timestamp: report.timestamp,
                userDetails: user ? {
                    email: user.email,
                    plan: user.plan,
                    isTrial: user.isTrial,
                    planActivatedAt: user.planActivatedAt,
                    acquisition: user.acquisition
                } : null
            };
        }) || [];

        const enrichedFailures = cronJob.failures?.map(failure => {
            const user = userMap.get(failure.phoneNumber);
            return {
                userName: failure.userName,
                phoneNumber: failure.phoneNumber,
                siteId: failure.siteId,
                siteName: failure.siteName,
                error: failure.error,
                timestamp: failure.timestamp,
                userDetails: user ? {
                    email: user.email,
                    plan: user.plan,
                    isTrial: user.isTrial,
                    planActivatedAt: user.planActivatedAt,
                    acquisition: user.acquisition
                } : null
            };
        }) || [];

        // Enrich user summary with full user details
        const enrichedUserSummary = cronJob.userSummary?.map(summary => {
            const user = userMap.get(summary.phoneNumber);
            return {
                userName: summary.userName,
                phoneNumber: summary.phoneNumber,
                totalSites: summary.totalSites,
                successfulSites: summary.successfulSites,
                failedSites: summary.failedSites,
                skippedSites: summary.skippedSites,
                successRate: summary.totalSites > 0
                    ? ((summary.successfulSites / summary.totalSites) * 100).toFixed(2)
                    : '0.00',
                userDetails: user ? {
                    email: user.email,
                    plan: user.plan,
                    isTrial: user.isTrial,
                    planActivatedAt: user.planActivatedAt,
                    acquisition: user.acquisition
                } : null
            };
        }) || [];

        res.json({
            success: true,
            cronJob: {
                _id: cronJob._id,
                jobName: cronJob.jobName,
                executionDate: cronJob.executionDate,
                status: cronJob.status,
                totalUsers: cronJob.totalUsers,
                totalSites: cronJob.totalSites,
                successCount: cronJob.successCount,
                failureCount: cronJob.failureCount,
                skippedCount: cronJob.skippedCount,
                executionTime: cronJob.executionTime,
                completedAt: cronJob.completedAt,
                metadata: cronJob.metadata,
                createdAt: cronJob.createdAt,
                updatedAt: cronJob.updatedAt
            },
            userSummary: enrichedUserSummary,
            successfulReports: enrichedSuccessfulReports,
            skippedReports: enrichedSkippedReports,
            failures: enrichedFailures,
            statistics: {
                totalReports: cronJob.successCount + cronJob.failureCount + cronJob.skippedCount,
                successRate: cronJob.successCount + cronJob.failureCount > 0
                    ? ((cronJob.successCount / (cronJob.successCount + cronJob.failureCount)) * 100).toFixed(2)
                    : '0.00',
                failureRate: cronJob.successCount + cronJob.failureCount > 0
                    ? ((cronJob.failureCount / (cronJob.successCount + cronJob.failureCount)) * 100).toFixed(2)
                    : '0.00',
                skipRate: cronJob.successCount + cronJob.failureCount + cronJob.skippedCount > 0
                    ? ((cronJob.skippedCount / (cronJob.successCount + cronJob.failureCount + cronJob.skippedCount)) * 100).toFixed(2)
                    : '0.00',
                executionTimeFormatted: cronJob.executionTime > 1000 
                    ? `${(cronJob.executionTime / 1000).toFixed(2)}s`
                    : `${cronJob.executionTime}ms`
            }
        });

    } catch (error) {
        console.error('Error fetching cron job details:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET /api/usage/cron-jobs/user/:phone
// Get all cron job reports for a specific user (by phone number)
// Shows which reports they received, failed, or were skipped
router.get('/cron-jobs/user/:phone', authenticateSuperAdmin, async (req, res) => {
    try {
        // Check if cron job logging is configured
        if (!CronJobLog) {
            return res.status(503).json({
                success: false,
                message: 'Cron job logging not available'
            });
        }

        const userPhone = req.params.phone;
        const period = req.query.period || 'month';
        const customStartDate = req.query.startDate;
        const customEndDate = req.query.endDate;

        const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);

        // Get user details
        const user = await User.findOne({ phoneNumber: userPhone })
            .select('name phoneNumber email plan isTrial planActivatedAt createdAt acquisition');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find all cron jobs where this user appears
        const cronJobs = await CronJobLog.find({
            executionDate: { $gte: startDate, $lte: endDate },
            $or: [
                { 'successfulReports.phoneNumber': userPhone },
                { 'skippedReports.phoneNumber': userPhone },
                { 'failures.phoneNumber': userPhone },
                { 'userSummary.phoneNumber': userPhone }
            ]
        }).sort({ executionDate: -1 });

        // Process each cron job to extract user-specific data
        const userReports = cronJobs.map(job => {
            const userSuccessful = job.successfulReports?.filter(r => r.phoneNumber === userPhone) || [];
            const userSkipped = job.skippedReports?.filter(r => r.phoneNumber === userPhone) || [];
            const userFailures = job.failures?.filter(f => f.phoneNumber === userPhone) || [];
            const userSummary = job.userSummary?.find(u => u.phoneNumber === userPhone) || null;

            return {
                jobId: job._id,
                jobName: job.jobName,
                executionDate: job.executionDate,
                status: job.status,
                metadata: job.metadata,
                userSummary: userSummary,
                successful: userSuccessful.map(r => ({
                    siteId: r.siteId,
                    siteName: r.siteName,
                    timestamp: r.timestamp
                })),
                skipped: userSkipped.map(r => ({
                    siteId: r.siteId,
                    siteName: r.siteName,
                    reason: r.reason,
                    timestamp: r.timestamp
                })),
                failures: userFailures.map(f => ({
                    siteId: f.siteId,
                    siteName: f.siteName,
                    error: f.error,
                    timestamp: f.timestamp
                })),
                counts: {
                    successful: userSuccessful.length,
                    skipped: userSkipped.length,
                    failed: userFailures.length,
                    total: userSuccessful.length + userSkipped.length + userFailures.length
                }
            };
        });

        // Calculate overall statistics for this user
        const totalSuccessful = userReports.reduce((sum, r) => sum + r.counts.successful, 0);
        const totalSkipped = userReports.reduce((sum, r) => sum + r.counts.skipped, 0);
        const totalFailed = userReports.reduce((sum, r) => sum + r.counts.failed, 0);
        const totalReports = totalSuccessful + totalSkipped + totalFailed;

        res.json({
            success: true,
            period: {
                type: customStartDate && customEndDate ? 'custom' : period,
                startDate,
                endDate
            },
            user: {
                name: user.name,
                phoneNumber: user.phoneNumber,
                email: user.email,
                plan: user.plan,
                isTrial: user.isTrial,
                acquisition: user.acquisition || null,
                planActivatedAt: user.planActivatedAt,
                registeredAt: user.createdAt
            },
            summary: {
                totalCronJobs: cronJobs.length,
                totalReports: totalReports,
                totalSuccessful: totalSuccessful,
                totalSkipped: totalSkipped,
                totalFailed: totalFailed,
                successRate: totalSuccessful + totalFailed > 0
                    ? ((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(2)
                    : '0.00'
            },
            reports: userReports
        });

    } catch (error) {
        console.error('Error fetching user cron job reports:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// POST /api/usage/cleanup
// Clean up old usage logs (admin only)
router.post('/cleanup', authenticateSuperAdmin, async (req, res) => {
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
router.get('/health', authenticateSuperAdmin, async (req, res) => {
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

// GET /api/usage/site-labour-stats
// NEW: Aggregates labour data by site for a specific month/year
router.get('/site-labour-stats', authenticateSuperAdmin, async (req, res) => {
    try {
        const { month, year } = req.query;
        
        // Default to current month/year if not provided
        const now = new Date();
        const searchMonth = month ? parseInt(month) : now.getMonth() + 1; // 1-12
        const searchYear = year ? parseInt(year) : now.getFullYear();

        const stats = await Employee.aggregate([
            // 1. FILTER: Get only this month's data
            {
                $match: {
                    month: searchMonth,
                    year: searchYear
                }
            },

            // 2. GROUP: Calculate the counts first (Reduces dataset size significantly)
            {
                $group: {
                    _id: "$siteID",              // This is the Link to the Site Collection
                    totalLabours: { $sum: 1 }
                }
            },

            // 3. FIRST LOOKUP: Fetch Site Details (to get 'sitename' and 'owner' ID)
            {
                $lookup: {
                    from: "sites",               // Name of your Site collection
                    localField: "_id",           // The _id from our Group stage (which is the siteID)
                    foreignField: "_id",         // The _id in the Site collection
                    as: "siteData"
                }
            },
            
            // 4. UNWIND: Flatten the site array (since 1 ID = 1 Site)
            { $unwind: "$siteData" },

            // 5. SECOND LOOKUP: Fetch User/Owner Details (using the ID we just got from step 3)
            {
                $lookup: {
                    from: "users",               // Name of your User collection
                    localField: "siteData.owner",// We grab the owner ID from the previous lookup
                    foreignField: "_id",         // Match it against _id in Users collection
                    as: "ownerData"
                }
            },

            // 6. UNWIND: Flatten the owner array
            { $unwind: "$ownerData" },

            // 7. PROJECT: Clean up the output to show only what you need
            {
                $project: {
                    _id: 0,                           // Hide the messy ID
                    SiteName: "$siteData.sitename",   // From Site Collection
                    OwnerName: "$ownerData.name",     // From User Collection
                    OwnerPhone: "$ownerData.phoneNumber", // Optional: Add phone if needed
                    OwnerPlan: "$ownerData.plan",     // Owner's plan
                    OwnerIsTrial: "$ownerData.isTrial", // Trial status
                    OwnerAcquisition: "$ownerData.acquisition", // Attribution data
                    EmployeeCount: "$totalLabours"    // From the Group stage
                }
            },

            // 8. SORT: High to Low
            {
                $sort: { EmployeeCount: -1 }
            }
        ]);

        res.json({
            success: true,
            period: { month: searchMonth, year: searchYear },
            data: stats
        });

    } catch (error) {
        console.error('Error fetching site labour stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;

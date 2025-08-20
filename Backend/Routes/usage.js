const express = require('express');
const router = express.Router();
const ApiUsageLog = require('../models/ApiUsageLog');
const { authenticateAndTrack } = require('../Middleware/usageTracker');
const { authorizeRole } = require('../Middleware/auth');
const { getUserUsageStats, checkUsageLimits } = require('../Middleware/usageTracker');
const { logConnection } = require('../config/logDatabase');

// GET /api/usage/dashboard
// Provides a summary of API usage grouped by user.
// Only accessible by admin users
router.get('/dashboard', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        // Identify users strictly by phone; tolerate missing nested fields
        const usageData = await ApiUsageLog.aggregate([
            // Normalize fields and keep only what we need
            {
                $project: {
                    phone: { $ifNull: ['$userPhone', '$phone'] },
                    name: { $ifNull: ['$userName', null] },
                    plan: { $ifNull: ['$userPlan', 'unknown'] },
                    actorId: { $ifNull: ['$actor.id', null] },
                    actorRole: { $ifNull: ['$actor.role', null] },
                    supervisorName: { $ifNull: ['$supervisor.profileName', null] },
                    endpoint: 1,
                    responseSizeBytes: { $ifNull: ['$responseSizeBytes', 0] },
                    timestamp: 1
                }
            },
            // Group by phone + actor to build per-actor breakdown per phone
            {
                $group: {
                    _id: {
                        phone: '$phone',
                        name: '$name',
                        actorId: '$actorId',
                        actorRole: '$actorRole',
                        supervisorName: '$supervisorName',
                        plan: '$plan'
                    },
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    endpointsCalled: { $addToSet: '$endpoint' }
                }
            },
            // Group again by phone to form the dashboard rows
            {
                $group: {
                    _id: { phone: '$_id.phone', name: '$_id.name' },
                    totalRequests: { $sum: '$totalRequests' },
                    totalDataBytes: { $sum: '$totalDataBytes' },
                    usageByActor: {
                        $push: {
                            actorId: '$_id.actorId',
                            actorRole: '$_id.actorRole',
                            supervisorName: '$_id.supervisorName',
                            plan: '$_id.plan',
                            requests: '$totalRequests',
                            dataBytes: '$totalDataBytes',
                            endpoints: '$endpointsCalled'
                        }
                    }
                }
            },
            // Final projection; pick a representative plan (first seen) if multiple
            {
                $project: {
                    _id: 0,
                    userId: '$_id.phone', // Keep legacy name but equals phone
                    phone: '$_id.phone',
                    name: '$_id.name',
                    plan: {
                        $let: {
                            vars: { plans: { $map: { input: '$usageByActor', as: 'u', in: '$$u.plan' } } },
                            in: { $ifNull: [ { $arrayElemAt: ['$$plans', 0] }, 'unknown' ] }
                        }
                    },
                    totalRequests: 1,
                    totalDataBytes: 1,
                    usageByActor: 1
                }
            },
            { $sort: { totalDataBytes: -1 } }
        ]);

        res.json(usageData);

    } catch (error) {
        console.error('Error fetching usage dashboard data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

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

// GET /api/usage/endpoint-stats
// Get usage statistics by endpoint
router.get('/endpoint-stats', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

    const endpointStats = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$endpoint',
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    avgResponseSize: { $avg: '$responseSizeBytes' },
            uniqueUsers: { $addToSet: { $ifNull: ['$userPhone', '$phone'] } },
                    methods: { $addToSet: '$method' }
                }
            },
            {
                $project: {
                    endpoint: '$_id',
                    totalRequests: 1,
                    totalDataBytes: 1,
                    avgResponseSize: { $round: ['$avgResponseSize', 2] },
            uniqueUserCount: { $size: '$uniqueUsers' },
                    methods: 1,
                    _id: 0
                }
            },
            {
                $sort: { totalRequests: -1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                period: `Last ${days} days`,
                endpoints: endpointStats
            }
        });
    } catch (error) {
        console.error('Error fetching endpoint stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/usage/plan-usage
// Get usage breakdown by plan type
router.get('/plan-usage', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

    const planUsage = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
            _id: { $ifNull: ['$userPlan', 'unknown'] },
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
            uniqueUsers: { $addToSet: { $ifNull: ['$userPhone', '$phone'] } },
                    avgRequestsPerUser: { $avg: 1 }
                }
            },
            {
                $project: {
                    plan: '$_id',
                    totalRequests: 1,
                    totalDataBytes: 1,
                    uniqueUserCount: { $size: '$uniqueUsers' },
                    avgDataPerUser: {
                        $round: [{ $divide: ['$totalDataBytes', { $size: '$uniqueUsers' }] }, 2]
                    },
                    _id: 0
                }
            },
            {
                $sort: { totalRequests: -1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                period: `Last ${days} days`,
                planBreakdown: planUsage
            }
        });
    } catch (error) {
        console.error('Error fetching plan usage stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/usage/real-time
// Get real-time usage statistics
router.get('/real-time', authenticateAndTrack, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Check if logging database is configured
        if (!ApiUsageLog) {
            return res.status(503).json({
                success: false,
                message: 'Usage tracking not available: Logging database not configured'
            });
        }

        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

    const realTimeStats = await ApiUsageLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: last24Hours }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d %H:00',
                            date: '$timestamp'
                        }
                    },
                    requests: { $sum: 1 },
                    dataBytes: { $sum: '$responseSizeBytes' },
            uniqueUsers: { $addToSet: { $ifNull: ['$userPhone', '$phone'] } }
                }
            },
            {
                $project: {
                    hour: '$_id',
                    requests: 1,
                    dataBytes: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    _id: 0
                }
            },
            {
                $sort: { hour: 1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                period: 'Last 24 hours',
                hourlyStats: realTimeStats
            }
        });
    } catch (error) {
        console.error('Error fetching real-time stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

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

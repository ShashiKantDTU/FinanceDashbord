const express = require('express');
const router = express.Router();
const ApiUsageLog = require('../models/ApiUsageLog');
const { authenticateToken, authorizeRole } = require('../Middleware/auth');
const { getUserUsageStats, checkUsageLimits } = require('../Middleware/usageTracker');

// GET /api/usage/dashboard
// Provides a summary of API usage grouped by user.
// Only accessible by admin users
router.get('/dashboard', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
        const usageData = await ApiUsageLog.aggregate([
            // Stage 1: Group by the main user and the specific actor (user or supervisor)
            {
                $group: {
                    _id: {
                        mainUserId: '$mainUserId',
                        userPhone: '$userPhone',
                        userPlan: '$userPlan',
                        actorId: '$actor.id',
                        actorRole: '$actor.role',
                        supervisorName: '$supervisor.profileName',
                    },
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    endpointsCalled: { $addToSet: '$endpoint' } // List unique endpoints called
                }
            },
            // Stage 2: Group the results again, this time only by the main user
            {
                $group: {
                    _id: '$_id.mainUserId',
                    phone: { $first: '$_id.userPhone' },
                    plan: { $first: '$_id.userPlan' },
                    totalRequests: { $sum: '$totalRequests' },
                    totalDataBytes: { $sum: '$totalDataBytes' },
                    // Create an array of usage by each actor (user or their supervisors)
                    usageByActor: {
                        $push: {
                            actorId: '$_id.actorId',
                            actorRole: '$_id.actorRole',
                            supervisorName: '$_id.supervisorName',
                            requests: '$totalRequests',
                            dataBytes: '$totalDataBytes',
                            endpoints: '$endpointsCalled'
                        }
                    }
                }
            },
            // Stage 3: Project for a cleaner output
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    phone: 1,
                    plan: 1,
                    totalRequests: 1,
                    totalDataBytes: 1,
                    usageByActor: 1,
                }
            },
            // Optional: Sort by the highest usage
            {
                $sort: {
                    totalDataBytes: -1
                }
            }
        ]);

        res.json(usageData);

    } catch (error) {
        console.error('Error fetching usage dashboard data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/usage/my-stats
// Get current user's usage statistics
router.get('/my-stats', authenticateToken, async (req, res) => {
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
router.get('/endpoint-stats', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
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
                    uniqueUsers: { $addToSet: '$mainUserId' },
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
router.get('/plan-usage', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
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
                    _id: '$userPlan',
                    totalRequests: { $sum: 1 },
                    totalDataBytes: { $sum: '$responseSizeBytes' },
                    uniqueUsers: { $addToSet: '$mainUserId' },
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
router.get('/real-time', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
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
                    uniqueUsers: { $addToSet: '$mainUserId' }
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
router.post('/cleanup', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
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

module.exports = router;

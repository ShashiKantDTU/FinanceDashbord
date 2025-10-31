const express = require('express');
const router = express.Router();
const { authenticateSuperAdmin } = require('../Middleware/superAdminAuth');
const { 
    addUserToTracking, 
    removeUserFromTracking, 
    isUserBeingTracked,
    getUserCallCount 
} = require('../Middleware/apiCallTracker');
const { redisClient } = require('../config/redisClient');

// Protect all routes with super admin auth
router.use(authenticateSuperAdmin);

/**
 * Add user to API tracking
 * POST /api/super-admin/api-tracking/add
 * Body: { phoneNumber: "+919876543210" }
 */
router.post('/add', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }
        
        const success = await addUserToTracking(phoneNumber);
        
        if (success) {
            res.status(200).json({
                success: true,
                message: `User ${phoneNumber} added to API tracking`,
                expiresIn: '10 days'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to add user to tracking'
            });
        }
    } catch (error) {
        console.error('Error adding user to tracking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * Remove user from API tracking
 * POST /api/super-admin/api-tracking/remove
 * Body: { phoneNumber: "+919876543210" }
 */
router.post('/remove', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }
        
        const success = await removeUserFromTracking(phoneNumber);
        
        if (success) {
            res.status(200).json({
                success: true,
                message: `User ${phoneNumber} removed from API tracking`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to remove user from tracking'
            });
        }
    } catch (error) {
        console.error('Error removing user from tracking:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * Get user tracking status and call count
 * GET /api/super-admin/api-tracking/status/:phoneNumber
 */
router.get('/status/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        const isTracked = await isUserBeingTracked(phoneNumber);
        const callCount = await getUserCallCount(phoneNumber);
        
        res.status(200).json({
            success: true,
            data: {
                phoneNumber,
                isBeingTracked: isTracked,
                apiCallCount: callCount,
                threshold: 20,
                status: callCount >= 20 ? 'threshold_reached' : 'tracking'
            }
        });
    } catch (error) {
        console.error('Error getting tracking status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * List all users being tracked
 * GET /api/super-admin/api-tracking/list
 */
router.get('/list', async (req, res) => {
    try {
        const TRACKING_SET_KEY = 'api:track:users';
        const CALL_COUNT_KEY_PREFIX = 'api:calls:';
        
        // Get all users from sorted set with scores
        // Redis v4+ returns array of objects: [{ value: 'phone', score: timestamp }, ...]
        const usersWithScores = await redisClient.zRangeWithScores(TRACKING_SET_KEY, 0, -1);
        
        const trackedUsers = [];
        
        // Process each user object
        for (const user of usersWithScores) {
            const phoneNumber = user.value;
            const expiryTimestamp = user.score;
            
            // Skip if invalid timestamp
            if (isNaN(expiryTimestamp)) {
                console.warn(`⚠️ Invalid expiry timestamp for ${phoneNumber}, skipping`);
                continue;
            }
            
            // Get call count
            const callCountKey = `${CALL_COUNT_KEY_PREFIX}${phoneNumber}`;
            const count = await redisClient.get(callCountKey);
            
            trackedUsers.push({
                phoneNumber,
                callCount: count ? parseInt(count, 10) : 0,
                expiresAt: new Date(expiryTimestamp).toISOString(),
                daysRemaining: Math.ceil((expiryTimestamp - Date.now()) / (1000 * 60 * 60 * 24))
            });
        }
        
        // Sort by call count descending
        trackedUsers.sort((a, b) => b.callCount - a.callCount);
        
        res.status(200).json({
            success: true,
            data: {
                totalUsers: trackedUsers.length,
                users: trackedUsers,
                threshold: 20
            }
        });
    } catch (error) {
        console.error('Error listing tracked users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * Bulk add users to tracking
 * POST /api/super-admin/api-tracking/bulk-add
 * Body: { phoneNumbers: ["+919876543210", "+919876543211", ...] }
 */
router.post('/bulk-add', async (req, res) => {
    try {
        const { phoneNumbers } = req.body;
        
        if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
            return res.status(400).json({
                success: false,
                message: 'phoneNumbers array is required'
            });
        }
        
        const results = {
            success: [],
            failed: []
        };
        
        for (const phoneNumber of phoneNumbers) {
            const success = await addUserToTracking(phoneNumber);
            if (success) {
                results.success.push(phoneNumber);
            } else {
                results.failed.push(phoneNumber);
            }
        }
        
        res.status(200).json({
            success: true,
            message: `Added ${results.success.length}/${phoneNumbers.length} users to tracking`,
            data: results
        });
    } catch (error) {
        console.error('Error bulk adding users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;

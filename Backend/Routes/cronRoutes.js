const express = require('express');
const router = express.Router();
const cronJobService = require('../services/cronJobs');
const User = require('../models/Userschema');
const JWT = require('jsonwebtoken');

// Middleware to restrict access to specific admin user
const adminOnlyMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = JWT.verify(token, process.env.JWT_SECRET);

    // Find user by ID from token
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not found.'
      });
    }

    // Check if user has the specific phone number
    if (user.phoneNumber !== '+919354739451') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    // Add user to request object for use in routes
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token.'
    });
  }
};

// Apply middleware to all routes in this router
router.use(adminOnlyMiddleware);

// Get status of all cron jobs
router.get('/status', (req, res) => {
  try {
    const status = cronJobService.getJobsStatus();
    res.json({
      success: true,
      jobs: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting cron job status',
      error: error.message
    });
  }
});

// Manual trigger for expired users check
router.post('/trigger/expired-users', async (req, res) => {
  try {
    await cronJobService.manualTriggerExpiredUsers();
    res.json({
      success: true,
      message: 'Expired users check triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering expired users check',
      error: error.message
    });
  }
});

// Manual trigger for grace expired users check
router.post('/trigger/grace-expired', async (req, res) => {
  try {
    await cronJobService.manualTriggerGraceExpired();
    res.json({
      success: true,
      message: 'Grace expired users check triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering grace expired users check',
      error: error.message
    });
  }
});

// Stop all cron jobs (for maintenance)
router.post('/stop-all', (req, res) => {
  try {
    cronJobService.stopAllJobs();
    res.json({
      success: true,
      message: 'All cron jobs stopped successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error stopping cron jobs',
      error: error.message
    });
  }
});

// Restart all cron jobs
router.post('/restart', (req, res) => {
  try {
    cronJobService.stopAllJobs();
    cronJobService.init();
    res.json({
      success: true,
      message: 'All cron jobs restarted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error restarting cron jobs',
      error: error.message
    });
  }
});

module.exports = router;
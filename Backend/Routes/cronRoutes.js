const express = require('express');
const router = express.Router();
const cronJobService = require('../services/cronJobs');
const User = require('../models/Userschema');
const JWT = require('jsonwebtoken');

const { authenticateSuperAdmin } = require('../Middleware/superAdminAuth');

// Apply middleware to all routes in this router
router.use(authenticateSuperAdmin);

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

// Manual trigger for weekly report Week 1
router.post('/trigger/weekly-week1', async (req, res) => {
  try {
    await cronJobService.manualTriggerWeeklyReportWeek1();
    res.json({
      success: true,
      message: 'Weekly Report Week 1 (Days 1-7) triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering Weekly Report Week 1',
      error: error.message
    });
  }
});

// Manual trigger for weekly report Week 2
router.post('/trigger/weekly-week2', async (req, res) => {
  try {
    await cronJobService.manualTriggerWeeklyReportWeek2();
    res.json({
      success: true,
      message: 'Weekly Report Week 2 (Days 8-14) triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering Weekly Report Week 2',
      error: error.message
    });
  }
});

// Manual trigger for weekly report Week 3
router.post('/trigger/weekly-week3', async (req, res) => {
  try {
    await cronJobService.manualTriggerWeeklyReportWeek3();
    res.json({
      success: true,
      message: 'Weekly Report Week 3 (Days 15-21) triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering Weekly Report Week 3',
      error: error.message
    });
  }
});

// Manual trigger for weekly report Week 4
router.post('/trigger/weekly-week4', async (req, res) => {
  try {
    await cronJobService.manualTriggerWeeklyReportWeek4();
    res.json({
      success: true,
      message: 'Weekly Report Week 4 (Days 22-28+) triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering Weekly Report Week 4',
      error: error.message
    });
  }
});

// Manual trigger for monthly report
router.post('/trigger/monthly-report', async (req, res) => {
  try {
    await cronJobService.manualTriggerMonthlyReport();
    res.json({
      success: true,
      message: 'Monthly Report triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering Monthly Report',
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

// Manual trigger for counter synchronization (fire-and-forget)
router.post('/trigger/counter-sync', async (req, res) => {
  try {
    // Use the Service method instead of requiring the Util directly
    // This keeps logging consistent and code cleaner
    cronJobService.manualTriggerCounterSync()
      .catch(err => console.error("❌ Background Manual Sync Error:", err));
    
    // Respond immediately (Fire-and-Forget)
    res.json({
      success: true,
      message: 'Counter sync started in background. Check CronJobLog for results.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering counter sync',
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
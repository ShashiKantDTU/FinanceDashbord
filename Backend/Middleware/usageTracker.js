const ApiUsageLog = require('../models/ApiUsageLog');
const User = require('../models/Userschema');
const { Supervisor } = require('../models/supervisorSchema');
const { authenticateToken } = require('./auth');

/**
 * Usage Tracking Middleware
 * 
 * This middleware should be placed AFTER authenticateToken middleware
 * It captures API usage data for analytics and billing purposes
 * 
 * Usage: app.use(usageTracker);
 */
const usageTracker = async (req, res, next) => {
  // Skip tracking for certain endpoints to avoid noise
  const skipEndpoints = [
    '/api/usage/dashboard',
    '/api/usage/stats',
    '/api/health',
    '/favicon.ico',
    '/robots.txt'
  ];

  // Skip if endpoint should not be tracked
  if (skipEndpoints.some(endpoint => req.path.includes(endpoint))) {
    return next();
  }

  // Skip if no user is authenticated (public endpoints)
  if (!req.user) {
    return next();
  }

  // Store original res.json and res.send to capture response data
  const originalJson = res.json;
  const originalSend = res.send;
  let responseData = null;
  let responseSizeBytes = 0;

  // Override res.json to capture response data
  res.json = function (data) {
    responseData = data;
    responseSizeBytes = JSON.stringify(data).length;
    return originalJson.call(this, data);
  };

  // Override res.send to capture response data
  res.send = function (data) {
    if (!responseData) {
      responseData = data;
      responseSizeBytes = typeof data === 'string' ? data.length : JSON.stringify(data).length;
    }
    return originalSend.call(this, data);
  };

  // Attach the finish event listener BEFORE calling next()
  res.on('finish', async () => {
    try {
      await logApiUsage(req, res, responseSizeBytes);
    } catch (error) {
      console.error('Error logging API usage:', error);
      // Don't throw error to avoid affecting the main request
    }
  });

  // Continue to the next middleware/route
  next();
};

/**
 * Log API usage to the database
 */
const logApiUsage = async (req, res, responseSizeBytes) => {
  try {
    // Check if ApiUsageLog model is available (logging database configured)
    if (!ApiUsageLog) {
      console.warn('⚠️  Usage tracking skipped: MONGO_URI_LOGS not configured');
      return;
    }

    const { user } = req;
    // Determine the main user ID (the account owner who will be billed)
    let mainUserId;
    let userPhone;
    let userPlan;
    let actorInfo;
    let supervisorInfo = {};

    if (user.role === 'Supervisor') {
      // For supervisor requests, find the owner (main user)
      const supervisor = await Supervisor.findOne({ userId: user.email }).populate('owner');

      if (!supervisor || !supervisor.owner) {
        console.warn('Supervisor owner not found for usage tracking:', user.email);
        return;
      }

      mainUserId = supervisor.owner._id;
      userPhone = supervisor.owner.phoneNumber;
      userPlan = supervisor.owner.plan || 'free';

      actorInfo = {
        id: supervisor._id.toString(),
        role: 'Supervisor'
      };

      supervisorInfo = {
        id: supervisor._id,
        profileName: supervisor.name || 'Unknown Supervisor'
      };
    } else {
      // For regular user requests
      const userData = await User.findById(user.id);

      if (!userData) {
        console.warn('User not found for usage tracking:', user.id);
        return;
      }

      mainUserId = userData._id;
      userPhone = userData.phoneNumber;
      userPlan = userData.plan || 'free';

      actorInfo = {
        id: userData._id.toString(),
        role: 'User'
      };
    }

    // Create the usage log entry
    const usageLog = new ApiUsageLog({
      mainUserId,
      userPhone,
      userPlan,
      actor: actorInfo,
      supervisor: Object.keys(supervisorInfo).length > 0 ? supervisorInfo : undefined,
      endpoint: req.path,
      method: req.method,
      status: res.statusCode,
      responseSizeBytes: responseSizeBytes || 0,
      timestamp: new Date()
    });

    await usageLog.save();

  } catch (error) {
    console.error('Error in logApiUsage:', error);
  }
};

/**
 * Enhanced usage tracker with request details
 * Captures additional metadata like IP, user agent, etc.
 */
const enhancedUsageTracker = async (req, res, next) => {
  // Add request metadata to req object for later use
  req.usageMetadata = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    requestStartTime: Date.now()
  };

  return usageTracker(req, res, next);
};

/**
 * Get usage statistics for a specific user
 */
const getUserUsageStats = async (userId, days = 30) => {
  try {
    // Check if ApiUsageLog model is available
    if (!ApiUsageLog) {
      throw new Error('Usage tracking not available: MONGO_URI_LOGS not configured');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await ApiUsageLog.aggregate([
      {
        $match: {
          mainUserId: userId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalDataBytes: { $sum: '$responseSizeBytes' },
          uniqueEndpoints: { $addToSet: '$endpoint' },
          avgResponseSize: { $avg: '$responseSizeBytes' }
        }
      }
    ]);

    return stats[0] || {
      totalRequests: 0,
      totalDataBytes: 0,
      uniqueEndpoints: [],
      avgResponseSize: 0
    };
  } catch (error) {
    console.error('Error getting user usage stats:', error);
    throw error;
  }
};

/**
 * Check if user has exceeded their plan limits
 */
const checkUsageLimits = async (userId, userPlan) => {
  try {
    // Check if ApiUsageLog model is available
    if (!ApiUsageLog) {
      throw new Error('Usage tracking not available: MONGO_URI_LOGS not configured');
    }

    // Define plan limits (adjust as needed)
    const planLimits = {
      free: {
        requestsPerMonth: 1000,
        dataPerMonth: 10 * 1024 * 1024 // 10MB
      },
      pro: {
        requestsPerMonth: 10000,
        dataPerMonth: 100 * 1024 * 1024 // 100MB
      },
      premium: {
        requestsPerMonth: 100000,
        dataPerMonth: 1024 * 1024 * 1024 // 1GB
      }
    };

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const usage = await ApiUsageLog.aggregate([
      {
        $match: {
          mainUserId: userId,
          timestamp: { $gte: currentMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalDataBytes: { $sum: '$responseSizeBytes' }
        }
      }
    ]);

    const currentUsage = usage[0] || { totalRequests: 0, totalDataBytes: 0 };
    const limits = planLimits[userPlan] || planLimits.free;

    return {
      withinLimits: currentUsage.totalRequests <= limits.requestsPerMonth &&
        currentUsage.totalDataBytes <= limits.dataPerMonth,
      usage: currentUsage,
      limits: limits,
      percentageUsed: {
        requests: (currentUsage.totalRequests / limits.requestsPerMonth) * 100,
        data: (currentUsage.totalDataBytes / limits.dataPerMonth) * 100
      }
    };
  } catch (error) {
    console.error('Error checking usage limits:', error);
    throw error;
  }
};

/**
 * Combined middleware that does authentication first, then usage tracking
 * Use this instead of applying authenticateToken and usageTracker separately
 */
const authenticateAndTrack = async (req, res, next) => {
  // First, authenticate the user
  authenticateToken(req, res, (authError) => {
    if (authError) {
      return next(authError);
    }
    
    // If authentication succeeds, apply usage tracking
    usageTracker(req, res, next);
  });
};

module.exports = {
  usageTracker,
  enhancedUsageTracker,
  getUserUsageStats,
  checkUsageLimits,
  authenticateAndTrack
};
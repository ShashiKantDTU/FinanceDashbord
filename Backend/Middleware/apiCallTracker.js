const { redisClient } = require('../config/redisClient');

// Configuration
const TRACKING_EXPIRY_DAYS = 10;
const TRACKING_EXPIRY_SECONDS = TRACKING_EXPIRY_DAYS * 24 * 60 * 60; // 10 days
const API_CALL_THRESHOLD = 50; // Threshold for immediate action execution

// Redis key patterns
const TRACKING_SET_KEY = 'api:track:users'; // Sorted set: phone -> expiry timestamp
const CALL_COUNT_KEY_PREFIX = 'api:calls:'; // String: phone -> count

/**
 * Add a user to the tracking list
 * This should be called when a new user registers or when you want to start tracking
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<boolean>} - Success status
 */
async function addUserToTracking(phoneNumber) {
    if (!phoneNumber) return false;
    
    try {
        const expiryTimestamp = Date.now() + (TRACKING_EXPIRY_SECONDS * 1000);
        
        // Add to sorted set with expiry timestamp as score
        await redisClient.zAdd(TRACKING_SET_KEY, {
            score: expiryTimestamp,
            value: phoneNumber
        });
        
        // Initialize call counter with expiry
        const callCountKey = `${CALL_COUNT_KEY_PREFIX}${phoneNumber}`;
        await redisClient.setEx(callCountKey, TRACKING_EXPIRY_SECONDS, '0');
        
        console.log(`✅ Added user ${phoneNumber} to API tracking (expires in ${TRACKING_EXPIRY_DAYS} days)`);
        return true;
    } catch (error) {
        console.error(`❌ Error adding user to tracking: ${phoneNumber}`, error.message);
        return false;
    }
}

/**
 * Remove a user from tracking list
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<boolean>} - true if user was removed, false if already gone
 */
async function removeUserFromTracking(phoneNumber) {
    if (!phoneNumber) return false;
    
    try {
        // Remove from sorted set - ATOMIC operation
        // zRem returns number of elements removed (1 if existed, 0 if not)
        const removedFromSet = await redisClient.zRem(TRACKING_SET_KEY, phoneNumber);
        
        // Delete call counter
        const callCountKey = `${CALL_COUNT_KEY_PREFIX}${phoneNumber}`;
        await redisClient.del(callCountKey);
        
        // Only return true if user was actually in the sorted set
        const wasRemoved = removedFromSet > 0;
        
        if (wasRemoved) {
            console.log(`🗑️ Removed user ${phoneNumber} from API tracking`);
        }
        
        return wasRemoved;
    } catch (error) {
        console.error(`❌ Error removing user from tracking: ${phoneNumber}`, error.message);
        return false;
    }
}

/**
 * Check if user is in tracking list
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<boolean>} - True if being tracked
 */
async function isUserBeingTracked(phoneNumber) {
    if (!phoneNumber) return false;
    
    try {
        const score = await redisClient.zScore(TRACKING_SET_KEY, phoneNumber);
        
        // If score exists, check if not expired
        if (score !== null) {
            const now = Date.now();
            if (score > now) {
                return true; // Still valid
            } else {
                // Expired, clean up
                await removeUserFromTracking(phoneNumber);
                return false;
            }
        }
        
        return false;
    } catch (error) {
        console.error(`❌ Error checking tracking status: ${phoneNumber}`, error.message);
        return false;
    }
}

/**
 * Get user's current API call count
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<number>} - Call count (0 if not tracked)
 */
async function getUserCallCount(phoneNumber) {
    if (!phoneNumber) return 0;
    
    try {
        const callCountKey = `${CALL_COUNT_KEY_PREFIX}${phoneNumber}`;
        const count = await redisClient.get(callCountKey);
        return count ? parseInt(count, 10) : 0;
    } catch (error) {
        console.error(`❌ Error getting call count: ${phoneNumber}`, error.message);
        return 0;
    }
}

/**
 * Execute action immediately when user hits threshold
 * NOTE: User should already be removed from tracking BEFORE calling this function
 * This ensures the action only executes ONCE, even with concurrent requests
 * @param {string} phoneNumber - User's phone number
 * @param {number} callCount - Final call count
 * @param {object} userInfo - Additional user info from req.user
 */
async function executeThresholdAction(phoneNumber, callCount, userInfo = {}) {
    if (!phoneNumber) return;
    
    try {
        console.log(`⚡ Executing action for ${phoneNumber}: ${callCount} API calls`);
        
        // ⚡ YOUR CUSTOM ACTION EXECUTES HERE IMMEDIATELY ⚡
        // This runs right away (fire-and-forget, won't block API)

        try {
            // 1. Use user details from userInfo (already fetched during authentication)
            // OPTIMIZATION: No additional DB query needed, data passed from req.user
            const username = userInfo.name || 'User';
            const language = userInfo.language || 'en'; // 'en', 'hi', or 'hing'
            
            console.log(`📤 Sending onboarding template to ${phoneNumber} (${username}, ${language})`);
            
            // 2. Send WhatsApp onboarding template message with video header
            // NOTE: phoneNumber from DB has + prefix (e.g., +919354739451)
            //       sendOnboardingTemplate() uses normalizePhone() to remove + for Meta API
            // Media ID is automatically selected based on language from config
            const { sendOnboardingTemplate } = require('../Utils/whatsappTemplates');
            const result = await sendOnboardingTemplate(phoneNumber, username, language);
            
            if (result.sent) {
                console.log(`✅ Onboarding template sent successfully: ${result.messageId}`);
            } else if (result.skipped) {
                console.warn(`⚠️ Template sending skipped: ${result.reason}`);
            } else {
                console.error(`❌ Failed to send template: ${result.error.message}`);
            }
            
        
            console.log(`✅ Threshold action completed for ${phoneNumber}`);
            
        } catch (error) {
            console.error(`❌ Error executing threshold action for ${phoneNumber}:`, error.message);
            // Don't retry - user is already removed from tracking
        }
    } catch (error) {
        console.error(`❌ Error in executeThresholdAction for ${phoneNumber}:`, error.message);
        // Log but don't throw - this is fire-and-forget
    }
}

/**
 * Clean up expired users from tracking set
 * Should be called periodically by cron job
 */
async function cleanupExpiredUsers() {
    try {
        const now = Date.now();
        
        // Remove all entries with score (expiry timestamp) less than now
        const removed = await redisClient.zRemRangeByScore(TRACKING_SET_KEY, 0, now);
        
        if (removed > 0) {
            console.log(`🧹 Cleaned up ${removed} expired users from tracking`);
        }
        
        return removed;
    } catch (error) {
        console.error('❌ Error cleaning up expired users:', error.message);
        return 0;
    }
}

/**
 * Middleware to track API calls for specific users
 * NON-BLOCKING: Uses fire-and-forget approach to avoid delaying responses
 */
function apiCallTracker(req, res, next) {
    // Skip if user info not available (not authenticated)
    if (!req.user || !req.user.phoneNumber) {
        return next();
    }
    
    const phoneNumber = req.user.phoneNumber;
    
    // Fire-and-forget tracking logic (no await, won't delay response)
    (async () => {
        try {
            // Check if user is being tracked
            const isTracked = await isUserBeingTracked(phoneNumber);
            
            if (!isTracked) {
                return; // Skip - not in tracking list
            }
            
            // Increment call counter atomically
            const callCountKey = `${CALL_COUNT_KEY_PREFIX}${phoneNumber}`;
            const newCount = await redisClient.incr(callCountKey);
            
            // Reset expiry on counter (extend tracking window)
            await redisClient.expire(callCountKey, TRACKING_EXPIRY_SECONDS);
            
            console.log(`📊 API call tracked for ${phoneNumber}: ${newCount}/${API_CALL_THRESHOLD} calls`);
            
            // Check if threshold reached
            if (newCount < API_CALL_THRESHOLD) {
                return; // Below threshold, keep tracking
            }
            
            // Threshold reached - REMOVE USER FIRST to prevent duplicate execution
            console.log(`🎯 Threshold reached for user ${phoneNumber}: ${newCount} calls`);
            
            // CRITICAL: Remove from tracking IMMEDIATELY to prevent race conditions
            // This ensures the action only executes ONCE even if multiple requests come simultaneously
            const removed = await removeUserFromTracking(phoneNumber);
            
            if (!removed) {
                // Another request already removed this user (race condition handled)
                console.log(`⚠️ User ${phoneNumber} already removed - skipping duplicate action`);
                return;
            }
            
            console.log(`🗑️ User ${phoneNumber} removed from tracking - executing action NOW`);
            
            // Now execute action (fire-and-forget, won't remove user again)
            // OPTIMIZATION: Pass language from req.user to avoid DB query in executeThresholdAction
            executeThresholdAction(phoneNumber, newCount, {
                id: req.user.id,
                name: req.user.name,
                role: req.user.role,
                email: req.user.email,
                language: req.user.language // Add language to avoid DB lookup
            }).catch(err => {
                console.error(`❌ Error executing action for ${phoneNumber}:`, err.message);
            });
            
        } catch (error) {
            // Silent failure - don't break API flow
            console.error(`API tracker error for ${phoneNumber}:`, error.message);
        }
    })();
    
    // Continue immediately (non-blocking)
    next();
}

// Export middleware and utilities
module.exports = {
    apiCallTracker,
    addUserToTracking,
    removeUserFromTracking,
    isUserBeingTracked,
    getUserCallCount,
    cleanupExpiredUsers,
    executeThresholdAction // Export for manual testing
};

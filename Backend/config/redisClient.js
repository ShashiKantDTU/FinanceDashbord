// Centralized Redis client
// Responsible for creating a singleton Redis client, initializing it on server startup,
// and providing a graceful shutdown method.
const redis = require('redis');

// Create the client instance (not connected yet)
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('✅ Connected to Redis'));
redisClient.on('end', () => console.log('❌ Redis connection closed'));

// Initialize (idempotent)
async function initRedis() {
  if (redisClient.isOpen) return redisClient;
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message);
    throw err;
  }
  return redisClient;
}

// Graceful shutdown
async function shutdownRedis() {
  if (redisClient.isOpen) {
    try {
      await redisClient.quit();
    } catch (err) {
      console.error('Error during Redis shutdown:', err.message);
    }
  }
}

module.exports = { redisClient, initRedis, shutdownRedis };

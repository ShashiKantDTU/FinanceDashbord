const { redisClient } = require('./config/redisClient');

async function checkRedisData() {
    try {
        // Connect to Redis first
        await redisClient.connect();
        console.log('✅ Connected to Redis\n');
        
        console.log('Checking Redis data for API tracking...\n');
        
        // Get all users with scores
        const users = await redisClient.zRange('api:track:users', 0, -1, { WITHSCORES: true });
        
        console.log('Raw data from Redis:', users);
        console.log('\nProcessing users:');
        
        for (let i = 0; i < users.length; i += 2) {
            const phoneNumber = users[i];
            const score = users[i + 1];
            
            console.log(`\nPhone: ${phoneNumber}`);
            console.log(`Score (raw): ${score}`);
            console.log(`Score type: ${typeof score}`);
            console.log(`Score parsed: ${parseInt(score, 10)}`);
            console.log(`Is NaN: ${isNaN(parseInt(score, 10))}`);
            
            const timestamp = parseInt(score, 10);
            if (!isNaN(timestamp)) {
                console.log(`Date: ${new Date(timestamp).toISOString()}`);
            }
        }
        
        await redisClient.quit();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await redisClient.quit().catch(() => {});
        process.exit(1);
    }
}

checkRedisData();

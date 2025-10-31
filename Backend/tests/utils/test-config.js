/**
 * Test Configuration
 * Edit these values to customize your test parameters
 */

// Log loaded environment variables for debugging
console.log('\n🔧 WhatsApp Configuration Loaded:');
console.log(`   Template Name: ${process.env.WHATSAPP_REPORT_TEMPLATE_NAME || 'report_delivery'}`);
console.log(`   Phone Number ID: ${process.env.META_PHONE_NUMBER_ID ? '✓ Loaded' : '✗ Missing'}`);
console.log(`   Access Token: ${process.env.META_ACCESS_TOKEN ? '✓ Loaded (' + process.env.META_ACCESS_TOKEN.substring(0, 20) + '...)' : '✗ Missing'}`);
console.log(`   AWS Bucket: ${process.env.AWS_BUCKET_NAME || '✗ Missing'}\n`);

module.exports = {
    // Test user configuration
    testUser: {
        _id: "685ea4b3d1d66ef1033d6782",
        name: "Sunny Poddar",
        email: "sunnypoddar1919@gmail.com",
        phoneNumber: "+919354739451", // ⚠️ EDIT: Your test phone number
        calculationType: "default"
    },
    
    // Test parameters
    testSiteId: "68ee282b41993bb4a9485e06", // ⚠️ EDIT: Your test site ID
    testMonth: 10, // October
    testYear: 2025,
    testWeek: 2, // Week 2 of the month
    
    // MongoDB connection
    mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/finance-dashboard',
    
    // WhatsApp API configuration
    whatsapp: {
        accessToken: process.env.META_ACCESS_TOKEN,
        phoneNumberId: process.env.META_PHONE_NUMBER_ID,
        templateName: process.env.WHATSAPP_REPORT_TEMPLATE_NAME || 'report_delivery'
    },
    
    // AWS S3 configuration
    aws: {
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        bucketName: process.env.AWS_BUCKET_NAME
    },
    
    // Test options
    options: {
        // Add delays between messages (milliseconds)
        messageDelay: 2000,
        
        // Cleanup temp files after test
        cleanupTempFiles: true,
        
        // Verbose logging
        verbose: true
    }
};

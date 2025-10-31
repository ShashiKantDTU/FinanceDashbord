/**
 * Test script for WhatsApp Template Message functionality
 * Uses PRODUCTION logic and server media IDs
 * 
 * Usage: node test-whatsapp-templates.js [phoneNumber]
 * Example: node test-whatsapp-templates.js 919354739451
 * 
 * Prerequisites:
 * - Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in .env file
 * - Set MONGO_URI in .env file for database access
 * - Ensure templates are approved in Meta Business Manager
 */

require('dotenv').config();
const { sendOnboardingTemplate } = require('./Utils/whatsappTemplates');
const mongoose = require('mongoose');
const Userschema = require('./models/Userschema');
const templateConfig = require('./config/whatsappTemplateConfig');

// Get phone number from command line or use default
const TEST_PHONE = process.argv[2] || '919354739451';

/**
 * Normalize phone for Meta API (remove +)
 * DB stores with +, Meta API needs without +
 */
function normalizePhoneForMeta(phone) {
    return phone.replace(/[^0-9]/g, '');
}

/**
 * Format phone for DB query (add + if not present)
 * DB stores: +919354739451
 * User input: 919354739451 or +919354739451
 */
function formatPhoneForDB(phone) {
    const cleaned = phone.replace(/[^0-9]/g, '');
    return `+${cleaned}`;
}

/**
 * Test sending onboarding template using production logic
 */
async function testProductionTemplate() {
    console.log('\n🧪 Testing WhatsApp Template with Production Logic\n');
    console.log('='.repeat(70));
    console.log(`📱 Input Phone Number: ${TEST_PHONE}`);
    
    // Format for different uses
    const phoneForDB = formatPhoneForDB(TEST_PHONE);      // +919354739451 (DB format)
    const phoneForMeta = normalizePhoneForMeta(TEST_PHONE); // 919354739451 (Meta API format)
    
    console.log(`📱 DB Query Format: ${phoneForDB}`);
    console.log(`📱 Meta API Format: ${phoneForMeta}\n`);

    // Check credentials
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
        console.error('❌ META_ACCESS_TOKEN or META_PHONE_NUMBER_ID not configured');
        console.error('   Please add these to your .env file');
        return;
    }

    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI not configured');
        console.error('   Please add this to your .env file');
        return;
    }

    console.log('✅ Meta credentials found');
    console.log('✅ MongoDB URI found\n');

    try {
        // Connect to MongoDB
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Fetch user data from database (production logic)
        console.log('👤 Fetching user data from database...');
        
        // DB stores phone with + prefix, so query with +
        const user = await Userschema.findOne({ phoneNumber: phoneForDB });

        let userName = 'User';
        let language = 'en';

        if (user) {
            userName = user.name || 'User';
            language = user.language || 'en';
            console.log(`✅ User found in database:`);
            console.log(`   Phone (stored): ${user.phoneNumber}`);
            console.log(`   Name: ${userName}`);
            console.log(`   Language: ${language}`);
        } else {
            console.log(`⚠️  User not found in database`);
            console.log(`   Queried: ${phoneForDB}`);
            console.log(`   Using defaults:`);
            console.log(`   Name: ${userName}`);
            console.log(`   Language: ${language}`);
        }

        // Get media ID from production config
        const mediaId = templateConfig.getVideoMediaId(language);
        const templateName = templateConfig.getTemplateName(language);

        console.log(`\n📋 Template Configuration:`);
        console.log(`   Template: ${templateName}`);
        console.log(`   Media ID: ${mediaId}`);
        console.log(`   Language: ${language}\n`);

        // Send template using production function (no hardcoded media ID)
        console.log('📤 Sending WhatsApp template...\n');
        const result = await sendOnboardingTemplate(
            phoneForMeta,  // Use Meta API format (without +)
            userName,
            language
            // Note: No mediaId parameter - uses production config automatically
        );

        console.log('─'.repeat(70));
        
        if (result.sent) {
            console.log(`\n✅ SUCCESS: Template sent successfully!`);
            console.log(`   Message ID: ${result.messageId}`);
            console.log(`   Template: ${result.template}`);
            console.log(`   Phone: ${result.phone}`);
        } else if (result.skipped) {
            console.log(`\n⚠️  SKIPPED: ${result.reason}`);
        } else {
            console.log(`\n❌ FAILED: ${result.error.message}`);
            console.log(`   Category: ${result.error.category}`);
            console.log(`   Status: ${result.error.status}`);
            if (result.error.code) {
                console.log(`   Error Code: ${result.error.code}`);
            }
        }
        
        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error(`\n❌ Exception: ${error.message}`);
        console.error(error.stack);
    } finally {
        // Disconnect from MongoDB
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

/**
 * Run test
 */
async function runTest() {
    console.log('\n🚀 WhatsApp Template Test (Production Mode)\n');
    console.log('📅 ' + new Date().toLocaleString());
    console.log('');

    await testProductionTemplate();

    console.log('\n🎉 Test completed!\n');
}

// Run test
runTest().catch(error => {
    console.error('\n💥 Fatal error in test execution:', error);
    process.exit(1);
});


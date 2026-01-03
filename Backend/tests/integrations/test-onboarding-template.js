/**
 * 📱 Onboarding Template Test
 * 
 * Tests the WhatsApp onboarding template (onbordingv2en) with payouts.mp4 video
 * - Validates template configuration
 * - Tests actual message sending to specified phone
 * - Verifies media ID and smart retry mechanism
 * 
 * Usage:
 *   node run-tests.js        # Select option 14
 *   node run-tests.js --onboarding
 */

require('dotenv').config();
const { sendOnboardingTemplate } = require('../../Utils/whatsappTemplates');
const templateConfig = require('../../config/whatsappTemplateConfig');
const { getMediaStorage } = require('../../Utils/mediaExpiryManager');

// Test configuration
const DEFAULT_TEST_PHONE = '919354739451';

/**
 * Validate onboarding template configuration
 */
async function validateOnboardingConfig() {
    console.log('🔍 Validating Onboarding Template Configuration...\n');
    
    const results = {
        template: { valid: false, value: null },
        mediaIds: { valid: false, value: null },
        storage: { valid: false, value: null }
    };
    
    // Check template name
    const templateName = templateConfig.getTemplateName('en');
    results.template.value = templateName;
    results.template.valid = templateName === 'onbordingv2en';
    console.log(`Template Name: ${templateName} ${results.template.valid ? '✅' : '❌ Expected: onbordingv2en'}`);
    
    // Check media IDs
    const mediaId = templateConfig.getVideoMediaId('en');
    results.mediaIds.value = mediaId;
    results.mediaIds.valid = mediaId && mediaId.length > 10;
    console.log(`Media ID (en): ${mediaId} ${results.mediaIds.valid ? '✅' : '❌ Invalid or missing'}`);
    
    // Check storage file
    try {
        const storage = await getMediaStorage();
        const enMedia = storage.media['en'];
        results.storage.value = enMedia;
        results.storage.valid = enMedia && enMedia.sourceUrl.includes('payouts.mp4');
        console.log(`Video URL: ${enMedia?.sourceUrl} ${results.storage.valid ? '✅' : '❌ Expected: payouts.mp4'}`);
        
        if (enMedia?.expiresAt) {
            const expiresAt = new Date(enMedia.expiresAt);
            const daysLeft = Math.floor((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
            console.log(`Media Expiry: ${daysLeft} days remaining ${daysLeft > 7 ? '✅' : '⚠️ Expires soon'}`);
        }
    } catch (error) {
        console.log(`Storage Check: ❌ ${error.message}`);
    }
    
    const allValid = results.template.valid && results.mediaIds.valid && results.storage.valid;
    
    return {
        success: allValid,
        message: allValid ? 'All configuration valid' : 'Configuration issues found',
        details: results
    };
}

/**
 * Test sending onboarding template
 */
async function testOnboardingTemplateSend(phoneNumber = DEFAULT_TEST_PHONE) {
    console.log(`\n📤 Testing Onboarding Template Send...\n`);
    console.log(`Phone: ${phoneNumber}`);
    console.log(`Template: ${templateConfig.getTemplateName('en')}`);
    console.log(`Media ID: ${templateConfig.getVideoMediaId('en')}\n`);
    
    try {
        const result = await sendOnboardingTemplate(
            phoneNumber,
            'Test User',
            'en'
        );
        
        if (result.sent) {
            console.log('✅ Message sent successfully!');
            console.log(`   Message ID: ${result.messageId}`);
            console.log(`   Template: ${result.template}`);
            return {
                success: true,
                message: `Template sent successfully: ${result.messageId}`,
                details: { messageId: result.messageId, template: result.template }
            };
        } else if (result.skipped) {
            console.log(`⚠️ Skipped: ${result.reason}`);
            return {
                success: false,
                message: `Skipped: ${result.reason}`
            };
        } else {
            console.log(`❌ Failed: ${result.error.message}`);
            console.log(`   Category: ${result.error.category}`);
            return {
                success: false,
                message: result.error.message,
                details: { category: result.error.category, code: result.error.code }
            };
        }
    } catch (error) {
        console.log(`❌ Exception: ${error.message}`);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Full onboarding template test (config + send)
 */
async function testOnboardingTemplate(phoneNumber = DEFAULT_TEST_PHONE) {
    console.log('\n' + '='.repeat(70));
    console.log('📱 ONBOARDING TEMPLATE TEST (onbordingv2en + payouts.mp4)');
    console.log('='.repeat(70) + '\n');
    
    // Step 1: Validate configuration
    const configResult = await validateOnboardingConfig();
    
    if (!configResult.success) {
        console.log('\n⚠️ Configuration issues detected. Fix before sending.\n');
        return configResult;
    }
    
    // Step 2: Send test message
    const sendResult = await testOnboardingTemplateSend(phoneNumber);
    
    console.log('\n' + '='.repeat(70));
    
    return sendResult;
}

/**
 * Config validation only (no send)
 */
async function testOnboardingConfigOnly() {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 ONBOARDING CONFIGURATION CHECK');
    console.log('='.repeat(70) + '\n');
    
    return await validateOnboardingConfig();
}

module.exports = {
    testOnboardingTemplate,
    testOnboardingConfigOnly,
    validateOnboardingConfig,
    testOnboardingTemplateSend
};

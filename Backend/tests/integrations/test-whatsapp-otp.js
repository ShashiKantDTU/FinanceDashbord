/**
 * 🔐 WhatsApp OTP Test
 * 
 * Tests the WhatsApp OTP authentication template
 * - Validates OTP send functionality
 * - Tests actual OTP delivery to specified phone
 * 
 * Usage:
 *   node run-tests.js        # Select option 15
 *   node run-tests.js --otp
 */

require('dotenv').config();
const { sendWhatsAppOtp } = require('../../Utils/whatsappOtp');

// Test configuration
const DEFAULT_TEST_PHONE = '919354739451';
const DEFAULT_TEST_OTP = '123456';

/**
 * Test sending OTP via WhatsApp
 */
async function testWhatsAppOtp(phoneNumber = DEFAULT_TEST_PHONE, otp = DEFAULT_TEST_OTP) {
    console.log('\n' + '='.repeat(70));
    console.log('🔐 WHATSAPP OTP TEST');
    console.log('='.repeat(70) + '\n');
    
    console.log(`📱 Phone: ${phoneNumber}`);
    console.log(`🔢 OTP: ${otp}`);
    console.log(`📋 Template: auth\n`);
    
    try {
        console.log('📤 Sending OTP via WhatsApp...\n');
        const result = await sendWhatsAppOtp(phoneNumber, otp, 600);
        
        if (result.sent) {
            console.log('✅ OTP sent successfully!');
            console.log(`   Message ID: ${result.id}`);
            return {
                success: true,
                message: `OTP sent successfully: ${result.id}`,
                details: { messageId: result.id, phone: phoneNumber }
            };
        } else if (result.skipped) {
            console.log('⚠️ OTP skipped: META credentials not configured');
            return {
                success: false,
                message: 'Skipped: META credentials not configured'
            };
        } else {
            console.log(`❌ OTP failed: ${result.error.message}`);
            console.log(`   Category: ${result.error.category}`);
            console.log(`   Retryable: ${result.error.retryable}`);
            return {
                success: false,
                message: result.error.message,
                details: { 
                    category: result.error.category, 
                    retryable: result.error.retryable 
                }
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
 * Generate random 6-digit OTP
 */
function generateTestOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
    testWhatsAppOtp,
    generateTestOtp,
    DEFAULT_TEST_PHONE,
    DEFAULT_TEST_OTP
};

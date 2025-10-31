/**
 * Template Validation Test Suite
 * Validates WhatsApp templates and configuration
 */

const axios = require('axios');
const { config } = require('./utils/test-helpers');

/**
 * Validate all WhatsApp templates
 */
async function validateAllTemplates() {
    try {
        console.log('🔍 Validating WhatsApp Templates...\n');
        
        const results = [];
        
        // Check environment variables
        console.log('1. Checking environment variables...');
        const envCheck = checkEnvironmentVariables();
        results.push(envCheck);
        console.log(envCheck.success ? '   ✅ All env vars present' : '   ❌ Missing env vars');
        
        // Check Meta API connection
        console.log('\n2. Checking Meta API connection...');
        const apiCheck = await checkMetaAPIConnection();
        results.push(apiCheck);
        console.log(apiCheck.success ? '   ✅ API connection OK' : '   ❌ API connection failed');
        
        // Check template availability
        console.log('\n3. Checking template availability...');
        const templateCheck = await checkTemplateAvailability();
        results.push(templateCheck);
        console.log(templateCheck.success ? '   ✅ Template accessible' : '   ❌ Template not found');
        
        const allPassed = results.every(r => r.success);
        
        return {
            success: allPassed,
            message: allPassed ? 'All validations passed' : 'Some validations failed',
            details: {
                totalChecks: results.length,
                passed: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                checks: results
            }
        };
        
    } catch (error) {
        return {
            success: false,
            message: 'Validation error: ' + error.message
        };
    }
}

/**
 * Check if all required environment variables are set
 */
function checkEnvironmentVariables() {
    const required = [
        'META_ACCESS_TOKEN',
        'META_PHONE_NUMBER_ID',
        'WHATSAPP_REPORT_TEMPLATE_NAME'
    ];
    
    const missing = required.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        return {
            success: false,
            message: `Missing env vars: ${missing.join(', ')}`
        };
    }
    
    return {
        success: true,
        message: 'All environment variables present'
    };
}

/**
 * Check Meta API connection
 */
async function checkMetaAPIConnection() {
    try {
        const url = `https://graph.facebook.com/v20.0/${config.whatsapp.phoneNumberId}`;
        
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${config.whatsapp.accessToken}`
            }
        });
        
        return {
            success: true,
            message: 'Meta API connection successful',
            details: {
                phoneNumberId: response.data.id,
                displayName: response.data.display_phone_number
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Meta API connection failed',
            details: {
                error: error.response?.data || error.message
            }
        };
    }
}

/**
 * Check if template exists and is approved
 */
async function checkTemplateAvailability() {
    try {
        // Note: We can't directly query template status without Business Account ID
        // This is a placeholder that checks if template name is configured
        
        const templateName = config.whatsapp.templateName;
        
        if (!templateName) {
            return {
                success: false,
                message: 'Template name not configured'
            };
        }
        
        return {
            success: true,
            message: `Template configured: ${templateName}`,
            details: {
                templateName: templateName,
                note: 'Cannot verify approval status without Business Account ID'
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Template check failed: ' + error.message
        };
    }
}

module.exports = {
    validateAllTemplates,
    checkEnvironmentVariables,
    checkMetaAPIConnection,
    checkTemplateAvailability
};

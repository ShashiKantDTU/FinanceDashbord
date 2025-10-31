/**
 * Weekly Report Test Suite
 * Contains all weekly report related tests
 */

const { sendWeeklyReport } = require('../scripts/whatsappReport');
const {
    getTestConfig,
    config
} = require('./utils/test-helpers');

/**
 * Test weekly report with template (Production mode)
 */
async function testWeeklyReportTemplate() {
    const testConfig = getTestConfig();
    const { user, siteId, month, year, week } = testConfig;
    
    try {
        console.log(`📊 Testing Weekly Report - Template Mode`);
        console.log(`   Period: ${month}/${year} - Week ${week}`);
        console.log(`   Site: ${siteId}\n`);
        
        const result = await sendWeeklyReport(user, siteId, month, year, week);
        
        return {
            success: result.success,
            message: result.message,
            details: {
                period: result.period,
                week: week,
                reportType: 'template'
            }
        };
        
    } catch (error) {
        return {
            success: false,
            message: error.message,
            details: { error: error.stack }
        };
    }
}

/**
 * Test weekly report with custom messages (24-hour window)
 * Note: Reuses monthly report custom message pattern
 */
async function testWeeklyReportCustomMessage() {
    const testConfig = getTestConfig();
    const { user, siteId, month, year, week } = testConfig;
    
    try {
        console.log(`📊 Testing Weekly Report - Custom Message Mode`);
        console.log(`   Period: ${month}/${year} - Week ${week}`);
        console.log(`   Site: ${siteId}\n`);
        
        console.log('⚠️  Note: Weekly custom message mode uses same pattern as monthly');
        console.log('   For now, using template-based weekly report...\n');
        
        const result = await sendWeeklyReport(user, siteId, month, year, week);
        
        return {
            success: result.success,
            message: 'Weekly report sent (template mode - custom message mode not yet implemented)',
            details: {
                period: result.period,
                week: week,
                reportType: 'template (fallback)'
            }
        };
        
    } catch (error) {
        return {
            success: false,
            message: error.message,
            details: { error: error.stack }
        };
    }
}

module.exports = {
    testWeeklyReportTemplate,
    testWeeklyReportCustomMessage
};

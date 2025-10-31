/**
 * Monthly Report Test Suite
 * Contains all monthly report related tests
 */

const { generatePaymentReportPdf } = require('../Routes/pdfReports');
const { generateFullPayrollReportWithRealData } = require('../Utils/generatePayrollWithRealData');
const siteSchema = require('../models/Siteschema');
const {
    getTestConfig,
    uploadToS3,
    sendWhatsAppText,
    sendWhatsAppDocument,
    sendWhatsAppTemplate,
    delay,
    getMonthName,
    config
} = require('./utils/test-helpers');

/**
 * Test monthly report with template (Production mode)
 */
async function testMonthlyReportTemplate() {
    const testConfig = getTestConfig();
    const { user, siteId, month, year } = testConfig;
    
    try {
        console.log(`📅 Testing Monthly Report - Template Mode`);
        console.log(`   Period: ${month}/${year}`);
        console.log(`   Site: ${siteId}\n`);
        
        // Fetch site details
        const site = await siteSchema.findById(siteId);
        const siteName = site ? site.sitename : 'Unknown Site';
        const period = `${getMonthName(month)} ${year}`;
        
        // Generate PDF
        console.log('📄 Generating PDF...');
        const pdfResult = await generatePaymentReportPdf(user, siteId, month, year);
        console.log(`   ✅ PDF generated: ${pdfResult.employeeCount} employees`);
        
        // Upload PDF to S3
        console.log('☁️  Uploading PDF to S3...');
        const pdfUrl = await uploadToS3(pdfResult.buffer, pdfResult.filename, 'application/pdf');
        console.log('   ✅ PDF uploaded');
        
        // Generate Excel
        console.log('📊 Generating Excel...');
        const excelBuffer = await generateFullPayrollReportWithRealData({
            siteID: siteId,
            month: month,
            year: year,
            calculationType: user.calculationType || 'default'
        });
        const excelFilename = `Monthly_Excel_${month}_${year}.xlsx`;
        console.log('   ✅ Excel generated');
        
        // Upload Excel to S3
        console.log('☁️  Uploading Excel to S3...');
        const excelUrl = await uploadToS3(
            excelBuffer, 
            excelFilename, 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        console.log('   ✅ Excel uploaded');
        
        // Send PDF via template
        console.log('📤 Sending PDF via WhatsApp template...');
        const pdfParams = [user.name, 'Monthly', period, siteName, 'PDF'];
        await sendWhatsAppTemplate(
            user.phoneNumber,
            config.whatsapp.templateName,
            pdfParams,
            pdfUrl,
            pdfResult.filename
        );
        console.log('   ✅ PDF sent');
        
        await delay(2000);
        
        // Send Excel via template
        console.log('📤 Sending Excel via WhatsApp template...');
        const excelParams = [user.name, 'Monthly', period, siteName, 'Excel'];
        await sendWhatsAppTemplate(
            user.phoneNumber,
            config.whatsapp.templateName,
            excelParams,
            excelUrl,
            excelFilename
        );
        console.log('   ✅ Excel sent');
        
        return {
            success: true,
            message: 'Monthly report sent successfully via template',
            details: {
                period,
                siteName,
                employeeCount: pdfResult.employeeCount,
                messagesSent: 2
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
 * Test monthly report with custom messages (24-hour window)
 */
async function testMonthlyReportCustomMessage() {
    const testConfig = getTestConfig();
    const { user, siteId, month, year } = testConfig;
    
    try {
        console.log(`📅 Testing Monthly Report - Custom Message Mode`);
        console.log(`   Period: ${month}/${year}`);
        console.log(`   Site: ${siteId}\n`);
        
        // Fetch site details
        const site = await siteSchema.findById(siteId);
        const siteName = site ? site.sitename : 'Unknown Site';
        const period = `${getMonthName(month)} ${year}`;
        
        // Generate PDF
        console.log('📄 Generating PDF...');
        const pdfResult = await generatePaymentReportPdf(user, siteId, month, year);
        console.log(`   ✅ PDF generated: ${pdfResult.employeeCount} employees`);
        
        // Upload PDF
        console.log('☁️  Uploading PDF to S3...');
        const pdfUrl = await uploadToS3(pdfResult.buffer, pdfResult.filename, 'application/pdf');
        console.log('   ✅ PDF uploaded');
        
        // Generate Excel
        console.log('📊 Generating Excel...');
        const excelBuffer = await generateFullPayrollReportWithRealData({
            siteID: siteId,
            month: month,
            year: year,
            calculationType: user.calculationType || 'default'
        });
        const excelFilename = `Monthly_Excel_${month}_${year}.xlsx`;
        console.log('   ✅ Excel generated');
        
        // Upload Excel
        console.log('☁️  Uploading Excel to S3...');
        const excelUrl = await uploadToS3(
            excelBuffer,
            excelFilename,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        console.log('   ✅ Excel uploaded');
        
        // Send welcome message
        console.log('💬 Sending welcome message...');
        const welcomeMsg = `Hello ${user.name}! 👋\n\n` +
            `Your monthly payroll report is ready:\n` +
            `📅 Period: ${period}\n` +
            `🏗️  Site: ${siteName}\n` +
            `👥 Employees: ${pdfResult.employeeCount}\n\n` +
            `You will receive 2 files (PDF & Excel).`;
        await sendWhatsAppText(user.phoneNumber, welcomeMsg);
        console.log('   ✅ Welcome sent');
        
        await delay();
        
        // Send PDF
        console.log('📄 Sending PDF document...');
        const pdfCaption = `📄 Monthly Report - PDF\nPeriod: ${period}\nSite: ${siteName}`;
        await sendWhatsAppDocument(user.phoneNumber, pdfUrl, pdfResult.filename, pdfCaption);
        console.log('   ✅ PDF sent');
        
        await delay();
        
        // Send Excel
        console.log('📊 Sending Excel document...');
        const excelCaption = `📊 Monthly Report - Excel\nPeriod: ${period}\nSite: ${siteName}`;
        await sendWhatsAppDocument(user.phoneNumber, excelUrl, excelFilename, excelCaption);
        console.log('   ✅ Excel sent');
        
        await delay();
        
        // Send closing message
        console.log('💬 Sending closing message...');
        const closingMsg = `✅ Reports delivered successfully!\n\n` +
            `Both PDF and Excel reports are ready.\n\n` +
            `Thank you for using Site Haazri! 🙏`;
        await sendWhatsAppText(user.phoneNumber, closingMsg);
        console.log('   ✅ Closing sent');
        
        return {
            success: true,
            message: 'Monthly report sent successfully with custom messages',
            details: {
                period,
                siteName,
                employeeCount: pdfResult.employeeCount,
                messagesSent: 4
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
 * Test PDF generation only (no WhatsApp)
 */
async function testPdfGenerationOnly() {
    const testConfig = getTestConfig();
    const { user, siteId, month, year } = testConfig;
    
    try {
        console.log('📄 Testing PDF generation...');
        
        const pdfResult = await generatePaymentReportPdf(user, siteId, month, year);
        
        return {
            success: true,
            message: 'PDF generated successfully',
            details: {
                filename: pdfResult.filename,
                employeeCount: pdfResult.employeeCount,
                sizeKB: Math.round(pdfResult.buffer.length / 1024)
            }
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Test Excel generation only (no WhatsApp)
 */
async function testExcelGenerationOnly() {
    const testConfig = getTestConfig();
    const { user, siteId, month, year } = testConfig;
    
    try {
        console.log('📊 Testing Excel generation...');
        
        const excelBuffer = await generateFullPayrollReportWithRealData({
            siteID: siteId,
            month: month,
            year: year,
            calculationType: user.calculationType || 'default'
        });
        
        return {
            success: true,
            message: 'Excel generated successfully',
            details: {
                sizeKB: Math.round(excelBuffer.length / 1024)
            }
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Test S3 upload only
 */
async function testS3UploadOnly() {
    try {
        console.log('☁️  Testing S3 upload...');
        
        const testBuffer = Buffer.from('Test file content');
        const testFilename = `test_${Date.now()}.txt`;
        
        const url = await uploadToS3(testBuffer, testFilename, 'text/plain');
        
        return {
            success: true,
            message: 'S3 upload successful',
            details: {
                filename: testFilename,
                urlLength: url.length,
                expiresIn: '7 days'
            }
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

module.exports = {
    testMonthlyReportTemplate,
    testMonthlyReportCustomMessage,
    testPdfGenerationOnly,
    testExcelGenerationOnly,
    testS3UploadOnly
};

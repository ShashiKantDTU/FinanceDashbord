// Load environment variables from the .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');

// Validate environment variables on load
const requiredEnvVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'META_ACCESS_TOKEN', 'META_PHONE_NUMBER_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
}

const { generatePaymentReportPdf } = require('../Routes/pdfReports');
const { generateFullPayrollReportWithRealData } = require('../Utils/generatePayrollWithRealData');

// Import necessary AWS libraries
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize S3 client with credentials from .env
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});


// Send WhatsApp text message (for fallback)
async function sendMetaTextMessage(recipientNumber, messageText) {
    const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: recipientNumber,
        type: 'text',
        text: {
            preview_url: true,
            body: messageText,
        },
    };

    const headers = {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        console.error('❌ WhatsApp text message failed:');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

// Send WhatsApp document message
async function sendMetaDocumentMessage(recipientNumber, documentUrl, filename, caption) {
    const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: recipientNumber,
        type: 'document',
        document: {
            link: documentUrl,
            filename: filename,
            caption: caption
        },
    };

    const headers = {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        console.error('❌ WhatsApp document message failed:');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

// Generate PDF and upload to S3, return signed URL
function generateAndUploadReportPdf(user, siteID, month, year) {
    return new Promise(async (resolve, reject) => {
        try {
            // Generate the PDF report
            const pdfResult = await generatePaymentReportPdf(user, siteID, month, year);

            // Extract the buffer from the result object
            const pdfBuffer = pdfResult.buffer;
            const filename = pdfResult.filename;

            // Ensure we have a proper Buffer
            if (!Buffer.isBuffer(pdfBuffer)) {
                console.error('🔍 PDF Buffer Debug:');
                console.error(`Type: ${typeof pdfBuffer}`);
                console.error(`Is Buffer: ${Buffer.isBuffer(pdfBuffer)}`);
                console.error(`Length: ${pdfBuffer?.length || 'undefined'}`);
                throw new Error('PDF generation did not return a valid buffer');
            }

            // Upload the PDF report to S3
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: filename, // Use the generated filename
                Body: pdfBuffer,
                ContentType: 'application/pdf',
            };
            const command = new PutObjectCommand(params);
            await s3Client.send(command);

            // Get the signed URL for the uploaded PDF report
            const getObjectParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: params.Key,
            };
            const url = await getSignedUrl(s3Client, new GetObjectCommand(getObjectParams));

            resolve(url);
        } catch (error) {
            reject(error);
        }
    });
}

// Generate Excel and upload to S3, return signed URL
function generateAndUploadReportExcel(user, siteID, month, year) {
    return new Promise(async (resolve, reject) => {
        try {
            // Generate the Excel report
            const excelBuffer = await generateFullPayrollReportWithRealData({
                siteID,
                month,
                year,
                calculationType: user?.calculationType || 'default'
            });

            // Ensure we have a proper Buffer
            if (!Buffer.isBuffer(excelBuffer)) {
                console.error('🔍 Excel Buffer Debug:');
                console.error(`Type: ${typeof excelBuffer}`);
                console.error(`Is Buffer: ${Buffer.isBuffer(excelBuffer)}`);
                console.error(`Length: ${excelBuffer?.length || 'undefined'}`);
                throw new Error('Excel generation did not return a valid buffer');
            }

            // Create filename with timestamp
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            const monthName = monthNames[month - 1];
            const filename = `Payroll_Report_${siteID}_${monthName}_${year}_${timestamp}.xlsx`;

            // Upload the Excel report to S3
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: filename,
                Body: excelBuffer,
                ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };
            const command = new PutObjectCommand(params);
            await s3Client.send(command);

            // Get the signed URL for the uploaded Excel report
            const getObjectParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: params.Key,
            };
            const url = await getSignedUrl(s3Client, new GetObjectCommand(getObjectParams));

            resolve({ url, filename });
        } catch (error) {
            reject(error);
        }
    });
}

// Generate message templates
function generateMonthlyReportTemplate(user, siteID, month, year) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = monthNames[month - 1];

    return `Hi ${user.name},

Your ${monthName} ${year} payroll report is ready.

📄 *Monthly Report*
• Complete attendance record
• Payment calculations
• Overtime & bonus details

Please download and review the attached document.

Questions? Contact your site supervisor.

*Site Haazri*
support@sitehaazri.com`;
}

function generateWeeklyReportTemplate(user, siteID, weekNumber, month, year) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = monthNames[month - 1];

    return `Hi ${user.name},

Your Week ${weekNumber} reports are ready.

📊 *Weekly Package*
• PDF: Summary & payments
• Excel: Detailed data & formulas

Both files include attendance records and calculations for ${monthName} ${year}.

*Site Haazri*
support@sitehaazri.com`;
}

// Send Monthly Report - Main function for monthly cron job
async function sendMonthlyReport(userObject, siteId, month, year) {
    try {
        // Validate required parameters
        if (!userObject || !userObject.phoneNumber || !userObject.name) {
            throw new Error('Invalid user object - missing required fields (phoneNumber, name)');
        }

        if (!siteId || !month || !year) {
            throw new Error('Missing required parameters: siteId, month, or year');
        }

        // Use phone number directly (remove + prefix if present)
        let phoneNumber = userObject.phoneNumber.trim();
        if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1);
        }

        // Validate month and year ranges
        if (month < 1 || month > 12) {
            throw new Error('Month must be between 1 and 12');
        }

        if (year < 2020 || year > 2030) {
            throw new Error('Year must be between 2020 and 2030');
        }

        console.log(`📅 Sending monthly report for ${userObject.name} - ${month}/${year} - Site: ${siteId}`);

        // Generate monthly report message template
        const messageText = generateMonthlyReportTemplate(userObject, siteId, month, year);
        const filename = `Monthly_Report_${month}_${year}_${userObject.name.replace(/\s+/g, '_')}.pdf`;

        // Generate both PDF and Excel reports
        console.log('📄 Generating PDF report...');
        const pdfUrl = await generateAndUploadReportPdf(userObject, siteId, month, year);

        console.log('📊 Generating Excel report...');
        const excelResult = await generateAndUploadReportExcel(userObject, siteId, month, year);

        // Send PDF document first
        await sendMetaDocumentMessage(
            phoneNumber,
            pdfUrl,
            filename,
            messageText
        );

        // Send Excel document second
        const excelFilename = `Monthly_Report_Excel_${month}_${year}_${userObject.name.replace(/\s+/g, '_')}.xlsx`;
        await sendMetaDocumentMessage(
            phoneNumber,
            excelResult.url,
            excelFilename,
            `📊 *Excel Report*

Detailed monthly attendance data with automated calculations.

• Complete monthly attendance grid
• Live formulas & calculations
• Employee payment details
• Ready for analysis

Open in Excel or Google Sheets.`
        );

        const successMessage = `✅ Monthly report sent successfully to ${userObject.name}`;
        console.log(successMessage);

        return {
            success: true,
            message: successMessage,
            reportType: 'monthly',
            user: userObject.name,
            phone: phoneNumber,
            period: `${month}/${year}`,
            siteId: siteId
        };

    } catch (error) {
        // Handle "no employees found" error gracefully
        if (error.message && error.message.includes('No employees found')) {
            const skipMessage = `⏭️  Skipping report for ${userObject?.name || 'Unknown'}: ${error.message}`;
            console.log(skipMessage);
            return {
                success: false,
                skipped: true,
                message: skipMessage,
                reason: 'no_employees',
                reportType: 'monthly',
                user: userObject?.name || 'Unknown',
                phone: phoneNumber,
                period: `${month}/${year}`,
                siteId: siteId
            };
        }

        const errorMessage = `❌ Error sending monthly report to ${userObject?.name || 'Unknown'}: ${error.message}`;
        console.error(errorMessage);

        // Clean phone number for fallback
        let fallbackPhone = 'Unknown';
        if (userObject?.phoneNumber) {
            fallbackPhone = userObject.phoneNumber.trim();
            if (fallbackPhone.startsWith('+')) {
                fallbackPhone = fallbackPhone.substring(1);
            }
        }

        // Attempt fallback text message
        try {
            if (fallbackPhone !== 'Unknown') {
                const fallbackMessage = `Hello ${userObject.name},\n\nWe encountered an issue sending your monthly report document. Please contact support for assistance.\n\nRegards,\nSite Haazri Team`;
                await sendMetaTextMessage(fallbackPhone, fallbackMessage);
            }
        } catch (fallbackError) {
            console.error(`❌ Fallback message also failed: ${fallbackError.message}`);
        }

        return {
            success: false,
            message: errorMessage,
            reportType: 'monthly',
            user: userObject?.name || 'Unknown',
            phone: fallbackPhone,
            period: `${month}/${year}`,
            siteId: siteId,
            error: error.message
        };
    }
}

// Send Weekly Report - Main function for weekly cron job
async function sendWeeklyReport(userObject, siteId, month, year, week) {
    try {
        // Validate required parameters
        if (!userObject || !userObject.phoneNumber || !userObject.name) {
            throw new Error('Invalid user object - missing required fields (phoneNumber, name)');
        }

        if (!siteId || !month || !year || !week) {
            throw new Error('Missing required parameters: siteId, month, year, or week');
        }

        // Use phone number directly (remove + prefix if present)
        let phoneNumber = userObject.phoneNumber.trim();
        if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1);
        }

        // Validate parameter ranges
        if (month < 1 || month > 12) {
            throw new Error('Month must be between 1 and 12');
        }

        if (year < 2020 || year > 2030) {
            throw new Error('Year must be between 2020 and 2030');
        }

        if (week < 1 || week > 4) {
            throw new Error('Week must be between 1 and 4');
        }

        console.log(`📅 Sending weekly report for ${userObject.name} - Week ${week} of ${month}/${year} - Site: ${siteId}`);

        // Calculate week number for the year (approximate)
        const weekOfYear = ((month - 1) * 4) + week;

        // Generate weekly report message template
        const messageText = generateWeeklyReportTemplate(userObject, siteId, weekOfYear, month, year);

        // Generate both PDF and Excel reports
        console.log('📄 Generating PDF report...');
        const pdfUrl = await generateAndUploadReportPdf(userObject, siteId, month, year);

        console.log('📊 Generating Excel report...');
        const excelResult = await generateAndUploadReportExcel(userObject, siteId, month, year);

        // Send PDF document first
        const pdfFilename = `Weekly_Report_PDF_W${week}_${month}_${year}_${userObject.name.replace(/\s+/g, '_')}.pdf`;
        await sendMetaDocumentMessage(
            phoneNumber,
            pdfUrl,
            pdfFilename,
            messageText
        );

        // Send Excel document second
        const excelFilename = `Weekly_Report_Excel_W${week}_${month}_${year}_${userObject.name.replace(/\s+/g, '_')}.xlsx`;
        await sendMetaDocumentMessage(
            phoneNumber,
            excelResult.url,
            excelFilename,
            `📊 *Excel Report*

Detailed attendance data with automated calculations.

• Daily attendance grid
• Live formulas
• Employee details
• Ready for analysis

Open in Excel or Google Sheets.`
        );

        const successMessage = `✅ Weekly report sent successfully to ${userObject.name}`;
        console.log(successMessage);

        return {
            success: true,
            message: successMessage,
            reportType: 'weekly',
            user: userObject.name,
            phone: phoneNumber,
            period: `Week ${week} of ${month}/${year}`,
            siteId: siteId,
            week: week
        };

    } catch (error) {
        // Handle "no employees found" error gracefully
        if (error.message && error.message.includes('No employees found')) {
            const skipMessage = `⏭️  Skipping weekly report for ${userObject?.name || 'Unknown'}: ${error.message}`;
            console.log(skipMessage);
            return {
                success: false,
                skipped: true,
                message: skipMessage,
                reason: 'no_employees',
                reportType: 'weekly',
                user: userObject?.name || 'Unknown',
                phone: phoneNumber,
                period: `Week ${week} of ${month}/${year}`,
                siteId: siteId,
                week: week
            };
        }

        const errorMessage = `❌ Error sending weekly report to ${userObject?.name || 'Unknown'}: ${error.message}`;
        console.error(errorMessage);

        // Clean phone number for fallback
        let fallbackPhone = 'Unknown';
        if (userObject?.phoneNumber) {
            fallbackPhone = userObject.phoneNumber.trim();
            if (fallbackPhone.startsWith('+')) {
                fallbackPhone = fallbackPhone.substring(1);
            }
        }

        // Attempt fallback text message
        try {
            if (fallbackPhone !== 'Unknown') {
                const fallbackMessage = `Hello ${userObject.name},\n\nWe encountered an issue sending your weekly report document. Please contact support for assistance.\n\nRegards,\nSite Haazri Team`;
                await sendMetaTextMessage(fallbackPhone, fallbackMessage);
            }
        } catch (fallbackError) {
            console.error(`❌ Fallback message also failed: ${fallbackError.message}`);
        }

        return {
            success: false,
            message: errorMessage,
            reportType: 'weekly',
            user: userObject?.name || 'Unknown',
            phone: fallbackPhone,
            period: `Week ${week} of ${month}/${year}`,
            siteId: siteId,
            week: week,
            error: error.message
        };
    }
}

module.exports = {
    sendMonthlyReport,
    sendWeeklyReport
};
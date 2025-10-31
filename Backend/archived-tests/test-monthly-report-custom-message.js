// Test script for Monthly Report with Custom Message (24-hour window)
// This script sends reports using custom text messages instead of templates
// Useful for testing when template approval is not available

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const { generatePaymentReportPdf } = require('./Routes/pdfReports');
const { generateFullPayrollReportWithRealData } = require('./Utils/generatePayrollWithRealData');
const siteSchema = require('./models/Siteschema');

// Import AWS S3 libraries
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// MongoDB connection
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/finance-dashboard';

async function connectToDatabase() {
    try {
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        return false;
    }
}

// Test user data
const testUser = {
    "_id": "685ea4b3d1d66ef1033d6782",
    "name": "Sunny Poddar",
    "email": "sunnypoddar1919@gmail.com",
    "phoneNumber": "+919354739451", // Will be converted to 919354739451
    "calculationType": "default"
};

// Test parameters
const testSiteId = "68ee282b41993bb4a9485e06";
const testMonth = 10; // October
const testYear = 2025;

/**
 * Upload PDF to S3 and get presigned URL
 */
async function uploadPdfToS3(pdfBuffer, filename) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const key = `monthly-reports/${Date.now()}_${filename}`;

    const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
    };

    try {
        console.log(`📤 Uploading ${filename} to S3...`);
        await s3Client.send(new PutObjectCommand(uploadParams));

        // Generate presigned URL (valid for 7 days)
        const getObjectParams = {
            Bucket: bucketName,
            Key: key,
        };
        const url = await getSignedUrl(s3Client, new PutObjectCommand(getObjectParams), {
            expiresIn: 7 * 24 * 60 * 60, // 7 days
        });

        console.log(`✅ PDF uploaded successfully`);
        return url;
    } catch (error) {
        console.error('❌ S3 upload error:', error);
        throw error;
    }
}

/**
 * Upload Excel to S3 and get presigned URL
 */
async function uploadExcelToS3(excelBuffer, filename) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const key = `monthly-reports/${Date.now()}_${filename}`;

    const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: excelBuffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    try {
        console.log(`📤 Uploading ${filename} to S3...`);
        await s3Client.send(new PutObjectCommand(uploadParams));

        // Generate presigned URL (valid for 7 days)
        const getObjectParams = {
            Bucket: bucketName,
            Key: key,
        };
        const url = await getSignedUrl(s3Client, new PutObjectCommand(getObjectParams), {
            expiresIn: 7 * 24 * 60 * 60, // 7 days
        });

        console.log(`✅ Excel uploaded successfully`);
        return url;
    } catch (error) {
        console.error('❌ S3 upload error:', error);
        throw error;
    }
}

/**
 * Send WhatsApp custom text message
 */
async function sendWhatsAppTextMessage(recipientNumber, messageText) {
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
        console.log('📤 Sending WhatsApp text message...');
        const response = await axios.post(url, payload, { headers });
        console.log('✅ Text message sent successfully');
        return response.data;
    } catch (error) {
        console.error('❌ WhatsApp text message failed:');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

/**
 * Send WhatsApp document message with caption
 */
async function sendWhatsAppDocumentMessage(recipientNumber, documentUrl, filename, caption) {
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
        console.log(`📤 Sending WhatsApp document: ${filename}...`);
        const response = await axios.post(url, payload, { headers });
        console.log(`✅ Document sent successfully: ${filename}`);
        return response.data;
    } catch (error) {
        console.error('❌ WhatsApp document message failed:');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

/**
 * Main test function - Send monthly report with custom messages
 */
async function testMonthlyReportWithCustomMessage() {
    console.log("🧪 Testing Monthly Report with Custom Message (24-hour window)\n");
    console.log("=".repeat(70));

    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
        console.error("❌ Failed to connect to database. Aborting test.");
        return;
    }

    let phoneNumber = testUser.phoneNumber.trim();
    if (phoneNumber.startsWith('+')) {
        phoneNumber = phoneNumber.substring(1); // Remove + prefix
    }

    try {
        console.log(`\n📋 Test Parameters:`);
        console.log(`   User: ${testUser.name}`);
        console.log(`   Phone: ${phoneNumber}`);
        console.log(`   Site ID: ${testSiteId}`);
        console.log(`   Period: ${testMonth}/${testYear}`);
        console.log("");

        // Fetch site details
        console.log('🏗️  Fetching site details...');
        const site = await siteSchema.findById(testSiteId);
        const siteName = site ? site.sitename : 'Unknown Site';
        console.log(`   Site Name: ${siteName}\n`);

        // Generate month name
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const period = `${monthNames[testMonth - 1]} ${testYear}`;

        // Step 1: Generate PDF Report
        console.log('📄 Step 1: Generating PDF Report...');
        const pdfResult = await generatePaymentReportPdf(testUser, testSiteId, testMonth, testYear);
        console.log(`   ✅ PDF generated: ${pdfResult.filename}`);
        console.log(`   📊 Employees: ${pdfResult.employeeCount}\n`);

        // Step 2: Upload PDF to S3
        console.log('☁️  Step 2: Uploading PDF to S3...');
        const pdfUrl = await uploadPdfToS3(pdfResult.buffer, pdfResult.filename);
        console.log(`   ✅ PDF URL generated (expires in 7 days)\n`);

        // Step 3: Generate Excel Report
        console.log('📊 Step 3: Generating Excel Report...');
        const excelResult = await generateFullPayrollReportWithRealData(testUser, testSiteId, testMonth, testYear);
        const excelFilename = `Monthly_Report_Excel_${testMonth}_${testYear}_${testUser.name.replace(/\s+/g, '_')}.xlsx`;
        console.log(`   ✅ Excel generated: ${excelFilename}\n`);

        // Step 4: Upload Excel to S3
        console.log('☁️  Step 4: Uploading Excel to S3...');
        const excelUrl = await uploadExcelToS3(excelResult, excelFilename);
        console.log(`   ✅ Excel URL generated (expires in 7 days)\n`);

        // Step 5: Send welcome text message
        console.log('💬 Step 5: Sending welcome message...');
        const welcomeMessage = `Hello ${testUser.name}! 👋\n\n` +
            `Your monthly payroll report is ready for:\n` +
            `📅 Period: ${period}\n` +
            `🏗️  Site: ${siteName}\n` +
            `👥 Employees: ${pdfResult.employeeCount}\n\n` +
            `You will receive 2 files:\n` +
            `📄 PDF Report (detailed)\n` +
            `📊 Excel Report (data)\n\n` +
            `These reports are valid for 7 days.`;
        
        await sendWhatsAppTextMessage(phoneNumber, welcomeMessage);
        console.log('   ✅ Welcome message sent\n');

        // Step 6: Send PDF document
        console.log('📄 Step 6: Sending PDF Report...');
        const pdfCaption = `📄 Monthly Payment Report - PDF\n` +
            `Period: ${period}\n` +
            `Site: ${siteName}`;
        
        await sendWhatsAppDocumentMessage(phoneNumber, pdfUrl, pdfResult.filename, pdfCaption);
        console.log('   ✅ PDF document sent\n');

        // Small delay between messages (optional)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 7: Send Excel document
        console.log('📊 Step 7: Sending Excel Report...');
        const excelCaption = `📊 Monthly Payment Report - Excel\n` +
            `Period: ${period}\n` +
            `Site: ${siteName}`;
        
        await sendWhatsAppDocumentMessage(phoneNumber, excelUrl, excelFilename, excelCaption);
        console.log('   ✅ Excel document sent\n');

        // Step 8: Send closing message
        console.log('💬 Step 8: Sending closing message...');
        const closingMessage = `✅ Reports sent successfully!\n\n` +
            `Both PDF and Excel reports have been delivered.\n\n` +
            `Need help? Reply to this message or contact support.\n\n` +
            `Thank you for using Site Haazri! 🙏`;
        
        await sendWhatsAppTextMessage(phoneNumber, closingMessage);
        console.log('   ✅ Closing message sent\n');

        // Success summary
        console.log("=".repeat(70));
        console.log("✅ TEST COMPLETED SUCCESSFULLY!\n");
        console.log("📋 Summary:");
        console.log(`   User: ${testUser.name}`);
        console.log(`   Phone: ${phoneNumber}`);
        console.log(`   Period: ${period}`);
        console.log(`   Site: ${siteName}`);
        console.log(`   Employees: ${pdfResult.employeeCount}`);
        console.log(`   Messages Sent: 4 (2 text + 2 documents)`);
        console.log("=".repeat(70));

        return {
            success: true,
            message: 'Monthly report sent successfully with custom messages',
            user: testUser.name,
            phone: phoneNumber,
            period: period,
            site: siteName,
            employeeCount: pdfResult.employeeCount,
            messagesSent: 4
        };

    } catch (error) {
        console.error("\n❌ TEST FAILED!");
        console.error("Error:", error.message);
        if (error.response?.data) {
            console.error("API Error Details:", JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log("\n🔌 Database connection closed");
    }
}

// Run the test
if (require.main === module) {
    testMonthlyReportWithCustomMessage()
        .then(() => {
            console.log("\n✅ Test script completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Test script failed:", error.message);
            process.exit(1);
        });
}

// Export for use in other scripts
module.exports = {
    testMonthlyReportWithCustomMessage,
    sendWhatsAppTextMessage,
    sendWhatsAppDocumentMessage
};

// Usage instructions
console.log(`
╔════════════════════════════════════════════════════════════════╗
║  📋 MONTHLY REPORT TEST - CUSTOM MESSAGE MODE                  ║
╚════════════════════════════════════════════════════════════════╝

🎯 Purpose:
   Test monthly report delivery using custom WhatsApp messages
   (within 24-hour window) instead of pre-approved templates.

🚀 How to Run:
   node test-monthly-report-custom-message.js

📝 What This Script Does:
   1. ✅ Connects to MongoDB
   2. 📄 Generates PDF payroll report
   3. ☁️  Uploads PDF to AWS S3
   4. 📊 Generates Excel report
   5. ☁️  Uploads Excel to AWS S3
   6. 💬 Sends welcome text message
   7. 📄 Sends PDF document with caption
   8. 📊 Sends Excel document with caption
   9. 💬 Sends closing message

⚙️  Required Environment Variables:
   - MONGO_URI
   - AWS_REGION
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - AWS_S3_BUCKET_NAME
   - META_ACCESS_TOKEN
   - META_PHONE_NUMBER_ID

⚠️  Important Notes:
   - This uses CUSTOM MESSAGES (not templates)
   - Only works within 24-hour customer service window
   - User must have messaged your WhatsApp Business number first
   - If outside 24hr window, you MUST use approved templates
   - Reports expire after 7 days

📱 Test User:
   Name: ${testUser.name}
   Phone: ${testUser.phoneNumber}
   Site: ${testSiteId}
   Period: ${testMonth}/${testYear}

═══════════════════════════════════════════════════════════════════
`);

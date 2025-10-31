/**
 * Shared Test Helpers
 * Common utilities used across all test suites
 */

const mongoose = require('mongoose');
const axios = require('axios');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('./test-config');

// Initialize S3 client
let s3Client = null;

function getS3Client() {
    if (!s3Client) {
        s3Client = new S3Client({
            region: config.aws.region,
            credentials: {
                accessKeyId: config.aws.accessKeyId,
                secretAccessKey: config.aws.secretAccessKey,
            },
        });
    }
    return s3Client;
}

/**
 * Connect to MongoDB
 */
async function connectToDatabase() {
    try {
        await mongoose.connect(config.mongoURI);
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        return false;
    }
}

/**
 * Close MongoDB connection
 */
async function closeDatabase() {
    try {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    } catch (error) {
        console.error('⚠️  Error closing database:', error.message);
    }
}

/**
 * Get test configuration
 */
function getTestConfig() {
    return {
        phoneNumber: config.testUser.phoneNumber,
        siteId: config.testSiteId,
        month: config.testMonth,
        year: config.testYear,
        week: config.testWeek,
        user: config.testUser
    };
}

/**
 * Normalize phone number for WhatsApp API (remove + prefix)
 */
function normalizePhoneNumber(phone) {
    let normalized = phone.trim();
    if (normalized.startsWith('+')) {
        normalized = normalized.substring(1);
    }
    return normalized;
}

/**
 * Upload buffer to S3 and get presigned URL
 */
async function uploadToS3(buffer, filename, contentType) {
    const key = `test-reports/${Date.now()}_${filename}`;
    
    const uploadParams = {
        Bucket: config.aws.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    };
    
    try {
        const client = getS3Client();
        await client.send(new PutObjectCommand(uploadParams));
        
        // Generate presigned URL for DOWNLOAD (GetObject, not PutObject!)
        const getObjectParams = {
            Bucket: config.aws.bucketName,
            Key: key,
        };
        
        const url = await getSignedUrl(client, new GetObjectCommand(getObjectParams), {
            expiresIn: 7 * 24 * 60 * 60, // 7 days
        });
        
        return url;
    } catch (error) {
        console.error('❌ S3 upload error:', error.message);
        throw error;
    }
}

/**
 * Send WhatsApp text message
 */
async function sendWhatsAppText(recipientNumber, messageText) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp.phoneNumberId}/messages`;
    
    const payload = {
        messaging_product: 'whatsapp',
        to: normalizePhoneNumber(recipientNumber),
        type: 'text',
        text: {
            preview_url: true,
            body: messageText,
        },
    };
    
    const headers = {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
    };
    
    try {
        console.log('📤 Text message payload:', JSON.stringify(payload, null, 2));
        const response = await axios.post(url, payload, { headers });
        console.log('✅ WhatsApp API response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('❌ WhatsApp text message failed:');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

/**
 * Send WhatsApp document message
 */
async function sendWhatsAppDocument(recipientNumber, documentUrl, filename, caption) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp.phoneNumberId}/messages`;
    
    const payload = {
        messaging_product: 'whatsapp',
        to: normalizePhoneNumber(recipientNumber),
        type: 'document',
        document: {
            link: documentUrl,
            filename: filename,
            caption: caption
        },
    };
    
    const headers = {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
    };
    
    try {
        console.log('📤 Document message payload:', JSON.stringify(payload, null, 2));
        const response = await axios.post(url, payload, { headers });
        console.log('✅ WhatsApp API response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('❌ WhatsApp document message failed:');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

/**
 * Send WhatsApp template message with document
 */
async function sendWhatsAppTemplate(recipientNumber, templateName, templateParams, documentUrl, filename) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp.phoneNumberId}/messages`;
    
    const bodyParameters = templateParams.map(paramText => ({
        type: 'text',
        text: String(paramText)
    }));
    
    const payload = {
        messaging_product: 'whatsapp',
        to: normalizePhoneNumber(recipientNumber),
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: 'en'
            },
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'document',
                            document: {
                                link: documentUrl,
                                filename: filename
                            }
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: bodyParameters
                }
            ]
        }
    };
    
    const headers = {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
    };
    
    try {
        console.log('📤 Template message payload:', JSON.stringify(payload, null, 2));
        const response = await axios.post(url, payload, { headers });
        console.log('✅ WhatsApp API response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('❌ WhatsApp template message failed:');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

/**
 * Add delay between operations
 */
async function delay(ms = config.options.messageDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Display test configuration info
 */
function displayTestInfo() {
    console.log('\n📋 Current Test Configuration:');
    console.log('─'.repeat(50));
    console.log(`User: ${config.testUser.name}`);
    console.log(`Phone: ${config.testUser.phoneNumber}`);
    console.log(`Email: ${config.testUser.email}`);
    console.log(`Site ID: ${config.testSiteId}`);
    console.log(`Period: ${config.testMonth}/${config.testYear}`);
    console.log(`Week: ${config.testWeek}`);
    console.log('─'.repeat(50));
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
}

/**
 * Get month name from number
 */
function getMonthName(monthNumber) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1];
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
    const required = [
        'MONGO_URI',
        'AWS_REGION',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_S3_BUCKET_NAME',
        'META_ACCESS_TOKEN',
        'META_PHONE_NUMBER_ID'
    ];
    
    const missing = required.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing.join(', '));
        return false;
    }
    
    return true;
}

module.exports = {
    connectToDatabase,
    closeDatabase,
    getTestConfig,
    normalizePhoneNumber,
    uploadToS3,
    sendWhatsAppText,
    sendWhatsAppDocument,
    sendWhatsAppTemplate,
    delay,
    displayTestInfo,
    formatCurrency,
    getMonthName,
    validateEnvironment,
    config
};

// Utility to send WhatsApp template messages via Meta's Cloud API
// Supports onboarding and other template messages with buttons
const axios = require("axios");
const templateConfig = require('../config/whatsappTemplateConfig');

/**
 * Normalize phone number to international format without '+'
 * DB stores: +919876543210 (with +)
 * Meta API needs: 919876543210 (without +)
 * 
 * @param {string} number - Phone number in any format
 * @returns {string} - Normalized phone number (e.g., 919876543210)
 */
function normalizePhone(number) {
  if (!number) return number;
  // Remove all non-digits (including + prefix)
  const cleaned = number.replace(/[^0-9]/g, "");
  // Remove leading 0 if present
  return cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
}

/**
 * Send onboarding template message to user
 * Automatically selects template based on user's language preference
 * Includes smart retry: If send fails with media error, auto-refreshes media ID and retries once
 * 
 * @param {string} rawPhoneNumber - User's phone number
 * @param {string} userName - User's name for personalization (replaces {{1}})
 * @param {string} language - User's language preference ('en', 'hi', 'hing')
 * @param {string} videoMediaId - Optional WhatsApp media ID or URL for video header
 * @param {boolean} isRetry - Internal flag to prevent infinite retry loops
 * @returns {Promise<Object>} - Result object with sent status and message ID or error
 */
async function sendOnboardingTemplate(rawPhoneNumber, userName = 'User', language = 'en', videoMediaId = null, isRetry = false) {
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
    console.warn("WhatsApp template skipped: META credentials not configured");
    return { skipped: true, reason: 'Missing credentials' };
  }

  // Get template name from config
  const templateName = templateConfig.getTemplateName(language);
  
  // Get video media ID from config if not explicitly provided
  // Prefer media ID over URL for better delivery
  if (videoMediaId === null) {
    videoMediaId = templateConfig.getVideoMediaId(language);
  }
  
  const phone = normalizePhone(rawPhoneNumber);

  const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
  
  // Build components array
  const components = [];

  // Add header component if video media ID or URL provided
  if (videoMediaId) {
    const videoParam = {
      type: "video",
      video: {}
    };

    // Check if it's a media ID (numeric only) or a URL
    if (/^\d+$/.test(videoMediaId)) {
      // It's a WhatsApp media ID (numeric)
      videoParam.video.id = videoMediaId;
      console.log(`📹 Using WhatsApp media ID: ${videoMediaId}`);
    } else if (videoMediaId.startsWith('http://') || videoMediaId.startsWith('https://')) {
      // It's a direct URL link (not recommended, may cause delivery issues)
      videoParam.video.link = videoMediaId;
      console.warn(`⚠️ Using direct video URL. Consider uploading to WhatsApp for better delivery.`);
    } else {
      console.warn(`⚠️ Invalid video parameter: ${videoMediaId}. Expected URL or numeric media ID`);
    }

    components.push({
      type: "header",
      parameters: [videoParam]
    });
  }

  // Add body component with user name parameter ONLY for v1 templates
  // v2 templates (onbordingv2en) have no body variables - only video header
  const isV2Template = templateName.includes('v2');
  
  if (!isV2Template) {
    // v1 templates use {{1}} for userName
    components.push({
      type: "body",
      parameters: [
        {
          type: "text",
          text: userName, // Replaces {{1}} in template body
        },
      ],
    });
  }

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        // Corrected mapping based on actual Meta template configuration:
        // 'en' → 'en' (onbordingv2en uses English)
        // 'hi' → 'en' (onboardingv1_hi uses English, NOT Hindi - Meta mistake)
        // 'hing' → 'hi' (onboardingv1_hing uses Hindi)
        code: language === 'hing' ? 'hi' : 'en',
      },
      components: components,
    },
  };

  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    const messageId = res.data?.messages?.[0]?.id;
    console.log(`✅ WhatsApp onboarding template sent to ${phone} (${templateName}): ${messageId}`);
    
    return { 
      sent: true, 
      messageId,
      template: templateName,
      phone: phone 
    };

  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const errorCode = data?.error?.code;
    const errorMessage = data?.error?.message;

    // Check if error is related to media (invalid/expired media ID)
    const isMediaError = 
      errorCode === 131053 || // Invalid media ID
      errorCode === 131005 || // Media download error
      (errorMessage && errorMessage.toLowerCase().includes('media'));

    // SMART RETRY: If media error and not already retrying, refresh media and retry once
    if (isMediaError && !isRetry && /^\d+$/.test(videoMediaId)) {
      console.warn(`⚠️ Media error detected (code: ${errorCode}). Refreshing media ID and retrying...`);
      
      try {
        // Try to refresh media using the expiry manager
        const { refreshMedia } = require('./mediaExpiryManager');
        const newMediaId = await refreshMedia(language);
        
        console.log(`🔄 Retrying with fresh media ID: ${newMediaId}`);
        
        // Retry with new media ID (isRetry=true prevents infinite loops)
        return await sendOnboardingTemplate(rawPhoneNumber, userName, language, newMediaId, true);
        
      } catch (refreshError) {
        console.error(`❌ Media refresh failed: ${refreshError.message}`);
        // Continue to normal error handling below
      }
    }

    // Enhanced error categorization
    let errorCategory = "UNKNOWN_ERROR";
    let userMessage = "Failed to send message. Please try again.";
    let retryable = true;

    if (status) {
      switch (status) {
        case 400:
          errorCategory = isMediaError ? "MEDIA_ERROR" : "INVALID_REQUEST";
          userMessage = isMediaError ? "Media file error. Retried with fresh media." : "Invalid phone number or template format.";
          retryable = false;
          break;
        case 401:
          errorCategory = "AUTH_FAILED";
          userMessage = "WhatsApp service authentication failed.";
          retryable = false;
          break;
        case 403:
          errorCategory = "FORBIDDEN";
          userMessage = "Phone number not eligible for WhatsApp messages.";
          retryable = false;
          break;
        case 429:
          errorCategory = "RATE_LIMITED";
          userMessage = "Too many messages sent. Please try again later.";
          retryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          errorCategory = "SERVER_ERROR";
          userMessage = "WhatsApp service temporarily unavailable.";
          retryable = true;
          break;
        default:
          errorCategory = "API_ERROR";
          userMessage = "Failed to send message. Please try again.";
          retryable = true;
      }
    } else if (err.code === 'ECONNABORTED') {
      errorCategory = "TIMEOUT";
      userMessage = "Request timeout. Please try again.";
      retryable = true;
    } else {
      errorCategory = "NETWORK_ERROR";
      userMessage = "Network error. Please check connection.";
      retryable = true;
    }

    console.error("❌ WhatsApp template send failed", {
      phone,
      template: templateName,
      status,
      errorCode,
      errorCategory,
      errorMessage,
      isRetry: isRetry,
      details: data
    });

    return {
      sent: false,
      error: {
        category: errorCategory,
        status: status || 0,
        code: errorCode,
        message: userMessage,
        retryable,
        details: errorMessage || data,
      },
    };
  }
}

/**
 * Generic function to send any WhatsApp template message
 * 
 * @param {string} rawPhoneNumber - User's phone number
 * @param {string} templateName - Template name registered in Meta
 * @param {string} languageCode - Language code ('en', 'hi', etc.)
 * @param {Object} options - Template options
 * @param {Array} options.bodyParameters - Array of parameters for template body
 * @param {Object} options.header - Header configuration
 * @param {string} options.header.type - Header type ('video', 'image', 'document')
 * @param {string} options.header.url - URL or ID of the media
 * @param {boolean} options.header.useId - If true, uses 'id' instead of 'link'
 * @param {Array} options.buttonParameters - Optional array of button parameters
 * @returns {Promise<Object>} - Result object with sent status
 */
async function sendTemplateMessage(
  rawPhoneNumber,
  templateName,
  languageCode = 'en',
  options = {}
) {
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
    console.warn("WhatsApp template skipped: META credentials not configured");
    return { skipped: true, reason: 'Missing credentials' };
  }

  const { bodyParameters = [], header = null, buttonParameters = [] } = options;
  const phone = normalizePhone(rawPhoneNumber);
  const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

  const components = [];

  // Add header component if provided
  if (header && header.type && header.url) {
    const headerParam = {
      type: header.type, // 'video', 'image', 'document'
    };

    // Use either 'id' or 'link' based on configuration
    if (header.useId) {
      headerParam[header.type] = { id: header.url };
    } else {
      headerParam[header.type] = { link: header.url };
    }

    components.push({
      type: "header",
      parameters: [headerParam]
    });
  }

  // Add body parameters if provided
  if (bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map(param => ({
        type: "text",
        text: String(param)
      }))
    });
  }

  // Add button parameters if provided
  if (buttonParameters.length > 0) {
    buttonParameters.forEach((param, index) => {
      components.push({
        type: "button",
        sub_type: param.subType || "url",
        index: String(index),
        parameters: [{
          type: "text",
          text: String(param.text)
        }]
      });
    });
  }

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: components.length > 0 ? components : undefined,
    },
  };

  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    const messageId = res.data?.messages?.[0]?.id;
    console.log(`✅ WhatsApp template sent to ${phone} (${templateName}): ${messageId}`);
    
    return { 
      sent: true, 
      messageId,
      template: templateName,
      phone: phone 
    };

  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;

    console.error("❌ WhatsApp template send failed", {
      phone,
      template: templateName,
      status,
      error: data?.error
    });

    return {
      sent: false,
      error: {
        status: status || 0,
        message: data?.error?.message || "Failed to send template message",
        details: data,
      },
    };
  }
}

module.exports = {
  sendOnboardingTemplate,
  sendTemplateMessage,
  normalizePhone
};

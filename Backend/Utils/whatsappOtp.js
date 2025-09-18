// Utility to send authentication OTP via WhatsApp using Meta's Cloud API.
// Keeps existing auth route logic untouched; simply export a helper.
// Relies on environment vars: META_ACCESS_TOKEN, META_PHONE_NUMBER_ID.
// Phone number must be in international format without '+' (e.g., 919876543210).
const axios = require("axios");

function normalizePhone(number) {
  if (!number) return number;
  const cleaned = number.replace(/[^0-9]/g, "");
  return cleaned.startsWith("0") ? cleaned.slice(1) : cleaned; // basic trim
}

async function sendWhatsAppOtp(rawPhoneNumber, otp, ttlSeconds = 300) {
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
    console.warn("WhatsApp OTP skipped: META credentials not configured");
    return { skipped: true };
  }
  const phone = normalizePhone(rawPhoneNumber);
  const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template", // Use 'template' type
    template: {
      name: "auth", // Your approved template name
      language: {
        code: "en_US", // The language code of your template
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otp, // For the {{1}} in the message body
            },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0", // The first button
          parameters: [
            {
              type: "text",
              text: otp, // The code that will be copied to the clipboard
            },
          ],
        },
      ],
    },
  };
  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return { sent: true, id: res.data?.messages?.[0]?.id };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;

    // Enhanced error categorization for frontend handling
    let errorCategory = "UNKNOWN_ERROR";
    let userMessage = "Failed to send OTP. Please try again.";
    let retryable = true;

    if (status) {
      switch (status) {
        case 400:
          errorCategory = "INVALID_REQUEST";
          userMessage = "Invalid phone number format.";
          retryable = false;
          break;
        case 401:
          errorCategory = "AUTH_FAILED";
          userMessage = "Service temporarily unavailable.";
          retryable = false;
          break;
        case 403:
          errorCategory = "FORBIDDEN";
          userMessage = "Phone number not eligible for WhatsApp messages.";
          retryable = false;
          break;
        case 429:
          errorCategory = "RATE_LIMITED";
          userMessage = "Too many requests. Please try again later.";
          retryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          errorCategory = "SERVER_ERROR";
          userMessage = "Service temporarily unavailable. Please try again.";
          retryable = true;
          break;
        default:
          errorCategory = "API_ERROR";
          userMessage = "Failed to send OTP. Please try again.";
          retryable = true;
      }
    } else {
      // Network or timeout error
      errorCategory = "NETWORK_ERROR";
      userMessage =
        "Network error. Please check your connection and try again.";
      retryable = true;
    }

    console.error("WhatsApp OTP send failed", { status, errorCategory, data });

    return {
      sent: false,
      error: {
        category: errorCategory,
        status: status || 0,
        message: userMessage,
        retryable,
        details: data,
      },
    };
  }
}

module.exports = { sendWhatsAppOtp };

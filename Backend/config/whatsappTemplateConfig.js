/**
 * WhatsApp Template Configuration
 * Centralized configuration for template names and media
 * 
 * IMPORTANT: Using Media IDs instead of direct URLs for better delivery
 * Media IDs are obtained by uploading videos to WhatsApp's servers
 * This prevents "video file is wrong" errors
 */

module.exports = {
    // Template names mapped to user language preferences
    TEMPLATE_NAMES: {
        'en': 'onbordingv2en',       // English content, English language code
        'hi': 'onbordingv2hi',       // Hindi content (v2 - no variables)
        'hing': 'onbordingv2en'      // Hinglish uses English v2 template
    },

    // WhatsApp Media IDs for videos (uploaded to WhatsApp servers)
    // Source: https://www.sitehaazri.in/payouts.mp4
    // Uploaded: 2026-01-03 (expires 2026-02-02)
    // To upload a new video: node scripts/upload-onboarding-video.js
    VIDEO_MEDIA_IDS: {
        'en': '1765821630747079',
        'hi': '1206458394917474',
        'hing': '1451951366557838'
    },

    // Fallback: Direct video URLs (not recommended, may cause delivery issues)
    VIDEO_URLS: {
        'en': 'https://www.sitehaazri.in/payouts.mp4',
        'hi': 'https://www.sitehaazri.in/payouts.mp4',
        'hing': 'https://www.sitehaazri.in/payouts.mp4'
    },

    // Default fallback values
    DEFAULT_LANGUAGE: 'en',
    DEFAULT_VIDEO_MEDIA_ID: '1765821630747079',
    DEFAULT_VIDEO_URL: 'https://www.sitehaazri.in/payouts.mp4',

    /**
     * Get template name for a given language
     * @param {string} language - User's language preference
     * @returns {string} Template name
     */
    getTemplateName(language) {
        return this.TEMPLATE_NAMES[language] || this.TEMPLATE_NAMES[this.DEFAULT_LANGUAGE];
    },

    /**
     * Get WhatsApp media ID for video (preferred method)
     * @param {string} language - User's language preference
     * @returns {string} WhatsApp media ID
     */
    getVideoMediaId(language) {
        return this.VIDEO_MEDIA_IDS[language] || this.DEFAULT_VIDEO_MEDIA_ID;
    },

    /**
     * Get video URL (fallback, not recommended)
     * @param {string} language - User's language preference
     * @returns {string} Video URL
     */
    getVideoUrl(language) {
        return this.VIDEO_URLS[language] || this.DEFAULT_VIDEO_URL;
    }
};

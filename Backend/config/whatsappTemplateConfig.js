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
        'en': 'onboardingv1_en',      // English content, English language code
        'hi': 'onboardingv1_hi',      // Hindi content (देवनागरी), English language code
        'hing': 'onboardingv1_hing'   // Hinglish content (Romanized), Hindi language code
    },

    // WhatsApp Media IDs for videos (uploaded to WhatsApp servers)
    // Media ID: 1157558846315275
    // Source: https://www.sitehaazri.in/intro.mp4
    // Size: 14.6 MB, MIME: video/mp4
    // Uploaded: 2025-01-21
    // 
    // To upload a new video: node test-upload-video.js
    VIDEO_MEDIA_IDS: {
        'en': '1893835704679398',
        'hi': '1157558846315274',
        'hing': '1280273577182728'
    },

    // Fallback: Direct video URLs (not recommended, may cause delivery issues)
    VIDEO_URLS: {
        'en': 'https://www.sitehaazri.in/intro.mp4',
        'hi': 'https://www.sitehaazri.in/intro.mp4',
        'hing': 'https://www.sitehaazri.in/intro.mp4'
    },

    // Default fallback values
    DEFAULT_LANGUAGE: 'en',
    DEFAULT_VIDEO_MEDIA_ID: '1893835704679398',
    DEFAULT_VIDEO_URL: 'https://www.sitehaazri.in/intro.mp4',

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

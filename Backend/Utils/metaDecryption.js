const crypto = require('crypto');

// 🔑 Decryption key from Facebook Developers Dashboard
// Settings → Basic → Android → Install Referrer Decryption Key
const DECRYPTION_KEY_HEX = process.env.META_INSTALL_REFERRER_KEY || '';

/**
 * Decrypts Meta (Facebook/Instagram) encrypted campaign data
 * @param {string} metaEncrypted - The meta_encrypted JSON string from mobile app
 * @returns {object|null} - Decrypted campaign data or null if decryption fails
 */
function decryptMetaCampaignData(metaEncrypted) {
  try {
    if (!metaEncrypted) return null;
    
    // Check if decryption key is configured
    if (!DECRYPTION_KEY_HEX || DECRYPTION_KEY_HEX.length !== 64) {
      console.log('Meta decryption: META_INSTALL_REFERRER_KEY not configured or invalid');
      return null;
    }
    
    // 1. Parse the JSON string
    // Format: { "source": { "data": "HEX...", "nonce": "HEX..." }, "a": "app_id", "t": timestamp }
    let contentJson;
    try {
      contentJson = typeof metaEncrypted === 'string' 
        ? JSON.parse(metaEncrypted) 
        : metaEncrypted;
    } catch (e) {
      console.log('Meta decryption: Invalid JSON format');
      return null;
    }
    
    // 2. Validate structure
    if (!contentJson.source || !contentJson.source.data || !contentJson.source.nonce) {
      console.log('Meta decryption: Missing required fields (source.data or source.nonce)');
      return null;
    }
    
    // 3. Prepare for Decryption (AES-256-GCM)
    const key = Buffer.from(DECRYPTION_KEY_HEX, 'hex');
    const ciphertext = Buffer.from(contentJson.source.data, 'hex');
    const nonce = Buffer.from(contentJson.source.nonce, 'hex');
    
    // 4. Meta places the 16-byte auth tag at the end of the ciphertext
    const tagLength = 16;
    if (ciphertext.length <= tagLength) {
      console.log('Meta decryption: Ciphertext too short');
      return null;
    }
    
    const encryptedData = ciphertext.subarray(0, ciphertext.length - tagLength);
    const authTag = ciphertext.subarray(ciphertext.length - tagLength);
    
    // 5. Decrypt using AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    // 6. Parse the decrypted JSON
    const campaignData = JSON.parse(decrypted);
    
    console.log('✅ Meta decryption successful:', campaignData);
    
    return campaignData;
    
  } catch (e) {
    console.error('Meta decryption failed:', e.message);
    return null;
  }
}

/**
 * Process acquisition data - decrypt Meta data if present
 * Returns a clean acquisition object with real campaign names
 * 
 * @param {object} acquisition - The acquisition object from mobile app
 * @returns {object} - Processed acquisition with real campaign names
 */
function processAcquisition(acquisition) {
  // Default values for organic installs
  if (!acquisition) {
    return { 
      source: 'organic', 
      campaign: 'organic', 
      medium: 'organic' 
    };
  }
  
  // Start with the basic data from mobile app
  const result = {
    source: acquisition.source || 'organic',
    campaign: acquisition.campaign || 'organic',
    medium: acquisition.medium || 'organic'
  };
  
  // Check if this is Meta ad with encrypted data
  if (acquisition.meta_encrypted) {
    const decrypted = decryptMetaCampaignData(acquisition.meta_encrypted);
    
    if (decrypted) {
      // Override with real campaign data from Meta
      result.campaign = decrypted.campaign_group_name || decrypted.campaign_name || result.campaign;
      
      // Add valuable Meta-specific fields
      result.platform_position = decrypted.platform_position || null; // e.g., "instagram_stories", "facebook_feed"
      result.ad_objective = decrypted.ad_objective_name || null; // e.g., "CONVERSIONS", "APP_INSTALLS"
      result.adgroup_name = decrypted.adgroup_name || null; // Ad set name
      
      // Determine actual source (Facebook vs Instagram)
      if (decrypted.is_instagram || decrypted.publisher_platform === 'instagram') {
        result.source = 'instagram';
      } else if (decrypted.publisher_platform === 'facebook') {
        result.source = 'facebook';
      }
    }
  }
  
  return result;
}

module.exports = {
  decryptMetaCampaignData,
  processAcquisition
};

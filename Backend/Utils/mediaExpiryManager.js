// Media Expiry Management for WhatsApp Media IDs
// Handles automatic refresh of media before expiry (30-day limit)

const { uploadMedia } = require('./uploadMediaToWhatsApp');
const fs = require('fs').promises;
const path = require('path');

// Storage file for media tracking
const MEDIA_STORAGE_FILE = path.join(__dirname, '../config/whatsappMediaStorage.json');

// Media expires after 30 days, refresh 7 days before expiry
const MEDIA_EXPIRY_DAYS = 30;
const REFRESH_THRESHOLD_DAYS = 7;

/**
 * Get media storage data
 * @returns {Promise<Object>} Media storage object
 */
async function getMediaStorage() {
  try {
    const data = await fs.readFile(MEDIA_STORAGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, return default structure
    return {
      lastUpdated: new Date().toISOString(),
      media: {
        'en': {
          id: process.env.WHATSAPP_VIDEO_MEDIA_ID_EN || '1765821630747079',
          uploadedAt: '2026-01-03T00:00:00.000Z',
          expiresAt: '2026-02-02T00:00:00.000Z',
          sourceUrl: 'https://www.sitehaazri.in/payouts.mp4',
          mediaType: 'video/mp4',
          usageCount: 0
        },
        'hi': {
          id: process.env.WHATSAPP_VIDEO_MEDIA_ID_HI || '1206458394917474',
          uploadedAt: '2026-01-03T00:00:00.000Z',
          expiresAt: '2026-02-02T00:00:00.000Z',
          sourceUrl: 'https://www.sitehaazri.in/payouts.mp4',
          mediaType: 'video/mp4',
          usageCount: 0
        },
        'hing': {
          id: process.env.WHATSAPP_VIDEO_MEDIA_ID_HING || '1451951366557838',
          uploadedAt: '2026-01-03T00:00:00.000Z',
          expiresAt: '2026-02-02T00:00:00.000Z',
          sourceUrl: 'https://www.sitehaazri.in/payouts.mp4',
          mediaType: 'video/mp4',
          usageCount: 0
        }
      }
    };
  }
}

/**
 * Save media storage data
 * @param {Object} storage - Media storage object
 */
async function saveMediaStorage(storage) {
  storage.lastUpdated = new Date().toISOString();
  await fs.writeFile(MEDIA_STORAGE_FILE, JSON.stringify(storage, null, 2));
}

/**
 * Check if media needs refresh
 * @param {string} language - Language code
 * @returns {Promise<boolean>} True if refresh needed
 */
async function needsRefresh(language) {
  const storage = await getMediaStorage();
  const media = storage.media[language];
  
  if (!media) return true;
  
  const expiresAt = new Date(media.expiresAt);
  const now = new Date();
  const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
  
  return daysUntilExpiry < REFRESH_THRESHOLD_DAYS;
}

/**
 * Refresh media ID by re-uploading
 * @param {string} language - Language code
 * @returns {Promise<string>} New media ID
 */
async function refreshMedia(language) {
  const storage = await getMediaStorage();
  const media = storage.media[language];
  
  if (!media) {
    throw new Error(`No media configuration found for language: ${language}`);
  }
  
  console.log(`🔄 Refreshing media for language: ${language}`);
  console.log(`   Source: ${media.sourceUrl}`);
  
  try {
    // Upload media
    const newMediaId = await uploadMedia(media.sourceUrl, media.mediaType);
    
    // Update storage
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MEDIA_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    storage.media[language] = {
      ...media,
      id: newMediaId,
      uploadedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      usageCount: 0
    };
    
    await saveMediaStorage(storage);
    
    // Update whatsappTemplateConfig.js permanently
    await updateConfigFile(language, newMediaId);
    
    console.log(`✅ Media refreshed for ${language}: ${newMediaId}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);
    
    return newMediaId;
    
  } catch (error) {
    console.error(`❌ Failed to refresh media for ${language}:`, error.message);
    throw error;
  }
}

/**
 * Get valid media ID (refresh if needed)
 * @param {string} language - Language code
 * @returns {Promise<string>} Valid media ID
 */
async function getValidMediaId(language) {
  if (await needsRefresh(language)) {
    return await refreshMedia(language);
  }
  
  const storage = await getMediaStorage();
  const media = storage.media[language];
  
  // Increment usage count
  media.usageCount = (media.usageCount || 0) + 1;
  await saveMediaStorage(storage);
  
  return media.id;
}

/**
 * Check all media and refresh if needed
 * Should be called by cron job weekly
 * @returns {Promise<Object>} Results of check
 */
async function checkAndRefreshAll() {
  console.log('\n🔍 Checking WhatsApp media expiry...\n');
  
  const results = {
    checked: [],
    refreshed: [],
    errors: []
  };
  
  const storage = await getMediaStorage();
  const languages = Object.keys(storage.media);
  
  for (const language of languages) {
    try {
      const media = storage.media[language];
      const expiresAt = new Date(media.expiresAt);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
      
      results.checked.push({
        language,
        mediaId: media.id,
        daysUntilExpiry
      });
      
      console.log(`📋 ${language}: Media ID ${media.id}`);
      console.log(`   Expires in ${daysUntilExpiry} days (${expiresAt.toISOString().split('T')[0]})`);
      
      if (daysUntilExpiry < REFRESH_THRESHOLD_DAYS) {
        console.log(`   ⚠️  Refreshing (< ${REFRESH_THRESHOLD_DAYS} days remaining)...`);
        const newMediaId = await refreshMedia(language);
        results.refreshed.push({ language, oldId: media.id, newId: newMediaId });
      } else {
        console.log(`   ✅ Still valid`);
      }
      
    } catch (error) {
      console.error(`❌ Error checking ${language}:`, error.message);
      results.errors.push({ language, error: error.message });
    }
  }
  
  console.log('\n✅ Media expiry check completed\n');
  
  return results;
}

/**
 * Update whatsappTemplateConfig.js with new media ID
 * @param {string} language - Language code
 * @param {string} newMediaId - New media ID to save
 */
async function updateConfigFile(language, newMediaId) {
  const configPath = path.join(__dirname, '../config/whatsappTemplateConfig.js');
  
  try {
    // Read current config file
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Update the specific language media ID
    // Match pattern: 'en': '1157558846315275',
    const regex = new RegExp(`('${language}':\\s*)'\\d+'`, 'g');
    configContent = configContent.replace(regex, `$1'${newMediaId}'`);
    
    // Also update DEFAULT_VIDEO_MEDIA_ID if language is 'en'
    if (language === 'en') {
      configContent = configContent.replace(
        /(DEFAULT_VIDEO_MEDIA_ID:\s*)'[^']+'/,
        `$1'${newMediaId}'`
      );
    }
    
    // Write updated config back
    await fs.writeFile(configPath, configContent, 'utf8');
    
    console.log(`✅ Updated whatsappTemplateConfig.js with new media ID for ${language}: ${newMediaId}`);
    
  } catch (error) {
    console.error(`⚠️ Failed to update config file:`, error.message);
    // Don't throw - this is not critical, JSON storage is primary
  }
}

/**
 * Initialize media storage file if it doesn't exist
 */
async function initializeMediaStorage() {
  try {
    await fs.access(MEDIA_STORAGE_FILE);
  } catch (error) {
    // File doesn't exist, create it
    const storage = await getMediaStorage();
    await saveMediaStorage(storage);
    console.log('✅ Initialized media storage file');
  }
}

module.exports = {
  getValidMediaId,
  needsRefresh,
  refreshMedia,
  checkAndRefreshAll,
  initializeMediaStorage,
  getMediaStorage,
  updateConfigFile,
  MEDIA_EXPIRY_DAYS,
  REFRESH_THRESHOLD_DAYS
};

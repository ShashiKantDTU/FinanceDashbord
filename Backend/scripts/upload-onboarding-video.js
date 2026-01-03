// One-time script to upload new video to WhatsApp
// Run: node scripts/upload-onboarding-video.js

require('dotenv').config();

const { refreshMedia } = require('../Utils/mediaExpiryManager');

async function uploadAll() {
  console.log('\n📤 Uploading payouts.mp4 to WhatsApp for all languages...\n');
  
  const languages = ['en', 'hi', 'hing'];
  
  for (const lang of languages) {
    try {
      console.log(`\n🔄 Uploading for language: ${lang}`);
      const mediaId = await refreshMedia(lang);
      console.log(`✅ ${lang}: Media ID = ${mediaId}`);
    } catch (error) {
      console.error(`❌ ${lang}: Failed - ${error.message}`);
    }
  }
  
  console.log('\n✅ Done! Check whatsappMediaStorage.json and whatsappTemplateConfig.js for updated IDs.\n');
}

uploadAll();

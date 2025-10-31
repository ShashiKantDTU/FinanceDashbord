// Test script for media expiry management
// Run this to check media status and test refresh functionality

require('dotenv').config();
const { 
  checkAndRefreshAll, 
  getValidMediaId, 
  needsRefresh,
  getMediaStorage 
} = require('./Utils/mediaExpiryManager');

async function testMediaExpiry() {
  console.log('🧪 Testing WhatsApp Media Expiry Management\n');
  console.log('='.repeat(70));
  
  try {
    // 1. Check current media storage
    console.log('\n📋 Current Media Storage:\n');
    const storage = await getMediaStorage();
    console.log(JSON.stringify(storage, null, 2));
    
    // 2. Check which media needs refresh
    console.log('\n🔍 Checking Refresh Status:\n');
    for (const lang of ['en', 'hi', 'hing']) {
      const needs = await needsRefresh(lang);
      const media = storage.media[lang];
      const expiresAt = new Date(media.expiresAt);
      const daysLeft = Math.floor((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
      
      console.log(`${lang}: ${needs ? '⚠️  NEEDS REFRESH' : '✅ Valid'} (${daysLeft} days left)`);
    }
    
    // 3. Run full check and refresh
    console.log('\n🔄 Running Full Check and Refresh:\n');
    const results = await checkAndRefreshAll();
    
    console.log('\n📊 Results Summary:');
    console.log(`   Checked: ${results.checked.length} languages`);
    console.log(`   Refreshed: ${results.refreshed.length} media IDs`);
    console.log(`   Errors: ${results.errors.length}`);
    
    if (results.refreshed.length > 0) {
      console.log('\n✅ Refreshed Media:');
      results.refreshed.forEach(r => {
        console.log(`   ${r.language}: ${r.oldId} → ${r.newId}`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(e => {
        console.log(`   ${e.language}: ${e.error}`);
      });
    }
    
    // 4. Test getting valid media ID
    console.log('\n🎯 Testing getValidMediaId():');
    const mediaId = await getValidMediaId('en');
    console.log(`   English media ID: ${mediaId}`);
    
    console.log('\n✅ All tests completed!\n');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

testMediaExpiry();

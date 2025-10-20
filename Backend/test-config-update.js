/**
 * Test script to verify config file update functionality
 * This tests that media ID updates are persisted to whatsappTemplateConfig.js
 */

require('dotenv').config();
const { updateConfigFile } = require('./Utils/mediaExpiryManager');
const fs = require('fs').promises;
const path = require('path');

async function testConfigUpdate() {
  console.log('\n🧪 Testing Config File Update\n');
  console.log('='.repeat(70));
  
  const configPath = path.join(__dirname, 'config/whatsappTemplateConfig.js');
  
  try {
    // Read current config
    console.log('\n📖 Reading current config...');
    const originalConfig = await fs.readFile(configPath, 'utf8');
    
    // Extract current media IDs
    const enMatch = originalConfig.match(/'en':\s*'(\d+)'/);
    const currentEnId = enMatch ? enMatch[1] : 'NOT_FOUND';
    
    console.log(`✅ Current EN media ID: ${currentEnId}`);
    
    // Test update with a dummy ID
    const testMediaId = '9999999999999999';
    console.log(`\n🔄 Testing update to dummy ID: ${testMediaId}`);
    
    await updateConfigFile('en', testMediaId);
    
    // Read updated config
    const updatedConfig = await fs.readFile(configPath, 'utf8');
    const updatedMatch = updatedConfig.match(/'en':\s*'(\d+)'/);
    const updatedId = updatedMatch ? updatedMatch[1] : 'NOT_FOUND';
    
    console.log(`✅ Updated EN media ID: ${updatedId}`);
    
    // Verify update
    if (updatedId === testMediaId) {
      console.log('\n✅ SUCCESS: Config file updated correctly!');
    } else {
      console.log('\n❌ FAILED: Config file not updated');
      console.log(`   Expected: ${testMediaId}`);
      console.log(`   Got: ${updatedId}`);
    }
    
    // Restore original config
    console.log(`\n🔄 Restoring original config...`);
    await updateConfigFile('en', currentEnId);
    
    const restoredConfig = await fs.readFile(configPath, 'utf8');
    const restoredMatch = restoredConfig.match(/'en':\s*'(\d+)'/);
    const restoredId = restoredMatch ? restoredMatch[1] : 'NOT_FOUND';
    
    if (restoredId === currentEnId) {
      console.log(`✅ Original config restored: ${restoredId}`);
    } else {
      console.log(`⚠️ Warning: Config may not be fully restored`);
      console.log(`   Original: ${currentEnId}`);
      console.log(`   Current: ${restoredId}`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Test complete!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testConfigUpdate();

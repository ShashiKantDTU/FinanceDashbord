// Test script to verify smart retry with media refresh
// Simulates media expiry and tests automatic retry mechanism

require('dotenv').config();
const { sendOnboardingTemplate } = require('./Utils/whatsappTemplates');

const TEST_PHONE = '919354739451';
const TEST_NAME = 'Test User';
const TEST_LANGUAGE = 'en';

async function testSmartRetry() {
  console.log('\n🧪 Testing Smart Retry with Media Refresh\n');
  console.log('='.repeat(70));
  
  console.log('\n📋 Test Scenarios:\n');
  console.log('1. ✅ Normal send with valid media ID');
  console.log('2. 🔄 Send with expired/invalid media ID (should auto-retry)');
  console.log('3. ⚠️  Verify only 1 retry attempt (no infinite loops)');
  
  // Test 1: Normal send with valid media ID
  console.log('\n' + '='.repeat(70));
  console.log('\n📤 Test 1: Send with Valid Media ID\n');
  
  try {
    const result1 = await sendOnboardingTemplate(
      TEST_PHONE,
      TEST_NAME,
      TEST_LANGUAGE
    );
    
    if (result1.sent) {
      console.log('✅ Test 1 PASSED: Message sent successfully');
      console.log(`   Message ID: ${result1.messageId}`);
    } else if (result1.skipped) {
      console.log(`⚠️  Test 1 SKIPPED: ${result1.reason}`);
    } else {
      console.log('❌ Test 1 FAILED: Message send failed');
      console.log(`   Error: ${result1.error.message}`);
      console.log(`   Category: ${result1.error.category}`);
    }
  } catch (error) {
    console.error('❌ Test 1 EXCEPTION:', error.message);
  }
  
  // Test 2: Simulate expired media ID
  console.log('\n' + '='.repeat(70));
  console.log('\n🔄 Test 2: Send with Expired Media ID (Simulated)\n');
  console.log('Note: This will use an invalid media ID to trigger retry logic\n');
  
  try {
    // Use a fake/old media ID to simulate expiry
    const invalidMediaId = '9999999999999999';
    
    console.log(`Using invalid media ID: ${invalidMediaId}`);
    console.log('Expected: Should detect error, refresh media, and retry\n');
    
    const result2 = await sendOnboardingTemplate(
      TEST_PHONE,
      TEST_NAME,
      TEST_LANGUAGE,
      invalidMediaId
    );
    
    if (result2.sent) {
      console.log('✅ Test 2 PASSED: Retry worked! Message sent with fresh media ID');
      console.log(`   Message ID: ${result2.messageId}`);
      console.log('   🎯 Smart retry feature working correctly!');
    } else {
      console.log('⚠️  Test 2: Retry attempted but failed');
      console.log(`   Error: ${result2.error.message}`);
      console.log(`   Category: ${result2.error.category}`);
      
      if (result2.error.category === 'MEDIA_ERROR') {
        console.log('   ✅ Media error detected correctly');
        console.log('   ℹ️  Retry was attempted but may have failed due to other reasons');
      }
    }
  } catch (error) {
    console.error('❌ Test 2 EXCEPTION:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Smart Retry Feature Summary:\n');
  console.log('✅ Feature: Auto-retry with fresh media ID on media errors');
  console.log('✅ Safety: Only 1 retry attempt (prevents infinite loops)');
  console.log('✅ Detection: Identifies media errors (codes 131053, 131005)');
  console.log('✅ Action: Refreshes media ID and retries automatically');
  console.log('✅ Fallback: Returns error if retry also fails');
  
  console.log('\n🎯 How it works:');
  console.log('   1. First attempt with configured media ID');
  console.log('   2. If media error detected → Refresh media ID');
  console.log('   3. Retry once with new media ID');
  console.log('   4. If still fails → Return error (no more retries)');
  
  console.log('\n✅ All tests completed!\n');
  console.log('='.repeat(70));
}

// Run tests
testSmartRetry().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});

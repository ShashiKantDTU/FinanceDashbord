require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/Userschema');

/**
 * Test Script: Google Sheets User Registration Logging
 * 
 * This script tests the post-save hook that automatically logs
 * new user registrations to Google Sheets.
 * 
 * Prerequisites:
 * - MONGO_URI must be set in .env
 * - SPREADSHEET_ID must be set in .env
 * - SHEET_NAME must be set in .env (defaults to 'Users')
 * - FIREBASE_SERVICE_ACCOUNT_KEY must be set in .env
 */

async function testGoogleSheetsLogging() {
  console.log('\n🧪 Starting Google Sheets Logging Test...\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Verify environment variables
    console.log('🔍 Checking environment variables...');
    if (!process.env.SPREADSHEET_ID) {
      console.warn('⚠️  WARNING: SPREADSHEET_ID not set in .env');
      console.warn('   Sheet logging will be skipped, but test will continue.\n');
    } else {
      console.log('✅ SPREADSHEET_ID is configured');
      console.log(`   Sheet Name: ${process.env.SHEET_NAME || 'Users (default)'}\n`);
    }

    // Generate unique test phone number
    const timestamp = Date.now();
    const testPhoneNumber = `+91${timestamp.toString().slice(-10)}`;

    // Create test user with phone number
    console.log('📝 Creating test user...');
    const testUser = new User({
      name: 'Test User - Sheets Logging',
      phoneNumber: testPhoneNumber,
      plan: 'free',
      whatsAppReportsEnabled: false
    });

    console.log(`   Name: ${testUser.name}`);
    console.log(`   Phone: ${testPhoneNumber}`);
    console.log(`   Plan: ${testUser.plan}\n`);

    // Save user - this should trigger the post-save hook
    console.log('💾 Saving user to database...');
    console.log('   (This will trigger the post-save hook for Google Sheets logging)\n');
    
    await testUser.save();
    
    console.log('✅ User saved successfully!\n');

    // Wait a moment for async sheet logging to complete
    console.log('⏳ Waiting 3 seconds for sheet logging to complete...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify in database
    const savedUser = await User.findById(testUser._id);
    if (savedUser) {
      console.log('✅ User verified in database:');
      console.log(`   ID: ${savedUser._id}`);
      console.log(`   Name: ${savedUser.name}`);
      console.log(`   Phone: ${savedUser.phoneNumber}`);
      console.log(`   Created: ${savedUser.createdAt}\n`);
    }

    // Instructions for manual verification
    console.log('📊 MANUAL VERIFICATION REQUIRED:');
    console.log('   Please check your Google Sheet for a new row with:');
    console.log('   - Column A: (blank)');
    console.log('   - Column B: Date/time (e.g., "17 Nov 2025, 04:30:45 PM")');
    console.log(`   - Column C: "${testUser.name}"`);
    console.log(`   - Column D: "${testPhoneNumber}"\n`);

    // Clean up - delete test user
    console.log('🧹 Cleaning up test data from database...');
    await User.findByIdAndDelete(testUser._id);
    console.log('✅ Test user deleted from database\n');

    console.log('⚠️  NOTE: The Google Sheet entry will NOT be deleted.');
    console.log('   You may manually remove the test row if needed.\n');

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Test completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    
    // Ensure connection is closed
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

// Run the test
testGoogleSheetsLogging();

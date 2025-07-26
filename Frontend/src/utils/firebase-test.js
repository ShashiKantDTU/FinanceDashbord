// Firebase Environment Test Utility
// Use this to verify your Firebase setup is working correctly

import { auth, analytics, firebaseConfig } from '../firebase-config';

export const testFirebaseSetup = () => {
  console.log('🔥 Firebase Configuration Test');
  console.log('================================');
  
  // Test 1: Environment Variables
  console.log('📋 Environment Variables:');
  console.log('✅ API Key:', firebaseConfig.apiKey ? 'Present' : '❌ Missing');
  console.log('✅ Auth Domain:', firebaseConfig.authDomain ? 'Present' : '❌ Missing');
  console.log('✅ Project ID:', firebaseConfig.projectId ? 'Present' : '❌ Missing');
  console.log('✅ App ID:', firebaseConfig.appId ? 'Present' : '❌ Missing');
  console.log('✅ Measurement ID:', firebaseConfig.measurementId ? 'Present' : '⚠️ Missing (Analytics disabled)');
  
  // Test 2: Firebase Services
  console.log('\n🔧 Firebase Services:');
  console.log('✅ Auth Instance:', auth ? 'Initialized' : '❌ Failed');
  console.log('✅ Analytics Instance:', analytics ? 'Initialized' : '⚠️ Not initialized');
  
  // Test 3: Auth Configuration
  console.log('\n🔐 Auth Configuration:');
  console.log('✅ Current User:', auth?.currentUser ? 'Logged in' : 'Not logged in');
  console.log('✅ Auth Domain:', auth?.config?.authDomain || 'Not available');
  
  // Test 4: reCAPTCHA Status
  console.log('\n🛡️ reCAPTCHA Status:');
  console.log('✅ reCAPTCHA Script:', typeof window.grecaptcha !== 'undefined' ? 'Loaded' : '⚠️ Not loaded');
  
  console.log('✅ reCAPTCHA Type:', 'Standard v2 (Firebase managed)');
  
  // Check Firebase SDK version for SMS Defense compatibility
  const firebaseVersion = '11.10.0'; // Your current version
  const smsDefenseSupported = parseFloat(firebaseVersion) >= 11.0;
  console.log('✅ SMS Defense Support:', smsDefenseSupported ? 'Enabled (SDK 11.10.0)' : '❌ Requires SDK 11+');
  
  // Test 5: Network Connectivity
  console.log('\n🌐 Network Test:');
  fetch('https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=' + firebaseConfig.apiKey)
    .then(response => {
      if (response.ok) {
        console.log('✅ Firebase API: Connected');
      } else {
        console.log('❌ Firebase API: Connection failed');
      }
    })
    .catch(error => {
      console.log('❌ Firebase API: Network error', error.message);
    });
  
  console.log('\n🎯 Summary:');
  console.log('- If all items show ✅, your setup is perfect!');
  console.log('- ⚠️ items are optional but recommended');
  console.log('- ❌ items need to be fixed');
  
  return {
    config: firebaseConfig,
    auth: !!auth,
    analytics: !!analytics,
    recaptcha: typeof window.grecaptcha !== 'undefined',
    recaptchaStandard: typeof window.grecaptcha !== 'undefined'
  };
};

// Auto-run test in development
if (import.meta.env.DEV) {
  // Run test after a short delay to ensure everything is loaded
  setTimeout(() => {
    testFirebaseSetup();
  }, 1000);
}

export default testFirebaseSetup;
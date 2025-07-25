// Quick Firebase Environment Test
// Run this to verify your environment variables are working correctly

console.log('🔥 Firebase Environment Variables Test');
console.log('=====================================');

// Test all environment variables
const envVars = {
  'VITE_FIREBASE_API_KEY': import.meta.env.VITE_FIREBASE_API_KEY,
  'VITE_FIREBASE_AUTH_DOMAIN': import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  'VITE_FIREBASE_PROJECT_ID': import.meta.env.VITE_FIREBASE_PROJECT_ID,
  'VITE_FIREBASE_STORAGE_BUCKET': import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  'VITE_FIREBASE_MESSAGING_SENDER_ID': import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  'VITE_FIREBASE_APP_ID': import.meta.env.VITE_FIREBASE_APP_ID,
  'VITE_FIREBASE_MEASUREMENT_ID': import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Expected values from Firebase Console
const expectedValues = {
  'VITE_FIREBASE_API_KEY': 'AIzaSyArgN3jZzISWOhdF0TvZmgtWt9yOetJsHk',
  'VITE_FIREBASE_AUTH_DOMAIN': 'sitehaazri.firebaseapp.com',
  'VITE_FIREBASE_PROJECT_ID': 'sitehaazri',
  'VITE_FIREBASE_STORAGE_BUCKET': 'sitehaazri.firebasestorage.app',
  'VITE_FIREBASE_MESSAGING_SENDER_ID': '820349080987',
  'VITE_FIREBASE_APP_ID': '1:820349080987:web:b3095601e9e240740e3d3e',
  'VITE_FIREBASE_MEASUREMENT_ID': 'G-YTZCXR5PJV',
};

let allCorrect = true;

Object.keys(expectedValues).forEach(key => {
  const actual = envVars[key];
  const expected = expectedValues[key];
  const isCorrect = actual === expected;
  
  if (!isCorrect) allCorrect = false;
  
  console.log(`${isCorrect ? '✅' : '❌'} ${key}:`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Actual:   ${actual || 'MISSING'}`);
  console.log('');
});

if (allCorrect) {
  console.log('🎉 ALL ENVIRONMENT VARIABLES ARE CORRECT!');
  console.log('✅ Your Firebase setup is ready to use');
} else {
  console.log('❌ Some environment variables need fixing');
  console.log('📝 Check your .env file in the Frontend directory');
}

// Test Firebase config object
try {
  const { firebaseConfig } = await import('./firebase-config.js');
  console.log('\n🔧 Firebase Config Object:');
  console.log(firebaseConfig);
  
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    console.log('✅ Firebase config loaded successfully');
  } else {
    console.log('❌ Firebase config has missing values');
  }
} catch (error) {
  console.log('❌ Error loading Firebase config:', error.message);
}

export default { envVars, expectedValues, allCorrect };
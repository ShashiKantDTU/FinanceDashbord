// Simple Firebase Configuration
// Following official Firebase v9+ documentation: https://firebase.google.com/docs/web/setup
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration object
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Set language for Firebase Auth (affects SMS messages and UI)
auth.languageCode = 'en';

// Development logging
if (import.meta.env.DEV) {
  console.log('✅ Firebase initialized successfully');
  console.log('📱 Firebase Auth configured for phone authentication');
  console.log('🌐 Language set to English for SMS messages');
}

export { app, auth };
export default app;
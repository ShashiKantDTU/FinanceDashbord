// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Firebase config using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate Firebase config
const validateFirebaseConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

  if (missingFields.length > 0) {
    // Production: Only log detailed errors in development
    if (import.meta.env.DEV) {
      console.error('Missing Firebase configuration:', missingFields);
      console.error('Please check your .env file in the Frontend directory');
    }
    throw new Error(`Firebase configuration incomplete. Missing: ${missingFields.join(', ')}`);
  }
};

// Initialize Firebase app
let app;
try {
  validateFirebaseConfig();
  app = initializeApp(firebaseConfig);
  // Production: Only log in development
  if (import.meta.env.DEV) {
    console.log('Firebase initialized successfully');
  }
} catch (error) {
  // Production: Only log errors in development
  if (import.meta.env.DEV) {
    console.error('Failed to initialize Firebase:', error);
  }
  throw error;
}

// Initialize Auth
const auth = getAuth(app);

// Initialize Analytics (production-ready)
let analytics = null;
try {
  if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID && typeof window !== 'undefined') {
    analytics = getAnalytics(app);
    // Production: Only log in development
    if (import.meta.env.DEV) {
      console.log('Firebase Analytics initialized successfully');
    }
  }
} catch (error) {
  // Production: Only log warnings in development
  if (import.meta.env.DEV) {
    console.warn('Firebase Analytics initialization failed:', error);
  }
  // Analytics failure shouldn't break the app
}

// Initialize reCAPTCHA Enterprise (App Check) after Firebase is ready
if (typeof window !== 'undefined') {
  // Import and initialize reCAPTCHA Enterprise
  import('./firebase-recaptcha-enterprise.js').then(({ setupRecaptchaEnterprise }) => {
    setupRecaptchaEnterprise();
  }).catch(error => {
    if (import.meta.env.DEV) {
      console.warn('Failed to load reCAPTCHA Enterprise:', error);
    }
  });
}

// Export the app, auth, and analytics instances
export { app, auth, analytics, firebaseConfig };
export default app;

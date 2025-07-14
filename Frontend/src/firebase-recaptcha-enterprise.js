// Optional: Advanced reCAPTCHA Enterprise configuration
// This file shows how to configure reCAPTCHA Enterprise programmatically

import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase-config'; // Your existing Firebase config

// Initialize App Check with reCAPTCHA Enterprise
// This is optional - you can also configure it in Firebase Console
export const setupAppCheck = () => {
  try {
    // Use environment variable for reCAPTCHA Enterprise site key
    const recaptchaKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    
    if (!recaptchaKey) {
      console.warn('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY not found in environment variables');
      return null;
    }
    
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      
      // Optional: Enable debug mode for development
      isTokenAutoRefreshEnabled: true,
    });
    
    console.log('App Check initialized with reCAPTCHA Enterprise');
    return appCheck;
  } catch (error) {
    console.error('Failed to initialize App Check:', error);
    return null;
  }
};

// Alternative: Configure reCAPTCHA Enterprise for Firebase Auth specifically
export const configureRecaptchaEnterprise = () => {
  const auth = getAuth();
  
  // This tells Firebase Auth to use reCAPTCHA Enterprise
  // The site key should be configured in Firebase Console
  auth.settings.appVerificationDisabledForTesting = false;
  
  return auth;
};

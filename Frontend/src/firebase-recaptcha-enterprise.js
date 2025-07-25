// Firebase App Check with reCAPTCHA Enterprise Configuration
// Following official Firebase documentation: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase-config';

// App Check instance
let appCheck = null;

export const setupRecaptchaEnterprise = () => {
  try {
    // Check if App Check is already initialized
    if (appCheck) {
      return appCheck;
    }

    // Get reCAPTCHA Enterprise configuration
    const enterpriseKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    const useEnterprise = import.meta.env.VITE_USE_RECAPTCHA_ENTERPRISE === 'true';
    
    // Skip if not configured
    if (!useEnterprise || !enterpriseKey) {
      if (import.meta.env.DEV) {
        console.log('App Check not configured - using Firebase Auth without App Check');
      }
      return null;
    }

    // Validate the enterprise key format (should start with 6L and not contain placeholders)
    if (!enterpriseKey.startsWith('6L') || enterpriseKey.includes('XXXXXXX')) {
      if (import.meta.env.DEV) {
        console.warn('Invalid reCAPTCHA Enterprise key format');
      }
      return null;
    }

    // Initialize App Check with reCAPTCHA Enterprise provider
    // Following official documentation pattern
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(enterpriseKey),
      isTokenAutoRefreshEnabled: true // Enable automatic token refresh (default TTL: 1 hour)
    });

    if (import.meta.env.DEV) {
      console.log('✅ App Check with reCAPTCHA Enterprise initialized successfully');
      console.log('📋 Site Key:', enterpriseKey);
      console.log('🔄 Auto-refresh enabled (TTL: ~1 hour)');
    }

    return appCheck;
  } catch (error) {
    // Handle specific App Check errors as per documentation
    if (error.code === 'app-check/recaptcha-error') {
      console.error('❌ ReCAPTCHA Enterprise error: Domain not authorized in Google Cloud Console');
      console.error('🔧 Fix: Add your domain to the reCAPTCHA Enterprise site key configuration');
    } else if (error.code === 'app-check/fetch-status-error') {
      console.error('❌ App Check network error: Check Firebase project configuration');
    } else if (error.code === 'app-check/throttled') {
      console.error('❌ App Check throttled: Too many requests');
    } else {
      console.error('❌ App Check initialization failed:', error.code || error.message);
    }
    
    // In development, provide more detailed error information
    if (import.meta.env.DEV) {
      console.warn('🔄 Continuing without App Check - Firebase Auth will still work');
      console.warn('📖 See: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider');
    }
    
    return null;
  }
};

// Auto-initialize App Check following official Firebase documentation
// This should be called before any Firebase service usage
if (typeof window !== 'undefined') {
  // Initialize immediately - no delay needed as per official docs
  setupRecaptchaEnterprise();
}

export { appCheck };
export default setupRecaptchaEnterprise;
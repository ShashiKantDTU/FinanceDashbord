// Firebase reCAPTCHA Enterprise Configuration
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase-config';

// reCAPTCHA Enterprise configuration
let appCheck = null;

export const setupRecaptchaEnterprise = () => {
  try {
    // Check if reCAPTCHA Enterprise is enabled and key is available
    const enterpriseKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    const useEnterprise = import.meta.env.VITE_USE_RECAPTCHA_ENTERPRISE === 'true';
    
    if (!useEnterprise || !enterpriseKey) {
      if (import.meta.env.DEV) {
        console.log('reCAPTCHA Enterprise not configured, using standard reCAPTCHA');
      }
      return null;
    }

    // Initialize App Check with reCAPTCHA Enterprise
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(enterpriseKey),
      isTokenAutoRefreshEnabled: true // Automatically refresh tokens
    });

    if (import.meta.env.DEV) {
      console.log('reCAPTCHA Enterprise initialized successfully');
    }

    return appCheck;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('reCAPTCHA Enterprise initialization failed:', error);
      console.log('Falling back to standard reCAPTCHA');
    }
    return null;
  }
};

// Auto-initialize reCAPTCHA Enterprise
if (typeof window !== 'undefined') {
  // Initialize after a short delay to ensure Firebase is ready
  setTimeout(() => {
    setupRecaptchaEnterprise();
  }, 100);
}

export { appCheck };
export default setupRecaptchaEnterprise;
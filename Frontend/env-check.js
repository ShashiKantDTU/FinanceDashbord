// Quick environment variable check for production deployment
console.log('=== Environment Variables Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VITE_USE_RECAPTCHA_ENTERPRISE:', process.env.VITE_USE_RECAPTCHA_ENTERPRISE);
console.log('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY:', process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY);
console.log('VITE_DISABLE_APPCHECK_IN_PRODUCTION:', process.env.VITE_DISABLE_APPCHECK_IN_PRODUCTION);
console.log('=====================================');
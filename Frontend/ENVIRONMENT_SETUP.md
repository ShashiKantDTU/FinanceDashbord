# Environment Variables Setup Guide

## 📁 **File Location**
Create/update the `.env` file in the `Frontend/` directory:
```
Frontend/.env
```

## 🔧 **Complete Environment Configuration**

### **Development Environment (.env)**
```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:5000

# Environment
NODE_ENV=development

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyArgN3jZzISWOhdF0TvZmgtWt9yOetJsHk
VITE_FIREBASE_AUTH_DOMAIN=sitehaazri.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sitehaazri
VITE_FIREBASE_STORAGE_BUCKET=sitehaazri.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=820349080987
VITE_FIREBASE_APP_ID=1:820349080987:web:b3095601e9e240740e3d3e
VITE_FIREBASE_MEASUREMENT_ID=G-YTZCXR5PJV

# reCAPTCHA Enterprise Configuration (Optional for production)
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=6LfZtoIrAAAAAELHgYTHyj0SbqEh8FCvXRQR9FD0
```

### **Production Environment (.env.production)**
```env
# Backend API Configuration
VITE_API_BASE_URL=https://your-production-api.com

# Environment
NODE_ENV=production

# Firebase Configuration (same as development)
VITE_FIREBASE_API_KEY=AIzaSyArgN3jZzISWOhdF0TvZmgtWt9yOetJsHk
VITE_FIREBASE_AUTH_DOMAIN=sitehaazri.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sitehaazri
VITE_FIREBASE_STORAGE_BUCKET=sitehaazri.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=820349080987
VITE_FIREBASE_APP_ID=1:820349080987:web:b3095601e9e240740e3d3e
VITE_FIREBASE_MEASUREMENT_ID=G-YTZCXR5PJV

# reCAPTCHA Enterprise Configuration (Recommended for production)
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=your-production-recaptcha-key
```

## 🔍 **Environment Variable Breakdown**

### **Backend API**
```env
VITE_API_BASE_URL=http://localhost:5000
```
- **Development**: `http://localhost:5000`
- **Production**: `https://your-production-api.com`

### **Firebase Core Configuration**
```env
VITE_FIREBASE_API_KEY=AIzaSyArgN3jZzISWOhdF0TvZmgtWt9yOetJsHk
VITE_FIREBASE_AUTH_DOMAIN=sitehaazri.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sitehaazri
VITE_FIREBASE_STORAGE_BUCKET=sitehaazri.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=820349080987
VITE_FIREBASE_APP_ID=1:820349080987:web:b3095601e9e240740e3d3e
```

### **Firebase Analytics (New)**
```env
VITE_FIREBASE_MEASUREMENT_ID=G-YTZCXR5PJV
```
- **Purpose**: Enables Firebase Analytics
- **Optional**: App works without it
- **Benefits**: User behavior tracking, performance monitoring

### **reCAPTCHA Enterprise (Optional)**
```env
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=6LfZtoIrAAAAAELHgYTHyj0SbqEh8FCvXRQR9FD0
```
- **Current**: Using standard reCAPTCHA v2 (free)
- **Future**: Can upgrade to Enterprise for advanced features

## 🚀 **How to Use**

### **1. Create the .env file**
```bash
# In the Frontend directory
touch .env
```

### **2. Copy the configuration**
Copy the development environment configuration above into your `.env` file.

### **3. Restart your development server**
```bash
npm run dev
```

### **4. Verify in browser console**
You should see:
```
Firebase initialized successfully
Firebase Analytics initialized successfully
```

## 🔒 **Security Notes**

### **Safe to Commit (Public)**
These Firebase config values are **safe to commit** to version control:
- ✅ `VITE_FIREBASE_API_KEY`
- ✅ `VITE_FIREBASE_AUTH_DOMAIN`
- ✅ `VITE_FIREBASE_PROJECT_ID`
- ✅ `VITE_FIREBASE_STORAGE_BUCKET`
- ✅ `VITE_FIREBASE_MESSAGING_SENDER_ID`
- ✅ `VITE_FIREBASE_APP_ID`
- ✅ `VITE_FIREBASE_MEASUREMENT_ID`

### **Keep Private (Don't Commit)**
- ⚠️ `VITE_API_BASE_URL` (if contains sensitive info)
- ⚠️ `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` (if using Enterprise)

## 🧪 **Testing Your Setup**

### **1. Check Environment Variables**
Add this to any component temporarily:
```javascript
console.log('Firebase Config:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
});
```

### **2. Test Firebase Connection**
```javascript
import { auth, analytics } from './firebase-config';

console.log('Auth instance:', auth);
console.log('Analytics instance:', analytics);
```

### **3. Test Phone Authentication**
1. Go to login page
2. Select "Mobile OTP"
3. Enter phone number
4. Check browser console for errors

## 🔄 **Different Environments**

### **Development**
```bash
npm run dev
# Uses .env file
```

### **Production Build**
```bash
npm run build
# Uses .env.production if it exists, otherwise .env
```

### **Preview Production Build**
```bash
npm run preview
# Tests production build locally
```

## 🛠️ **Troubleshooting**

### **Environment Variables Not Loading**
1. **Restart dev server** after changing .env
2. **Check file location** - must be in `Frontend/.env`
3. **Check variable names** - must start with `VITE_`
4. **Check syntax** - no spaces around `=`

### **Firebase Not Initializing**
1. **Check all required variables** are present
2. **Verify values** match Firebase Console
3. **Check browser console** for specific errors

### **Analytics Not Working**
1. **Check measurementId** is correct
2. **Verify Analytics is enabled** in Firebase Console
3. **Check browser console** for Analytics errors

## ✅ **Current Status**

Your environment is now configured with:
- [x] Firebase Authentication
- [x] Firebase Analytics
- [x] reCAPTCHA v2 (standard)
- [x] Development/Production environment support
- [x] Proper security practices

## 🎯 **Next Steps**

1. **Test phone authentication** with your setup
2. **Monitor Firebase Analytics** in Firebase Console
3. **Consider reCAPTCHA Enterprise** if needed later
4. **Set up production environment** when ready to deploy
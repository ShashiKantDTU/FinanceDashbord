# Firebase Phone Authentication Setup Checklist

## 🔥 Firebase Console Configuration

### 1. **Enable Phone Number Sign-in Method**
- [ ] Go to [Firebase Console](https://console.firebase.google.com/)
- [ ] Select your project: `sitehaazri`
- [ ] Navigate to **Authentication** → **Sign-in method**
- [ ] Enable **Phone Number** provider
- [ ] Click **Save**

### 2. **Configure OAuth Redirect Domains**
- [ ] In the same **Sign-in method** page
- [ ] Scroll to **OAuth redirect domains** section
- [ ] Ensure your domains are added:
  - [ ] `localhost` (for development)
  - [ ] Your production domain (e.g., `yourapp.com`)
  - [ ] `sitehaazri.firebaseapp.com` (Firebase hosting domain)

### 3. **reCAPTCHA Configuration**
- [ ] Phone auth automatically uses reCAPTCHA v2
- [ ] No additional setup needed for basic reCAPTCHA
- [ ] For production, consider reCAPTCHA Enterprise (optional)

### 4. **Test Phone Numbers (Optional for Development)**
- [ ] In **Authentication** → **Sign-in method** → **Phone**
- [ ] Scroll to **Phone numbers for testing**
- [ ] Add test numbers like: `+1 650-555-3434` with code `123456`
- [ ] This allows testing without sending real SMS

## 🔧 Code Configuration

### 1. **Environment Variables** ✅
```env
VITE_FIREBASE_API_KEY=AIzaSyArgN3jZzISWOhdF0TvZmgtWt9yOetJsHk
VITE_FIREBASE_AUTH_DOMAIN=sitehaazri.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sitehaazri
VITE_FIREBASE_STORAGE_BUCKET=sitehaazri.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=820349080987
VITE_FIREBASE_APP_ID=1:820349080987:web:b3095601e9e240740e3d3e
VITE_FIREBASE_MEASUREMENT_ID=G-YTZCXR5PJV
```

### 2. **Required Scripts** ✅
- [x] reCAPTCHA script added to `index.html`
- [x] Firebase SDK installed (`firebase@11.10.0`)

### 3. **Code Implementation** ✅
- [x] Proper Firebase v9+ modular imports
- [x] RecaptchaVerifier with auth instance
- [x] signInWithPhoneNumber implementation
- [x] OTP verification with confirmationResult.confirm()
- [x] Error handling for Firebase auth errors
- [x] Cleanup on component unmount

## 🧪 Testing Steps

### 1. **Development Testing**
1. Start your dev server: `npm run dev`
2. Go to login page and select "Mobile OTP"
3. Enter a valid Indian mobile number (10 digits, starts with 6-9)
4. Click "Send OTP"
5. Check browser console for any errors
6. Enter the received OTP and verify

### 2. **Common Issues & Solutions**

#### Issue: "reCAPTCHA verification failed"
- **Solution**: Ensure reCAPTCHA script is loaded in `index.html`
- **Check**: Browser console for reCAPTCHA errors

#### Issue: "Domain not authorized"
- **Solution**: Add your domain to OAuth redirect domains in Firebase Console

#### Issue: "Phone authentication is not enabled"
- **Solution**: Enable Phone Number sign-in method in Firebase Console

#### Issue: "SMS quota exceeded"
- **Solution**: Check Firebase Console → Authentication → Usage tab

#### Issue: "Invalid phone number format"
- **Solution**: Ensure number format is correct (+91XXXXXXXXXX)

## 📱 Production Considerations

### 1. **SMS Quota**
- Firebase has daily SMS limits
- Monitor usage in Firebase Console
- Consider implementing rate limiting

### 2. **Security**
- Use reCAPTCHA Enterprise for production
- Implement proper backend verification
- Add phone number validation

### 3. **User Experience**
- Show clear error messages
- Implement resend OTP functionality
- Add loading states

## 🔍 Debugging

### 1. **Browser Console**
Check for these logs:
- "Firebase initialized successfully"
- "reCAPTCHA solved"
- Any Firebase auth errors

### 2. **Network Tab**
Monitor these requests:
- reCAPTCHA verification
- Firebase Auth API calls
- Your backend OTP login endpoint

### 3. **Firebase Console**
- Check Authentication → Users for new phone users
- Monitor Authentication → Usage for SMS usage
- Check Authentication → Settings for any issues

## ✅ Current Status

- [x] Firebase package installed
- [x] Environment variables configured
- [x] reCAPTCHA script added to HTML
- [x] Code implementation completed
- [x] Error handling implemented
- [x] Cleanup logic added
- [ ] **TODO**: Verify Firebase Console phone auth is enabled
- [ ] **TODO**: Test with real phone number
- [ ] **TODO**: Add test phone numbers for development

## 🚀 Next Steps

1. **Enable phone auth in Firebase Console** (most important)
2. **Test with a real phone number**
3. **Add test phone numbers for development**
4. **Monitor SMS usage and costs**
5. **Consider reCAPTCHA Enterprise for production**
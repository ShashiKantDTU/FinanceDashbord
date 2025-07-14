import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { FaMobileAlt, FaCheckCircle, FaRocket, FaLock, FaUserFriends } from 'react-icons/fa';
import { MdEmail, MdLock } from 'react-icons/md';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';

// Firebase config using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase config
const validateFirebaseConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
  
  if (missingFields.length > 0) {
    console.error('Missing Firebase configuration:', missingFields);
    throw new Error(`Firebase configuration incomplete. Missing: ${missingFields.join(', ')}`);
  }
};

// Initialize Firebase app
let _firebaseApp;
let auth = null;

const initializeFirebaseAuth = () => {
  try {
    validateFirebaseConfig();
    
    if (!window._firebaseInitialized) {
      _firebaseApp = initializeApp(firebaseConfig);
      window._firebaseInitialized = true;
    }
    
    auth = getAuth();
    
    
    return auth;
    
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return null;
  }
};

// Initialize immediately
auth = initializeFirebaseAuth();

const features = [
  { icon: <FaRocket color="#6358DC" size={22} />, title: 'Fast & Reliable', desc: 'Lightning fast access to your dashboard.' },
  { icon: <FaLock color="#6358DC" size={22} />, title: 'Secure', desc: 'Your data is protected with industry standards.' },
  { icon: <FaUserFriends color="#6358DC" size={22} />, title: 'Collaboration', desc: 'Work with your team in real time.' },
  { icon: <FaCheckCircle color="#6358DC" size={22} />, title: 'Easy to Use', desc: 'Intuitive design for everyone.' },
];

const RESEND_OTP_SECONDS = 60;

const LoginV2 = () => {
  const [mode, setMode] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [firebaseReady, setFirebaseReady] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [resendTimer, setResendTimer] = useState(0);

  // Check Firebase initialization
  useEffect(() => {
    const checkFirebaseReady = () => {
      try {
        const currentAuth = getAuth();
        if (window._firebaseInitialized && currentAuth && currentAuth.app) {
          setFirebaseReady(true);
          return true;
        } else {
          setFirebaseReady(false);
          return false;
        }
      } catch (error) {
        console.error('Firebase initialization error:', error);
        setFirebaseReady(false);
        setError('Firebase configuration error. Please contact support.');
        return false;
      }
    };

    const isReady = checkFirebaseReady();
    
    if (!isReady) {
      const timeout = setTimeout(() => {
        checkFirebaseReady();
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    // Client-side validation
    if (!email) {
      setError('Email is required');
      setLoading(false);
      return;
    }
    if (!password) {
      setError('Password is required');
      setLoading(false);
      return;
    } else if (password.length < 4) {
      setError('Password must be at least 4 characters');
      setLoading(false);
      return;
    }
    try {
      // Call the backend API
      const data = await authAPI.login({ email, password });
      // Use the auth context login function
      try {
        login(data);
        setSuccess('Login successful!');
        navigate('/');
      } catch (authError) {
        if (authError.message?.includes('Supervisor credentials are not valid')) {
          setError('Invalid role. Supervisor credentials are not valid for this application.');
        } else {
          setError(authError.message || 'Authentication failed. Please try again.');
        }
        return;
      }
    } catch (error) {
      const errorMessage = error.message || '';
      if (errorMessage === 'Email and password are required') {
        setError('Please fill in both email and password fields.');
      } else if (errorMessage === 'Invalid email format') {
        setError('Please enter a valid email address.');
      } else if (errorMessage === 'Incorrect password') {
        setError('The password you entered is incorrect. Please try again.');
      } else if (errorMessage === 'Invalid email or password') {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (errorMessage === 'Account disabled') {
        setError('Your account has been disabled. Please contact support for assistance.');
      } else if (errorMessage === 'Too many attempts. Try again later.') {
        setError('Too many login attempts. Please wait a few minutes before trying again.');
      } else if (errorMessage === 'User not found in system') {
        setError('No account found with this email address.');
      } else if (errorMessage === 'System configuration error. Please contact your administrator.') {
        setError('There is a system configuration issue. Please contact support.');
      } else if (errorMessage === 'Server error occurred during login') {
        setError('A server error occurred. Please try again later.');
      } else {
        setError(errorMessage || 'Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Mobile number validation function
  const validateMobileNumber = (mobile) => {
    // Indian mobile number validation: 10 digits, starts with 6-9
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(mobile);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const currentAuth = getAuth();
    
    if (!currentAuth || !currentAuth.app) {
      setError('Firebase authentication is not available. Please refresh the page and try again.');
      setLoading(false);
      return;
    }
    
    if (!validateMobileNumber(mobile)) {
      setError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9');
      setLoading(false);
      return;
    }
    
    try {
      // Clean up existing recaptcha verifier
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {
          // Non-critical error, continue
        }
        window.recaptchaVerifier = null;
      }
      
      // Brief delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create RecaptchaVerifier with compatibility handling
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(currentAuth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // TODO: Remove after deployment test
            console.log('reCAPTCHA verified successfully');
          },
          'expired-callback': () => {
            setError('Recaptcha expired. Please try again.');
            setLoading(false);
          }
        });
      } catch {
        // Fallback: Try without auth parameter
        try {
          window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
            size: 'invisible',
            callback: () => {
              // TODO: Remove after deployment test
              console.log('reCAPTCHA verified successfully (fallback method)');
            },
            'expired-callback': () => {
              setError('Recaptcha expired. Please try again.');
              setLoading(false);
            }
          });
        } catch {
          setError('Failed to initialize verification. Please refresh the page and try again.');
          setLoading(false);
          return;
        }
      }
      
      const appVerifier = window.recaptchaVerifier;
      const phoneNumber = '+91' + mobile;
      
      await signInWithPhoneNumber(currentAuth, phoneNumber, appVerifier)
        .then((confirmationResult) => {
          window.confirmationResult = confirmationResult;
          setOtpSent(true);
          setResendTimer(RESEND_OTP_SECONDS);
          setError('');
          setSuccess(`OTP sent to ${phoneNumber}`);
        })
        .catch((err) => {
          if (err.code === 'auth/too-many-requests') {
            setError('Too many attempts. Please try again later.');
          } else if (err.code === 'auth/invalid-phone-number') {
            setError('Invalid phone number format.');
          } else if (err.code === 'auth/quota-exceeded') {
            setError('SMS quota exceeded. Please try again later.');
          } else {
            setError(err.message || 'Failed to send OTP. Please try again.');
          }
        });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Timer effect for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timerId = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [resendTimer]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {
          // Non-critical cleanup error
        }
        window.recaptchaVerifier = null;
      }
      window.confirmationResult = null;
    };
  }, []);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    // Validate OTP
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      setLoading(false);
      return;
    }
    
    try {
      // 1. Confirm OTP with Firebase
      if (!window.confirmationResult) {
        setError('Verification session expired. Please request a new OTP.');
        setOtpSent(false);
        setOtp('');
        setLoading(false);
        return;
      }
      
      const result = await window.confirmationResult.confirm(otp);
      const firebaseUser = result.user;
      
      // 2. Get Firebase ID token
      const idToken = await firebaseUser.getIdToken();
      
      // 3. Send ID token to backend to get app JWT
      const data = await authAPI.otplogin({ token: idToken });
      
      // 4. Use AuthContext to log in with backend JWT
      login(data);
      setSuccess('Login successful!');
      
      // Clean up
      setOtp('');
      setOtpSent(false);
      window.confirmationResult = null;
      
      navigate('/');
    } catch (err) {
      // Handle specific Firebase auth errors
      if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid OTP. Please check and try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('OTP has expired. Please request a new one.');
        setOtpSent(false);
        setOtp('');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (err.message && err.message.includes('User not found')) {
        setError('Account not found. Please contact support.');
      } else if (err.message && err.message.includes('Invalid or expired ID token')) {
        setError('Session expired. Please try again.');
        setOtpSent(false);
        setOtp('');
      } else {
        setError(err.message || 'OTP verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const leftColVariants = {
    initial: { opacity: 0, x: -40 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } },
  };
  const featureVariants = {
    initial: { opacity: 0, y: 20 },
    animate: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.2 + i * 0.12, duration: 0.5 } }),
  };
  const formVariants = {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    exit: { opacity: 0, y: -40, transition: { duration: 0.3 } },
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: 'linear-gradient(120deg, #F4F4F4 60%, #E8EAF6 100%)' }}>
      {/* Left column: Animated marketing/feature area */}
      <motion.div
        variants={leftColVariants}
        initial="initial"
        animate="animate"
        style={{
          flex: 1,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '7vh 6vw',
          minWidth: 0,
        }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ fontFamily: 'Poppins, Inter, sans-serif', fontWeight: 900, fontSize: '2.3rem', color: '#6358DC', marginBottom: 16, lineHeight: 1.1 }}
        >
          Welcome to Design School
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{ color: '#2F2F2F', fontWeight: 500, fontSize: '1.18rem', marginBottom: 36, opacity: 0.85, lineHeight: 1.3 }}
        >
          Unlock your productivity with our modern dashboard.
        </motion.div>
        <div style={{ width: '100%' }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="initial"
              animate="animate"
              variants={featureVariants}
              style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}
            >
              <div>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#222', fontSize: '1.13rem' }}>{f.title}</div>
                <div style={{ color: '#666', fontSize: '1.01rem', opacity: 0.85 }}>{f.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
      {/* Right column: Centered floating login card */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(120deg, #f3f4f8 80%, #e0e3ee 100%)', // softer, less bright
        minWidth: 0,
        height: '100vh',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } }}
          exit={{ opacity: 0, y: -40, scale: 0.98, transition: { duration: 0.3 } }}
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'rgba(255,255,255,0.85)',
            borderRadius: 24,
            boxShadow: '0 12px 48px 0 rgba(99,88,220,0.18), 0 1.5px 8px 0 rgba(99,88,220,0.08)',
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'stretch',
            minHeight: 420,
            overflow: 'auto',
            border: '1.5px solid #e3e6f0',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'box-shadow 0.2s, background 0.2s',
          }}
        >
          <h2 style={{ fontFamily: 'Poppins, Inter, sans-serif', fontWeight: 800, fontSize: '1.45rem', marginBottom: 6, color: '#2F2F2F', letterSpacing: '-0.5px', lineHeight: 1.1, textAlign: 'center' }}>Welcome to Design School</h2>
          <div style={{ color: '#6358DC', fontWeight: 500, fontSize: '0.98rem', marginBottom: '1.2vh', opacity: 0.85, lineHeight: 1.1, textAlign: 'center' }}>Sign in to your account</div>
          <div style={{ display: 'flex', gap: '0.5vw', marginBottom: '1.2vh' }}>
            <button onClick={() => setMode('email')} style={{ flex: 1, background: mode === 'email' ? '#6358DC' : '#ECECEC', color: mode === 'email' ? '#fff' : '#2F2F2F', border: 'none', borderRadius: 7, padding: '0.5em 0', fontWeight: 700, fontSize: '0.93rem', cursor: 'pointer', transition: 'all 0.2s' }}>Email Login</button>
            <button 
              onClick={() => firebaseReady && setMode('mobile')} 
              disabled={!firebaseReady}
              style={{ 
                flex: 1, 
                background: mode === 'mobile' ? '#6358DC' : (!firebaseReady ? '#CCCCCC' : '#ECECEC'), 
                color: mode === 'mobile' ? '#fff' : (!firebaseReady ? '#888' : '#2F2F2F'), 
                border: 'none', 
                borderRadius: 7, 
                padding: '0.5em 0', 
                fontWeight: 700, 
                fontSize: '0.93rem', 
                cursor: firebaseReady ? 'pointer' : 'not-allowed', 
                transition: 'all 0.2s' 
              }}
            >
              Mobile OTP {!firebaseReady && '(Loading...)'}
            </button>
          </div>
          <AnimatePresence mode="wait">
            {mode === 'email' && (
              <motion.form
                key="email"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={formVariants}
                onSubmit={handleEmailLogin}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.7vh', marginTop: 2 }}
              >
                <label style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.93rem', color: '#6358DC' }}><MdEmail /> Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="example@gmail.com" style={{ padding: '0.6em', borderRadius: 7, border: '1.2px solid #ECECEC', fontSize: '0.93rem', background: '#FAFAFA', fontWeight: 500 }} />
                <label style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.93rem', color: '#6358DC' }}><MdLock /> Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="***********" style={{ padding: '0.6em', borderRadius: 7, border: '1.2px solid #ECECEC', fontSize: '0.93rem', background: '#FAFAFA', fontWeight: 500 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <input type="checkbox" id="remember" style={{ accentColor: '#6358DC' }} />
                    <label htmlFor="remember" style={{ fontSize: '0.93rem', color: '#2F2F2F' }}>Remember me</label>
                  </div>
                  <a href="#" style={{ color: '#6358DC', fontWeight: 600, fontSize: '0.93rem', textDecoration: 'none' }}>Forgot Password?</a>
                </div>
                <button type="submit" disabled={loading} style={{ background: '#6358DC', color: '#fff', border: 'none', borderRadius: 7, padding: '0.7em 0', fontWeight: 700, fontSize: '1rem', marginTop: 8, cursor: 'pointer', boxShadow: '0 4px 15px 0 rgba(99,88,220,0.11)', transition: 'background 0.2s' }}>{loading ? 'Logging in...' : 'Login'}</button>
              </motion.form>
            )}
            {mode === 'mobile' && (
              <motion.form
                key="mobile"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={formVariants}
                onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.7vh', marginTop: 2 }}
              >
                <label style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.93rem', color: '#6358DC' }}><FaMobileAlt /> Mobile Number</label>
                <input 
                  type="tel" 
                  value={mobile} 
                  onChange={e => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 10) {
                      setMobile(value);
                      // Clear error when user starts typing valid number
                      if (value.length > 0 && error.includes('mobile number')) {
                        setError('');
                      }
                    }
                  }} 
                  required 
                  placeholder="Enter 10 digit mobile (6-9 XXXXXXXXX)" 
                  maxLength={10}
                  style={{ 
                    padding: '0.6em', 
                    borderRadius: 7, 
                    border: `1.2px solid ${error.includes('mobile number') ? '#F36F56' : '#ECECEC'}`, 
                    fontSize: '0.93rem', 
                    background: '#FAFAFA', 
                    fontWeight: 500 
                  }} 
                />
                <div id="recaptcha-container"></div>
                {/* Resend OTP button and timer */}
                {otpSent && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || resendTimer > 0}
                    style={{
                      background: resendTimer > 0 ? '#ECECEC' : '#6358DC',
                      color: resendTimer > 0 ? '#888' : '#fff',
                      border: 'none',
                      borderRadius: 7,
                      padding: '0.5em 0',
                      fontWeight: 700,
                      fontSize: '0.93rem',
                      marginBottom: 6,
                      cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                )}
                {otpSent && (
                  <>
                    <label style={{ fontWeight: 600, marginBottom: 2, fontSize: '0.93rem', color: '#6358DC' }}>OTP</label>
                    <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required placeholder="Enter OTP" maxLength={6} style={{ padding: '0.6em', borderRadius: 7, border: '1.2px solid #ECECEC', fontSize: '0.93rem', background: '#FAFAFA', fontWeight: 500 }} />
                  </>
                )}
                <button type="submit" disabled={loading} style={{ background: '#6358DC', color: '#fff', border: 'none', borderRadius: 7, padding: '0.7em 0', fontWeight: 700, fontSize: '1rem', marginTop: 8, cursor: 'pointer', boxShadow: '0 4px 15px 0 rgba(99,88,220,0.11)', transition: 'background 0.2s' }}>{loading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify OTP' : 'Send OTP')}</button>
              </motion.form>
            )}
          </AnimatePresence>
          {error && <div style={{ color: '#F36F56', marginTop: '0.8vh', fontWeight: 600, fontSize: '0.93rem' }}>{error}</div>}
          {success && <div style={{ color: '#28B446', marginTop: '0.8vh', fontWeight: 600, fontSize: '0.93rem' }}>{success}</div>}

          {/* OR separator above Google login button */}
          <div style={{ textAlign: 'center', margin: '1.2vh 0 0.7vh 0', color: '#BFBFBF', fontWeight: 600, fontSize: '0.93rem' }}>OR</div>

          {/* Google Login Button - moved to bottom */}
          <button style={{
            width: '100%',
            margin: '0 0 0.7vh 0',
            background: '#fff',
            border: '1.2px solid #ECECEC',
            borderRadius: 7,
            padding: '0.7em 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontWeight: 600,
            fontSize: '0.97rem',
            color: '#222',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.07)',
            transition: 'box-shadow 0.2s',
            cursor: 'pointer',
          }}>
            {/* Google logo in original colors */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_993_771)">
                <path d="M19.805 10.2305C19.805 9.55047 19.7482 8.90047 19.6482 8.27047H10.2V12.0555H15.605C15.38 13.2555 14.655 14.2655 13.605 14.9455V17.2055H16.685C18.505 15.5455 19.805 13.1455 19.805 10.2305Z" fill="#4285F4"/>
                <path d="M10.2 20.0005C12.7 20.0005 14.77 19.1805 16.29 17.8055L13.605 14.9455C12.805 15.4855 11.805 15.8055 10.2 15.8055C7.805 15.8055 5.805 14.1455 5.065 11.9955H1.865V14.3255C3.38 17.4655 6.565 20.0005 10.2 20.0005Z" fill="#34A853"/>
                <path d="M5.065 11.9955C4.865 11.4555 4.75 10.8755 4.75 10.2755C4.75 9.67547 4.865 9.09547 5.065 8.55547V6.22547H1.865C1.165 7.62547 0.75 9.14547 0.75 10.7755C0.75 12.4055 1.165 13.9255 1.865 15.3255L5.065 11.9955Z" fill="#FBBC05"/>
                <path d="M10.2 4.19547C11.655 4.19547 12.755 4.71547 13.505 5.41547L16.35 2.57047C14.77 1.04547 12.7 0.000473022 10.2 0.000473022C6.565 0.000473022 3.38 2.53547 1.865 5.67547L5.065 8.55547C5.805 6.40547 7.805 4.19547 10.2 4.19547Z" fill="#EA4335"/>
              </g>
              <defs>
                <clipPath id="clip0_993_771">
                  <rect width="20" height="20" fill="white"/>
                </clipPath>
              </defs>
            </svg>
            <span style={{ color: '#222', fontWeight: 600 }}>Sign in with Google</span>
          </button>

          <div style={{ marginTop: '1.2vh', textAlign: 'center', color: '#2F2F2F', fontSize: '0.93rem', marginBottom: 2 }}>
            Don’t have an account? <a href="#" style={{ color: '#6358DC', fontWeight: 700, textDecoration: 'none' }}>Register</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginV2;
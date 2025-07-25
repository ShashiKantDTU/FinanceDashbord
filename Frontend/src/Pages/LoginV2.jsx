import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { FaMobileAlt, FaCheckCircle, FaRocket, FaLock, FaUserFriends } from 'react-icons/fa';
import { MdEmail, MdLock } from 'react-icons/md';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';
// Import Firebase config from centralized location
import { auth } from '../firebase-config';
// Import the logo image
import LoginPageLogo from '../assets/LoginPageLogo.png';
// Production-ready Firebase phone authentication with reCAPTCHA Enterprise

const features = [
  { icon: <FaRocket color="#10B981" size={24} />, title: 'Auto-calculated payments', desc: 'Accurate labour payment, based on daily attendance and all advances given.' },
  { icon: <FaUserFriends color="#10B981" size={24} />, title: 'All labour records. One app', desc: 'Track haazri, payment, and reports – everything auto-managed.' },
  { icon: <FaCheckCircle color="#10B981" size={24} />, title: 'Supervisor access. Fully synced', desc: 'Supervisors mark attendance. You get live updates on your phone.' },
  { icon: <FaLock color="#10B981" size={24} />, title: 'PDF report in one tap', desc: 'Download monthly labour summaries instantly.' },
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
        // Check if Firebase auth is properly initialized
        if (auth && auth.app) {
          setFirebaseReady(true);
          return true;
        } else {
          setFirebaseReady(false);
          return false;
        }
      } catch (error) {
        console.error('Firebase initialization error:', error);
        setFirebaseReady(false);
        setError('Firebase initialization failed. Please refresh the page and try again.');
        return false;
      }
    };

    const isReady = checkFirebaseReady();

    // If not ready, try again after a short delay
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

    // Use centralized auth instance
    if (!auth || !auth.app) {
      setError('Firebase authentication is not available. Please refresh the page and try again.');
      setLoading(false);
      return;
    }

    // Set language for reCAPTCHA and SMS to English for production
    auth.languageCode = 'en';

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

      // Brief delay to ensure DOM is ready and reCAPTCHA script is loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if reCAPTCHA is available
      if (typeof window.grecaptcha === 'undefined') {
        setError('reCAPTCHA is not loaded. Please refresh the page and try again.');
        setLoading(false);
        return;
      }

      // Create RecaptchaVerifier with Enterprise support
      try {
        // Initialize RecaptchaVerifier with auth instance as first parameter (Firebase v9+ requirement)
        // Try using the submit button first, fallback to container if needed
        const containerId = !otpSent ? 'send-otp-button' : 'recaptcha-container';

        // Check if reCAPTCHA Enterprise is enabled
        const useEnterprise = import.meta.env.VITE_USE_RECAPTCHA_ENTERPRISE === 'true';
        const enterpriseKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

        // Configure reCAPTCHA based on Enterprise availability
        const recaptchaConfig = {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved, allow signInWithPhoneNumber
            if (import.meta.env.DEV) {
              console.log(`reCAPTCHA ${useEnterprise && enterpriseKey ? 'Enterprise' : 'Standard'} solved`);
            }
          },
          'expired-callback': () => {
            // Response expired. Ask user to solve reCAPTCHA again
            setError('Verification expired. Please try again.');
            setLoading(false);
          },
          'error-callback': () => {
            setError('Verification failed. Please try again.');
            setLoading(false);
          }
        };

        // Add Enterprise-specific configuration if available
        if (useEnterprise && enterpriseKey) {
          // reCAPTCHA Enterprise is handled by App Check, but we still need the verifier
          recaptchaConfig.callback = () => {
            if (import.meta.env.DEV) {
              console.log('reCAPTCHA Enterprise verification completed');
            }
          };
        }

        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, recaptchaConfig);
      } catch (recaptchaError) {
        // Production: Only log detailed errors in development
        if (import.meta.env.DEV) {
          console.error('reCAPTCHA initialization error:', recaptchaError);
        }
        setError('Unable to initialize phone verification. Please refresh the page and try again.');
        setLoading(false);
        return;
      }

      const appVerifier = window.recaptchaVerifier;
      const phoneNumber = '+91' + mobile;

      await signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((confirmationResult) => {
          window.confirmationResult = confirmationResult;
          setOtpSent(true);
          setResendTimer(RESEND_OTP_SECONDS);
          setError('');
          setSuccess(`OTP sent to ${phoneNumber}`);
        })
        .catch((err) => {
          // Reset reCAPTCHA on error as recommended by Firebase docs
          if (window.recaptchaVerifier) {
            try {
              window.recaptchaVerifier.render().then((widgetId) => {
                if (window.grecaptcha) {
                  window.grecaptcha.reset(widgetId);
                }
              });
            } catch {
              // Non-critical error, continue with error handling
            }
          }

          // Handle specific Firebase Auth errors
          if (err.code === 'auth/invalid-app-credential') {
            setError('App verification failed. Please ensure phone authentication is enabled in Firebase Console.');
          } else if (err.code === 'auth/too-many-requests') {
            setError('Too many attempts. Please try again later.');
          } else if (err.code === 'auth/invalid-phone-number') {
            setError('Invalid phone number format.');
          } else if (err.code === 'auth/quota-exceeded') {
            setError('SMS quota exceeded. Please try again later.');
          } else if (err.code === 'auth/captcha-check-failed') {
            setError('Verification failed. Please refresh the page and try again.');
          } else if (err.code === 'auth/missing-app-credential') {
            setError('App verification failed. Please contact support.');
          } else if (err.code === 'auth/operation-not-allowed') {
            setError('Phone authentication is not enabled. Please contact support.');
          } else if (err.code === 'auth/unauthorized-domain') {
            setError('Domain not authorized for phone authentication. Please contact support.');
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
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 50%, #D1FAE5 100%)' }}>
      {/* Left column: Animated marketing/feature area */}
      <motion.div
        variants={leftColVariants}
        initial="initial"
        animate="animate"
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '7vh 6vw',
          minWidth: 0,
          borderRight: '1px solid #E5E7EB',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 8
          }}
        >
          <motion.img
            src={LoginPageLogo}
            alt="Site Haazri Logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(16, 185, 129, 0.15))'
            }}
          />
          <h1
            style={{
              fontFamily: 'Poppins, Inter, sans-serif',
              fontWeight: 900,
              fontSize: '2.8rem',
              color: '#065F46',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              textShadow: '0 2px 4px rgba(16, 185, 129, 0.1)'
            }}
          >
            Site Haazri
          </h1>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{
            color: '#10B981',
            fontWeight: 700,
            fontSize: '1.3rem',
            marginBottom: 12,
            opacity: 0.9,
            lineHeight: 1.2,
            letterSpacing: '-0.01em'
          }}
        >
          Smart Labour Management
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          style={{
            color: '#374151',
            fontWeight: 500,
            fontSize: '1.1rem',
            marginBottom: 40,
            opacity: 0.8,
            lineHeight: 1.4
          }}
        >
          Daily Labour Report. Automatic work summaries based on haazri.
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
                <div style={{ fontWeight: 800, color: '#065F46', fontSize: '1.2rem', marginBottom: 4, letterSpacing: '-0.01em' }}>{f.title}</div>
                <div style={{ color: '#6B7280', fontSize: '1.05rem', opacity: 0.9, lineHeight: 1.4 }}>{f.desc}</div>
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
        background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 50%, #D1FAE5 100%)',
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
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 24,
            boxShadow: '0 20px 60px 0 rgba(16, 185, 129, 0.15), 0 4px 16px 0 rgba(16, 185, 129, 0.1)',
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'stretch',
            minHeight: 420,
            overflow: 'auto',
            border: '2px solid rgba(16, 185, 129, 0.1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            transition: 'box-shadow 0.2s, background 0.2s',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 12
            }}
          >

            <h2 style={{
              fontFamily: 'Poppins, Inter, sans-serif',
              fontWeight: 800,
              fontSize: '1.6rem',
              margin: 0,
              color: '#065F46',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              textAlign: 'center',
              textShadow: '0 1px 2px rgba(16, 185, 129, 0.1)'
            }}>Site Haazri</h2>
          </motion.div>
          <div style={{
            color: '#10B981',
            fontWeight: 600,
            fontSize: '1.05rem',
            marginBottom: '1.2vh',
            opacity: 0.9,
            lineHeight: 1.1,
            textAlign: 'center'
          }}>Sign in to your account</div>
          <div style={{ display: 'flex', gap: '0.5vw', marginBottom: '1.2vh' }}>
            <button onClick={() => setMode('email')} style={{
              flex: 1,
              background: mode === 'email' ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : '#F3F4F6',
              color: mode === 'email' ? '#fff' : '#374151',
              border: mode === 'email' ? '2px solid #10B981' : '2px solid #E5E7EB',
              borderRadius: 10,
              padding: '0.65em 0',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: mode === 'email' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
            }}>Email Login</button>
            <button
              onClick={() => firebaseReady && setMode('mobile')}
              disabled={!firebaseReady}
              style={{
                flex: 1,
                background: mode === 'mobile' ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : (!firebaseReady ? '#E5E7EB' : '#F3F4F6'),
                color: mode === 'mobile' ? '#fff' : (!firebaseReady ? '#9CA3AF' : '#374151'),
                border: mode === 'mobile' ? '2px solid #10B981' : (!firebaseReady ? '2px solid #E5E7EB' : '2px solid #E5E7EB'),
                borderRadius: 10,
                padding: '0.65em 0',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: firebaseReady ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                boxShadow: mode === 'mobile' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
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
                <label style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem', color: '#065F46' }}><MdEmail /> Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="example@gmail.com" style={{ padding: '0.75em', borderRadius: 10, border: '2px solid #E5E7EB', fontSize: '0.95rem', background: '#FAFAFA', fontWeight: 500, transition: 'border-color 0.2s', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#10B981'} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                <label style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem', color: '#065F46' }}><MdLock /> Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="***********" style={{ padding: '0.75em', borderRadius: 10, border: '2px solid #E5E7EB', fontSize: '0.95rem', background: '#FAFAFA', fontWeight: 500, transition: 'border-color 0.2s', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#10B981'} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <input type="checkbox" id="remember" style={{ accentColor: '#10B981', transform: 'scale(1.1)' }} />
                    <label htmlFor="remember" style={{ fontSize: '0.95rem', color: '#374151', fontWeight: 500 }}>Remember me</label>
                  </div>
                  <a href="#" style={{ color: '#10B981', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none', transition: 'color 0.2s' }}>Forgot Password?</a>
                </div>
                <button type="submit" disabled={loading} style={{
                  background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '0.8em 0',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  marginTop: 12,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 6px 20px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.3s ease',
                  transform: loading ? 'none' : 'translateY(0)',
                }}>{loading ? 'Logging in...' : 'Login'}</button>
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
                <label style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem', color: '#065F46' }}><FaMobileAlt /> Mobile Number</label>
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
                    padding: '0.75em',
                    borderRadius: 10,
                    border: `2px solid ${error.includes('mobile number') ? '#EF4444' : '#E5E7EB'}`,
                    fontSize: '0.95rem',
                    background: '#FAFAFA',
                    fontWeight: 500,
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = error.includes('mobile number') ? '#EF4444' : '#10B981'}
                  onBlur={e => e.target.style.borderColor = error.includes('mobile number') ? '#EF4444' : '#E5E7EB'}
                />
                {/* reCAPTCHA container - only visible if needed for debugging */}
                <div id="recaptcha-container" style={{ display: 'none' }}></div>
                {/* Resend OTP button and timer */}
                {otpSent && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || resendTimer > 0}
                    style={{
                      background: resendTimer > 0 ? '#E5E7EB' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: resendTimer > 0 ? '#9CA3AF' : '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0.6em 0',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      marginBottom: 8,
                      cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: resendTimer > 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                )}
                {otpSent && (
                  <>
                    <label style={{ fontWeight: 600, marginBottom: 2, fontSize: '0.95rem', color: '#065F46' }}>OTP</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      required
                      placeholder="Enter OTP"
                      maxLength={6}
                      style={{
                        padding: '0.75em',
                        borderRadius: 10,
                        border: '2px solid #E5E7EB',
                        fontSize: '0.95rem',
                        background: '#FAFAFA',
                        fontWeight: 500,
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      onFocus={e => e.target.style.borderColor = '#10B981'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </>
                )}
                <button
                  type="submit"
                  id={!otpSent ? "send-otp-button" : undefined}
                  disabled={loading}
                  style={{
                    background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.8em 0',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    marginTop: 12,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 6px 20px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {loading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify OTP' : 'Send OTP')}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
          {error && <div style={{ color: '#EF4444', marginTop: '0.8vh', fontWeight: 600, fontSize: '0.95rem', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8, border: '1px solid #FECACA' }}>{error}</div>}
          {success && <div style={{ color: '#059669', marginTop: '0.8vh', fontWeight: 600, fontSize: '0.95rem', background: '#F0FDF4', padding: '8px 12px', borderRadius: 8, border: '1px solid #BBF7D0' }}>{success}</div>}

          {/* OR separator above Google login button */}
          <div style={{ textAlign: 'center', margin: '1.5vh 0 1vh 0', color: '#9CA3AF', fontWeight: 600, fontSize: '0.95rem' }}>OR</div>

          {/* Google Login Button - moved to bottom */}
          <button style={{
            width: '100%',
            margin: '0 0 0.7vh 0',
            background: '#fff',
            border: '2px solid #E5E7EB',
            borderRadius: 10,
            padding: '0.8em 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontWeight: 600,
            fontSize: '1rem',
            color: '#374151',
            boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
          }}
            onMouseEnter={e => {
              e.target.style.borderColor = '#10B981';
              e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.1)';
            }}
            onMouseLeave={e => {
              e.target.style.borderColor = '#E5E7EB';
              e.target.style.boxShadow = '0 4px 12px 0 rgba(0,0,0,0.05)';
            }}
          >
            {/* Google logo in original colors */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_993_771)">
                <path d="M19.805 10.2305C19.805 9.55047 19.7482 8.90047 19.6482 8.27047H10.2V12.0555H15.605C15.38 13.2555 14.655 14.2655 13.605 14.9455V17.2055H16.685C18.505 15.5455 19.805 13.1455 19.805 10.2305Z" fill="#4285F4" />
                <path d="M10.2 20.0005C12.7 20.0005 14.77 19.1805 16.29 17.8055L13.605 14.9455C12.805 15.4855 11.805 15.8055 10.2 15.8055C7.805 15.8055 5.805 14.1455 5.065 11.9955H1.865V14.3255C3.38 17.4655 6.565 20.0005 10.2 20.0005Z" fill="#34A853" />
                <path d="M5.065 11.9955C4.865 11.4555 4.75 10.8755 4.75 10.2755C4.75 9.67547 4.865 9.09547 5.065 8.55547V6.22547H1.865C1.165 7.62547 0.75 9.14547 0.75 10.7755C0.75 12.4055 1.165 13.9255 1.865 15.3255L5.065 11.9955Z" fill="#FBBC05" />
                <path d="M10.2 4.19547C11.655 4.19547 12.755 4.71547 13.505 5.41547L16.35 2.57047C14.77 1.04547 12.7 0.000473022 10.2 0.000473022C6.565 0.000473022 3.38 2.53547 1.865 5.67547L5.065 8.55547C5.805 6.40547 7.805 4.19547 10.2 4.19547Z" fill="#EA4335" />
              </g>
              <defs>
                <clipPath id="clip0_993_771">
                  <rect width="20" height="20" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <span style={{ color: '#374151', fontWeight: 600 }}>Sign in with Google</span>
          </button>

          <div style={{ marginTop: '1.5vh', textAlign: 'center', color: '#6B7280', fontSize: '0.95rem', marginBottom: 2 }}>
            Don't have an account? <a href="#" style={{ color: '#10B981', fontWeight: 700, textDecoration: 'none', transition: 'color 0.2s' }}>Register</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginV2;
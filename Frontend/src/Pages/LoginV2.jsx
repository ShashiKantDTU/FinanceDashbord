// Dual Authentication: Firebase Phone Auth + Custom Backend Email Auth
// Phone: https://firebase.google.com/docs/auth/web/phone-auth
// Email: Custom backend API
import React, { useState, useEffect } from 'react';
import { FaMobileAlt, FaCheckCircle, FaRocket, FaLock, FaUserFriends, FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdEmail, MdLock } from 'react-icons/md';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase-config';
import { authAPI } from '../utils/api';

// Import the logo image
import LoginPageLogo from '../assets/LoginPageLogo.png';

const features = [
  {
    icon: <FaRocket style={{ color: '#3B82F6', fontSize: '24px' }} />,
    title: "Fast & Secure",
    description: "Lightning-fast authentication with enterprise-grade security"
  },
  {
    icon: <FaLock style={{ color: '#10B981', fontSize: '24px' }} />,
    title: "Privacy First",
    description: "Your data is encrypted and protected with industry standards"
  },
  {
    icon: <FaUserFriends style={{ color: '#8B5CF6', fontSize: '24px' }} />,
    title: "User Friendly",
    description: "Intuitive interface designed for seamless user experience"
  }
];

const LoginV2 = () => {
  const [loginMethod, setLoginMethod] = useState('mobile');
  
  // Mobile OTP states
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState(null);
  
  // Email login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Common states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuth();

  // Timer for resend OTP
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Cleanup reCAPTCHA on component unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (error) {
          // Ignore cleanup errors
        }
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    // Clean up existing verifier
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (error) {
        // Ignore cleanup errors
      }
      window.recaptchaVerifier = null;
    }

    // Create new RecaptchaVerifier following official docs
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: (response) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber
        console.log('reCAPTCHA solved');
      },
      'expired-callback': () => {
        // Response expired. Ask user to solve reCAPTCHA again
        setError('Verification expired. Please try again.');
        setLoading(false);
      }
    });
  };

  const sendOTP = async () => {
    if (!mobile || mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Setup reCAPTCHA
      setupRecaptcha();
      
      const phoneNumber = '+91' + mobile;
      const appVerifier = window.recaptchaVerifier;

      // Send SMS
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setResendTimer(60);
      console.log('OTP sent successfully');
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      // Reset reCAPTCHA on error
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.render().then((widgetId) => {
            if (window.grecaptcha) {
              window.grecaptcha.reset(widgetId);
            }
          });
        } catch (resetError) {
          // Ignore reset errors
        }
      }

      // Handle specific errors
      if (error.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else if (error.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format.');
      } else {
        setError('Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    if (!confirmationResult) {
      setError('Please request OTP first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify the OTP with Firebase
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      
      console.log('Firebase phone authentication successful:', user.uid);
      
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      console.log('Firebase ID token obtained, sending to backend...');
      
      // Send Firebase ID token to your custom backend
      const backendResponse = await authAPI.otplogin({ token: idToken });
      console.log('Backend OTP login successful:', backendResponse);
      
      // Login user with backend response data
      await login(backendResponse);

      navigate('/');
    } catch (error) {
      console.error('Error in OTP verification process:', error);
      
      // Handle Firebase authentication errors
      if (error.code === 'auth/invalid-verification-code') {
        setError('Invalid OTP. Please check and try again.');
      } else if (error.code === 'auth/code-expired') {
        setError('OTP expired. Please request a new one.');
        setOtpSent(false);
        setConfirmationResult(null);
      } else if (error.code && error.code.startsWith('auth/')) {
        // Other Firebase auth errors
        setError('Firebase authentication failed. Please try again.');
      } else {
        // Backend API errors
        const errorMessage = error.message || '';
        if (errorMessage.includes('token') || errorMessage.includes('invalid')) {
          setError('Authentication failed. Please try again.');
        } else if (errorMessage.includes('User not found')) {
          setError('Phone number not registered. Please contact support.');
        } else if (errorMessage.includes('Account disabled')) {
          setError('Your account has been disabled. Please contact support.');
        } else {
          setError(errorMessage || 'Failed to verify OTP. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    if (resendTimer > 0) return;
    
    setOtp('');
    setOtpSent(false);
    setConfirmationResult(null);
    await sendOTP();
  };

  // Email login functionality
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    
    // Clear errors when user starts typing
    if (error) setError('');
    if (emailError) setEmailError('');
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    
    // Clear errors when user starts typing
    if (error) setError('');
    if (passwordError) setPasswordError('');
    
    // Real-time validation
    if (value && value.length < 4) {
      setPasswordError('Password must be at least 4 characters');
    } else {
      setPasswordError('');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Client-side validation
    let hasErrors = false;
    
    if (!email) {
      setEmailError('Email is required');
      hasErrors = true;
    }
    
    if (!password) {
      setPasswordError('Password is required');
      hasErrors = true;
    } else if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      hasErrors = true;
    }

    if (hasErrors) {
      setLoading(false);
      return;
    }

    try {
      // Call the backend API
      const data = await authAPI.login({ email, password });
      
      // Use the auth context login function
      try {
        login(data);
        // Redirect to home page after successful login
        navigate('/');
      } catch (authError) {
        // Handle auth context errors (like invalid role)
        console.error('Auth context error:', authError);
        if (authError.message?.includes('Supervisor credentials are not valid')) {
          setError('Invalid role. Supervisor credentials are not valid for this application.');
        } else {
          setError(authError.message || 'Authentication failed. Please try again.');
        }
        return;
      }
    } catch (error) {
      console.error('Email login error:', error);
      // Handle specific error messages from backend auth route
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
        // Fallback for any other errors
        setError(errorMessage || 'Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleMethodChange = (method) => {
    // Clear all form data and errors when switching methods
    setLoginMethod(method);
    setError('');
    
    // Clear mobile OTP data
    setMobile('');
    setOtp('');
    setOtpSent(false);
    setConfirmationResult(null);
    setResendTimer(0);
    
    // Clear email data
    setEmail('');
    setPassword('');
    setEmailError('');
    setPasswordError('');
    setShowPassword(false);
    
    // Clear reCAPTCHA
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (error) {
        // Ignore cleanup errors
      }
      window.recaptchaVerifier = null;
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #EBF8FF 0%, #FFFFFF 50%, #F3E8FF 100%)',
    display: 'flex'
  };

  const leftPanelStyle = {
    display: 'none',
    width: '50%',
    background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
    padding: '48px',
    flexDirection: 'column',
    justifyContent: 'center'
  };

  const leftPanelResponsive = {
    ...leftPanelStyle,
    '@media (min-width: 1024px)': {
      display: 'flex'
    }
  };

  const rightPanelStyle = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px'
  };

  const formContainerStyle = {
    maxWidth: '400px',
    width: '100%'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '32px'
  };

  const logoStyle = {
    width: '48px',
    height: '48px',
    margin: '0 auto 16px',
    display: 'block'
  };

  const titleStyle = {
    fontSize: '30px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '8px'
  };

  const subtitleStyle = {
    color: '#6B7280'
  };

  const methodSelectorStyle = {
    display: 'flex',
    marginBottom: '24px',
    backgroundColor: '#F3F4F6',
    borderRadius: '8px',
    padding: '4px'
  };

  const methodButtonStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '14px'
  };

  const activeMethodStyle = {
    ...methodButtonStyle,
    backgroundColor: '#FFFFFF',
    color: '#2563EB',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
  };

  const inactiveMethodStyle = {
    ...methodButtonStyle,
    color: '#6B7280',
    backgroundColor: 'transparent'
  };

  const errorStyle = {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '8px',
    color: '#B91C1C',
    fontSize: '14px'
  };

  const inputGroupStyle = {
    marginBottom: '16px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px'
  };

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '12px',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box'
  };

  const inputFocusStyle = {
    borderColor: '#2563EB',
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)'
  };

  const phoneInputStyle = {
    ...inputStyle,
    paddingLeft: '48px'
  };

  const phoneInputContainerStyle = {
    position: 'relative'
  };

  const phonePrefixStyle = {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#6B7280',
    fontSize: '14px',
    pointerEvents: 'none'
  };

  const otpInputStyle = {
    ...inputStyle,
    textAlign: 'center',
    fontSize: '18px',
    letterSpacing: '4px'
  };

  const buttonStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginBottom: '16px'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#2563EB',
    color: '#FFFFFF'
  };

  const primaryButtonHoverStyle = {
    backgroundColor: '#1D4ED8'
  };

  const successButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#059669',
    color: '#FFFFFF'
  };

  const successButtonHoverStyle = {
    backgroundColor: '#047857'
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#9CA3AF',
    color: '#FFFFFF',
    cursor: 'not-allowed'
  };

  const textButtonStyle = {
    width: '100%',
    padding: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#2563EB',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  const grayTextButtonStyle = {
    ...textButtonStyle,
    color: '#6B7280'
  };

  const centerTextStyle = {
    textAlign: 'center'
  };

  const timerTextStyle = {
    color: '#6B7280'
  };

  const footerStyle = {
    marginTop: '32px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#6B7280'
  };

  return (
    <div style={containerStyle}>
      {/* Left Panel - Features */}
      <div style={leftPanelResponsive}>
        <div style={{ maxWidth: '400px', margin: '0 auto', color: '#FFFFFF' }}>
          <img src={LoginPageLogo} alt="Logo" style={{ width: '64px', height: '64px', marginBottom: '32px' }} />
          <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '24px' }}>
            Welcome to Finance Dashboard
          </h1>
          <p style={{ fontSize: '20px', marginBottom: '48px', color: '#DBEAFE' }}>
            Secure, fast, and reliable financial management at your fingertips.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {features.map((feature, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                  padding: '12px', 
                  borderRadius: '8px' 
                }}>
                  {feature.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: '#DBEAFE' }}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div style={rightPanelStyle}>
        <div style={formContainerStyle}>
          <div style={headerStyle}>
            <img src={LoginPageLogo} alt="Logo" style={logoStyle} />
            <h2 style={titleStyle}>Sign In</h2>
            <p style={subtitleStyle}>Choose your preferred sign-in method</p>
          </div>

          {/* Login Method Selector */}
          <div style={methodSelectorStyle}>
            <button
              onClick={() => handleMethodChange('mobile')}
              style={loginMethod === 'mobile' ? activeMethodStyle : inactiveMethodStyle}
              type="button"
            >
              <FaMobileAlt style={{ marginRight: '8px' }} />
              Mobile OTP
            </button>
            <button
              onClick={() => handleMethodChange('email')}
              style={loginMethod === 'email' ? activeMethodStyle : inactiveMethodStyle}
              type="button"
            >
              <MdEmail style={{ marginRight: '8px' }} />
              Email
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div style={errorStyle}>
              {error}
            </div>
          )}

          {/* Mobile OTP Form */}
          {loginMethod === 'mobile' && (
            <div>
              {!otpSent ? (
                <>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>
                      Mobile Number
                    </label>
                    <div style={phoneInputContainerStyle}>
                      <div style={phonePrefixStyle}>+91</div>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        style={phoneInputStyle}
                        placeholder="Enter 10-digit mobile number"
                        maxLength="10"
                        onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                        onBlur={(e) => Object.assign(e.target.style, { borderColor: '#D1D5DB', boxShadow: 'none' })}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={sendOTP}
                    disabled={loading || mobile.length !== 10}
                    style={loading || mobile.length !== 10 ? disabledButtonStyle : primaryButtonStyle}
                    onMouseEnter={(e) => {
                      if (!loading && mobile.length === 10) {
                        e.target.style.backgroundColor = primaryButtonHoverStyle.backgroundColor;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && mobile.length === 10) {
                        e.target.style.backgroundColor = primaryButtonStyle.backgroundColor;
                      }
                    }}
                  >
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </>
              ) : (
                <>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>
                      Enter OTP sent to +91{mobile}
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={otpInputStyle}
                      placeholder="000000"
                      maxLength="6"
                      onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                      onBlur={(e) => Object.assign(e.target.style, { borderColor: '#D1D5DB', boxShadow: 'none' })}
                    />
                  </div>

                  <button
                    onClick={verifyOTP}
                    disabled={loading || otp.length !== 6}
                    style={loading || otp.length !== 6 ? disabledButtonStyle : successButtonStyle}
                    onMouseEnter={(e) => {
                      if (!loading && otp.length === 6) {
                        e.target.style.backgroundColor = successButtonHoverStyle.backgroundColor;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && otp.length === 6) {
                        e.target.style.backgroundColor = successButtonStyle.backgroundColor;
                      }
                    }}
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>

                  <div style={centerTextStyle}>
                    {resendTimer > 0 ? (
                      <p style={timerTextStyle}>
                        Resend OTP in {resendTimer} seconds
                      </p>
                    ) : (
                      <button
                        onClick={resendOTP}
                        style={textButtonStyle}
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setConfirmationResult(null);
                      setError('');
                    }}
                    style={grayTextButtonStyle}
                  >
                    Change Mobile Number
                  </button>
                </>
              )}
            </div>
          )}

          {/* Email Form */}
          {loginMethod === 'email' && (
            <form onSubmit={handleEmailLogin}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  style={{
                    ...inputStyle,
                    borderColor: emailError ? '#EF4444' : '#D1D5DB'
                  }}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, { 
                    borderColor: emailError ? '#EF4444' : '#D1D5DB', 
                    boxShadow: 'none' 
                  })}
                />
                {emailError && (
                  <div style={{ color: '#EF4444', fontSize: '14px', marginTop: '4px' }}>
                    {emailError}
                  </div>
                )}
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    style={{
                      ...inputStyle,
                      borderColor: passwordError ? '#EF4444' : '#D1D5DB',
                      paddingRight: '40px'
                    }}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={(e) => Object.assign(e.target.style, { 
                      borderColor: passwordError ? '#EF4444' : '#D1D5DB', 
                      boxShadow: 'none' 
                    })}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#6B7280',
                      padding: '4px'
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
                {passwordError && (
                  <div style={{ color: '#EF4444', fontSize: '14px', marginTop: '4px' }}>
                    {passwordError}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !!emailError || !!passwordError}
                style={loading || !!emailError || !!passwordError ? disabledButtonStyle : primaryButtonStyle}
                onMouseEnter={(e) => {
                  if (!loading && !emailError && !passwordError) {
                    e.target.style.backgroundColor = primaryButtonHoverStyle.backgroundColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !emailError && !passwordError) {
                    e.target.style.backgroundColor = primaryButtonStyle.backgroundColor;
                  }
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* reCAPTCHA container - hidden but required for phone auth */}
          <div id="recaptcha-container" style={{ display: 'none' }}></div>

          {/* Footer */}
          <div style={footerStyle}>
            <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginV2;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackWebAppEvents } from '../utils/analytics';
import logo from '../assets/LoginPageLogo.png';

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Your OTP sending logic here
      setIsOtpSent(true);
      trackWebAppEvents.userLogin('phone_otp_requested');
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Your OTP verification logic here
      await login(phoneNumber, otp);
      trackWebAppEvents.userLogin('phone_otp_verified');
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Set document title on component mount
  useEffect(() => {
    document.title = 'Login - Site Haazri Dashboard';
  }, []);

  return (

    <div className="login-container">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <img src={logo} alt="Site Haazri" className="login-logo" />
          <h1>Site Haazri Dashboard</h1>
          <p className="login-subtitle">
            {isOtpSent
              ? 'Enter the OTP sent to your phone'
              : 'Login to manage your construction sites'
            }
          </p>
        </div>

        {/* Login Form */}
        <div className="login-form-container">
          {!isOtpSent ? (
            <form onSubmit={handleSendOtp} className="login-form">
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <div className="phone-input-container">
                  <span className="country-code">+91</span>
                  <input
                    type="tel"
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter your phone number"
                    required
                    maxLength="10"
                    pattern="[0-9]{10}"
                    className="phone-input"
                  />
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                className="login-button"
                disabled={loading || phoneNumber.length !== 10}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="login-form">
              <div className="form-group">
                <label htmlFor="otp">Enter OTP</label>
                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  required
                  maxLength="6"
                  pattern="[0-9]{6}"
                  className="otp-input"
                />
              </div>

              <div className="otp-info">
                <p>OTP sent to +91 {phoneNumber}</p>
                <button
                  type="button"
                  className="resend-button"
                  onClick={() => setIsOtpSent(false)}
                >
                  Change Number
                </button>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                className="login-button"
                disabled={loading || otp.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>
            Don't have the mobile app yet?{' '}
            <a
              href="https://sitehaazri.in/download"
              target="_blank"
              rel="noopener noreferrer"
              className="download-link"
            >
              Download Site Haazri App
            </a>
          </p>
          <div className="login-links">
            <a href="https://sitehaazri.in/privacy-policy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            <a href="https://sitehaazri.in/contact" target="_blank" rel="noopener noreferrer">
              Support
            </a>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="login-background">
        <div className="bg-pattern"></div>
      </div>
    </div>
  );
};

export default Login;
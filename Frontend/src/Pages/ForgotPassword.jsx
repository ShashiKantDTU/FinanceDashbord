import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import styles from './Login.module.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    // Client-side validation
    if (!email) {
      setEmailError('Email is required');
      setIsLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }    try {
      await authAPI.forgotPassword(email);
      setMessage('Password reset instructions have been sent to your email address. Please check your inbox and follow the instructions to reset your password.');
    } catch (error) {
      // Handle specific error types from auth middleware
      if (error.message?.includes('User not found') || error.message?.includes('not found')) {
        setError('No account found with this email address.');
      } else if (error.message?.includes('rate limit') || error.message?.includes('Too many')) {
        setError('Too many reset requests. Please try again later.');
      } else if (error.message?.includes('invalid email')) {
        setError('Please enter a valid email address.');
      } else {
        setError(error.message || 'Failed to send reset email. Please check your connection and try again.');
      }
      console.error('Forgot password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    
    // Clear messages when user starts typing
    if (error) setError('');
    if (message) setMessage('');
    if (emailError) setEmailError('');
    
    // Real-time validation
    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    }
  };
  return (
    <div className={styles.authContainer}>      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.logoContainer}>
            <div className={styles.logo}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7V10C2 16 6 20.5 12 22C18 20.5 22 16 22 10V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 12L11 14L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.subtitle}>Enter your email to receive reset instructions</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {error && (
            <div className={styles.errorMessage}>
              <svg className={styles.errorIcon} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {message && (
            <div className={styles.successMessage}>
              <svg className={styles.successIcon} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {message}
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email Address
            </label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={handleChange}
                className={`${styles.input} ${emailError ? styles.inputError : ''}`}
                placeholder="Enter your email address"
                required
                autoComplete="email"
              />
            </div>
            {emailError && <span className={styles.fieldError}>{emailError}</span>}
          </div>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isLoading || !!emailError || !email}
          >            {isLoading ? (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
                Sending instructions...
              </div>
            ) : (
              'Send Reset Instructions'
            )}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>
            Remember your password?{' '}
            <Link to="/login" className={styles.authLink}>
              Back to sign in
            </Link>
          </p>        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

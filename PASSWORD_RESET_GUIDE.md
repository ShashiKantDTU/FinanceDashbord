# Password Reset Setup - Complete Guide

## Overview
This document explains how to configure and use the password reset functionality in your Finance Dashboard application using Nodemailer.

## 🚀 Features Implemented

### Backend Features
- ✅ Password reset token generation and validation
- ✅ Secure email sending with HTML templates
- ✅ Token expiration (1 hour)
- ✅ User schema updated with reset token fields
- ✅ Complete API endpoints for forgot/reset password
- ✅ Email service with connection testing
- ✅ Error handling and validation

### Frontend Features
- ✅ Forgot Password page (`/forgot-password`)
- ✅ Reset Password page (`/reset-password`)
- ✅ Form validation and error handling
- ✅ Success messages and redirects
- ✅ Beautiful email templates
- ✅ Loading states and user feedback

## 📧 Email Configuration

### Step 1: Brevo (Sendinblue) Setup (Recommended)
1. **Create Brevo Account**:
   - Sign up at [brevo.com](https://www.brevo.com) (free tier available)
   - Verify your account and domain (optional but recommended)

2. **Get SMTP Credentials**:
   - Login to Brevo dashboard
   - Go to **Settings** → **SMTP & API**
   - Click on **SMTP** tab
   - Your SMTP details will be shown:
     - **Server**: `smtp-relay.brevo.com`
     - **Port**: `587`
     - **Login**: Your Brevo account email
     - **Password**: Generate a new SMTP key

3. **Generate SMTP Key**:
   - In SMTP settings, click **Generate a new SMTP key**
   - Copy the generated key (you won't see it again!)

### Step 2: Update Environment Variables
Edit `Backend/.env` file:

```bash
# Email Configuration (for password reset) - Brevo SMTP
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=your_brevo_account_email@domain.com
EMAIL_PASS=your_brevo_smtp_key_here
EMAIL_FROM=noreply@yourdomain.com
```

### Step 3: Alternative Email Providers

#### Gmail (Alternative)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_character_app_password
```

#### Custom SMTP
```bash
EMAIL_HOST=mail.yourdomain.com
EMAIL_PORT=587
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASS=your_password
```

## 🔧 How It Works

### 1. User Requests Password Reset
- User visits `/forgot-password`
- Enters email address
- System generates secure token
- Email sent with reset link

### 2. Email Template
Beautiful HTML email includes:
- Company branding
- Secure reset link
- 1-hour expiration notice
- Security warnings
- Fallback text version

### 3. Password Reset Process
- User clicks link in email
- Redirected to `/reset-password?token=...`
- Enters new password
- Token validated and password updated
- Redirected to login with success message

## 🛠️ Testing

### 1. Test Email Configuration
The server automatically tests Brevo SMTP configuration on startup:
```bash
cd Backend
npm start
```

Look for these messages:
- ✅ `Email service is configured and ready`
- ⚠️ `Email service configuration failed`

**For Brevo Testing**:
- Check Brevo dashboard for sending statistics
- Monitor daily/monthly email limits
- Verify domain authentication status

### 2. Test Password Reset Flow
1. Start both servers:
   ```bash
   # Terminal 1 - Backend
   cd Backend
   npm start

   # Terminal 2 - Frontend  
   cd Frontend
   npm run dev
   ```

2. Visit `http://localhost:5173/forgot-password`
3. Enter a valid email address
4. Check for success message
5. Check email inbox for reset link
6. Click link and test password reset

## 🔐 Security Features

### Token Security
- 32-byte random tokens
- 1-hour expiration
- Single-use tokens
- Secure database storage

### Email Security
- No sensitive data in emails
- Secure SMTP connection
- Rate limiting protection
- User existence protection

### Validation
- Email format validation
- Password strength requirements
- Token expiration checks
- CSRF protection

## 🐛 Troubleshooting

### Common Issues

#### 1. "Invalid login: Username and Password not accepted"
**Solution for Brevo**: 
- Make sure you're using your Brevo account email as EMAIL_USER
- Use the SMTP key (not your account password) as EMAIL_PASS
- Generate a fresh SMTP key in Brevo dashboard if needed

#### 2. "Failed to send reset email"
**Causes**:
- Wrong Brevo SMTP credentials
- Exceeded Brevo daily/monthly limits
- Domain not verified in Brevo

**Solution**:
- Check credentials in `.env`
- Verify domain in Brevo dashboard
- Check your Brevo account limits
- Make sure your account is active

#### 3. "Invalid or expired reset token"
**Causes**:
- Token older than 1 hour
- Token already used
- Invalid token format

**Solution**:
- Request new password reset
- Check URL copying correctly

#### 4. Email not received
**Check**:
- Spam/junk folder
- Email address typos
- Server logs for errors
- Rate limiting messages

### Debug Mode
Set `NODE_ENV=development` in `.env` for detailed error messages.

## 📱 Frontend Pages

### Forgot Password (`/forgot-password`)
- Email input with validation
- Loading states
- Error/success messages
- Link back to login

### Reset Password (`/reset-password`)
- Token validation from URL
- Password confirmation
- Strength requirements
- Auto-redirect to login

### Login Updates
- Shows success messages from password reset
- Handles navigation state

## 🔄 API Endpoints

### POST `/api/auth/forgot-password`
```json
{
  "email": "user@example.com"
}
```

**Response**: 200 (always returns success for security)

### POST `/api/auth/reset-password`
```json
{
  "token": "reset_token_here",
  "password": "new_password"
}
```

**Response**: Success or error with details

## 🎨 Email Template Features
- Responsive design
- Company branding
- Security warnings
- Clear call-to-action
- Fallback text version
- Professional styling

## 🔥 Brevo Advantages
- **Free Tier**: 300 emails/day free
- **High Deliverability**: Industry-leading delivery rates
- **Easy Setup**: No 2FA or app passwords needed
- **Analytics**: Track email opens, clicks, bounces
- **Domain Authentication**: SPF, DKIM setup guidance
- **Reliable**: Enterprise-grade infrastructure

## 📊 Brevo Monitoring
Access your Brevo dashboard to monitor:
- Email delivery status
- Open/click rates
- Bounce reports
- Daily/monthly usage
- API key usage

## 🔧 Brevo Domain Setup (Optional but Recommended)
1. **Add Domain** in Brevo dashboard
2. **Configure DNS Records**:
   - Add SPF record: `v=spf1 include:spf.brevo.com ~all`
   - Add DKIM record (provided by Brevo)
3. **Verify Domain** for better deliverability
4. **Update EMAIL_FROM** to use your verified domain

## 🚀 Production Deployment

### Environment Variables
Ensure these are set in production:
```bash
NODE_ENV=production
EMAIL_USER=your_production_email
EMAIL_PASS=your_production_password
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Security Considerations
- Use secure email service
- Monitor reset attempts
- Implement rate limiting
- Log security events
- Regular token cleanup

## 📞 Support
If you encounter issues:
1. Check server logs
2. Verify email credentials
3. Test SMTP connection
4. Check firewall settings
5. Review error messages

The password reset system is now fully functional and ready for production use!

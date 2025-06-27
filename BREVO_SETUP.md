# Brevo SMTP Setup - Quick Start Guide

## 🚀 Quick Setup Steps

### 1. Create Brevo Account
1. Go to [brevo.com](https://www.brevo.com)
2. Sign up for free account (300 emails/day)
3. Verify your email address

### 2. Get SMTP Credentials
1. Login to Brevo dashboard
2. Navigate: **Settings** → **SMTP & API**
3. Click **SMTP** tab
4. Note down:
   - **SMTP Server**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: Your Brevo account email

### 3. Generate SMTP Key
1. In SMTP settings, click **"Generate a new SMTP key"**
2. **IMPORTANT**: Copy this key immediately (you won't see it again!)
3. Give it a descriptive name like "Finance Dashboard Reset Emails"

### 4. Update .env File
Edit `Backend/.env`:

```bash
# Email Configuration (for password reset) - Brevo SMTP
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=your_brevo_account_email@domain.com
EMAIL_PASS=your_generated_smtp_key_here
EMAIL_FROM=noreply@yourdomain.com
```

### 5. Test Configuration
```bash
cd Backend
npm start
```

Look for: ✅ `Email service is configured and ready`

## 📊 Brevo Free Tier Limits
- **300 emails/day** (perfect for password resets)
- **Unlimited contacts**
- **Email tracking**
- **24/7 support**

## 🔧 Domain Setup (Optional - Better Deliverability)
1. **Add your domain** in Brevo dashboard
2. **Configure DNS**:
   - SPF: `v=spf1 include:spf.brevo.com ~all`
   - DKIM: (provided by Brevo)
3. **Verify domain**
4. **Update EMAIL_FROM** to use your domain

## ✅ Test Password Reset Flow
1. Start servers:
   ```bash
   cd Backend && npm start
   cd Frontend && npm run dev
   ```
2. Visit: `http://localhost:5173/forgot-password`
3. Enter email and test!

## 🎯 Production Checklist
- [ ] Brevo account verified
- [ ] SMTP key generated and secured
- [ ] Domain added and verified (recommended)
- [ ] EMAIL_FROM uses verified domain
- [ ] Test emails sending successfully
- [ ] Monitor Brevo dashboard for delivery stats

Your password reset system is now powered by Brevo's reliable email infrastructure! 🚀

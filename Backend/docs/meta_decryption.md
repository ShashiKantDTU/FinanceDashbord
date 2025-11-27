# Backend Developer Guide: Meta Attribution Decryption

## Overview

The mobile app now sends encrypted Meta (Facebook/Instagram) campaign data to the backend. You need to decrypt this data to get the real campaign names instead of generic `fb4a` or `ig4a` placeholders.

---

## New Payload Structure

### What the mobile app NOW sends:

```json
{
  "phoneNumber": "+919876543210",
  "otp": "123456",
  "acquisition": {
    "source": "apps.instagram.com",
    "campaign": "ig4a",
    "medium": "organic",
    "meta_encrypted": "{\"source\":{\"data\":\"7fb9bd76...\",\"nonce\":\"1234abcd...\"},\"a\":\"your_fb_app_id\",\"t\":1234567890}",
    "raw_referrer": "utm_source=apps.instagram.com&utm_campaign=ig4a&utm_content=..."
  }
}
```

### Fields Explanation:

| Field | Description |
|-------|-------------|
| `source` | Traffic source (`apps.facebook.com`, `apps.instagram.com`, `google`, `organic`) |
| `campaign` | Campaign name (may be `fb4a`/`ig4a` for Meta, or real name for Google) |
| `medium` | Traffic medium (`cpc`, `organic`, etc.) |
| `meta_encrypted` | **NEW** - JSON string with encrypted Meta campaign data |
| `raw_referrer` | **NEW** - Full raw referrer string (backup) |

---

## Step 1: Get Your Decryption Key

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Select your app
3. Navigate to: **Settings → Basic → Android**
4. Find: **Install Referrer Decryption Key**
5. Copy the 64-character hex string

Example key:
```
2575590594a9cd809e5bfacf397f8c1ac730dbc38a3e137ecd1ab66591c8c3c9
```

---

## Step 2: Add Decryption Utility

Create a new file: `utils/metaDecryption.js`

```javascript
const crypto = require('crypto');

// 🔑 YOUR KEY FROM FACEBOOK DASHBOARD
// Store this in environment variables for security!
const DECRYPTION_KEY_HEX = process.env.META_INSTALL_REFERRER_KEY || 'YOUR_64_CHAR_HEX_KEY_HERE';

/**
 * Decrypts Meta (Facebook/Instagram) encrypted campaign data
 * @param {string} metaEncrypted - The utm_content JSON string from mobile app
 * @returns {object|null} - Decrypted campaign data or null if decryption fails
 */
function decryptMetaCampaignData(metaEncrypted) {
  try {
    if (!metaEncrypted) return null;
    
    // 1. Parse the JSON string
    // Format: { "source": { "data": "HEX...", "nonce": "HEX..." }, "a": "app_id", "t": timestamp }
    let contentJson;
    try {
      contentJson = typeof metaEncrypted === 'string' 
        ? JSON.parse(metaEncrypted) 
        : metaEncrypted;
    } catch (e) {
      console.log('Meta decryption: Invalid JSON format');
      return null;
    }
    
    // 2. Validate structure
    if (!contentJson.source || !contentJson.source.data || !contentJson.source.nonce) {
      console.log('Meta decryption: Missing required fields (source.data or source.nonce)');
      return null;
    }
    
    // 3. Prepare for Decryption (AES-256-GCM)
    const key = Buffer.from(DECRYPTION_KEY_HEX, 'hex');
    const ciphertext = Buffer.from(contentJson.source.data, 'hex');
    const nonce = Buffer.from(contentJson.source.nonce, 'hex');
    
    // 4. Meta places the 16-byte auth tag at the end of the ciphertext
    const tagLength = 16;
    if (ciphertext.length <= tagLength) {
      console.log('Meta decryption: Ciphertext too short');
      return null;
    }
    
    const encryptedData = ciphertext.subarray(0, ciphertext.length - tagLength);
    const authTag = ciphertext.subarray(ciphertext.length - tagLength);
    
    // 5. Decrypt using AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    // 6. Parse the decrypted JSON
    const campaignData = JSON.parse(decrypted);
    
    console.log('✅ Meta decryption successful:', campaignData);
    
    return campaignData;
    
  } catch (e) {
    console.error('Meta decryption failed:', e.message);
    return null;
  }
}

/**
 * Process acquisition data - decrypt Meta data if present
 * @param {object} acquisition - The acquisition object from mobile app
 * @returns {object} - Processed acquisition with real campaign names
 */
function processAcquisition(acquisition) {
  if (!acquisition) {
    return { source: 'organic', campaign: 'organic', medium: 'organic' };
  }
  
  // Start with the basic data
  const result = {
    source: acquisition.source || 'organic',
    campaign: acquisition.campaign || 'none',
    medium: acquisition.medium || 'organic'
  };
  
  // Check if this is Meta ad with encrypted data
  if (acquisition.meta_encrypted) {
    const decrypted = decryptMetaCampaignData(acquisition.meta_encrypted);
    
    if (decrypted) {
      // Override with real campaign data from Meta
      result.campaign = decrypted.campaign_group_name || decrypted.campaign_name || result.campaign;
      result.campaign_id = decrypted.campaign_id;
      result.campaign_group_id = decrypted.campaign_group_id;
      result.ad_id = decrypted.ad_id;
      result.adgroup_id = decrypted.adgroup_id;
      result.adgroup_name = decrypted.adgroup_name;
      result.account_id = decrypted.account_id;
      result.ad_objective = decrypted.ad_objective_name;
      
      // Check if it was an Instagram ad
      if (decrypted.is_instagram || decrypted.publisher_platform === 'instagram') {
        result.source = 'instagram';
        result.platform_position = decrypted.platform_position; // e.g., "instagram_stories"
      } else {
        result.source = 'facebook';
      }
      
      result.decrypted = true; // Flag to indicate successful decryption
    }
  }
  
  return result;
}

module.exports = {
  decryptMetaCampaignData,
  processAcquisition
};
```

---

## Step 3: Update User Schema

```javascript
// models/User.js

const userSchema = new mongoose.Schema({
  // ... existing fields ...
  
  acquisition: {
    // Basic fields (always present)
    source: { type: String, default: 'organic' },
    campaign: { type: String, default: 'organic' },
    medium: { type: String, default: 'organic' },
    
    // Meta-specific fields (populated after decryption)
    campaign_id: { type: String },
    campaign_group_id: { type: String },
    ad_id: { type: String },
    adgroup_id: { type: String },
    adgroup_name: { type: String },
    account_id: { type: String },
    ad_objective: { type: String },
    platform_position: { type: String },  // e.g., "instagram_stories", "facebook_feed"
    decrypted: { type: Boolean, default: false }
  },
  
  createdAt: { type: Date, default: Date.now }
});
```

---

## Step 4: Update Auth Controllers

### `/api/auth/otp/verify` (WhatsApp OTP)

```javascript
const { processAcquisition } = require('../utils/metaDecryption');

exports.verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp, acquisition } = req.body;
    
    // Verify OTP (existing logic)
    // ...
    
    // Check if user exists
    let user = await User.findOne({ phone: phoneNumber });
    
    if (!user) {
      // Process acquisition data (handles Meta decryption)
      const processedAcquisition = processAcquisition(acquisition);
      
      console.log('📊 New user acquisition:', processedAcquisition);
      
      // Create new user
      user = new User({
        phone: phoneNumber,
        name: phoneNumber,
        acquisition: processedAcquisition
      });
      await user.save();
    }
    
    // Generate JWT and respond
    const token = generateToken(user);
    res.json({ token, user });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

### `/api/auth/otplogin` (Firebase OTP)

```javascript
const { processAcquisition } = require('../utils/metaDecryption');

exports.otpLogin = async (req, res) => {
  try {
    const { token, acquisition } = req.body;
    
    // Verify Firebase token (existing logic)
    const decodedToken = await admin.auth().verifyIdToken(token);
    const phoneNumber = decodedToken.phone_number;
    
    let user = await User.findOne({ phone: phoneNumber });
    
    if (!user) {
      // Process acquisition data (handles Meta decryption)
      const processedAcquisition = processAcquisition(acquisition);
      
      user = new User({
        phone: phoneNumber,
        name: phoneNumber,
        acquisition: processedAcquisition
      });
      await user.save();
    }
    
    const jwtToken = generateToken(user);
    res.json({ token: jwtToken, user });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

### `/api/auth/truecallerlogin`

```javascript
const { processAcquisition } = require('../utils/metaDecryption');

exports.truecallerLogin = async (req, res) => {
  try {
    const { accessToken, firstName, lastName, phoneNumber, acquisition } = req.body;
    
    // Verify Truecaller (existing logic)
    // ...
    
    let user = await User.findOne({ phone: phoneNumber });
    
    if (!user) {
      // Process acquisition data (handles Meta decryption)
      const processedAcquisition = processAcquisition(acquisition);
      
      user = new User({
        phone: phoneNumber,
        name: `${firstName} ${lastName}`.trim() || phoneNumber,
        acquisition: processedAcquisition
      });
      await user.save();
    }
    
    const token = generateToken(user);
    res.json({ token, user });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

---

## Step 5: Environment Variable

Add to your `.env` file:

```env
META_INSTALL_REFERRER_KEY=2575590594a9cd809e5bfacf397f8c1ac730dbc38a3e137ecd1ab66591c8c3c9
```

---

## Example: Before vs After Decryption

### Input (from mobile app):
```json
{
  "source": "apps.instagram.com",
  "campaign": "ig4a",
  "medium": "organic",
  "meta_encrypted": "{\"source\":{\"data\":\"7fb9bd76...\",\"nonce\":\"1234\"}}"
}
```

### Output (after `processAcquisition()`):
```json
{
  "source": "instagram",
  "campaign": "Winter_Sale_2025",
  "medium": "organic",
  "campaign_id": "6110808710224",
  "campaign_group_id": "6110808710624",
  "campaign_group_name": "Winter_Sale_2025",
  "ad_id": "6110809314024",
  "adgroup_id": "6110808725024",
  "adgroup_name": "RTG_Stories",
  "account_id": "485495091598353",
  "ad_objective": "CONVERSIONS",
  "platform_position": "instagram_stories",
  "decrypted": true
}
```

---

## Analytics Queries

### Users by Real Campaign Name
```javascript
db.users.aggregate([
  { $match: { "acquisition.decrypted": true } },
  { $group: { _id: "$acquisition.campaign", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

### Instagram Stories vs Feed Performance
```javascript
db.users.aggregate([
  { $match: { "acquisition.source": "instagram" } },
  { $group: { _id: "$acquisition.platform_position", count: { $sum: 1 } } }
]);
```

### Decryption Success Rate
```javascript
db.users.aggregate([
  { $match: { "acquisition.source": { $in: ["facebook", "instagram", "apps.facebook.com", "apps.instagram.com"] } } },
  { $group: { 
    _id: "$acquisition.decrypted", 
    count: { $sum: 1 } 
  }}
]);
```

---

## Summary Checklist

| Task | File/Location | Status |
|------|---------------|--------|
| Get Decryption Key | Facebook Developers Dashboard | ⬜ TODO |
| Add to `.env` | `META_INSTALL_REFERRER_KEY` | ⬜ TODO |
| Create decryption utility | `utils/metaDecryption.js` | ⬜ TODO |
| Update User schema | `models/User.js` | ⬜ TODO |
| Update `/api/auth/otp/verify` | Auth controller | ⬜ TODO |
| Update `/api/auth/otplogin` | Auth controller | ⬜ TODO |
| Update `/api/auth/truecallerlogin` | Auth controller | ⬜ TODO |
| Test with sample encrypted data | Manual test | ⬜ TODO |
| Deploy | Production | ⬜ TODO |

---

## Testing

### Test the Decryption Function:

```javascript
// test-decryption.js
const { decryptMetaCampaignData } = require('./utils/metaDecryption');

// Use a sample encrypted string from your logs
const testData = {
  source: {
    data: "your_hex_encrypted_data_here",
    nonce: "your_nonce_here"
  }
};

const result = decryptMetaCampaignData(JSON.stringify(testData));
console.log('Decrypted:', result);
```

Run: `node test-decryption.js`
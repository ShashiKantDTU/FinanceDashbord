const express = require("express");
const admin = require('./firebase')
const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/Userschema");
const { Supervisor } = require("../models/supervisorSchema");
const Site = require("../models/Siteschema");
const {
  authenticateToken,
  generateToken,
  hashPassword,
  comparePassword,
  generateSupervisorCredentials,
} = require("../Middleware/auth");
const { sendPasswordResetEmail } = require("../Utils/emailService");
// Centralized Redis client (do not create a new one here)
const { redisClient } = require('../config/redisClient');
// WhatsApp OTP helper
const { sendWhatsAppOtp } = require('../Utils/whatsappOtp');
// API Call Tracker
const { addUserToTracking } = require('../Middleware/apiCallTracker');
// Meta Attribution Decryption
const { processAcquisition } = require('../Utils/metaDecryption');
const router = express.Router();
// Redis connection is initialized centrally in server.js. This file just uses the shared client.

// --- OTP Helper Function ---
// This function generates the OTP and its expiration time
const generateOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ttl = 600; // Time-to-live in seconds (10 minutes)
    return { otp, ttl };
};

// --- Trial Expiry Helper Function ---
// Calculates if trial ends on 30th of current month or next, based on registration date (16th cutoff)
const getTrialExpiryDate = () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth(); // 0-11
    const year = today.getFullYear();
    
    let targetYear = year;
    let targetMonth = month;
    
    // If < 16th, trial ends current month. Else next month.
    if (day >= 16) {
        targetMonth = month + 1;
        if (targetMonth > 11) {
            targetMonth = 0;
            targetYear = year + 1;
        }
    }
    
    // Determine target day (30th, unless Feb)
    let targetDay = 30;
    
    // Check if target month is Feb (1)
    if (targetMonth === 1) {
        // Last day of Feb
        targetDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    }
    
    // Set expiry date to end of that day
    const expiryDate = new Date(targetYear, targetMonth, targetDay);
    expiryDate.setHours(23, 59, 59, 999);
    
    return expiryDate;
};

// --- OTP Rate Limiting Config ---
const OTP_TTL_SECONDS = 600; // align with generateOtp
const OTP_COOLDOWN_SECONDS = 60; // minimum gap between sends for same number
const OTP_MAX_SENDS_PER_WINDOW = 5; // max sends per window
const OTP_SEND_WINDOW_SECONDS = 3600; // 1 hour window

// OTP send route

router.post("/otp/send", async (req, res) => {
  console.log("OTP send route hit");
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
    }

    // Handle test phone number - always set OTP as 123456 and skip WhatsApp
    if (phoneNumber === '+919876543210') {
        const testOtp = '123456';
        const testTtl = OTP_TTL_SECONDS;
        const otpKey = phoneNumber;
        
        // Store test OTP in Redis
        await redisClient.setEx(otpKey, testTtl, testOtp);
        console.log(`Test OTP for ${phoneNumber}: ${testOtp} (WhatsApp skipped)`);
        
        return res.status(200).json({
            message: `Test OTP generated successfully. It will expire in ${Math.floor(testTtl/60)} minutes.`,
            whatsAppStatus: 'skipped',
            expiresInSeconds: testTtl
        });
    }

  try {
    // Keys
    const otpKey = phoneNumber; // existing usage
    const cooldownKey = `otp:cd:${phoneNumber}`;
    const sendCountKey = `otp:sc:${phoneNumber}`;

    // Cooldown check
    const cooldownTTL = await redisClient.ttl(cooldownKey);
    if (cooldownTTL && cooldownTTL > 0) {
      return res.status(429).json({ message: `Please wait ${cooldownTTL} seconds before requesting another OTP.` });
    }

    // Rate limiting (simple counter per hour)
    let sendCount = await redisClient.get(sendCountKey);
    if (sendCount === null) {
      // initialize counter with window TTL
      await redisClient.setEx(sendCountKey, OTP_SEND_WINDOW_SECONDS, '0');
      sendCount = '0';
    }
    sendCount = await redisClient.incr(sendCountKey);
    if (parseInt(sendCount, 10) > OTP_MAX_SENDS_PER_WINDOW) {
      return res.status(429).json({ message: 'Too many OTP requests. Please try again later.' });
    }

    // Existing OTP reuse logic
    const existingOtp = await redisClient.get(otpKey);
    if (existingOtp) {
      // Fetch remaining TTL
      let remaining = await redisClient.ttl(otpKey);
      if (remaining < 0) remaining = OTP_TTL_SECONDS; // fallback

      // Set cooldown so user cannot spam every second
      await redisClient.setEx(cooldownKey, OTP_COOLDOWN_SECONDS, '1');

      

      // Resend existing OTP (do not extend main TTL here — /otp/resend handles extension)
      const whatsAppResult = await sendWhatsAppOtp(phoneNumber, existingOtp, remaining);
      
      // Handle WhatsApp send errors for existing OTP
      if (!whatsAppResult.sent && !whatsAppResult.skipped && whatsAppResult.error) {
        if (!whatsAppResult.error.retryable) {
          return res.status(400).json({
            message: whatsAppResult.error.message,
            errorCode: whatsAppResult.error.category,
            retryable: false
          });
        }
        console.warn('WhatsApp OTP resend (implicit) failed for', phoneNumber, whatsAppResult.error);
      }

      return res.status(200).json({
        message: whatsAppResult.sent 
          ? `OTP sent successfully. It will expire in ${Math.floor(remaining/60)} minutes.`
          : `OTP resent (delivery status unknown). It will expire in ${Math.floor(remaining/60)} minutes.`,
        expiresInSeconds: remaining,
        resend: true,
        whatsAppStatus: whatsAppResult.sent ? 'sent' : whatsAppResult.skipped ? 'skipped' : 'failed'
      });
    }

    // Generate new OTP
    const { otp, ttl } = generateOtp();
    await redisClient.setEx(otpKey, ttl, otp);
    await redisClient.setEx(cooldownKey, OTP_COOLDOWN_SECONDS, '1');
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    // Send OTP via WhatsApp (blocking to handle errors properly)
    const whatsAppResult = await sendWhatsAppOtp(phoneNumber, otp, ttl);
    
    // Handle critical WhatsApp errors that should stop the flow
    if (!whatsAppResult.sent && !whatsAppResult.skipped && whatsAppResult.error) {
      if (!whatsAppResult.error.retryable) {
        // Remove OTP and cooldown for non-retryable errors
        await redisClient.del(otpKey);
        await redisClient.del(cooldownKey);
        return res.status(400).json({
          message: whatsAppResult.error.message,
          errorCode: whatsAppResult.error.category,
          retryable: false
        });
      }
      console.warn('WhatsApp OTP failed for', phoneNumber, whatsAppResult.error);
    }

    res.status(200).json({ 
      message: whatsAppResult.sent 
        ? `OTP sent successfully. It will expire in ${Math.floor(OTP_TTL_SECONDS/60)} minutes.`
        : `OTP generated (delivery status unknown). It will expire in ${Math.floor(OTP_TTL_SECONDS/60)} minutes.`,
      whatsAppStatus: whatsAppResult.sent ? 'sent' : whatsAppResult.skipped ? 'skipped' : 'failed',
      expiresInSeconds: OTP_TTL_SECONDS
    });

    } catch (error) {
        console.error(`❌ [POST /otp/send] Phone: ${req.body.phoneNumber} - Error sending OTP:`, error);
        res.status(500).json({ message: "Error sending OTP", error: error.message });
    }
});

router.post("/otp/verify", async (req, res) => {
    const { phoneNumber, otp, acquisition } = req.body;
    console.log("OTP verify route hit");
    
    // Log acquisition payload for debugging
    if (acquisition) {
      console.log(`📊 [otp/verify] Acquisition payload for ${phoneNumber}:`, JSON.stringify(acquisition, null, 2));
    }
    
    if (!phoneNumber || !otp) {
        return res.status(400).json({ message: "Phone number and OTP are required" });
    }

    try {
        const storedOtp = await redisClient.get(phoneNumber);

        if (!storedOtp) {
            return res.status(400).json({ message: "Invalid or expired OTP. Please request a new one." });
        }

        if (storedOtp !== otp) {
            return res.status(400).json({ message: "Incorrect OTP." });
        }

        // --- OTP is correct, clean up Redis ---
        await redisClient.del(phoneNumber);

        // --- YOUR DATABASE AND JWT LOGIC HERE ---
    // check if user exist in db
    let user = await User.findOne({ phoneNumber: phoneNumber });
    console.log("Found existing user:", user ? "Yes" : "No");


    if (!user) {
      // Create user if doesn't exist (auto-registration)
      // Grant trial till 30th of current/next month
      const trialExpiryDate = getTrialExpiryDate();
      const name = phoneNumber;
      
      // Process acquisition data (handles Meta decryption if present)
      const acquisitionData = processAcquisition(acquisition);
      console.log('📊 New user acquisition (otp/verify):', acquisitionData);
      
      user = new User({
        name: name,
        phoneNumber: phoneNumber,
        plan: 'pro',
        isTrial: true,
        whatsAppReportsEnabled: true,
        whatsAppReportPhone: phoneNumber,
        planExpiresAt: trialExpiryDate,
        planSource: 'manual',
        planActivatedAt: new Date(),
        acquisition: acquisitionData
      });
      await user.save();
      // console.log(`New mobile user created: ${firebaseUid}`);
      
      // Add new user to API tracking (fire-and-forget)
      addUserToTracking(phoneNumber).catch(err => {
        console.error('Failed to add user to tracking:', err.message);
      });
    }

    // Generate JWT token for your app
    const jwtToken = generateToken({
      id: user._id,
      name: user.name,
      role: "Admin",
    });
    // console.log(`JWT token generated for user in mobile otp route: ${user._id}`);
    return res.status(200).json({
      message: "OTP login successful",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        whatsAppReportsEnabled: user.whatsAppReportsEnabled,
        whatsAppReportPhone: user.whatsAppReportPhone,
        language: user.language || 'en',
        role: "Admin",
      }
    })

    } catch (error) {
        console.error(`❌ [POST /otp/verify] Phone: ${req.body.phoneNumber} - Error verifying OTP:`, error);
        res.status(500).json({ message: "Error verifying OTP", error: error.message });
    }
});

// OTP resend route

router.post("/otp/resend", async (req, res) => {
  console.log("OTP resend route hit");
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
    }

    try {
        const existingOtp = await redisClient.get(phoneNumber);

        if (!existingOtp) {
            return res.status(400).json({ message: "No active OTP found. Please request a new one." });
        }

        // Reset / extend TTL back to full window (same as generateOtp currently 600s)
        const EXTENDED_TTL = 600; // 10 minutes
        await redisClient.setEx(phoneNumber, EXTENDED_TTL, existingOtp);

        // Resend existing OTP and inform user (blocking to handle errors)
        const whatsAppResult = await sendWhatsAppOtp(phoneNumber, existingOtp, EXTENDED_TTL);
        
        // Handle WhatsApp send errors for resend
        if (!whatsAppResult.sent && !whatsAppResult.skipped && whatsAppResult.error) {
          if (!whatsAppResult.error.retryable) {
            return res.status(400).json({
              message: whatsAppResult.error.message,
              errorCode: whatsAppResult.error.category,
              retryable: false
            });
          }
          console.warn('WhatsApp OTP resend failed for', phoneNumber, whatsAppResult.error);
        }

        res.status(200).json({ 
          message: whatsAppResult.sent 
            ? "OTP has been resent and validity extended."
            : "OTP validity extended (delivery status unknown).",
          whatsAppStatus: whatsAppResult.sent ? 'sent' : whatsAppResult.skipped ? 'skipped' : 'failed',
          expiresInSeconds: EXTENDED_TTL
        });

    } catch (error) {
        console.error(`❌ [POST /otp/resend] Phone: ${req.body.phoneNumber} - Error resending OTP:`, error);
        res.status(500).json({ message: "Error resending OTP", error: error.message });
    }
});

// Register route

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error checking user existence", error });
  }
  try {
    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    // Save user to database
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
});


// OTP login route

router.post("/otplogin", async (req, res) => {
  // check if ID token is provided in req Body
  console.log("OTP login route hit");
  const { token: firebaseIdToken, acquisition } = req.body;
  
  // Log acquisition payload for debugging
  if (acquisition) {
    console.log(`📊 [otplogin] Acquisition payload:`, JSON.stringify(acquisition, null, 2));
  }
  
  if (!firebaseIdToken) {
    return res.status(400).json({ message: "ID token is required" });
  }
  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const firebaseUid = decodedToken.uid;
    const phoneNumber = decodedToken.phone_number;
    console.log(`Firebase UID: ${firebaseUid}`);
    console.log(`Phone number: ${phoneNumber}`);
    // Find user in MongoDB by phone number only
    let user = await User.findOne({ phoneNumber: phoneNumber });

    if (!user) {
      // Create user if doesn't exist (auto-registration)
      // Grant trial till 30th of current/next month
      const trialExpiryDate = getTrialExpiryDate();

      // Process acquisition data (handles Meta decryption if present)
      const acquisitionData = processAcquisition(acquisition);
      console.log('📊 New user acquisition (otplogin):', acquisitionData);

      user = new User({
        name: phoneNumber,
        uid: firebaseUid,
        phoneNumber: phoneNumber,
        whatsAppReportsEnabled: true,
        whatsAppReportPhone: phoneNumber,
        plan: 'pro',
        isTrial: true,
        planExpiresAt: trialExpiryDate,
        planSource: 'manual',
        planActivatedAt: new Date(),
        acquisition: acquisitionData
      });
      await user.save();
      // console.log(`New mobile user created: ${firebaseUid}`);
      
      // Add new user to API tracking (fire-and-forget)
      addUserToTracking(phoneNumber).catch(err => {
        console.error('Failed to add user to tracking:', err.message);
      });
    }

    // Generate JWT token for your app
    const jwtToken = generateToken({
      id: user._id,
      name: user.name,
      role: "Admin",
    });
    // console.log(`JWT token generated for user in mobile otp route: ${user._id}`);
    return res.status(200).json({
      message: "OTP login successful",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        role: "Admin",
        phoneNumber: user.phoneNumber,
        whatsAppReportsEnabled: user.whatsAppReportsEnabled,
        whatsAppReportPhone: user.whatsAppReportPhone,
        language: user.language || 'en',
      },
    });
  } catch (error) {
    console.error("OTP login error:", error);
    return res.status(401).json({ message: "Invalid or expired ID token", error: error.message });
  }
})


router.post("/truecallerlogin", async (req, res) => {
  try {
    const { authorizationCode, codeVerifier, acquisition } = req.body;
    console.log("authorization code " + authorizationCode)
    
    // Log acquisition payload for debugging
    if (acquisition) {
      console.log(`📊 [truecallerlogin] Acquisition payload:`, JSON.stringify(acquisition, null, 2));
    }

    if (!authorizationCode || !codeVerifier) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code and verifier are required.'
      });
    }

    // Use the URL from the documentation you have
    const tokenUrl = 'https://oauth-account-noneu.truecaller.com/v1/token';

    const requestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.TRUECALLER_CLIENT_ID,
      code: authorizationCode,
      code_verifier: codeVerifier,
      // The redirect_uri is NOT needed for the native SDK flow
    });

    const tokenResponse = await axios.post(tokenUrl, requestBody, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const accessToken = tokenResponse.data.access_token;

    // The rest of the logic remains the same...
    const userProfileUrl = 'https://oauth-account-noneu.truecaller.com/v1/userinfo';
    const userProfileResponse = await axios.get(userProfileUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const verifiedUserData = userProfileResponse.data;
    const phoneNumber = '+'+verifiedUserData.phone_number;
    console.log("verified user data", verifiedUserData)
    console.log("Searching for phone number:", phoneNumber);
    console.log("Phone number type:", typeof phoneNumber);

    // --- YOUR DATABASE AND JWT LOGIC HERE ---
    // check if user exist in db
    let user = await User.findOne({ phoneNumber: phoneNumber });
    console.log("Found existing user:", user ? "Yes" : "No");


    if (!user) {
      // Create user if doesn't exist (auto-registration)
      // Grant trial till 30th of current/next month
      const trialExpiryDate = getTrialExpiryDate();
      const name = verifiedUserData.given_name + " " + verifiedUserData.family_name || phoneNumber;
      
      // Process acquisition data (handles Meta decryption if present)
      const acquisitionData = processAcquisition(acquisition);
      console.log('📊 New user acquisition (truecaller):', acquisitionData);
      
      user = new User({
        name: name,
        phoneNumber: phoneNumber,
        plan: 'pro',
        isTrial: true,
        whatsAppReportsEnabled: true,
        whatsAppReportPhone: phoneNumber,
        planExpiresAt: trialExpiryDate,
        planSource: 'manual',
        planActivatedAt: new Date(),
        acquisition: acquisitionData
      });
      await user.save();
      // console.log(`New mobile user created: ${firebaseUid}`);
      
      // Add new user to API tracking (fire-and-forget)
      addUserToTracking(phoneNumber).catch(err => {
        console.error('Failed to add user to tracking:', err.message);
      });
    }

    // Generate JWT token for your app
    const jwtToken = generateToken({
      id: user._id,
      name: user.name,
      role: "Admin",
    });
    // console.log(`JWT token generated for user in mobile otp route: ${user._id}`);
    return res.status(200).json({
      message: "OTP login successful",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        role: "Admin",
        phoneNumber: user.phoneNumber,
        whatsAppReportsEnabled: user.whatsAppReportsEnabled,
        whatsAppReportPhone: user.whatsAppReportPhone,
        language: user.language || 'en'
      }
    })

  } catch (error) {
    console.error("Truecaller login error:", error.response ? error.response.data : error.message);

    return res.status(500).json({
      success: false,
      message: 'An error occurred during the Truecaller login process.',
    });
  }
});


// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Login route called");
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (user) {
      // Compare passwords
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Generate JWT token with user information
      const token = generateToken({
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        whatsAppReportsEnabled: user.whatsAppReportsEnabled,
        whatsAppReportPhone: user.whatsAppReportPhone,
        name: user.name,
        role: "Admin",
      });

      res.status(200).json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          role: "Admin",
          phoneNumber: user.phoneNumber,
          whatsAppReportsEnabled: user.whatsAppReportsEnabled,
          whatsAppReportPhone: user.whatsAppReportPhone,
          language: user.language || 'en'
        },
      });
    } else {
      const existingSupervisor = await Supervisor.findOne({ userId: email });
      if (existingSupervisor) {
        // Compare passwords simply from database for supervisor
        if (existingSupervisor.password === password) {
          // Generate JWT token with supervisor information
          const token = generateToken({
            id: existingSupervisor._id,
            email: existingSupervisor.userId,
            name: existingSupervisor.profileName,
            role: "Supervisor",
            site: existingSupervisor.site,
          });

          // Get all sites assigned to the supervisor
          const supervisorSites = await Site.find({ 
            _id: { $in: existingSupervisor.site } 
          }).select('_id sitename isActive');
          
          if (!supervisorSites || supervisorSites.length === 0) {
            return res.status(404).json({ message: "Contact your contractor" });
          }

          // Build sites array with siteId, siteName, isActive
          const sitesArray = supervisorSites.map(site => ({
            siteId: site._id,
            siteName: site.sitename,
            isActive: site.isActive
          }));

          // Get first site for legacy response fields (backward compatibility)
          const primarySite = supervisorSites[0];

          res.status(200).json({
            message: "Login successful",
            token,
            user: {
              id: existingSupervisor._id,
              name: existingSupervisor.profileName,
              role: "Supervisor",
              sites: sitesArray,
              // Legacy fields for backward compatibility
              siteid: existingSupervisor.site[0],
              siteName: primarySite.sitename,
              isActive: primarySite.isActive,
              siteStatus: primarySite.isActive ? "Active" : "Inactive",
              language: existingSupervisor.language || 'en'
            },
          });
        }else{
          return res.status(400).json({ message: "Invalid email or password" });
        }
      } else {
        return res.status(400).json({ message: "Invalid email or password" });
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
});

// Forgot password route
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Validate email input
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        message:
          "If an account with that email exists, password reset instructions have been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.name);

      res.status(200).json({
        message: "Password reset instructions have been sent to your email.",
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);

      // Clear the reset token if email fails
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      return res.status(500).json({
        message: "Failed to send reset email. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      message: "Error processing password reset request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Reset password route
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  try {
    // Validate input
    if (!token || !password) {
      return res.status(400).json({
        message: "Reset token and new password are required",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        message: "Password must be at least 4 characters long",
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      message:
        "Password has been successfully reset. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Error resetting password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Protected route - Get user profile
router.get("/profile/:siteId?", authenticateToken, async (req, res) => {
  // console.log("params:", req.params);
  try {
    // Check if siteId is provided in the params
    if (!req.params.siteId) {
      // The user information is already attached to req.user by the middleware
      const user = await User.findById(req.user.id)
        .select("-password")
        .lean(); // Use lean() to get plain JavaScript objects

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Manually populate supervisors to avoid circular references
      const supervisors = await Supervisor.find({ owner: user._id })
        .select("-__v") // Exclude version key
        .lean();

      // Get all site IDs from all supervisors
      const allSiteIds = supervisors.flatMap(sup => sup.site || []);
      const uniqueSiteIds = [...new Set(allSiteIds.map(id => id.toString()))];
      
      // Fetch all sites at once
      const allSites = await Site.find({ _id: { $in: uniqueSiteIds } })
        .select('_id sitename isActive')
        .lean();
      
      // Create a map for quick lookup
      const siteMap = {};
      allSites.forEach(site => {
        siteMap[site._id.toString()] = {
          siteId: site._id,
          siteName: site.sitename,
          isActive: site.isActive
        };
      });

      // Add supervisors to user object with sites array
      const userWithSupervisors = {
        ...user,
        supervisors: supervisors.map(supervisor => {
          // Build sites array for this supervisor
          const supervisorSiteIds = supervisor.site || [];
          const sitesArray = supervisorSiteIds
            .map(siteId => siteMap[siteId.toString()])
            .filter(Boolean);
          
          return {
            ...supervisor,
            owner: user._id, // Keep owner reference as ID only, not full object
            sites: sitesArray,
            // Legacy fields for backward compatibility (use first site)
            loginId: supervisor.userId,
            name: supervisor.profileName,
            isActive: supervisor.status === 'active'
          };
        })
      };

      res.status(200).json({
        message: "Profile retrieved successfully",
        user: userWithSupervisors,
      });
    } else {
      // If siteId is provided, populate user with only that site's supervisors
      const siteId = req.params.siteId;
      // console.log("Fetching profile for site:", siteId);
      const user = await User.findById(req.user.id)
        .select("-password")
        .lean(); // Use lean() to get plain JavaScript objects

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Manually populate supervisors for specific site to avoid circular references
      const supervisors = await Supervisor.find({
        owner: user._id,
        site: siteId
      })
        .select("-__v") // Exclude version key
        .lean();

      // Get all site IDs from all supervisors
      const allSiteIds = supervisors.flatMap(sup => sup.site || []);
      const uniqueSiteIds = [...new Set(allSiteIds.map(id => id.toString()))];
      
      // Fetch all sites at once
      const allSites = await Site.find({ _id: { $in: uniqueSiteIds } })
        .select('_id sitename isActive')
        .lean();
      
      // Create a map for quick lookup
      const siteMap = {};
      allSites.forEach(site => {
        siteMap[site._id.toString()] = {
          siteId: site._id,
          siteName: site.sitename,
          isActive: site.isActive
        };
      });

      // Add supervisors to user object with sites array
      const userWithSupervisors = {
        ...user,
        supervisors: supervisors.map(supervisor => {
          // Build sites array for this supervisor
          const supervisorSiteIds = supervisor.site || [];
          const sitesArray = supervisorSiteIds
            .map(siteId => siteMap[siteId.toString()])
            .filter(Boolean);
          
          return {
            ...supervisor,
            owner: user._id, // Keep owner reference as ID only, not full object
            sites: sitesArray,
            // Legacy fields for backward compatibility
            loginId: supervisor.userId,
            name: supervisor.profileName,
            isActive: supervisor.status === 'active'
          };
        })
      };

      res.status(200).json({
        message: "Profile retrieved successfully",
        user: userWithSupervisors,
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error retrieving profile", error });
  }
});

// Protected route - Verify token (enhanced / backward compatible)
// Returns 200 with enriched user payload if token valid
// Base fields always: id, email, name, role
// Additional (required) fields for Supervisors: siteid, siteName, isActive (plus siteStatus for parity with login response)
router.get("/verify", authenticateToken, async (req, res) => {
  try {
    // Start with base fields from token/middleware
    const baseUser = {
      id: req.user?.id,
      email: req.user?.email,
      name: req.user?.name,
      role: req.user?.role,
      phoneNumber: req.user?.phoneNumber,
      whatsAppReportsEnabled: req.user?.whatsAppReportsEnabled,
      whatsAppReportPhone: req.user?.whatsAppReportPhone
    };

    // Fallback: ensure email/name/language for Admin if missing (older tokens)
    if (baseUser.role === "Admin" && (!baseUser.email || !baseUser.name || !baseUser.language)) {
      try {
        const dbUser = await User.findById(baseUser.id).select("email name language").lean();
        if (dbUser) {
          baseUser.email = baseUser.email || dbUser.email;
          // prefer token name if present
          if (!baseUser.name) baseUser.name = dbUser.name;
          baseUser.language = dbUser.language || 'en';
        }
      } catch (_) {
        // Silent — verification should still succeed if token valid
        baseUser.language = baseUser.language || 'en';
      }
    } else if (baseUser.role === "Admin") {
      // Ensure language is set even if other fields are present
      baseUser.language = baseUser.language || 'en';
    }

    if (baseUser.role === "Supervisor") {
      try {
        // Get supervisor document for authoritative site assignment
        const supervisor = await Supervisor.findById(baseUser.id).lean();
        if (supervisor) {
          // Add language support for supervisor
          baseUser.language = supervisor.language || 'en';
          // site may be stored as array (as seen in login) — pick first
          const siteId = Array.isArray(supervisor.site)
            ? supervisor.site[0]
            : supervisor.site;
          baseUser.siteid = siteId || null;

          if (siteId) {
            const site = await Site.findById(siteId).lean();
            if (site) {
              baseUser.siteName = site.sitename || "Unknown Site";
              baseUser.isActive = !!site.isActive;
              baseUser.siteStatus = site.isActive ? "Active" : "Inactive"; // keep existing pattern
            } else {
              baseUser.siteName = "Unknown Site";
              baseUser.isActive = false;
              baseUser.siteStatus = "Inactive";
            }
          } else {
            baseUser.siteName = "Unknown Site";
            baseUser.isActive = false;
            baseUser.siteStatus = "Inactive";
          }
        } else {
          // Supervisor record missing (edge case — still return required fields)
          baseUser.siteid = null;
          baseUser.siteName = "Unknown Site";
          baseUser.isActive = false;
          baseUser.siteStatus = "Inactive";
        }
      } catch (e) {
        // On any lookup error, still respond successfully (token already validated)
        if (!("siteid" in baseUser)) {
          baseUser.siteid = null;
          baseUser.siteName = "Unknown Site";
          baseUser.isActive = false;
          baseUser.siteStatus = "Inactive";
        }
      }
    }

    res.status(200).json({
      message: "Token is valid",
      user: baseUser,
    });
  } catch (error) {
    // Should rarely occur; treat as server error while token was valid
    res.status(500).json({ message: "Error verifying token", error: error.message });
  }
});


// Get assigned sites for supervisor
// This endpoint returns all sites assigned to the authenticated supervisor
router.get("/supervisor/assigned-sites", authenticateToken, async (req, res) => {
  try {
    // Check if user is authenticated and is a Supervisor
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role !== "Supervisor") {
      return res.status(403).json({ message: "This endpoint is only for supervisors" });
    }

    // Find the supervisor by ID
    const supervisor = await Supervisor.findById(req.user.id);
    if (!supervisor) {
      return res.status(404).json({ message: "Supervisor not found" });
    }

    // Check if supervisor is active
    if (supervisor.status !== "active") {
      return res.status(403).json({ message: "Supervisor account is inactive" });
    }

    // Get all sites assigned to the supervisor
    const supervisorSites = await Site.find({
      _id: { $in: supervisor.site }
    }).select('_id sitename isActive');

    // Build sites array with siteId, siteName, isActive
    const sites = supervisorSites.map(site => ({
      siteId: site._id,
      siteName: site.sitename,
      isActive: site.isActive
    }));

    res.status(200).json({
      sites: sites
    });

  } catch (error) {
    console.error("Error fetching supervisor assigned sites:", error);
    res.status(500).json({ message: "Error fetching assigned sites", error: error.message });
  }
});


//  supervisor credentials route
router.post("/supervisor-credentials/create", authenticateToken, async (req, res) => {
  try {
    // Check if user is authenticated
    if (
      !req.user ||
      !req.user.id ||
      !req.user.role ||
      req.user.role !== "Admin"
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check if supervisor name is provided
    if (!req.body.name || req.body.name.trim() === "") {
      return res
        .status(400)
        .json({ message: "Supervisor name is required" });
    }

    // Support both siteIds (array) and siteId (single) for backward compatibility
    let siteIds = [];
    if (req.body.siteIds && Array.isArray(req.body.siteIds) && req.body.siteIds.length > 0) {
      siteIds = req.body.siteIds;
    } else if (req.body.siteId) {
      siteIds = [req.body.siteId];
    } else {
      return res
        .status(400)
        .json({ message: "At least one site ID is required (use siteIds array or siteId)" });
    }

    const supervisorName = req.body.name;

    // Validate all site IDs exist
    const sites = await Site.find({ _id: { $in: siteIds } }).select('_id sitename isActive');
    if (!sites || sites.length === 0) {
      return res.status(404).json({ message: "No valid sites found" });
    }
    if (sites.length !== siteIds.length) {
      return res.status(404).json({ message: "One or more site IDs are invalid" });
    }

    // Find user by ID
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate supervisor credentials
    const credentials = await generateSupervisorCredentials(supervisorName);

    // add the supervisor to database with all sites
    const newSupervisor = new Supervisor({
      userId: credentials.username,
      password: credentials.password,
      profileName: supervisorName,
      createdBy: user.name,
      site: siteIds,
      owner: user
    });

    await newSupervisor.save();

    // add this credentials to the user
    user.supervisors.push(newSupervisor);
    await user.save();

    // Build sites array for response
    const sitesArray = sites.map(site => ({
      siteId: site._id,
      siteName: site.sitename,
      isActive: site.isActive
    }));

    // Create response with new format
    const supervisorResponse = {
      _id: newSupervisor._id,
      userId: newSupervisor.userId,
      loginId: newSupervisor.userId,
      name: newSupervisor.profileName,
      password: newSupervisor.password,
      profileName: newSupervisor.profileName,
      createdBy: newSupervisor.createdBy,
      sites: sitesArray,
      // Legacy field for backward compatibility
      site: newSupervisor.site,
      status: newSupervisor.status,
      createdAt: newSupervisor.createdAt,
      updatedAt: newSupervisor.updatedAt
    };

    res.status(201).json({
      success: true,
      message: "Supervisor credentials created successfully",
      supervisor: supervisorResponse,
    });
  } catch (error) {
    console.error("Error fetching supervisor credentials:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching supervisor credentials", error });
  }
}
);

// Update supervisor sites route
// This route allows an admin user to update the sites assigned to a supervisor
router.put(
  "/supervisor-credentials/update-sites",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // Validate request body
      const userId = req.body.userId;
      const siteIds = req.body.siteIds;

      if (!userId) {
        return res.status(400).json({ success: false, message: "Supervisor userId is required" });
      }

      if (!siteIds || !Array.isArray(siteIds) || siteIds.length === 0) {
        return res.status(400).json({ success: false, message: "siteIds array is required and must not be empty" });
      }

      // Find supervisor by userId
      const supervisor = await Supervisor.findOne({ userId });
      if (!supervisor) {
        return res.status(404).json({ success: false, message: "Supervisor not found" });
      }

      // Find the user to check if they have permission to modify this supervisor
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Check if Admin has permission to modify this supervisor
      const hasPermission = user.supervisors.some(
        (sup) => sup._id.toString() === supervisor._id.toString()
      );
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "Forbidden - You don't have permission to modify this supervisor",
        });
      }

      // Validate all site IDs exist and belong to this admin
      const sites = await Site.find({ 
        _id: { $in: siteIds },
        owner: req.user.id
      }).select('_id sitename isActive');

      if (!sites || sites.length === 0) {
        return res.status(404).json({ success: false, message: "No valid sites found" });
      }

      if (sites.length !== siteIds.length) {
        return res.status(400).json({ 
          success: false, 
          message: "One or more site IDs are invalid or don't belong to you" 
        });
      }

      // Update supervisor's sites
      supervisor.site = siteIds;
      await supervisor.save();

      // Build sites array for response
      const sitesArray = sites.map(site => ({
        siteId: site._id,
        siteName: site.sitename,
        isActive: site.isActive
      }));

      res.status(200).json({
        success: true,
        message: "Supervisor sites updated successfully",
        supervisor: {
          userId: supervisor.userId,
          name: supervisor.profileName,
          sites: sitesArray
        }
      });
    } catch (error) {
      console.error("Error updating supervisor sites:", error);
      res.status(500).json({
        success: false,
        message: "Error updating supervisor sites",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// add a detailed comment to explain the delete route explaining how to use it in frontend
// This route allows an admin user to delete a supervisor's credentials.
// To use this route from the frontend, send a DELETE request to /supervisor-credentials/delete/
// with the supervisor's ID in the request body, like this:
// {
//   "supervisor": {
//     "userId": "supervisor_id_here"
//   }
// }

router.delete(
  "/supervisor-credentials/delete/",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Find supervisor by ID first (don't delete yet)
      const supervisor = await Supervisor.findOne({
        userId: req.body.supervisor.userId,
      });
      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Find the user to check if they have permission to delete this supervisor
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if Admin has permission to delete this supervisor
      const hasPermission = user.supervisors.some(
        (sup) => sup._id.toString() === supervisor._id.toString()
      );
      if (!hasPermission) {
        return res.status(403).json({
          message:
            "Forbidden - You don't have permission to delete this supervisor",
        });
      }

      // Now delete the supervisor
      await Supervisor.findOneAndDelete({ userId: req.body.supervisor.userId });

      // Remove supervisor from user's list
      if (user) {
        user.supervisors.pull(supervisor._id);
        await user.save();
      }
      // Return success response

      res.status(200).json({
        message: "Supervisor credentials deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting supervisor credentials:", error);
      res.status(500).json({
        message: "Error deleting supervisor credentials",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Change supervisor password route

// userId is the unique identifier for the supervisor whose password needs to be changed
// This route allows an admin user to change a supervisor's password.
// put the userId in the request body like this:
// // {
//   "supervisor": {
//     "userId": "supervisor_id_here"
//   }
// }

router.post(
  "/supervisor-credentials/change-password",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const userId = req.body.supervisor?.userId;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Find supervisor by userId
      const supervisor = await Supervisor.findOne({ userId });
      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Find the user to check if they have permission to change this supervisor's password
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if Admin has permission to change this supervisor's password
      const hasPermission = user.supervisors.some(
        (sup) => sup._id.toString() === supervisor._id.toString()
      );
      if (!hasPermission) {
        return res.status(403).json({
          message:
            "Forbidden - You don't have permission to modify this supervisor",
        });
      }

      // Generate a new 6 digit numeric password
      const newPassword = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      // Update supervisor password
      supervisor.password = newPassword;
      await supervisor.save();

      res.status(200).json({
        message: "Supervisor password changed successfully",
        newPassword,
      });
    } catch (error) {
      console.error("Error changing supervisor password:", error);
      res.status(500).json({
        message: "Error changing supervisor password",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Toggle supervisor status route
// This route allows an admin user to toggle a supervisor's status between active and inactive.
router.post(
  "/supervisor-credentials/toggle-status",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const userId = req.body.supervisor?.userId;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Find supervisor by userId
      const supervisor = await Supervisor.findOne({ userId });
      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Find the user to check if they have permission to toggle this supervisor's status
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if Admin has permission to toggle this supervisor's status
      const hasPermission = user.supervisors.some(
        (sup) => sup._id.toString() === supervisor._id.toString()
      );
      if (!hasPermission) {
        return res.status(403).json({
          message:
            "Forbidden - You don't have permission to modify this supervisor",
        });
      }

      // Toggle status
      supervisor.status =
        supervisor.status === "active" ? "inactive" : "active";
      await supervisor.save();

      res.status(200).json({
        message: `Supervisor status changed to ${supervisor.status}`,
        supervisor,
      });
    } catch (error) {
      console.error("Error toggling supervisor status:", error);
      res.status(500).json({
        message: "Error toggling supervisor status",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Test email endpoint (for debugging only - remove in production)
router.post("/test-email", async (req, res) => {
  const { testEmail } = req.body;

  if (process.env.NODE_ENV === "production") {
    return res
      .status(404)
      .json({ message: "Endpoint not available in production" });
  }

  try {
    const { sendPasswordResetEmail } = require("../Utils/emailService");

    // Generate a test token
    const testToken = "test-token-123";

    await sendPasswordResetEmail(
      testEmail || "test@example.com",
      testToken,
      "Test User"
    );

    res.status(200).json({
      message: "Test email sent successfully",
      note: "Check your email inbox",
    });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      message: "Failed to send test email",
      error: error.message,
      details: {
        code: error.code,
        response: error.response,
      },
    });
  }
});

// Update user name route
router.put("/update-name", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({
        message: "Name is required and cannot be empty"
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const trimmedName = name.trim();
    user.name = trimmedName;
    await user.save();

    // Update Google Sheet if user has phone number (fire-and-forget)
    if (user.phoneNumber) {
      const { updateUserNameInSheet } = require('../Utils/sheets');
      const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
      const SHEET_NAME = process.env.SHEET_NAME || 'Users';
      
      if (SPREADSHEET_ID) {
        updateUserNameInSheet(SPREADSHEET_ID, SHEET_NAME, user.phoneNumber, trimmedName)
          .catch(err => console.error('Failed to update name in Google Sheet:', err.message));
      }
    }

    res.status(200).json({
      message: "Name updated successfully",
      user: {
        id: user._id,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating name",
      error: error.message
    });
  }
});
// Update user profile route (name and language) - Supports both User and Supervisor schemas
router.put("/update-profile", authenticateToken, async (req, res) => {
  try {
    const { name, language } = req.body;
    const userRole = req.user.role; // Get role from JWT token

    if ((!name || name.trim() === "") && (!language || language.trim() === "")) {
      return res.status(400).json({
        message: "At least one field (name or language) is required"
      });
    }

    // Validate language if provided
    if (language) {
      const validLanguages = ['en', 'hi', 'hing'];
      if (!validLanguages.includes(language.trim())) {
        return res.status(400).json({
          message: "Invalid language. Must be: en, hi, or hing"
        });
      }
    }

    // Determine which model to use based on role
    let user;
    if (userRole === "Supervisor") {
      // Update Supervisor schema
      user = await Supervisor.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          message: "Supervisor not found"
        });
      }

      // Update fields if provided
      if (name && name.trim() !== "") {
        user.profileName = name.trim(); // Supervisor uses 'profileName' field
      }
      if (language && language.trim() !== "") {
        user.language = language.trim();
      }

      await user.save();

      res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          name: user.profileName,
          role: "Supervisor",
          language: user.language || 'en'
        }
      });
    } else {
      // Update User schema (Admin/Contractor)
      user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      // Track if name was updated for Google Sheets sync
      let nameUpdated = false;
      let newName = null;

      // Update fields if provided
      if (name && name.trim() !== "") {
        newName = name.trim();
        user.name = newName;
        nameUpdated = true;
      }
      if (language && language.trim() !== "") {
        user.language = language.trim();
      }

      await user.save();

      // Update Google Sheet if name was changed and user has phone number (fire-and-forget)
      if (nameUpdated && user.phoneNumber) {
        const { updateUserNameInSheet } = require('../Utils/sheets');
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const SHEET_NAME = process.env.SHEET_NAME || 'Users';
        
        if (SPREADSHEET_ID) {
          updateUserNameInSheet(SPREADSHEET_ID, SHEET_NAME, user.phoneNumber, newName)
            .catch(err => console.error('Failed to update name in Google Sheet:', err.message));
        }
      }

      res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          whatsAppReportsEnabled: user.whatsAppReportsEnabled,
          whatsAppReportPhone: user.whatsAppReportPhone,
          language: user.language || 'en'
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error updating profile",
      error: error.message
    });
  }
});

// Temporary debug route to check users in database (remove in production)
router.get("/debug-users", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(404)
      .json({ message: "Endpoint not available in production" });
  }

  try {
    const users = await User.find({}, "name email uid").limit(10);
    const userCount = await User.countDocuments();

    res.status(200).json({
      message: "Users in database",
      totalUsers: userCount,
      users: users,
    });
  } catch (error) {
    console.error("Debug users error:", error);
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
});



module.exports = router;

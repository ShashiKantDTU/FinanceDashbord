const mongoose = require("mongoose");

// Sub-schema for custom labels
const labelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  color: {
    type: String,
    default: '#3b82f6', // Default blue if none provided
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/ // Validates HEX codes
  }
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false, trim: true },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    phoneNumber: { type: String, unique: true, match: /^\+?[1-9]\d{1,14}$/ }, // E.164
    // uid comes from providers (e.g. Firebase / Truecaller). Not unique on purpose so
    // flows that don't supply it can store null or duplicates safely.
    uid: { type: String },
    whatsAppReportsEnabled: { type: Boolean, default: false },
    whatsAppReportPhone: { type: String, match: /^\+?[1-9]\d{1,14}$/ }, // E.164
    password: { type: String },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    site: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
      },
    ],
    supervisors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supervisor",
      },
    ],

    // 👇 Plan info
    plan: {
      type: String,
      enum: ["free", "lite", "pro", "premium", "business", "enterprise"],
      default: "free",
    },
    planActivatedAt: { type: Date },
    billing_cycle: { type: String, enum: ["monthly", "yearly"] },
    planExpiresAt: { type: Date },
    // 👇 Enterprise Custom Plan Limits (only used when plan === 'enterprise')
    enterpriseLimits: {
      maxActiveSites: { type: Number, default: 10 }, // Custom limit for active sites
      maxEmployeesPerSite: { type: Number, default: 100 }, // Custom limit for employees per site
      // Feature flags
      isWhatsApp: { type: Boolean, default: true },
      isPDF: { type: Boolean, default: true },
      isExcel: { type: Boolean, default: true },
      isSupervisorAccess: { type: Boolean, default: true },
      isChangeTracking: { type: Boolean, default: true },
    },
    // 👇 Business Custom Plan Limits (only used when plan === 'business')
    // Business plan uses TOTAL employees across all sites, not per-site limits
    businessLimits: {
      maxActiveSites: { type: Number, default: 10 }, // Custom limit for active sites
      maxTotalEmployees: { type: Number, default: 100 }, // Total employees across ALL active sites
      // Feature flags
      isWhatsApp: { type: Boolean, default: true },
      isPDF: { type: Boolean, default: true },
      isExcel: { type: Boolean, default: true },
      isSupervisorAccess: { type: Boolean, default: true },
      isChangeTracking: { type: Boolean, default: true },
    },
    isTrial: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    isGrace: { type: Boolean, default: false },
    graceExpiresAt: { type: Date, default: null },

    // For safety
    isPaymentVerified: { type: Boolean, default: false },
    planSource: {
      type: String,
      enum: ["google_play", "app_store", "web", "web_razorpay", "manual", "free"],
      default: null,
    },
    purchaseToken: { type: String, default: null },
    // 👇 Razorpay subscription details (only used when planSource === 'web_razorpay')
    razorpayDetails: {
      customerId: { type: String, default: null },       // Razorpay customer ID (cust_...)
      subscriptionId: { type: String, default: null },   // Razorpay subscription ID (sub_...)
      planId: { type: String, default: null },           // Razorpay plan ID (plan_...)
      status: { type: String, default: null },           // "active", "created", "authenticated", etc.
      nextBillDate: { type: Date, default: null },       // Next billing date from Razorpay
    },
    // Store the last purchase token for renewal verification
    lastPurchaseToken: { type: String, default: null },
    planHistory: {
      type: [
        {
          plan: {
            type: String,
            enum: ["free", "lite", "pro", "premium", "business", "enterprise"],
            required: true,
          },
          purchasedAt: {
            type: Date,
            required: true,
          },
          expiresAt: {
            type: Date,
            required: true,
          },
          transactionId: {
            type: String,
            required: true,
          },
          platform: {
            type: String,
            enum: ["android", "ios", "web"],
            required: true,
          },
          source: {
            type: String,
            enum: ["google_play", "app_store", "stripe", "razorpay", "manual"],
            required: true,
          },
          isActive: {
            type: Boolean,
            default: true,
          },
          renewalToken: String, // For subscription renewals
          originalPurchaseToken: String, // For tracking original purchase
          // Google Play specific fields
          originalProductId: String, // Original product ID from Google Play
          subscriptionId: String, // Google Play subscription ID
          regionCode: String, // Purchase region
          // Additional metadata
          verificationData: {
            subscriptionState: String,
            startTime: Date,
          },
        },
      ],
      default: [], // Ensure every user has an empty array by default
    },
    // Tracks the last time user updated active site selection via API
    lastSiteUpdated: { type: Date, default: null },
    language: {
      type: String,
      enum: ["en", "hi", "hing" , "gu"],
      default: "en",
      required: false, // Optional - defaults to 'en' if not provided
    },
    // 👇 Cached stats for Calculate-on-Write optimization
    // These are updated when employees are added/removed, avoiding expensive aggregations on dashboard
    stats: {
      totalActiveLabors: { type: Number, default: 0 }, // Total employees across ALL active sites for current month
    },

    // 👇 Custom labels for categorizing employees
    customLabels: {
      type: [labelSchema],
      default: []
    },

    // 👇 Acquisition/Attribution Tracking - How user discovered the app
    acquisition: {
      // Core fields (always present)
      source: {
        type: String,
        default: "organic",
      },
      campaign: {
        type: String,
        default: "organic",
      },
      medium: {
        type: String,
        default: "organic",
      },
      // Meta-specific fields (populated after decryption)
      platform_position: {
        type: String, // e.g., "instagram_stories", "facebook_feed", "instagram_reels"
      },
      ad_objective: {
        type: String, // e.g., "CONVERSIONS", "APP_INSTALLS"
      },
      adgroup_name: {
        type: String, // Ad set name from Meta
      },
      // Raw referrer for debugging (stored if decryption fails)
      raw_referrer: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Post-save hook to log new user registrations to Google Sheets
userSchema.post('save', async function(doc, next) {
  // Check if this was a new document using wasNew flag
  // In post-save, isNew is already false, so we check if _id was just created
  const wasNew = this.$locals.wasNew;
  
  if (!wasNew) {
    return;
  }

  // Skip users without phone numbers (e.g., email/password-only registrations)
  if (!this.phoneNumber || this.phoneNumber.trim() === '') {
    return;
  }

  try {
    // Import the appendToSheet function
    const { appendToSheet } = require('../Utils/sheets');

    // Get spreadsheet configuration from environment variables
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const SHEET_NAME = process.env.SHEET_NAME || 'Users'; // Default to 'Users' if not set

    // Check if SPREADSHEET_ID is configured
    if (!SPREADSHEET_ID) {
      console.warn('SPREADSHEET_ID not configured. Skipping Google Sheets logging for new user registration.');
      return;
    }

    // Prepare the row data: timestamp, name, phone number, acquisition data
    const now = new Date();
    const readableDate = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
    
    // Get acquisition data with defaults
    const acquisitionSource = this.acquisition?.source || 'organic';
    const acquisitionCampaign = this.acquisition?.campaign || 'organic';
    const acquisitionMedium = this.acquisition?.medium || 'organic';
    // Meta-specific field
    const platformPosition = this.acquisition?.platform_position || '';
    
    const newRow = [
      '', // Column A - left blank
      readableDate, // Column B - creation date (e.g., "Nov 12, 2025")
      this.name || 'N/A', // Column C - name
      this.phoneNumber, // Column D - phone number
      acquisitionSource, // Column E - acquisition source
      acquisitionCampaign, // Column F - acquisition campaign
      acquisitionMedium, // Column G - acquisition medium
      platformPosition // Column H - platform position (e.g., "instagram_stories")
    ];

    // Append to Google Sheets
    await appendToSheet(SPREADSHEET_ID, SHEET_NAME, [newRow]);
    
    console.log(`Successfully logged new user registration to Google Sheets: ${this.phoneNumber}`);
  } catch (err) {
    // Log the error but don't throw it - we don't want sheet logging failures to affect user registration
    console.error('Failed to log user registration to Google Sheets:', err.message);
  }
});

// Pre-save hook to track if document is new
userSchema.pre('save', function(next) {
  this.$locals.wasNew = this.isNew;
  next();
});

module.exports = mongoose.model("User", userSchema);

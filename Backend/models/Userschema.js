const mongoose = require("mongoose");

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
      enum: ["free", "pro", "premium", "business"],
      default: "free",
    },
    planActivatedAt: { type: Date },
    billing_cycle: { type: String, enum: ["monthly", "yearly"] },
    planExpiresAt: { type: Date },

    // 👇 Business Custom Plan Limits (only used when plan === 'business')
    businessLimits: {
      maxSites: { type: Number, default: null }, // Custom site limit per user
      maxEmployeesPerSite: { type: Number, default: null }, // Custom employee limit per site
      customPlanName: { type: String, default: null }, // Custom plan display name
      notes: { type: String, default: null }, // Admin notes about the custom plan
    },
    isTrial: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    isGrace: { type: Boolean, default: false },
    graceExpiresAt: { type: Date, default: null },

    // For safety
    isPaymentVerified: { type: Boolean, default: false },
    planSource: {
      type: String,
      enum: ["google_play", "app_store", "web", "manual"],
      default: null,
    },
    purchaseToken: { type: String, default: null },
    // Store the last purchase token for renewal verification
    lastPurchaseToken: { type: String, default: null },
    planHistory: {
      type: [
        {
          plan: {
            type: String,
            enum: ["free", "pro", "premium", "business"],
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
      enum: ["en", "hi", "hing"],
      default: "en",
      required: false, // Optional - defaults to 'en' if not provided
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);

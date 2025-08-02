const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false, // Optional field
      trim: true,
    },
    email: {
      type: String,
      required: false, // Optional field
      lowercase: true,
      trim: true,
      sparse: true, // This allows multiple null values
    },
    phoneNumber: {
      type: String,
      //   required: true,
      unique: true,
      match: /^\+?[1-9]\d{1,14}$/, // ✅ E.164 format validation
    },
    uid: {
      type: String,
      //   required: true,
      unique: true,
    },
    password: {
      type: String,
      // required: true,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
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
      enum: ['free', 'pro', 'premium'],
      default: 'free',
    },
    planActivatedAt: {
      type: Date,
    },
    billing_cycle : {
      type: String,
      enum: ['monthly', 'yearly']
    },
    planExpiresAt: {
      type: Date,
    },
    isTrial: {
      type: Boolean,
      default: false,
    },

    // For safety
    isPaymentVerified: {
      type: Boolean,
      default: false
    },
    planSource: {
      type: String,
      enum: ['google_play', 'app_store', 'web', 'manual'],
      default: null
    },
    purchaseToken: {
      type: String,
      default: null
    },
    // Store the last purchase token for renewal verification
    lastPurchaseToken: {
      type: String,
      default: null
    },
    planHistory: {
      type: [{
        plan: {
          type: String,
          enum: ['free', 'pro', 'premium'],
          required: true
        },
        purchasedAt: {
          type: Date,
          required: true
        },
        expiresAt: {
          type: Date,
          required: true
        },
        transactionId: {
          type: String,
          required: true
        },
        platform: {
          type: String,
          enum: ['android', 'ios', 'web'],
          required: true
        },
        source: {
          type: String,
          enum: ['google_play', 'app_store', 'stripe', 'razorpay', 'manual'],
          required: true
        },
        isActive: {
          type: Boolean,
          default: true
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
          startTime: Date
        }
      }],
      default: [] // Ensure every user has an empty array by default
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);

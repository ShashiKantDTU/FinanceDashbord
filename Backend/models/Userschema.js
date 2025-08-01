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
    planSource: String,
    purchaseToken: String,
    planHistory: [{
      plan: String,
      purchasedAt: Date,
      expiresAt: Date,
      transactionId: String,
      platform: String,
      source: String
    }]
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);

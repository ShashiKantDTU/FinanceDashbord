/**
 * Failed Webhook Schema
 * 
 * Stores webhook payloads that couldn't be processed successfully.
 * This allows admins to review and manually reconcile failed payments.
 */

const mongoose = require("mongoose");

const failedWebhookSchema = new mongoose.Schema(
  {
    // Source of the webhook
    source: {
      type: String,
      enum: ["razorpay", "google_play"],
      required: true,
    },
    
    // The event type
    event: {
      type: String,
      required: true,
    },
    
    // Request ID for tracking
    requestId: {
      type: String,
      required: true,
    },
    
    // The reason it failed
    failureReason: {
      type: String,
      required: true,
    },
    
    // User ID that was attempted (from notes/payload)
    attemptedUserId: {
      type: String,
      default: null,
    },
    
    // Subscription/transaction details for reconciliation
    subscriptionId: {
      type: String,
      default: null,
    },
    
    customerId: {
      type: String,
      default: null,
    },
    
    // Plan details from notes
    planDetails: {
      planType: String,
      maxSites: Number,
      maxEmployeesPerSite: Number,
      maxTotalEmployees: Number,
    },
    
    // Customer contact info for reaching out (from Razorpay)
    customerContact: {
      email: { type: String, default: null },
      phone: { type: String, default: null },
      name: { type: String, default: null },
    },
    
    // Payment amount (in paise for INR)
    paymentAmount: {
      type: Number,
      default: null,
    },
    
    // Full payload for debugging
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    
    // Resolution status
    status: {
      type: String,
      enum: ["pending", "resolved", "ignored", "refunded"],
      default: "pending",
    },
    
    // Resolution notes
    resolvedAt: {
      type: Date,
      default: null,
    },
    
    resolvedBy: {
      type: String,
      default: null,
    },
    
    resolutionNotes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookup of pending webhooks
failedWebhookSchema.index({ status: 1, source: 1, createdAt: -1 });
failedWebhookSchema.index({ attemptedUserId: 1 });
failedWebhookSchema.index({ subscriptionId: 1 });

module.exports = mongoose.model("FailedWebhook", failedWebhookSchema);

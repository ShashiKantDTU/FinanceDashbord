const mongoose = require('mongoose');

const apiUsageLogSchema = new mongoose.Schema({
  // --- User & Plan Details ---
  // The primary account owner who will be billed or tracked
  mainUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // Index for faster grouping
  },
  userPhone: {
    type: String,
    required: true,
  },
  userPlan: {
    type: String,
    default: 'free',
  },

  // --- Request Actor Details ---
  // Who made the request (can be a User or a Supervisor)
  actor: {
    id: { type: String, required: true },
    role: { type: String, enum: ['User', 'Supervisor'], required: true },
  },

  // --- Supervisor Specific Details (if applicable) ---
  supervisor: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supervisor' },
    profileName: { type: String },
  },

  // --- Request & Response Details ---
  endpoint: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    required: true,
  },
  status: {
    type: Number,
    required: true,
  },
  responseSizeBytes: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: '90d', // Automatically delete logs older than 90 days to save space
  },
});

// Compound index to optimize dashboard queries
apiUsageLogSchema.index({ mainUserId: 1, timestamp: -1 });

const ApiUsageLog = mongoose.model('ApiUsageLog', apiUsageLogSchema);

module.exports = ApiUsageLog;

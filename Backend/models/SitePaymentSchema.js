const mongoose = require('mongoose');

const sitePaymentSchema = new mongoose.Schema({
    siteID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Site',
        required: true,
        index: true // Important for performance
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        required: true
    },
    remark: {
        type: String,
        trim: true
    },
    receivedBy: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Create compound index for efficient queries
sitePaymentSchema.index({ siteID: 1, date: 1 });

module.exports = mongoose.model('SitePayment', sitePaymentSchema);
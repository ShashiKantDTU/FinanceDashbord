const mongoose = require('mongoose');

const siteExpenseSchema = new mongoose.Schema({
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
    category: { // e.g., "Travel", "Food", "Material , "
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    remark: {
        type: String,
        trim: true
    },
    createdBy: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Create compound index for efficient queries
siteExpenseSchema.index({ siteID: 1, date: 1 });

module.exports = mongoose.model('SiteExpense', siteExpenseSchema);
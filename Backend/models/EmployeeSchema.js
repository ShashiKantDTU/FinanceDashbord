const mongoose = require('mongoose');


const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    empid: {
        type: String,
        required: true,
        trim: true
    },
    rate: {
        type: Number,
        required: true,
        min: 0
    },
    month: {
        type: Number,
        required: true,
    },
    year: {
        type: Number,
        required: true,
        min: 2000, // Assuming a reasonable minimum year
        max: new Date().getFullYear() + 1 // Allowing current year and next year
    },
    siteID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Site',
        required: true
    },
    payouts: [{
        value: {
            type: Number,
        },
        remark: {
            type: String,
        },
        date: {
            type: Date,
        },
        createdBy: {
            type: String, // Email or userid of the creator
            required: true
        }
    }],
    wage: {
        type: Number,
        required: true,
        min: 0
    },
    // additional payments (other than salary) required for the employee in the month
    additional_req_pays: [{
        value: {
            type: Number,
            required: true,
            min: 0
        },
        remark: {
            type: String,
            required: true,
            trim: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        createdBy: {
            type: String, // Email or userid of the creator
            required: true
        }
    }],
    attendance: [String],
    closing_balance: {
        type: Number,
        default: 0
    },
    carry_forwarded: {
        value: {
            type: Number,
            default: 0
        },
        remark: {
            type: String,
            default: ''
        },
        date: {
            type: Date,
            default: Date.now
        }
    },
    createdBy: {
        type: String, // Email or userid of the creator
        required: true
    },
    attendanceHistory: {
        type: Map,
        of: {
            attendance: [String],
            updated_by: String
        },
        default: {}
    },
    recalculationneeded: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

// Add this line to create the compound index
employeeSchema.index({ siteID: 1, empid: 1, month: 1, year: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
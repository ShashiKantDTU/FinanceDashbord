/**
 * Optimized Change Tracking Schema
 * 
 * This schema stores only the exact changes made to critical fields,
 * significantly reducing storage usage while maintaining complete audit trail.
 * 
 * Key Features:
 * - Field-specific tracking (one document per field change)
 * - Tracks attendance, payouts, additional payments, and rate changes
 * - Minimal storage footprint
 * - Easy querying and filtering
 * - Clear change categorization
 * - Support for array and number field types
 */

const mongoose = require('mongoose');

// Schema for individual field changes with detailed tracking
const OptimizedChangeTrackingSchema = new mongoose.Schema({
    // Basic identification
    siteID: {
        type: String,
        required: true,
        index: true
    },
    employeeID: {
        type: String,
        // required: true,
        index: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true,
        min: 2000,
        max: 2100
    },

    // Field details
    field: {
        type: String,
        required: true,
        enum: ['attendance', 'payouts', 'additional_req_pays', 'rate'],
        index: true
    },
    fieldDisplayName: {
        type: String,
        required: true
    },
    fieldType: {
        type: String,
        required: true,
        enum: ['array_string', 'array_object', 'number']
    },

    // Change details (granular tracking)
    changeType: {
        type: String,
        required: true,
        enum: ['added', 'removed', 'modified', 'repositioned'],
        index: true
    },
    changeDescription: {
        type: String,
        required: true
    },

    // Specific change data
    changeData: {
        // What changed from/to
        from: {
            type: mongoose.Schema.Types.Mixed
        },
        to: {
            type: mongoose.Schema.Types.Mixed
        },
        // The actual item (for payment changes)
        item: {
            type: mongoose.Schema.Types.Mixed
        },
        // Which fields changed (for modifications)
        changedFields: [{
            field: String,
            from: mongoose.Schema.Types.Mixed,
            to: mongoose.Schema.Types.Mixed
        }],
        // Attendance position in array
        position: {
            type: Number
        },
        // Attendance value (P, A, P20, etc.)
        attendanceValue: {
            type: String
        },
        // Rate change details (for number fields)
        difference: {
            type: Number
        },
        percentageChange: {
            type: String
        },
        // Date information for attendance changes
        dateInfo: {
            day: Number,
            month: Number,
            year: Number,
            date: Date,
            dateString: String,
            dayName: String,
            isValid: Boolean
        },
        // Quick access fields for frontend
        attendanceDate: {
            type: String
        },
        dayName: {
            type: String
        },
        // Legacy field for backwards compatibility
        date: {
            type: String // Store as string for attendance dates
        }
    },

    // Audit information
    changedBy: {
        type: String,
        required: true,
        index: true
    },
    remark: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Frontend display metadata
    metadata: {
        displayMessage: {
            type: String,
            required: true
        },
        isAttendanceChange: {
            type: Boolean,
            default: false
        },
        isPaymentChange: {
            type: Boolean,
            default: false
        },
        isRateChange: {
            type: Boolean,
            default: false
        },
        updateType: {
            type: String,
            enum: ['attendance-only', 'payments-only', 'rate-only', 'mixed', 'attendance-rate', 'payments-rate', 'comprehensive', 'other', 'unknown'],
            default: 'unknown'
        },
        complexity: {
            type: String,
            enum: ['simple', 'medium', 'high'],
            default: 'simple'
        },
        totalFieldsUpdated: {
            type: Number,
            default: 1
        },
        fieldsUpdated: {
            type: String,
            default: ''
        }
    }
}, {
    timestamps: true,
    collection: 'optimized_change_tracking'
});

// Compound indexes for efficient querying
OptimizedChangeTrackingSchema.index({ siteID: 1, employeeID: 1, field: 1 });
OptimizedChangeTrackingSchema.index({ siteID: 1, field: 1, timestamp: -1 });
OptimizedChangeTrackingSchema.index({ employeeID: 1, timestamp: -1 });
OptimizedChangeTrackingSchema.index({ field: 1, changeType: 1, timestamp: -1 });
OptimizedChangeTrackingSchema.index({ changedBy: 1, timestamp: -1 });

// Virtual for period identification
OptimizedChangeTrackingSchema.virtual('period').get(function () {
    return `${this.month}/${this.year}`;
});

// Virtual for user-friendly change summary
OptimizedChangeTrackingSchema.virtual('changeSummary').get(function () {
    if (this.metadata.isAttendanceChange) {
        return `${this.changeType} attendance for ${this.changeData.date || 'unknown date'}`;
    } else if (this.metadata.isPaymentChange) {
        const item = this.changeData.item || {};
        return `${this.changeType} payment: ₹${item.value || 0} - ${item.remark || 'No remark'}`;
    } else if (this.metadata.isRateChange) {
        const { from, to, difference } = this.changeData;
        return `${this.changeType} rate: ₹${from || 0} → ₹${to || 0} (${difference > 0 ? '+' : ''}₹${difference || 0})`;
    }
    return `${this.changeType} ${this.field}`;
});

// Static method to get field statistics with detailed breakdown
OptimizedChangeTrackingSchema.statics.getFieldStatistics = function (filters = {}) {
    const matchStage = { ...filters };

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    field: '$field',
                    changeType: '$changeType'
                },
                count: { $sum: 1 },
                uniqueEmployees: { $addToSet: '$employeeID' },
                lastChanged: { $max: '$timestamp' },
                firstChanged: { $min: '$timestamp' }
            }
        },
        {
            $group: {
                _id: '$_id.field',
                totalChanges: { $sum: '$count' },
                changeTypes: {
                    $push: {
                        type: '$_id.changeType',
                        count: '$count'
                    }
                },
                uniqueEmployees: { $first: '$uniqueEmployees' },
                lastChanged: { $max: '$lastChanged' },
                firstChanged: { $min: '$firstChanged' }
            }
        },
        {
            $project: {
                field: '$_id',
                totalChanges: 1,
                changeTypeBreakdown: '$changeTypes',
                uniqueEmployeeCount: { $size: '$uniqueEmployees' },
                lastChanged: 1,
                firstChanged: 1
            }
        },
        { $sort: { totalChanges: -1 } }
    ]);
};

// Static method to get recent changes with display messages
OptimizedChangeTrackingSchema.statics.getRecentChanges = function (limit = 50, siteID = null) {
    const matchStage = {};
    if (siteID) matchStage.siteID = siteID;

    return this.find(matchStage)
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('employeeID siteID field changeType changeDescription metadata.displayMessage changedBy timestamp remark')
        .lean();
};

// Instance method to get detailed change summary
OptimizedChangeTrackingSchema.methods.getDetailedChangeSummary = function () {
    return {
        field: this.field,
        changeType: this.changeType,
        description: this.changeDescription,
        displayMessage: this.metadata.displayMessage,
        period: this.period,
        timestamp: this.timestamp,
        changedBy: this.changedBy,
        isAttendanceChange: this.metadata.isAttendanceChange,
        isPaymentChange: this.metadata.isPaymentChange,
        isRateChange: this.metadata.isRateChange,
        specificData: {
            date: this.changeData.date,
            item: this.changeData.item,
            changedFields: this.changeData.changedFields,
            from: this.changeData.from,
            to: this.changeData.to,
            difference: this.changeData.difference,
            percentageChange: this.changeData.percentageChange
        }
    };
};

// Pre-save middleware (removed automatic calculation since we're doing granular tracking)
OptimizedChangeTrackingSchema.pre('save', function (next) {
    // Ensure display message is set
    if (!this.metadata.displayMessage) {
        this.metadata.displayMessage = this.changeDescription || `${this.changeType} ${this.field}`;
    }
    next();
});

const OptimizedChangeTracking = mongoose.model('OptimizedChangeTracking', OptimizedChangeTrackingSchema);

module.exports = OptimizedChangeTracking;

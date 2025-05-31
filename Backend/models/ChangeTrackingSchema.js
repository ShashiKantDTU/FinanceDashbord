const mongoose = require('mongoose');

// Schema for individual field changes
const FieldChangeSchema = new mongoose.Schema({
    fieldPath: {
        type: String,
        required: true,
        description: "The dot-notation path to the changed field (e.g., 'employee.carry_forwarded.value')"
    },
    changeType: {
        type: String,
        enum: ['ADDED', 'MODIFIED', 'REMOVED'],
        required: true
    },
    oldValue: {
        type: mongoose.Schema.Types.Mixed,
        description: "The previous value of the field"
    },
    newValue: {
        type: mongoose.Schema.Types.Mixed,
        description: "The new value of the field"
    },
    oldType: {
        type: String,
        description: "Data type description of the old value"
    },
    newType: {
        type: String,
        description: "Data type description of the new value"
    },
    oldDisplay: {
        type: String,
        description: "Human-readable format of old value"
    },
    newDisplay: {
        type: String,
        description: "Human-readable format of new value"
    }
}, { _id: false });

// Main change tracking schema
const ChangeTrackingSchema = new mongoose.Schema({    // Serial number for easy frontend tracking
    serialNumber: {
        type: Number,
        unique: true,
        required: true,
        description: "Auto-incrementing serial number for frontend display"
    },
    
    // Employee and site information
    siteID: {
        type: String,
        required: true,
        index: true
    },
    employeeID: {
        type: String,
        required: true,
        index: true
    },
    
    // Correction period information
    correctionMonth: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    correctionYear: {
        type: Number,
        required: true,
        min: 2000
    },
    
    // Who made the changes and when
    correctedBy: {
        type: String,
        required: true,
        description: "User ID or name who made the correction"
    },
    correctionDate: {
        type: Date,
        required: true,
        description: "When the correction was made"
    },
    
    // Additional context
    remark: {
        type: String,
        required: true,
        description: "Reason or description for the change"
    },
    
    // Change summary for quick overview
    summary: {
        totalChanges: {
            type: Number,
            default: 0
        },
        fieldsAdded: {
            type: Number,
            default: 0
        },
        fieldsModified: {
            type: Number,
            default: 0
        },
        fieldsRemoved: {
            type: Number,
            default: 0
        }
    },
    
    // Detailed changes array
    changes: [FieldChangeSchema],
    
    // System metadata
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // For data integrity and audit
    originalDataChecksum: {
        type: String,
        description: "Hash of original data for integrity verification"
    },
    newDataChecksum: {
        type: String,
        description: "Hash of new data for integrity verification"
    },
    
    // Processing status
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSED', 'VERIFIED', 'FAILED'],
        default: 'PROCESSED'
    },
    
    // Additional metadata for advanced tracking
    metadata: {
        ipAddress: String,
        userAgent: String,
        sessionId: String,
        applicationVersion: String,
        processingTime: Number // milliseconds
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt
    collection: 'change_tracking'
});

// Indexes for better query performance
ChangeTrackingSchema.index({ siteID: 1, employeeID: 1 });
ChangeTrackingSchema.index({ correctionYear: 1, correctionMonth: 1 });
ChangeTrackingSchema.index({ correctedBy: 1 });
ChangeTrackingSchema.index({ timestamp: -1 });
// Note: serialNumber index is automatically created by unique: true

// Compound indexes for common queries
ChangeTrackingSchema.index({ 
    siteID: 1, 
    employeeID: 1, 
    correctionYear: -1, 
    correctionMonth: -1 
});

// Pre-save middleware for additional validations
ChangeTrackingSchema.pre('save', async function(next) {
    // Ensure serialNumber is always set before saving
    if (!this.serialNumber) {
        return next(new Error('Serial number must be provided'));
    }
    next();
});

// Instance methods
ChangeTrackingSchema.methods.getFormattedSummary = function() {
    return `${this.summary.totalChanges} changes: ${this.summary.fieldsAdded} added, ${this.summary.fieldsModified} modified, ${this.summary.fieldsRemoved} removed`;
};

ChangeTrackingSchema.methods.getChangesByType = function(changeType) {
    return this.changes.filter(change => change.changeType === changeType);
};

// Static methods for querying
ChangeTrackingSchema.statics.findByEmployee = function(siteID, employeeID, options = {}) {
    const query = { siteID, employeeID };
    
    if (options.fromDate) query.correctionDate = { $gte: options.fromDate };
    if (options.toDate) query.correctionDate = { ...query.correctionDate, $lte: options.toDate };
    if (options.year) query.correctionYear = options.year;
    if (options.month) query.correctionMonth = options.month;
    
    return this.find(query).sort({ serialNumber: -1 });
};

ChangeTrackingSchema.statics.getChangeStatistics = function(filters = {}) {
    const pipeline = [
        { $match: filters },
        {
            $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                totalChanges: { $sum: '$summary.totalChanges' },
                totalAdded: { $sum: '$summary.fieldsAdded' },
                totalModified: { $sum: '$summary.fieldsModified' },
                totalRemoved: { $sum: '$summary.fieldsRemoved' },
                uniqueEmployees: { $addToSet: '$employeeID' },
                uniqueSites: { $addToSet: '$siteID' }
            }
        },
        {
            $project: {
                _id: 0,
                totalRecords: 1,
                totalChanges: 1,
                totalAdded: 1,
                totalModified: 1,
                totalRemoved: 1,
                uniqueEmployeeCount: { $size: '$uniqueEmployees' },
                uniqueSiteCount: { $size: '$uniqueSites' }
            }
        }
    ];
    
    return this.aggregate(pipeline);
};

// Virtual for formatted date
ChangeTrackingSchema.virtual('formattedDate').get(function() {
    return this.correctionDate.toLocaleDateString() + ' ' + this.correctionDate.toLocaleTimeString();
});

// Virtual for period string
ChangeTrackingSchema.virtual('periodString').get(function() {
    return `${this.correctionMonth}/${this.correctionYear}`;
});

// Ensure virtual fields are serialized
ChangeTrackingSchema.set('toJSON', { virtuals: true });
ChangeTrackingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ChangeTracking', ChangeTrackingSchema);

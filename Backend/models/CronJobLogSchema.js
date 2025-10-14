const mongoose = require('mongoose');
const { logConnection } = require('../config/logDatabase');

const cronJobLogSchema = new mongoose.Schema({
    jobName: {
        type: String,
        required: true,
        enum: ['weekly-week1', 'weekly-week2', 'weekly-week3', 'weekly-week4', 'weekly-feb28', 'monthly']
    },
    executionDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    status: {
        type: String,
        required: true,
        enum: ['started', 'completed', 'failed']
    },
    totalUsers: {
        type: Number,
        default: 0
    },
    totalSites: {
        type: Number,
        default: 0
    },
    successCount: {
        type: Number,
        default: 0
    },
    failureCount: {
        type: Number,
        default: 0
    },
    skippedCount: {
        type: Number,
        default: 0
    },
    // Detailed success logs
    successfulReports: [{
        userName: String,
        phoneNumber: String,
        siteId: String,
        siteName: String,
        timestamp: Date
    }],
    // Detailed skipped logs
    skippedReports: [{
        userName: String,
        phoneNumber: String,
        siteId: String,
        siteName: String,
        reason: String,
        timestamp: Date
    }],
    // Detailed failure logs
    failures: [{
        userName: String,
        phoneNumber: String,
        siteId: String,
        siteName: String,
        error: String,
        timestamp: Date
    }],
    // User-wise summary
    userSummary: [{
        userName: String,
        phoneNumber: String,
        totalSites: Number,
        successfulSites: Number,
        failedSites: Number,
        skippedSites: Number
    }],
    executionTime: {
        type: Number, // in milliseconds
        default: 0
    },
    completedAt: {
        type: Date
    },
    metadata: {
        month: Number,
        year: Number,
        weekNumber: Number
    }
}, {
    timestamps: true
});

// Index for faster queries
cronJobLogSchema.index({ executionDate: -1 });
cronJobLogSchema.index({ jobName: 1, executionDate: -1 });
cronJobLogSchema.index({ status: 1, executionDate: -1 });

// Use logging database connection if available, otherwise use default
const CronJobLog = logConnection 
    ? logConnection.model('CronJobLog', cronJobLogSchema)
    : mongoose.model('CronJobLog', cronJobLogSchema);

module.exports = CronJobLog;

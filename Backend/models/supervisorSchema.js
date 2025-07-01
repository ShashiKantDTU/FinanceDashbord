const mongoose = require('mongoose');
const supervisorSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    profileName: {
        type: String,
        required: true,
    },
    permissions: {
        type: Map,
        of: Boolean,
        default: {}
    },
    site: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Site'
    }],
    createdBy: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
}, {
    timestamps: true
});

// Function to get latest serial for unique credentials generation
const fetchLatestSupervisorSerial = async () => {
    try {
        // Count total number of supervisors to generate next serial number
        const supervisorCount = await mongoose.model('Supervisor').countDocuments();
        return supervisorCount + 1; // Return next serial number
    } catch (error) {
        console.error('Error fetching supervisor serial:', error);
        return 1; // Return 1 if error occurs (first supervisor)
    }
};

// Function to generate a 6-digit numeric password
const generateSixDigitPassword = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
    Supervisor: mongoose.model('Supervisor', supervisorSchema),
    fetchLatestSupervisorSerial,
    generateSixDigitPassword
};
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

// Function to get latest serial for unique credentials generation based on supervisor name
const fetchLatestSupervisorSerial = async (supervisorCleanName) => {
    try {
        // Validate input
        if (!supervisorCleanName || typeof supervisorCleanName !== 'string') {
            throw new Error('Supervisor clean name is required and must be a string');
        }

        // Find all supervisors with userIds that start with the clean name
        const pattern = new RegExp(`^${supervisorCleanName}\\d*@`, 'i');
        const existingSupervisors = await mongoose.model('Supervisor').find({
            userId: { $regex: pattern }
        }).select('userId');

        if (existingSupervisors.length === 0) {
            return 1; // First supervisor with this name
        }

        // Extract serial numbers from existing userIds
        const serialNumbers = existingSupervisors.map(supervisor => {
            const match = supervisor.userId.match(new RegExp(`^${supervisorCleanName}(\\d*)@`, 'i'));
            if (match && match[1]) {
                return parseInt(match[1], 10);
            }
            return 1; // If no number found, it's the first one
        }).filter(num => !isNaN(num));

        // Find the highest serial number and return next one
        const maxSerial = Math.max(...serialNumbers);
        return maxSerial + 1;
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
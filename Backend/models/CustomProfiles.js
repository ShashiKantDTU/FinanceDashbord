const mongoose = require('mongoose');
const customProfileSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
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
    createdBy: {
        type: String,
        required: true
    },
}, {
    timestamps: true
});
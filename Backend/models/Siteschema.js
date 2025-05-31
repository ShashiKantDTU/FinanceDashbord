const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
    sitename: {
        type: String,
        required: true,
        trim: true
    },
    CustomProfile: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomProfile'
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdBy: {
        type: String,  // Email of creator
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Site', siteSchema);
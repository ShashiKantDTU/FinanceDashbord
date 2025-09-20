const express = require('express');

const router = express.Router();

// Example GET route
// This can be expanded with more service-related endpoints
router.get('/istruecalleravailable', (req, res) => {
    console.log('Truecaller availability check requested');
    res.status(307).json({ message: 'Truecaller is not available' });
});

module.exports = router;
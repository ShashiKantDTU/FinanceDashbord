const express = require('express');

const router = express.Router();

// Example GET route
// This can be expanded with more service-related endpoints
router.get('/istruecalleravailable', (req, res) => {
    console.log('Truecaller availability check requested');
    res.status(200).json({ message: 'Truecaller is available' });
});

module.exports = router;

// send 307 to hide true caller from app
// send 200 to show truecaller 
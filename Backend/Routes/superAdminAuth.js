const express = require('express');
const router = express.Router();
const { 
    generateSuperAdminToken, 
    verifySuperAdminCredentials,
    authenticateSuperAdmin,
    generatePasswordHash
} = require('../Middleware/superAdminAuth');

/**
 * Super Admin Authentication Routes
 * 
 * These routes handle login/logout for the internal admin panel.
 * Completely separate from regular user authentication.
 */

// POST /api/super-admin/login
// Login endpoint for super admin
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // Verify credentials
        const isValid = await verifySuperAdminCredentials(username, password);

        if (!isValid) {
            // Don't reveal whether username or password was wrong
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate token
        const token = generateSuperAdminToken(username);

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            expiresIn: '24h'
        });

    } catch (error) {
        console.error('Super admin login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please contact system administrator.'
        });
    }
});

// GET /api/super-admin/verify
// Verify if current token is valid
router.get('/verify', authenticateSuperAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid',
        admin: {
            username: req.superAdmin.username,
            role: req.superAdmin.role
        }
    });
});

// POST /api/super-admin/logout
// Logout endpoint (client-side should delete token)
router.post('/logout', authenticateSuperAdmin, (req, res) => {
    // With JWT, logout is handled client-side by deleting the token
    // This endpoint just confirms the action
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// GET /api/super-admin/health
// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
    const isConfigured = !!(
        process.env.SUPER_ADMIN_USERNAME && 
        process.env.SUPER_ADMIN_PASSWORD_HASH && 
        process.env.SUPER_ADMIN_JWT_SECRET
    );

    res.json({
        success: true,
        configured: isConfigured,
        message: isConfigured 
            ? 'Super admin system is configured' 
            : 'Super admin system needs configuration'
    });
});

// ==========================================
// SETUP HELPER ENDPOINT (REMOVE IN PRODUCTION)
// ==========================================
// This endpoint helps generate password hash for initial setup
// IMPORTANT: Remove or disable this in production!
// router.post('/generate-hash', async (req, res) => {
//     // Only allow in development mode
//     if (process.env.NODE_ENV === 'production') {
//         return res.status(404).json({ error: 'Not found' });
//     }

//     try {
//         const { password } = req.body;

//         if (!password) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Password is required'
//             });
//         }

//         const hash = await generatePasswordHash(password);

//         res.json({
//             success: true,
//             message: 'Password hash generated. Add this to your .env file as SUPER_ADMIN_PASSWORD_HASH',
//             hash: hash,
//             instructions: [
//                 '1. Copy the hash above',
//                 '2. Add to .env: SUPER_ADMIN_PASSWORD_HASH=<hash>',
//                 '3. Add to .env: SUPER_ADMIN_USERNAME=<your_username>',
//                 '4. Add to .env: SUPER_ADMIN_JWT_SECRET=<random_secret>',
//                 '5. Restart the server',
//                 '6. IMPORTANT: Remove this /generate-hash endpoint in production!'
//             ]
//         });

//     } catch (error) {
//         console.error('Hash generation error:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to generate hash'
//         });
//     }
// });

module.exports = router;

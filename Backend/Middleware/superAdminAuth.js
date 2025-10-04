const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Super Admin Authentication Middleware
 * 
 * This is a separate authentication system for internal admin panels.
 * It does NOT use the regular user database - credentials are stored in environment variables.
 * 
 * Required Environment Variables:
 * - SUPER_ADMIN_USERNAME: The admin username
 * - SUPER_ADMIN_PASSWORD_HASH: Bcrypt hash of the admin password
 * - SUPER_ADMIN_JWT_SECRET: Separate JWT secret for super admin tokens
 * 
 * Usage:
 * 1. Login via /api/super-admin/login with username/password
 * 2. Receive JWT token
 * 3. Use token in Authorization header for protected routes
 */

// Verify super admin JWT token
const authenticateSuperAdmin = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                error: 'Access denied. No token provided.' 
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Access denied. Invalid token format.' 
            });
        }

        // Verify token using separate super admin secret
        const secret = process.env.SUPER_ADMIN_JWT_SECRET;
        
        if (!secret) {
            console.error('CRITICAL: SUPER_ADMIN_JWT_SECRET not configured');
            return res.status(500).json({ 
                success: false,
                error: 'Server configuration error' 
            });
        }

        const decoded = jwt.verify(token, secret);
        
        // Verify this is a super admin token
        if (decoded.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ 
                success: false,
                error: 'Access denied. Insufficient permissions.' 
            });
        }

        // Attach super admin info to request
        req.superAdmin = {
            username: decoded.username,
            role: decoded.role,
            loginTime: decoded.iat
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                error: 'Token expired. Please login again.' 
            });
        }

        console.error('Super admin authentication error:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Authentication error' 
        });
    }
};

// Generate super admin JWT token
const generateSuperAdminToken = (username) => {
    const secret = process.env.SUPER_ADMIN_JWT_SECRET;
    
    if (!secret) {
        throw new Error('SUPER_ADMIN_JWT_SECRET not configured');
    }

    return jwt.sign(
        {
            username: username,
            role: 'SUPER_ADMIN',
            tokenType: 'super_admin_access'
        },
        secret,
        { 
            expiresIn: '24h' // Token valid for 24 hours
        }
    );
};

// Verify super admin credentials
const verifySuperAdminCredentials = async (username, password) => {
    const envUsername = process.env.SUPER_ADMIN_USERNAME;
    const envPasswordHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

    if (!envUsername || !envPasswordHash) {
        throw new Error('Super admin credentials not configured in environment variables');
    }

    // Check username match
    if (username !== envUsername) {
        return false;
    }

    // Verify password against hash
    const isValid = await bcrypt.compare(password, envPasswordHash);
    return isValid;
};

// Helper function to generate password hash (for initial setup)
const generatePasswordHash = async (password) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
};

module.exports = {
    authenticateSuperAdmin,
    generateSuperAdminToken,
    verifySuperAdminCredentials,
    generatePasswordHash
};

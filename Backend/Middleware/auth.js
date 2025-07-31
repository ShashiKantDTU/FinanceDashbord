const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { fetchLatestSupervisorSerial, generateSixDigitPassword } = require('../models/supervisorSchema');
const { Supervisor } = require('../models/supervisorSchema');
const User = require('../models/Userschema')
// Middleware to authenticate user using JWT
const authenticateToken = async (req, res, next) => {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Check if token exists
    if (!token) {
        return res.status(401).json({
            error: 'Access denied. No token provided.'
        });
    }

    try {
        // Verify token
        const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user information to request object
        req.user = decoded;

        if (req.user && req.user._id && req.user._id.toString() === '683b167e47f3087645d8ba7f') {
            req.user.calculationType = 'special'
        } else {
            if (req.user.role !== 'Supervisor') {
                req.user.calculationType = 'normal'
            }
        }

        // Attach plan information for all users
        if (decoded.role === 'Supervisor') {
            // check if the supervisor is active
            const supervisor = await Supervisor.findOne({ userId: decoded.email });
            if (!supervisor || supervisor.status !== 'active') {
                return res.status(403).json({
                    error: 'Access denied. Supervisor account is inactive.'
                });
            }

            // add plan info from User to supervisor requests
            const user = await User.findById(supervisor.owner._id)
            req.user.plan = user.plan
            req.user.planExpiresAt = user.planExpiresAt
            if (!user.plan || user.plan === null || user.plan === undefined) {
                // find owner using siteid in supervisor
                const owner = await User.findOne({ site: supervisor.site })
                req.user.plan = owner.plan
                req.user.planExpiresAt = owner.planExpiresAt
            }

            // if special user superviosr request 
            // then calculationType is special

            if (user && user._id && supervisor.owner._id.toString() === '683b167e47f3087645d8ba7f') {
                req.user.calculationType = 'special'
            } else {
                req.user.calculationType = 'normal'
            }
        } else {
            // For regular Admin users, fetch plan information from database
            try {
                const user = await User.findById(decoded.id);
                if (user) {
                    req.user.plan = user.plan || 'free';
                    req.user.planExpiresAt = user.planExpiresAt;
                } else {
                    // Fallback to free plan if user not found
                    req.user.plan = 'free';
                    req.user.planExpiresAt = null;
                }
            } catch (dbError) {
                console.warn('Failed to fetch user plan information:', dbError.message);
                // Fallback to free plan on database error
                req.user.plan = 'free';
                req.user.planExpiresAt = null;
            }
        }

        // Continue to next middleware/route handler
        next();
    } catch (error) {
        // Token is invalid
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired. Please login again.'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token.'
            });
        } else {
            return res.status(401).json({
                error: 'Token verification failed.'
            });
        }
    }
};

// Optional: Middleware to check for specific roles
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Access denied. Authentication required.'
            });
        }

        if (roles && roles.length > 0) {
            const hasRole = roles.includes(req.user.role);
            if (!hasRole) {
                return res.status(403).json({
                    error: 'Access denied. Insufficient permissions.'
                });
            }
        }

        next();
    };
};

// Helper function to generate Supervisor credentials
const generateSupervisorCredentials = async (name) => {
    try {
        // Validate name input
        if (!name || typeof name !== 'string') {
            throw new Error('Name is required and must be a string');
        }

        // Generate a clean name for username generation
        const cleanName = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

        // Get the next serial number for unique username generation based on clean name
        const serial = await fetchLatestSupervisorSerial(cleanName);

        // Generate a unique username based on the user's name and serial
        const username = `${cleanName}${serial}@sitehaazri.in`;

        // Generate a 6-digit numeric password
        const password = generateSixDigitPassword();

        const credentials = {
            username: username,
            password: password,
        };

        // Return the credentials object
        return {
            ...credentials
        };
    } catch (error) {
        console.error('Error generating supervisor credentials:', error);
        throw error;
    }
};

// Helper function to generate JWT token
const generateToken = (payload, expiresIn = '7d') => {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Helper function to hash passwords
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

// Helper function to compare passwords
const comparePassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
    authenticateToken,
    authorizeRole,
    generateToken,
    hashPassword,
    comparePassword,
    generateSupervisorCredentials
};



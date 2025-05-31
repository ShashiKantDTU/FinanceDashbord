const express = require('express');
const User = require('../models/Userschema');
const { 
    authenticateToken, 
    generateToken, 
    hashPassword, 
    comparePassword 
} = require('../Middleware/auth');

const router = express.Router();

// Register route

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Error checking user existence', error });
    }    try {
        // Hash the password
        const hashedPassword = await hashPassword(password);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        // Save user to database
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
}
);

// Login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }        // Compare passwords
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Generate JWT token with user information
        const token = generateToken({ 
            id: user._id, 
            email: user.email,
            name: user.name 
        });

        res.status(200).json({ 
            message: 'Login successful', 
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error });
    }
}
);

// Forgot password route
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(200).json({ 
                message: 'If an account with that email exists, password reset instructions have been sent.' 
            });
        }

        // For now, just return a success message
        // TODO: Implement actual email sending with reset token
        res.status(200).json({ 
            message: 'Password reset instructions have been sent to your email.' 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error processing password reset request', error });
    }
});

// Protected route - Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        // The user information is already attached to req.user by the middleware
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ 
            message: 'Profile retrieved successfully', 
            user 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving profile', error });
    }
});

// Protected route - Verify token
router.get('/verify', authenticateToken, (req, res) => {
    // If we reach here, the token is valid
    res.status(200).json({ 
        message: 'Token is valid', 
        user: req.user 
    });
});

module.exports = router;
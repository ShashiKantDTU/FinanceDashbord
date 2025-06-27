const express = require("express");
const crypto = require("crypto");
const User = require("../models/Userschema");
const {
  authenticateToken,
  generateToken,
  hashPassword,
  comparePassword,
} = require("../Middleware/auth");
const { sendPasswordResetEmail } = require("../Utils/emailService");



const router = express.Router();



// Register route

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error checking user existence", error });
  }
  try {
    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    // Save user to database
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    } // Compare passwords
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT token with user information
    const token = generateToken({
      id: user._id,
      email: user.email,
      name: user.name,
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
});

// Forgot password route
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Validate email input
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        message: "If an account with that email exists, password reset instructions have been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.name);
      
      res.status(200).json({
        message: "Password reset instructions have been sent to your email.",
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Clear the reset token if email fails
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      
      return res.status(500).json({
        message: "Failed to send reset email. Please try again later.",
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      message: "Error processing password reset request", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Reset password route
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  try {
    // Validate input
    if (!token || !password) {
      return res.status(400).json({ 
        message: "Reset token and new password are required" 
      });
    }

    if (password.length < 4) {
      return res.status(400).json({ 
        message: "Password must be at least 4 characters long" 
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: "Invalid or expired reset token" 
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      message: "Password has been successfully reset. You can now log in with your new password.",
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      message: "Error resetting password", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Protected route - Get user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    // The user information is already attached to req.user by the middleware
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile retrieved successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving profile", error });
  }
});

// Protected route - Verify token
router.get("/verify", authenticateToken, (req, res) => {
  // If we reach here, the token is valid
  res.status(200).json({
    message: "Token is valid",
    user: req.user,
  });
});

// Test email endpoint (for debugging only - remove in production)
router.post("/test-email", async (req, res) => {
  const { testEmail } = req.body;
  
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: "Endpoint not available in production" });
  }

  try {
    const { sendPasswordResetEmail } = require("../Utils/emailService");
    
    // Generate a test token
    const testToken = "test-token-123";
    
    await sendPasswordResetEmail(testEmail || "test@example.com", testToken, "Test User");
    
    res.status(200).json({
      message: "Test email sent successfully",
      note: "Check your email inbox"
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      message: "Failed to send test email",
      error: error.message,
      details: {
        code: error.code,
        response: error.response
      }
    });
  }
});

module.exports = router;

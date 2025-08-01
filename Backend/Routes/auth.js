const express = require("express");
const admin = require('./firebase')
const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/Userschema");
const { Supervisor } = require("../models/supervisorSchema");
const Site = require("../models/Siteschema");
const {
  authenticateToken,
  generateToken,
  hashPassword,
  comparePassword,
  generateSupervisorCredentials,
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


// OTP login route

router.post ("/otplogin", async (req, res) => {
  // check if ID token is provided in req Body
  console.log("OTP login route hit");
  const {token: firebaseIdToken} = req.body;
  if (!firebaseIdToken) {
    return res.status(400).json({ message: "ID token is required" });
  }
  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const firebaseUid = decodedToken.uid;
    const phoneNumber = decodedToken.phone_number;
    console.log(`Firebase UID: ${firebaseUid}`);
    console.log(`Phone number: ${phoneNumber}`);
    // Find user in MongoDB by phone number only
    let user = await User.findOne({ phoneNumber: phoneNumber });
    
    if (!user) {
      // Create user if doesn't exist (auto-registration)
      user = new User({
        name: phoneNumber,
        uid : firebaseUid,
        phoneNumber: phoneNumber,
      });
      await user.save();
      // console.log(`New mobile user created: ${firebaseUid}`);
    }
    
    // Generate JWT token for your app
    const jwtToken = generateToken({
      id: user._id,
      name: user.name,
      role: "Admin",
    });
    // console.log(`JWT token generated for user in mobile otp route: ${user._id}`);
    return res.status(200).json({
      message: "OTP login successful",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        role: "Admin",
      },
    });
  } catch (error) {
    console.error("OTP login error:", error);
    return res.status(401).json({ message: "Invalid or expired ID token", error: error.message });
  }
})


// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (user) {
      // Compare passwords
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Generate JWT token with user information
      const token = generateToken({
        id: user._id,
        email: user.email,
        name: user.name,
        role: "Admin",
      });

      res.status(200).json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          role: "Admin",
        },
      });
    } else {
      const existingSupervisor = await Supervisor.findOne({ userId: email });
      if (existingSupervisor) {
        // Compare passwords simply from database for supervisor
        if (existingSupervisor.password === password) {
          // Generate JWT token with supervisor information
          const token = generateToken({
            id: existingSupervisor._id,
            email: existingSupervisor.userId,
            name: existingSupervisor.profileName,
            role: "Supervisor",
            site: existingSupervisor.site,
          });

          // Get site name from Site model
          const site = await Site.findById(existingSupervisor.site);
          if (!site) {
            return res.status(404).json({ message: "Contact your contractor" });
          }
          

          // console.log("Supervisor login successful:", existingSupervisor.site[0].toString());

          
          res.status(200).json({
            message: "Login successful",
            token,
            user: {
              id: existingSupervisor._id,
              name: existingSupervisor.profileName,
              role: "Supervisor",
              siteid: existingSupervisor.site[0],
              siteName: site.sitename,
            },
          });
        }
      } else {
        return res.status(400).json({ message: "Invalid email or password" });
      }
    }
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
        message:
          "If an account with that email exists, password reset instructions have been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
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
      console.error("Email sending failed:", emailError);

      // Clear the reset token if email fails
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      return res.status(500).json({
        message: "Failed to send reset email. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      message: "Error processing password reset request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
        message: "Reset token and new password are required",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        message: "Password must be at least 4 characters long",
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
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
      message:
        "Password has been successfully reset. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Error resetting password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Protected route - Get user profile
router.get("/profile/:siteId?", authenticateToken, async (req, res) => {
  // console.log("params:", req.params);
  try {
    // Check if siteId is provided in the params
    if (!req.params.siteId) {
      // The user information is already attached to req.user by the middleware
      const user = await User.findById(req.user.id)
        .select("-password")
        .populate("supervisors"); // Populate supervisor details

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({
        message: "Profile retrieved successfully",
        user,
      });
    } else {
      // If siteId is provided, populate user with only that site's supervisors
      const siteId = req.params.siteId;
      // console.log("Fetching profile for site:", siteId);
      const user = await User.findById(req.user.id)
        .select("-password")
        .populate({
          path: "supervisors",
          match: { site: siteId },
        });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({
        message: "Profile retrieved successfully",
        user,
      });
    }
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



//  supervisor credentials route
router.post(
  "/supervisor-credentials/create",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      // Check if supervisor name is provided
      if (!req.body.name || req.body.name.trim() === "" || !req.body.siteId) {
        return res
          .status(400)
          .json({ message: "Supervisor name and site ID are required" });
      }

      const supervisorName = req.body.name;
      const siteId = req.body.siteId;

      // Check if siteId is valid
      const site = await Site.findById(siteId);
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
      }

      // Find user by ID
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate supervisor credentials
      const credentials = await generateSupervisorCredentials(supervisorName);

      // add the supervisor to database
      const newSupervisor = new Supervisor({
        userId: credentials.username,
        password: credentials.password,
        profileName: supervisorName,
        createdBy: user.name,
        site: siteId,
        owner:  user
      });

      await newSupervisor.save();

      // add this credentials to the user
      user.supervisors.push(newSupervisor);
      await user.save();

      res.status(201).json({
        message: "Supervisor credentials created successfully",
        supervisor: newSupervisor,
      });
    } catch (error) {
      console.error("Error fetching supervisor credentials:", error);
      res
        .status(500)
        .json({ message: "Error fetching supervisor credentials", error });
    }
  }
);

// add a detailed comment to explain the delete route explaining how to use it in frontend
// This route allows an admin user to delete a supervisor's credentials.
// To use this route from the frontend, send a DELETE request to /supervisor-credentials/delete/
// with the supervisor's ID in the request body, like this:
// {
//   "supervisor": {
//     "userId": "supervisor_id_here"
//   }
// }

router.delete(
  "/supervisor-credentials/delete/",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Find supervisor by ID first (don't delete yet)
      const supervisor = await Supervisor.findOne({
        userId: req.body.supervisor.userId,
      });
      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Find the user to check if they have permission to delete this supervisor
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if Admin has permission to delete this supervisor
      const hasPermission = user.supervisors.some(
        (sup) => sup._id.toString() === supervisor._id.toString()
      );
      if (!hasPermission) {
        return res.status(403).json({
          message:
            "Forbidden - You don't have permission to delete this supervisor",
        });
      }

      // Now delete the supervisor
      await Supervisor.findOneAndDelete({ userId: req.body.supervisor.userId });

      // Remove supervisor from user's list
      if (user) {
        user.supervisors.pull(supervisor._id);
        await user.save();
      }
      // Return success response

      res.status(200).json({
        message: "Supervisor credentials deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting supervisor credentials:", error);
      res.status(500).json({
        message: "Error deleting supervisor credentials",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Change supervisor password route

// userId is the unique identifier for the supervisor whose password needs to be changed
// This route allows an admin user to change a supervisor's password.
// put the userId in the request body like this:
// // {
//   "supervisor": {
//     "userId": "supervisor_id_here"
//   }
// }

router.post(
  "/supervisor-credentials/change-password",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const userId = req.body.supervisor?.userId;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Find supervisor by userId
      const supervisor = await Supervisor.findOne({ userId });
      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Find the user to check if they have permission to change this supervisor's password
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if Admin has permission to change this supervisor's password
      const hasPermission = user.supervisors.some(
        (sup) => sup._id.toString() === supervisor._id.toString()
      );
      if (!hasPermission) {
        return res.status(403).json({
          message:
            "Forbidden - You don't have permission to modify this supervisor",
        });
      }

      // Generate a new 6 digit numeric password
      const newPassword = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      // Update supervisor password
      supervisor.password = newPassword;
      await supervisor.save();

      res.status(200).json({
        message: "Supervisor password changed successfully",
        newPassword,
      });
    } catch (error) {
      console.error("Error changing supervisor password:", error);
      res.status(500).json({
        message: "Error changing supervisor password",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Toggle supervisor status route
// This route allows an admin user to toggle a supervisor's status between active and inactive.
router.post(
  "/supervisor-credentials/toggle-status",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user is authenticated
      if (
        !req.user ||
        !req.user.id ||
        !req.user.role ||
        req.user.role !== "Admin"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const userId = req.body.supervisor?.userId;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Find supervisor by userId
      const supervisor = await Supervisor.findOne({ userId });
      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Find the user to check if they have permission to toggle this supervisor's status
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if Admin has permission to toggle this supervisor's status
      const hasPermission = user.supervisors.some(
        (sup) => sup._id.toString() === supervisor._id.toString()
      );
      if (!hasPermission) {
        return res.status(403).json({
          message:
            "Forbidden - You don't have permission to modify this supervisor",
        });
      }

      // Toggle status
      supervisor.status =
        supervisor.status === "active" ? "inactive" : "active";
      await supervisor.save();

      res.status(200).json({
        message: `Supervisor status changed to ${supervisor.status}`,
        supervisor,
      });
    } catch (error) {
      console.error("Error toggling supervisor status:", error);
      res.status(500).json({
        message: "Error toggling supervisor status",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Test email endpoint (for debugging only - remove in production)
router.post("/test-email", async (req, res) => {
  const { testEmail } = req.body;

  if (process.env.NODE_ENV === "production") {
    return res
      .status(404)
      .json({ message: "Endpoint not available in production" });
  }

  try {
    const { sendPasswordResetEmail } = require("../Utils/emailService");

    // Generate a test token
    const testToken = "test-token-123";

    await sendPasswordResetEmail(
      testEmail || "test@example.com",
      testToken,
      "Test User"
    );

    res.status(200).json({
      message: "Test email sent successfully",
      note: "Check your email inbox",
    });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      message: "Failed to send test email",
      error: error.message,
      details: {
        code: error.code,
        response: error.response,
      },
    });
  }
});

// Update user name route
router.put("/update-name", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        message: "Name is required and cannot be empty" 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found" 
      });
    }

    user.name = name.trim();
    await user.save();

    res.status(200).json({
      message: "Name updated successfully",
      user: {
        id: user._id,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Error updating name", 
      error: error.message 
    });
  }
});

// Temporary debug route to check users in database (remove in production)
router.get("/debug-users", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(404)
      .json({ message: "Endpoint not available in production" });
  }

  try {
    const users = await User.find({}, "name email uid").limit(10);
    const userCount = await User.countDocuments();

    res.status(200).json({
      message: "Users in database",
      totalUsers: userCount,
      users: users,
    });
  } catch (error) {
    console.error("Debug users error:", error);
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
});

module.exports = router;

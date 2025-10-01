const express = require("express");
const checkInternalAccess = require("../Middleware/checkInternalAccess");
const User = require("../models/Userschema");

const router = express.Router();


router.get("/verifyByPhone", checkInternalAccess, async (req, res) => {
  console.log("Internal API Accessed: Verify User by Phone");
  if (!req.query.phone) {
    console.log("Phone number is required");
    return res.status(400).json({ error: "Phone number is required" });
  }
  const { phone } = req.query;
  const user = await User.findOne({ phoneNumber: phone }).select('createdAt planExpiresAt isTrial');

  if (!user) return res.json({ exists: false });

  return res.json({
    exists: true,
    createdAt: user.createdAt,
    trialExpiryDate: user.planExpiresAt || null
  });
});


module.exports = router;
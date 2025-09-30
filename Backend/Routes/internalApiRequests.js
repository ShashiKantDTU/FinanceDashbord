const express = require("express");
const checkInternalAccess = require("../Middleware/checkInternalAccess");
const User = require("../models/Userschema");

const router = express.Router();


router.get("/internal/verifyByPhone", checkInternalAccess, async (req, res) => {
  const { phone } = req.query;
  const user = await User.findOne({ phone });

  if (!user) return res.json({ exists: false });

  return res.json({
    exists: true,
    createdAt: user.createdAt,
  });
});


module.exports = router;
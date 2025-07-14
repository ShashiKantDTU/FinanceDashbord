const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false, // Optional field
      trim: true,
    },
    email: {
      type: String,
      required: false, // Optional field
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      //   required: true,
      unique: true,
      match: /^\+?[1-9]\d{1,14}$/, // ✅ E.164 format validation
    },
    uid: {
      type: String,
      //   required: true,
      unique: true,
    },
    password: {
      type: String,
      // required: true,
      minlength: 4,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    site: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
      },
    ],
    supervisors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supervisor",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

const siteSchema = new mongoose.Schema(
  {
    sitename: {
      type: String,
      required: true,
      trim: true,
    },
    supervisors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supervisor",
      },
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: String, // Email of creator
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Site", siteSchema);

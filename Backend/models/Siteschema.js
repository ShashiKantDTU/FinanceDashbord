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
    isActive: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: String, // Email of creator
      required: true,
    },
    // 👇 Cached stats for Calculate-on-Write optimization
    // These are updated when employees are added/removed, avoiding expensive aggregations on dashboard
    stats: {
      employeeCount: { type: Number, default: 0 }, // Cached count of current month employees on this site
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Site", siteSchema);

"use strict";

const mongoose = require("mongoose");

const shippingZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Zone name is required"],
      trim: true,
      unique: true,
    }, // e.g. "Inside Dhaka"
    districts: { type: [String], default: [] }, // districts covered by this zone
    charge: {
      type: Number,
      required: [true, "Shipping charge is required"],
      min: [0, "Charge cannot be negative"],
    }, // BDT
    estimatedDays: {
      type: String,
      required: [true, "Estimated delivery days is required"],
      trim: true,
    }, // e.g. "1-2 days"
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

shippingZoneSchema.index({ districts: 1 });
shippingZoneSchema.index({ isActive: 1 });

const ShippingZone = mongoose.model("ShippingZone", shippingZoneSchema);
module.exports = ShippingZone;

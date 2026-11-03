"use strict";

const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: "Nexora Fashions", trim: true },
    storeLogo: { type: String, default: "" },
    storeEmail: {
      type: String,
      default: "info@nexorafashions.com",
      trim: true,
      lowercase: true,
    },
    storePhone: { type: String, default: "", trim: true },
    storeAddress: { type: String, default: "", trim: true },
    currency: { type: String, default: "BDT", trim: true, uppercase: true },
    deliveryChargeInsideDhaka: { type: Number, default: 60, min: 0 },
    deliveryChargeOutsideDhaka: { type: Number, default: 120, min: 0 },
    sslcommerzEnabled: { type: Boolean, default: true },
    codEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false }, // hides storefront from non-admins
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Keep a single settings document.
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

const Settings = mongoose.model("Settings", settingsSchema);
module.exports = Settings;

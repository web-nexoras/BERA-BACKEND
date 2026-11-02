"use strict";

const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    label: {
      type: String,
      enum: {
        values: ["home", "work", "other"],
        message: "Label must be 'home', 'work', or 'other'",
      },
      default: "home",
    },
    recipientName: {
      type: String,
      required: [true, "Recipient name is required"],
      trim: true,
      maxlength: [100, "Recipient name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^(?:\+?880|0)1[3-9]\d{8}$/,
        "Please provide a valid Bangladeshi phone number",
      ],
    },
    addressLine1: {
      type: String,
      required: [true, "Address line 1 is required"],
      trim: true,
      maxlength: [200, "Address line 1 cannot exceed 200 characters"],
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, "Address line 2 cannot exceed 200 characters"],
      default: null,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [100, "City cannot exceed 100 characters"],
    },
    district: {
      type: String,
      required: [true, "District is required"],
      trim: true,
      maxlength: [100, "District cannot exceed 100 characters"],
    },
    division: {
      type: String,
      required: [true, "Division is required"],
      trim: true,
      maxlength: [100, "Division cannot exceed 100 characters"],
    },
    postalCode: {
      type: String,
      required: [true, "Postal code is required"],
      trim: true,
      match: [/^\d{4}$/, "Please provide a valid 4-digit postal code"],
    },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

addressSchema.index({ user: 1, isDefault: 1 });
addressSchema.index({ user: 1, createdAt: -1 });

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;

"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [50, "Coupon code cannot exceed 50 characters"],
    },
    type: {
      type: String,
      enum: {
        values: ["percentage", "fixed"],
        message: 'Coupon type must be either "percentage" or "fixed"',
      },
      required: [true, "Coupon type is required"],
    },
    value: {
      type: Number,
      required: [true, "Coupon value is required"],
      min: [0, "Coupon value cannot be negative"],
    }, // % or BDT amount
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"],
    },
    maximumDiscount: { type: Number, default: null }, // cap for percentage coupons (BDT)
    expiresAt: { type: Date, required: [true, "Expiry date is required"] },
    usageLimit: {
      type: Number,
      default: null,
      min: [1, "Usage limit must be at least 1"],
    }, // null = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    isFirstOrderOnly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    applicableCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }], // empty = all
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }], // empty = all
    usedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true, versionKey: false },
);

couponSchema.index({ isActive: 1, expiresAt: 1 });

// basic validity check — per-user eligibility is handled in service
couponSchema.methods.isValid = function isValid() {
  if (!this.isActive) return false;
  if (new Date() > this.expiresAt) return false;
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit)
    return false;
  return true;
};

couponSchema.statics.findByCode = function findByCode(code) {
  return this.findOne({ code: String(code).toUpperCase().trim() });
};

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;

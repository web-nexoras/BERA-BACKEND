"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

// price, name, image, size, color are snapshotted so display stays accurate after product edits
const cartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },
    variant: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: [true, "Variant reference is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    price: {
      type: Number,
      required: [true, "Price snapshot is required"],
      min: [0, "Price cannot be negative"],
    },
    name: { type: String, trim: true },
    image: { type: String, trim: true },
    size: { type: String, trim: true },
    color: { type: String, trim: true },
  },
  { _id: true },
);

const appliedCouponSchema = new Schema(
  {
    code: { type: String, trim: true, uppercase: true },
    discountAmount: { type: Number, default: 0 },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon" },
  },
  { _id: false },
);

// one cart per user
const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
    },
    items: [cartItemSchema],
    appliedCoupon: { type: appliedCouponSchema, default: null },
  },
  { timestamps: true, versionKey: false },
);

cartSchema.index({ user: 1 });

cartSchema.methods.getTotals = function getTotals() {
  const subtotal = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const discountAmount = this.appliedCoupon
    ? this.appliedCoupon.discountAmount || 0
    : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    itemCount,
  };
};

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;

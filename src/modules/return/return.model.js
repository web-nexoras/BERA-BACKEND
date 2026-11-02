"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

// snapshot of the original order item so return is self-contained
const returnItemSchema = new Schema(
  {
    orderItem: { type: Schema.Types.Mixed, required: true },
    reason: {
      type: String,
      required: [true, "Return reason is required"],
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    quantity: {
      type: Number,
      required: [true, "Return quantity is required"],
      min: [1, "Return quantity must be at least 1"],
    },
  },
  { _id: true },
);

const RETURN_STATUSES = ["requested", "approved", "rejected", "completed"];

const returnSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order reference is required"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    items: {
      type: [returnItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Return request must include at least one item",
      },
    },
    status: {
      type: String,
      enum: { values: RETURN_STATUSES, message: "Invalid return status" },
      default: "requested",
    },
    adminNotes: { type: String, trim: true },
    refundAmount: { type: Number, default: 0, min: 0 }, // BDT, may be partial
    refundMethod: { type: String, trim: true }, // e.g. 'original_payment', 'bank_transfer'
  },
  { timestamps: true, versionKey: false },
);

returnSchema.index({ order: 1 });
returnSchema.index({ user: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

const Return = mongoose.model("Return", returnSchema);
module.exports = Return;

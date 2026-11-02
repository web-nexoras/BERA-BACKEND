"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order reference is required"],
    },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    transactionId: { type: String, trim: true }, // SSLCommerz tran_id or COD reference
    method: {
      type: String,
      enum: {
        values: ["cod", "sslcommerz"],
        message: 'Payment method must be "cod" or "sslcommerz"',
      },
      required: [true, "Payment method is required"],
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: { type: String, default: "BDT", uppercase: true, trim: true },
    status: {
      type: String,
      enum: {
        values: ["pending", "completed", "failed", "cancelled", "refunded"],
        message: "Invalid payment status",
      },
      default: "pending",
    },
    gatewayResponse: { type: Schema.Types.Mixed, default: null }, // raw SSLCommerz IPN/callback payload
    refundAmount: { type: Number, default: 0, min: 0 },
    refundedAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;

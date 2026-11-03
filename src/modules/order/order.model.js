"use strict";

const mongoose = require("mongoose");
const { generateOrderNumber } = require("../../utils/helpers");
const { Schema } = mongoose;

// Snapshot details so the order remains self-contained.
const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    variant: { type: Schema.Types.ObjectId, ref: "ProductVariant" },
    name: { type: String, required: true, trim: true },
    image: { type: String, trim: true },
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    sku: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 }, // quantity × price
  },
  { _id: true },
);

const shippingAddressSchema = new Schema(
  {
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    division: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false },
);

const pricingSchema = new Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },
    shippingCharge: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, trim: true, uppercase: true },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon" },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const shippingInfoSchema = new Schema(
  {
    trackingNumber: { type: String, trim: true },
    carrier: { type: String, trim: true },
    estimatedDelivery: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { _id: false },
);

const statusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    note: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
];
const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partial_refund",
];

const orderSchema = new Schema(
  {
    orderNumber: { type: String, unique: true, trim: true }, // auto-generated NF-YYYY-XXXXXX
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    guestEmail: { type: String, trim: true, lowercase: true },
    guestPhone: { type: String, trim: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Order must contain at least one item",
      },
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    pricing: { type: pricingSchema, required: true },
    paymentMethod: {
      type: String,
      enum: {
        values: ["cod", "sslcommerz"],
        message: 'Payment method must be "cod" or "sslcommerz"',
      },
      required: [true, "Payment method is required"],
    },
    paymentStatus: {
      type: String,
      enum: { values: PAYMENT_STATUSES, message: "Invalid payment status" },
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: { values: ORDER_STATUSES, message: "Invalid order status" },
      default: "pending",
    },
    statusHistory: [statusHistorySchema],
    shipping: { type: shippingInfoSchema, default: () => ({}) },
    notes: { type: String, trim: true }, // customer note at checkout
    adminNotes: { type: String, trim: true }, // internal admin note
    cancelReason: { type: String, trim: true },
    isReturnable: { type: Boolean, default: true },
    returnDeadline: { type: Date }, // deliveredAt + 7 days
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.pre("save", function preSave() {
  if (!this.orderNumber) this.orderNumber = generateOrderNumber();
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;

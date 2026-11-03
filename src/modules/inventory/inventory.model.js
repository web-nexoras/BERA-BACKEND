"use strict";

const mongoose = require("mongoose");

const INVENTORY_TYPES = [
  "purchase",
  "sale",
  "adjustment",
  "return",
  "damaged",
  "initial",
];

const inventoryLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      index: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: [true, "Variant reference is required"],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: INVENTORY_TYPES,
        message: `Type must be one of: ${INVENTORY_TYPES.join(", ")}`,
      },
      required: [true, "Movement type is required"],
    },
    quantity: { type: Number, required: [true, "Quantity is required"] }, // positive=added, negative=removed
    previousStock: {
      type: Number,
      required: [true, "Previous stock value is required"],
      min: [0, "Previous stock cannot be negative"],
    },
    newStock: {
      type: Number,
      required: [true, "New stock value is required"],
      min: [0, "New stock cannot be negative"],
    },
    reference: { type: String, trim: true, default: "" }, // order number, PO number, etc.
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes must be at most 500 characters"],
      default: "",
    },
  },
  { timestamps: true },
);

inventoryLogSchema.index({ variant: 1, createdAt: -1 });
inventoryLogSchema.index({ product: 1, createdAt: -1 });
inventoryLogSchema.index({ type: 1 });
inventoryLogSchema.index({ performedBy: 1 });

const InventoryLog = mongoose.model("InventoryLog", inventoryLogSchema);

module.exports = InventoryLog;
module.exports.INVENTORY_TYPES = INVENTORY_TYPES;

"use strict";

const mongoose = require("mongoose");

const variantImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: true },
);

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },
    size: { type: String, trim: true, default: "" }, // e.g. 'S', 'M', 'XL', '32'
    color: { type: String, trim: true, default: "" }, // e.g. 'Navy Blue'
    colorCode: { type: String, trim: true, default: "" }, // CSS hex e.g. '#1A237E'
    sku: {
      type: String,
      required: [true, "Variant SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    price: {
      type: Number,
      required: [true, "Variant price is required"],
      min: [0, "Price cannot be negative"],
    },
    regularPrice: {
      type: Number,
      required: [true, "Regular price is required"],
      min: [0, "Regular price cannot be negative"],
    },
    costPrice: {
      type: Number,
      default: 0,
      min: [0, "Cost price cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, "Low stock threshold cannot be negative"],
    },
    isActive: { type: Boolean, default: true },
    images: { type: [variantImageSchema], default: [] },
    weight: { type: Number, default: 0, min: [0, "Weight cannot be negative"] }, // grams
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

productVariantSchema.index({ product: 1 });
productVariantSchema.index({ sku: 1 });
productVariantSchema.index({ product: 1, isActive: 1 });
productVariantSchema.index({ stock: 1 });

productVariantSchema.virtual("isLowStock").get(function () {
  return this.stock > 0 && this.stock <= this.lowStockThreshold;
});

productVariantSchema.virtual("isOutOfStock").get(function () {
  return this.stock === 0;
});

productVariantSchema.virtual("discountPercentage").get(function () {
  if (!this.regularPrice || this.regularPrice <= this.price) return 0;
  return Math.round(
    ((this.regularPrice - this.price) / this.regularPrice) * 100,
  );
});

// Prevent negative stock.
productVariantSchema.methods.adjustStock = async function (quantity, type) {
  if (type === "decrement") {
    if (this.stock < quantity) {
      throw new Error(
        `Insufficient stock for variant ${this.sku}. Available: ${this.stock}, Requested: ${quantity}`,
      );
    }
    this.stock -= quantity;
  } else {
    this.stock += quantity;
  }
  return this.save();
};

const ProductVariant = mongoose.model("ProductVariant", productVariantSchema);
module.exports = ProductVariant;

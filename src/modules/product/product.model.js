"use strict";

const mongoose = require("mongoose");
const slugify = require("slugify");

const PRODUCT_STATUSES = ["draft", "active", "inactive", "out_of_stock"];

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // cloudinary public_id for deletion
    isMain: { type: Boolean, default: false },
  },
  { _id: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name must be at most 200 characters"],
    },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Short description must be at most 500 characters"],
      default: "",
    },
    sku: { type: String, unique: true, trim: true, uppercase: true }, // base SKU; variants derive from this
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },
    images: { type: [productImageSchema], default: [] },
    tags: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }, // soft-delete
    scheduledPublishAt: { type: Date, default: null },
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Price cannot be negative"],
    },
    status: {
      type: String,
      enum: {
        values: PRODUCT_STATUSES,
        message: `Status must be one of: ${PRODUCT_STATUSES.join(", ")}`,
      },
      default: "draft",
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be below 0"],
      max: [5, "Rating cannot exceed 5"],
    },
    totalReviews: { type: Number, default: 0, min: 0 },
    totalSold: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isNewArrival: 1 });
productSchema.index({ isBestSeller: 1 });
productSchema.index({ status: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ basePrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ totalSold: -1 });
productSchema.index({ averageRating: -1 });
productSchema.index(
  { name: "text", description: "text", tags: "text" },
  {
    weights: { name: 10, tags: 5, description: 1 },
    name: "product_text_search",
  },
);

productSchema.virtual("variants", {
  ref: "ProductVariant",
  localField: "_id",
  foreignField: "product",
  options: { sort: { size: 1, color: 1 } },
});

productSchema.pre("save", async function () {
  if (!this.isModified("name") && this.slug) return;

  const baseSlug = slugify(this.name, {
    lower: true,
    strict: true,
    trim: true,
  });
  const existing = await mongoose
    .model("Product")
    .findOne({ slug: baseSlug, _id: { $ne: this._id } });
  this.slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
});

productSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, isActive: true, status: "active" });
};

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
module.exports.PRODUCT_STATUSES = PRODUCT_STATUSES;

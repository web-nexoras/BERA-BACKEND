"use strict";

const mongoose = require("mongoose");
const slugify = require("slugify");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Brand name must be at most 100 characters"],
    },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description must be at most 2000 characters"],
      default: "",
    },
    logo: { type: String, default: "" },
    website: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

brandSchema.index({ slug: 1 });
brandSchema.index({ isActive: 1 });

brandSchema.pre("save", async function () {
  if (!this.isModified("name") && this.slug) return;

  const baseSlug = slugify(this.name, {
    lower: true,
    strict: true,
    trim: true,
  });
  const existing = await mongoose
    .model("Brand")
    .findOne({ slug: baseSlug, _id: { $ne: this._id } });
  this.slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
});

brandSchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;

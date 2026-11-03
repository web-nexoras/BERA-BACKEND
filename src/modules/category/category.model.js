"use strict";

const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Category name must be at most 100 characters"],
    },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description must be at most 1000 characters"],
      default: "",
    },
    image: { type: String, default: "" },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    }, // null = top-level
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });

categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
  options: { sort: { sortOrder: 1, name: 1 } },
});

// Generate a unique slug from the name.
categorySchema.pre("save", async function (next) {
  if (!this.isModified("name") && this.slug) return next();

  const baseSlug = slugify(this.name, {
    lower: true,
    strict: true,
    trim: true,
  });
  const existing = await mongoose
    .model("Category")
    .findOne({ slug: baseSlug, _id: { $ne: this._id } });
  this.slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
  next();
});

categorySchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.findWithSubcategories = function () {
  return this.find({ isActive: true, parent: null })
    .sort({ sortOrder: 1, name: 1 })
    .populate({
      path: "subcategories",
      match: { isActive: true },
      options: { sort: { sortOrder: 1, name: 1 } },
    });
};

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;

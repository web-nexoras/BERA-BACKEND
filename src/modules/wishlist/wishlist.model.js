'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const wishlistItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: [true, 'Product reference is required'] },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// one wishlist per user
const wishlistSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User reference is required'], unique: true },
    items: [wishlistItemSchema],
  },
  { timestamps: true, versionKey: false }
);

wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);
module.exports = Wishlist;

"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const env = require("../../config/env");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },

    isEmailVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    avatar: { type: String, default: null },
    phone: { type: String, default: null },

    // tokens (hidden from responses)
    emailVerificationToken: { type: String, select: false },
    emailVerificationTokenExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetTokenExpires: { type: Date, select: false },
    refreshTokens: { type: [String], select: false, default: [] },

    lastLogin: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationTokenExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetTokenExpires;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(
    this.password,
    env.BCRYPT_SALT_ROUNDS || 12,
  );
  next();
});

// compare plain password with hash
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// generate password reset token (returns raw token, stores hash)
userSchema.methods.createPasswordResetToken = function () {
  const raw = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");
  this.passwordResetTokenExpires = new Date(
    Date.now() +
      (env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES || 30) * 60 * 1000,
  );
  return raw;
};

// generate email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const raw = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");
  this.emailVerificationTokenExpires = new Date(
    Date.now() + (env.OTP_EXPIRES_IN_MINUTES || 10) * 60 * 1000,
  );
  return raw;
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

module.exports = mongoose.model("User", userSchema);

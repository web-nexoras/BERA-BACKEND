'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const slugify = require('slugify');

function generateOTP(length = 6) {
  const max = Math.pow(10, length);
  const otp = crypto.randomInt(0, max);
  return String(otp).padStart(length, '0');
}

// format: NF-YYYY-XXXXXX
function generateOrderNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NF-${year}-${suffix}`;
}

function generateSlug(text) {
  return slugify(text, { lower: true, strict: true, trim: true, locale: 'en' });
}

// returns ৳ formatted string
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `৳ ${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculatePagination(page, limit, total) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, parseInt(limit, 10) || 10);
  const totalPages = Math.ceil(total / l);

  return {
    total,
    page: p,
    limit: l,
    totalPages,
    hasNextPage: p < totalPages,
    hasPrevPage: p > 1,
  };
}

function getSkip(page, limit) {
  return (Math.max(1, page) - 1) * limit;
}

// strips +880/880 prefix and validates BD number format
function sanitizePhoneNumber(phone) {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('880')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = '0' + digits;

  if (/^01[3-9]\d{8}$/.test(digits)) return digits;
  return null;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// SHA-256 hash for safe DB storage of tokens
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateOTP,
  generateOrderNumber,
  generateSlug,
  formatCurrency,
  calculatePagination,
  getSkip,
  sanitizePhoneNumber,
  isValidObjectId,
  generateSecureToken,
  hashToken,
};

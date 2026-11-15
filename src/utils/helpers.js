'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

// format: NF-YYYY-XXXXXXXXXXXX
function generateOrderNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `NF-${year}-${suffix}`;
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

function sanitizePhoneNumber(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = '0' + digits;
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateOrderNumber,
  calculatePagination,
  getSkip,
  sanitizePhoneNumber,
  isValidObjectId,
  hashToken,
};

'use strict';

const axios = require('axios');
const env = require('../config/env');
const logger = require('../utils/logger');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendEmail({ to, subject, html, text }) {
  try {
    await axios.post(
      BREVO_API_URL,
      {
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
        to: [{ email: to.email || to, name: to.name || '' }],
        subject,
        htmlContent: html,
        textContent: text || subject,
      },
      { headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' } },
    );
    logger.info('Email sent', { to: to.email || to, subject });
  } catch (err) {
    logger.error('Failed to send email via Brevo', { to: to.email || to, subject, error: err.response?.data || err.message });
    throw err;
  }
}

async function sendVerificationEmail(user, verificationUrl) {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: 'Verify your email — Nexora Fashions',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Welcome to Nexora Fashions, ${user.name}!</h2>
        <p>Please verify your email address to get started:</p>
        <a href="${verificationUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">Verify Email</a>
        <p style="margin-top:16px;color:#666">Link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>`,
  });
}

async function sendPasswordResetEmail(user, resetUrl) {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: 'Reset your password — Nexora Fashions',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>Click below to reset your password:</p>
        <a href="${resetUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">Reset Password</a>
        <p style="margin-top:16px;color:#666">This link expires in 30 minutes. If you didn't request this, please ignore this email.</p>
      </div>`,
  });
}

async function sendWelcomeEmail(user) {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: 'Welcome to Nexora Fashions!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>You're all set, ${user.name}!</h2>
        <p>Your email has been verified. Start exploring our latest collection:</p>
        <a href="${env.FRONTEND_URL}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">Shop Now</a>
      </div>`,
  });
}

async function sendOrderConfirmationEmail(user, order) {
  const itemsList = order.items
    .map((i) => `<tr><td>${i.name} (${i.size || ''} ${i.color || ''})</td><td>${i.quantity}</td><td>৳${i.totalPrice}</td></tr>`)
    .join('');

  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: `Order Confirmed — ${order.orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Order Confirmed!</h2>
        <p>Hi ${user.name}, your order <strong>${order.orderNumber}</strong> has been placed.</p>
        <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody>${itemsList}</tbody>
        </table>
        <p><strong>Subtotal:</strong> ৳${order.pricing.subtotal}</p>
        <p><strong>Shipping:</strong> ৳${order.pricing.shippingCharge}</p>
        <p><strong>Discount:</strong> ৳${order.pricing.discountAmount}</p>
        <p><strong>Total:</strong> ৳${order.pricing.total}</p>
        <p><strong>Payment:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
      </div>`,
  });
}

async function sendLowStockAlertEmail(adminEmail, products) {
  const rows = products
    .map((v) => `<tr><td>${v.product?.name}</td><td>${v.sku}</td><td style="color:${v.stock === 0 ? 'red' : 'orange'}">${v.stock}</td><td>${v.lowStockThreshold}</td></tr>`)
    .join('');

  await sendEmail({
    to: adminEmail,
    subject: `Low Stock Alert — ${products.length} variants need attention`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto">
        <h2>Low Stock Alert</h2>
        <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse">
          <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Threshold</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
  });
}

async function sendDailyReportEmail(adminEmail, reportData) {
  await sendEmail({
    to: adminEmail,
    subject: `Daily Report — ${new Date().toLocaleDateString('en-BD')}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Daily Sales Report</h2>
        <p>Date: ${new Date().toLocaleDateString('en-BD', { timeZone: 'Asia/Dhaka' })}</p>
        <ul>
          <li><strong>Orders Today:</strong> ${reportData.ordersToday}</li>
          <li><strong>Revenue Today:</strong> ৳${reportData.revenueToday}</li>
          <li><strong>New Customers:</strong> ${reportData.newCustomersToday}</li>
          <li><strong>Delivered Orders:</strong> ${reportData.deliveredOrders}</li>
          <li><strong>Cancelled Orders:</strong> ${reportData.cancelledOrders}</li>
        </ul>
      </div>`,
  });
}

module.exports = {
  sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail,
  sendOrderConfirmationEmail, sendLowStockAlertEmail, sendDailyReportEmail,
};

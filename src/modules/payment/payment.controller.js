'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const paymentService = require('./payment.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const initiatePayment = asyncHandler(async (req, res) => {
  const result = await paymentService.initiatePaymentForOrder(req.user.id, req.body.orderId);
  return successResponse(res, 'Payment initiated', result);
});

const sslcommerzSuccess = asyncHandler(async (req, res) => {
  const result = await paymentService.verifySSLCommerzPayment(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/order/${result.ok ? 'success' : 'failed'}`);
});

const sslcommerzFail = asyncHandler(async (req, res) => {
  const result = await paymentService.handleSSLCommerzFail(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/order/${result.ok ? 'success' : 'failed'}`);
});

const sslcommerzCancel = asyncHandler(async (req, res) => {
  const result = await paymentService.handleSSLCommerzCancel(req.body);
  res.redirect(`${process.env.FRONTEND_URL}/order/${result.ok ? 'success' : 'cancelled'}`);
});

const sslcommerzIPN = asyncHandler(async (req, res) => {
  const result = await paymentService.verifySSLCommerzPayment(req.body);
  if (!result.ok) return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'IPN rejected', reason: result.reason });
  return successResponse(res, 'IPN received', result);
});

const getMyTransactions = asyncHandler(async (req, res) => {
  const { payments, pagination } = await paymentService.getMyTransactions(req.user.id, req.query);
  return paginatedResponse(res, 'Transactions retrieved', payments, pagination);
});

const getAllTransactions = asyncHandler(async (req, res) => {
  const { payments, pagination } = await paymentService.getAllTransactions(req.query);
  return paginatedResponse(res, 'Transactions retrieved', payments, pagination);
});

const processRefund = asyncHandler(async (req, res) => {
  const payment = await paymentService.processRefund(req.body.orderId, req.body.amount, req.user.id);
  return successResponse(res, 'Refund processed', payment);
});

module.exports = { initiatePayment, sslcommerzSuccess, sslcommerzFail, sslcommerzCancel, sslcommerzIPN, getMyTransactions, getAllTransactions, processRefund };

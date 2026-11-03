'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const orderService = require('./order.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const checkout = asyncHandler(async (req, res) => {
  const result = await orderService.checkout(req.user.id, req.body);
  return successResponse(res, 'Order placed successfully', result, StatusCodes.CREATED);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const { orders, pagination } = await orderService.getOrders(req.user.id, req.query);
  return paginatedResponse(res, 'Orders retrieved successfully', orders, pagination);
});

const getMyOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.user.id, req.params.orderId);
  return successResponse(res, 'Order retrieved successfully', order);
});

const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.user.id, req.params.orderId, req.body.reason);
  return successResponse(res, 'Order cancelled successfully', order);
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { orders, pagination } = await orderService.getAdminOrders(req.query);
  return paginatedResponse(res, 'Orders retrieved successfully', orders, pagination);
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getAdminOrders({ search: '' });
  const o = await require('./order.model').findById(req.params.orderId)
    .populate('user', 'name email phone').lean();
  if (!o) return res.status(404).json({ success: false, message: 'Order not found' });
  return successResponse(res, 'Order retrieved', o);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(
    req.params.orderId, req.body.status, req.body.note, req.user.id,
  );
  return successResponse(res, 'Order status updated', order);
});

const generateInvoice = asyncHandler(async (req, res) => {
  const invoice = await orderService.generateInvoice(req.params.orderId);
  return successResponse(res, 'Invoice generated', invoice);
});

module.exports = { checkout, getMyOrders, getMyOrderById, cancelMyOrder, getAllOrders, getOrderById, updateOrderStatus, generateInvoice };

'use strict';

const Order = require('../order/order.model');
const Payment = require('../payment/payment.model');
const Product = require('../product/product.model');
const ProductVariant = require('../variant/variant.model');
const User = require('../auth/auth.model');
const { get, set } = require('../../config/redis');
const { calculatePagination, getSkip } = require('../../utils/helpers');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../../utils/AppError');
const { getDhakaDayBounds, getDhakaYear } = require('../../utils/dhakaTime');

async function getDashboardStats() {
  const { start: todayStart, end: todayEnd, dateKey } = getDhakaDayBounds();
  const cacheKey = `admin:dashboard_stats:${dateKey}`;
  const cached = await get(cacheKey);
  if (cached) return cached;

  const [
    totalOrders, pendingOrders, confirmedOrders, processingOrders,
    shippedOrders, deliveredOrders, cancelledOrders,
    totalCustomers, totalProducts,
    lowStockVariants, outOfStockVariants,
    revenueResult, todayRevenueResult, todayOrders, newCustomersToday,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: 'pending' }),
    Order.countDocuments({ orderStatus: 'confirmed' }),
    Order.countDocuments({ orderStatus: 'processing' }),
    Order.countDocuments({ orderStatus: 'shipped' }),
    Order.countDocuments({ orderStatus: 'delivered' }),
    Order.countDocuments({ orderStatus: 'cancelled' }),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ isDeleted: false, status: 'active' }),
    ProductVariant.countDocuments({ $expr: { $and: [{ $lte: ['$stock', '$lowStockThreshold'] }, { $gt: ['$stock', 0] }] } }),
    ProductVariant.countDocuments({ stock: 0 }),
    Payment.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { status: 'completed', createdAt: { $gte: todayStart, $lt: todayEnd } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Order.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: todayStart, $lt: todayEnd } }),
  ]);

  const stats = {
    totalRevenue: revenueResult[0]?.total || 0,
    revenueToday: todayRevenueResult[0]?.total || 0,
    totalOrders,
    ordersToday: todayOrders,
    pendingOrders, confirmedOrders, processingOrders, shippedOrders, deliveredOrders, cancelledOrders,
    totalCustomers, newCustomersToday,
    totalProducts, lowStockVariants, outOfStockVariants,
  };

  await set(cacheKey, stats, 300); // 5-minute cache
  return stats;
}

async function getMonthlySalesData(year = getDhakaYear()) {
  const start = new Date(Date.UTC(year, 0, 1) - 6 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year + 1, 0, 1) - 6 * 60 * 60 * 1000);
  const result = await Payment.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: { $month: { date: '$createdAt', timezone: 'Asia/Dhaka' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { '_id': 1 } },
  ]);

  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0, orders: 0 }));
  result.forEach((r) => { months[r._id - 1] = { month: r._id, revenue: r.revenue, orders: r.count }; });
  return months;
}

async function getRecentOrders(limit = 10) {
  return Order.find()
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('orderNumber user pricing.total orderStatus paymentMethod createdAt')
    .lean();
}

async function getBestSellingProducts(limit = 10) {
  return Product.find({ isDeleted: false })
    .sort({ totalSold: -1 })
    .limit(limit)
    .select('name images totalSold basePrice averageRating')
    .lean();
}

async function getSalesReport(startDate, endDate) {
  const match = { status: 'completed' };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) match.createdAt.$gte = getDhakaDayBounds(startDate).start;
      else match.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) match.createdAt.$lt = getDhakaDayBounds(endDate).end;
      else match.createdAt.$lte = new Date(endDate);
    }
  } else {
    const { start, end } = getDhakaDayBounds();
    match.createdAt = { $gte: start, $lt: end };
  }

  const [revenue, orderStats] = await Promise.all([
    Payment.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Dhaka' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: match.createdAt || { $exists: true }, orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);

  return { dailyRevenue: revenue, ordersByStatus: orderStats };
}

async function getDailyReportStats(reportDate = getDhakaDayBounds().dateKey) {
  const { start, end } = getDhakaDayBounds(reportDate);
  const [ordersToday, revenueResult, newCustomersToday, deliveredOrders, cancelledOrders] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    User.countDocuments({ role: 'customer', createdAt: { $gte: start, $lt: end } }),
    Order.countDocuments({ 'shipping.deliveredAt': { $gte: start, $lt: end } }),
    Order.countDocuments({ statusHistory: { $elemMatch: { status: 'cancelled', updatedAt: { $gte: start, $lt: end } } } }),
  ]);
  return {
    reportDate,
    ordersToday,
    revenueToday: revenueResult[0]?.total || 0,
    newCustomersToday,
    deliveredOrders,
    cancelledOrders,
  };
}

async function getInventoryReport() {
  return ProductVariant.find()
    .populate('product', 'name sku')
    .select('sku size color stock lowStockThreshold price product')
    .lean();
}

async function getCustomers(query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = getSkip(page, limit);

  const filter = { role: 'customer' };
  if (query.search) filter.$or = [{ name: { $regex: query.search, $options: 'i' } }, { email: { $regex: query.search, $options: 'i' } }];
  if (query.isBlocked !== undefined) filter.isBlocked = query.isBlocked === 'true';

  const [customers, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return { customers, pagination: calculatePagination(page, limit, total) };
}

async function getCustomerById(id) {
  const customer = await User.findOne({ _id: id, role: 'customer' }).lean();
  if (!customer) throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
  const orders = await Order.find({ user: id }).sort({ createdAt: -1 }).limit(10).select('orderNumber pricing.total orderStatus createdAt').lean();
  const totalSpent = await Payment.aggregate([{ $match: { user: customer._id, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return { customer, recentOrders: orders, totalSpent: totalSpent[0]?.total || 0 };
}

async function blockCustomer(id, adminId) {
  if (String(id) === String(adminId)) {
    throw new AppError('You cannot block your own admin account.', StatusCodes.FORBIDDEN);
  }
  const user = await User.findOneAndUpdate(
    { _id: id, role: 'customer' },
    { $set: { isBlocked: true, refreshTokens: [] } },
    { new: true },
  );
  if (!user) throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
  return user;
}

async function unblockCustomer(id) {
  const user = await User.findOneAndUpdate({ _id: id, role: 'customer' }, { isBlocked: false }, { new: true });
  if (!user) throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
  return user;
}

module.exports = {
  getDashboardStats, getMonthlySalesData, getRecentOrders, getBestSellingProducts,
  getSalesReport, getDailyReportStats, getInventoryReport, getCustomers, getCustomerById, blockCustomer, unblockCustomer,
};

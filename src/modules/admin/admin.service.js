'use strict';

const Order = require('../order/order.model');
const Payment = require('../payment/payment.model');
const Product = require('../product/product.model');
const ProductVariant = require('../variant/variant.model');
const User = require('../auth/auth.model');
const { get, set } = require('../../config/redis');
const { calculatePagination, getSkip } = require('../../utils/helpers');

async function getDashboardStats() {
  const cacheKey = 'admin:dashboard_stats';
  const cached = await get(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
    Payment.aggregate([{ $match: { status: 'completed', createdAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Order.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: todayStart } }),
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

async function getMonthlySalesData(year = new Date().getFullYear()) {
  const result = await Payment.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) } } },
    { $group: { _id: { $month: '$createdAt' }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
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
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const [revenue, orderStats] = await Promise.all([
    Payment.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: match.createdAt || { $exists: true }, orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);

  return { dailyRevenue: revenue, ordersByStatus: orderStats };
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
  const customer = await User.findById(id).lean();
  if (!customer) throw new Error('Customer not found');
  const orders = await Order.find({ user: id }).sort({ createdAt: -1 }).limit(10).select('orderNumber pricing.total orderStatus createdAt').lean();
  const totalSpent = await Payment.aggregate([{ $match: { user: customer._id, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return { customer, recentOrders: orders, totalSpent: totalSpent[0]?.total || 0 };
}

async function blockCustomer(id) {
  const user = await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
  if (!user) throw new Error('Customer not found');
  await User.findByIdAndUpdate(id, { refreshTokens: [] }); // invalidate sessions
  return user;
}

async function unblockCustomer(id) {
  const user = await User.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
  if (!user) throw new Error('Customer not found');
  return user;
}

module.exports = {
  getDashboardStats, getMonthlySalesData, getRecentOrders, getBestSellingProducts,
  getSalesReport, getInventoryReport, getCustomers, getCustomerById, blockCustomer, unblockCustomer,
};

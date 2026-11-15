'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1/test';
process.env.JWT_ACCESS_SECRET = 'integration-test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret-0123456789';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.BREVO_API_KEY = 'test-brevo-key';
process.env.SSLCOMMERZ_STORE_ID = 'test-store';
process.env.SSLCOMMERZ_STORE_PASS = 'test-store-pass';
process.env.SSLCOMMERZ_IS_LIVE = 'false';
process.env.SWAGGER_ENABLED = 'false';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '1';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { before, beforeEach, after, test } = require('node:test');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const env = require('../../src/config/env');
const app = require('../../src/app');
const User = require('../../src/modules/auth/auth.model');
const Category = require('../../src/modules/category/category.model');
const Product = require('../../src/modules/product/product.model');
const ProductVariant = require('../../src/modules/variant/variant.model');
const Cart = require('../../src/modules/cart/cart.model');
const Order = require('../../src/modules/order/order.model');
const Payment = require('../../src/modules/payment/payment.model');
const Coupon = require('../../src/modules/coupon/coupon.model');
const Wishlist = require('../../src/modules/wishlist/wishlist.model');
const InventoryLog = require('../../src/modules/inventory/inventory.model');
const Settings = require('../../src/modules/admin/settings.model');
const settingsService = require('../../src/modules/admin/settings.service');
const paymentService = require('../../src/modules/payment/payment.service');
const { runOrderCleanup } = require('../../src/jobs/orderCleanup.job');
const redis = require('../../src/config/redis');

let replSet;
let originalAxiosPost;
let originalAxiosGet;
let validationPayload;
let fixtureCounter = 0;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: 'bera-integration' });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  originalAxiosPost = axios.post;
  originalAxiosGet = axios.get;
  axios.post = async (url) => {
    if (url.includes('/gwprocess/')) return { data: { status: 'SUCCESS', GatewayPageURL: 'https://gateway.test/session', sessionkey: 'session-key' } };
    if (url.includes('api.brevo.com')) return { data: { messageId: 'email-mocked' } };
    throw new Error(`Unexpected axios POST ${url}`);
  };
  axios.get = async () => ({ data: validationPayload });
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Category.deleteMany({}), Product.deleteMany({}), ProductVariant.deleteMany({}),
    Cart.deleteMany({}), Order.deleteMany({}), Payment.deleteMany({}), Coupon.deleteMany({}),
    Wishlist.deleteMany({}), InventoryLog.deleteMany({}), Settings.deleteMany({}),
  ]);
  settingsService.invalidateSettingsCache();
  validationPayload = null;
});

after(async () => {
  axios.post = originalAxiosPost;
  axios.get = originalAxiosGet;
  if (redis.redisClient) redis.redisClient.disconnect();
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

async function makeUser(role = 'customer') {
  const suffix = ++fixtureCounter;
  return User.create({ name: `Test User ${suffix}`, email: `integration-${suffix}@example.test`, password: 'Password123!', role, isEmailVerified: true });
}
function bearer(user) {
  return `Bearer ${jwt.sign({ id: String(user._id), role: user.role }, env.JWT_ACCESS_SECRET)}`;
}
async function makeCatalog({ price = 100, stock = 20 } = {}) {
  const suffix = ++fixtureCounter;
  const category = await Category.create({ name: `Category ${suffix}` });
  const product = await Product.create({ name: `Active Product ${suffix}`, sku: `PRODUCT-${suffix}`, description: 'Integration fixture product description', category: category._id, basePrice: price, status: 'active', isActive: true });
  const variant = await ProductVariant.create({ product: product._id, sku: `VARIANT-${suffix}`, price, regularPrice: price, stock, isActive: true });
  return { category, product, variant };
}
async function putCart({ user = null, sessionId = null, product, variant, quantity = 1 }) {
  const owner = user ? { user: user._id } : { user: null, sessionId };
  return Cart.findOneAndUpdate(
    owner,
    { $set: { items: [{ product: product._id, variant: variant._id, quantity, price: variant.price, name: product.name }] }, $setOnInsert: { user: user?._id || null, sessionId: user ? null : sessionId } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
}
function checkoutBody(paymentMethod, email = 'buyer@example.test') {
  return { paymentMethod, shippingAddress: { recipientName: 'Integration Buyer', phone: '+8801712345678', email, addressLine1: '12 Integration Road', city: 'Dhaka', district: 'Dhaka', division: 'Dhaka', postalCode: '1207' } };
}
async function checkoutAs(user, paymentMethod = 'cod', email) {
  return request(app).post('/api/v1/orders/checkout').set('Authorization', bearer(user)).send(checkoutBody(paymentMethod, email));
}
function signedIpn({ tranId, valId, amount }) {
  const data = { tran_id: tranId, val_id: valId, status: 'VALID', amount: Number(amount).toFixed(2), currency_type: 'BDT' };
  data.verify_key = 'tran_id,val_id,status,amount,currency_type';
  const fields = data.verify_key.split(',').map((key) => `${key}=${data[key] ?? ''}`);
  fields.push(`store_passwd=${crypto.createHash('md5').update(env.SSLCOMMERZ_STORE_PASS).digest('hex')}`);
  data.verify_sign = crypto.createHash('md5').update(fields.join('&')).digest('hex');
  return data;
}

test('checkout creates COD and SSLCommerz orders with mocked gateway HTTP', async () => {
  const user = await makeUser();
  const { product, variant } = await makeCatalog({ price: 100, stock: 10 });
  await putCart({ user, product, variant, quantity: 2 });
  const cod = await checkoutAs(user, 'cod');
  assert.equal(cod.status, 201, JSON.stringify(cod.body));
  assert.equal(cod.body.data.order.paymentMethod, 'cod');
  assert.equal(cod.body.data.order.orderStatus, 'confirmed');
  assert.equal((await ProductVariant.findById(variant._id)).stock, 8);

  await putCart({ user, product, variant });
  const online = await checkoutAs(user, 'sslcommerz');
  assert.equal(online.status, 201, JSON.stringify(online.body));
  assert.equal(online.body.data.order.paymentMethod, 'sslcommerz');
  assert.equal(online.body.data.paymentUrl, 'https://gateway.test/session');
  assert.match(online.body.data.payment.transactionId, /^NF-/);
  assert.equal((await ProductVariant.findById(variant._id)).stock, 7);
});

test('payment callback rejects a val_id replay against another transaction', async () => {
  const user = await makeUser();
  const { product, variant } = await makeCatalog({ price: 50, stock: 10 });
  await putCart({ user, product, variant });
  const firstResponse = await checkoutAs(user, 'sslcommerz');
  assert.equal(firstResponse.status, 201, JSON.stringify(firstResponse.body));
  const firstPayment = await Payment.findOne({ order: firstResponse.body.data.order._id });
  await putCart({ user, product, variant });
  const secondResponse = await checkoutAs(user, 'sslcommerz');
  assert.equal(secondResponse.status, 201, JSON.stringify(secondResponse.body));
  const secondPayment = await Payment.findOne({ order: secondResponse.body.data.order._id });

  validationPayload = { status: 'VALID', tran_id: firstPayment.transactionId, amount: firstPayment.amount.toFixed(2), currency_type: 'BDT' };
  const first = await paymentService.verifySSLCommerzPayment(signedIpn({ tranId: firstPayment.transactionId, valId: 'REPLAY-VAL-1', amount: firstPayment.amount }));
  assert.equal(first.ok, true);
  validationPayload = { status: 'VALID', tran_id: secondPayment.transactionId, amount: secondPayment.amount.toFixed(2), currency_type: 'BDT' };
  const second = await paymentService.verifySSLCommerzPayment(signedIpn({ tranId: secondPayment.transactionId, valId: 'REPLAY-VAL-1', amount: secondPayment.amount }));
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'val_id_already_used');
  assert.equal((await Payment.findById(secondPayment._id)).status, 'pending');
  assert.equal((await Order.findById(secondResponse.body.data.order._id)).paymentStatus, 'pending');
});

test('failed SSLCommerz payment cleanup releases reserved stock', async () => {
  const user = await makeUser();
  const { product, variant } = await makeCatalog({ price: 80, stock: 5 });
  await putCart({ user, product, variant, quantity: 2 });
  const response = await checkoutAs(user, 'sslcommerz');
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const orderId = response.body.data.order._id;
  const payment = await Payment.findOne({ order: orderId });
  assert.equal((await ProductVariant.findById(variant._id)).stock, 3);
  const failResult = await paymentService.handleSSLCommerzFail({ tran_id: payment.transactionId });
  assert.equal(failResult.ok, false);
  await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(orderId) }, { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });
  const expiredOrder = await Order.findOne({ _id: orderId, orderStatus: 'pending', paymentMethod: 'sslcommerz', paymentStatus: { $in: ['pending', 'failed'] }, createdAt: { $lt: new Date(Date.now() - env.UNPAID_ORDER_CANCEL_MINUTES * 60 * 1000) } });
  assert.ok(expiredOrder, `Expected failed order to match cleanup filter: ${JSON.stringify(await Order.findById(orderId).lean())}`);
  await runOrderCleanup();
  assert.equal((await ProductVariant.findById(variant._id)).stock, 5);
  assert.equal((await Order.findById(orderId)).orderStatus, 'cancelled');
  assert.equal((await Payment.findById(payment._id)).status, 'failed');
  assert.equal(await InventoryLog.countDocuments({ reference: failResult.order.orderNumber, type: 'return', quantity: 2 }), 1);
});

test('coupon per-user usage limit prevents a repeated checkout', async () => {
  const user = await makeUser();
  const { product, variant } = await makeCatalog({ price: 100, stock: 10 });
  const coupon = await Coupon.create({ code: 'ONE-USE-PER-USER', type: 'percentage', value: 10, expiresAt: new Date(Date.now() + 86_400_000), usageLimit: 5 });
  await putCart({ user, product, variant });
  const first = await request(app).post('/api/v1/orders/checkout').set('Authorization', bearer(user)).send({ ...checkoutBody('cod'), couponCode: coupon.code });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const used = await Coupon.findById(coupon._id);
  assert.equal(used.usedCount, 1);
  assert.equal(String(used.usedBy[0]), String(user._id));
  await putCart({ user, product, variant });
  const second = await request(app).post('/api/v1/orders/checkout').set('Authorization', bearer(user)).send({ ...checkoutBody('cod'), couponCode: coupon.code });
  assert.equal(second.status, 400);
  assert.match(second.body.message, /already used/i);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
});

test('guest order tracking verifies phone and returns only the minimal payload', async () => {
  const { product, variant } = await makeCatalog({ price: 75, stock: 4 });
  const sessionId = crypto.randomUUID();
  await putCart({ sessionId, product, variant });
  const checkout = await request(app).post('/api/v1/orders/checkout').set('X-Session-Id', sessionId).send(checkoutBody('cod', 'guest@example.test'));
  assert.equal(checkout.status, 201, JSON.stringify(checkout.body));
  const order = checkout.body.data.order;
  const wrong = await request(app).get('/api/v1/orders/track').query({ orderNumber: order.orderNumber, phone: '01700000000' });
  assert.equal(wrong.status, 404);
  assert.equal(wrong.body.message, 'Order not found');
  const tracked = await request(app).get('/api/v1/orders/track').query({ orderNumber: order.orderNumber, phone: '+8801712345678' });
  assert.equal(tracked.status, 200, JSON.stringify(tracked.body));
  assert.equal(tracked.body.data.status, 'confirmed');
  assert.equal(tracked.body.data.phone, '017****5678');
  assert.ok(Array.isArray(tracked.body.data.items));
  assert.equal(Object.hasOwn(tracked.body.data, 'shippingAddress'), false);
});

test('inventory endpoint applies type directions and explicit adjustment directions', async () => {
  const admin = await makeUser('admin');
  const { variant } = await makeCatalog({ stock: 10 });
  const adjust = (body) => request(app).post('/api/v1/inventory/adjust').set('Authorization', bearer(admin)).send({ variantId: String(variant._id), ...body });
  const purchase = await adjust({ type: 'purchase', quantity: 3 });
  assert.equal(purchase.status, 200, JSON.stringify(purchase.body));
  assert.equal(purchase.body.data.stock, 13);
  const sale = await adjust({ type: 'sale', quantity: 2 });
  assert.equal(sale.status, 200, JSON.stringify(sale.body));
  assert.equal(sale.body.data.stock, 11);
  const increase = await adjust({ type: 'adjustment', direction: 'increase', quantity: 4 });
  assert.equal(increase.status, 200, JSON.stringify(increase.body));
  assert.equal(increase.body.data.stock, 15);
  const decrease = await adjust({ type: 'adjustment', direction: 'decrease', quantity: 5 });
  assert.equal(decrease.status, 200, JSON.stringify(decrease.body));
  assert.equal(decrease.body.data.stock, 10);
  const insufficient = await adjust({ type: 'damaged', quantity: 11 });
  assert.equal(insufficient.status, 409);
  assert.equal((await ProductVariant.findById(variant._id)).stock, 10);
  const movements = await InventoryLog.find({ variant: variant._id }).sort({ createdAt: 1 }).lean();
  assert.deepEqual(movements.map((movement) => movement.quantity), [3, -2, 4, -5]);
});

test('wishlist move-to-cart moves item only after successful cart addition', async () => {
  const user = await makeUser();
  const { product, variant } = await makeCatalog({ stock: 6 });
  const auth = { Authorization: bearer(user) };
  const added = await request(app).post('/api/v1/wishlist/items').set(auth).send({ productId: String(product._id) });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  const moved = await request(app).post(`/api/v1/wishlist/items/${product._id}/move-to-cart`).set(auth).send({ variantId: String(variant._id), quantity: 2 });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  const cart = await Cart.findOne({ user: user._id });
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 2);
  const wishlist = await Wishlist.findOne({ user: user._id });
  assert.equal(wishlist.items.length, 0);
});

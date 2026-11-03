'use strict';

const { StatusCodes } = require('http-status-codes');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const ShippingZone = require('./shipping.model');
const env = require('../../config/env');

const DEFAULT_ZONES = [
  {
    name: 'Inside Dhaka',
    districts: ['Dhaka', 'Narayanganj', 'Gazipur', 'Manikganj', 'Munshiganj', 'Narsingdi'],
    charge: env.SHIPPING_CHARGE_INSIDE_DHAKA || 60,
    estimatedDays: '1-2 days',
    isActive: true,
  },
  {
    name: 'Outside Dhaka',
    districts: [
      'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal', 'Rangpur', 'Mymensingh',
      'Comilla', 'Noakhali', 'Feni', 'Lakshmipur', "Cox's Bazar", 'Brahmanbaria', 'Chandpur',
      'Jessore', 'Satkhira', 'Bogra', 'Pabna', 'Sirajganj', 'Tangail', 'Kishoreganj',
      'Netrokona', 'Sherpur', 'Jamalpur', 'Dinajpur', 'Kurigram', 'Nilphamari', 'Panchagarh',
      'Thakurgaon', 'Gaibandha', 'Lalmonirhat', 'Sunamganj', 'Moulvibazar', 'Habiganj',
      'Jhenaidah', 'Magura', 'Narail', 'Bagerhat', 'Pirojpur', 'Jhalokati', 'Patuakhali',
      'Bhola', 'Barguna', 'Faridpur', 'Madaripur', 'Shariatpur', 'Rajbari', 'Gopalganj',
      'Meherpur', 'Chuadanga', 'Kushtia', 'Bandarban', 'Rangamati', 'Khagrachhari',
    ],
    charge: env.SHIPPING_CHARGE_OUTSIDE_DHAKA || 120,
    estimatedDays: '3-5 days',
    isActive: true,
  },
];

const getShippingCharge = async (district) => {
  const zone = await ShippingZone.findOne({ isActive: true, districts: { $regex: new RegExp(`^${district}$`, 'i') } }).lean();
  if (zone) return { zone, charge: zone.charge, estimatedDays: zone.estimatedDays };

  // Use Outside Dhaka when no zone matches.
  const fallbackZone = await ShippingZone.findOne({ isActive: true, name: /outside dhaka/i }).lean();
  return {
    zone: fallbackZone || null,
    charge: fallbackZone?.charge ?? (env.SHIPPING_CHARGE_OUTSIDE_DHAKA || 120),
    estimatedDays: fallbackZone?.estimatedDays ?? '3-5 days',
  };
};

const getShippingZones = async () => ShippingZone.find({ isActive: true }).sort({ name: 1 }).lean();

const createZone = async (data) => {
  const existing = await ShippingZone.findOne({ name: data.name });
  if (existing) throw new AppError(`A shipping zone named "${data.name}" already exists.`, StatusCodes.CONFLICT);
  const zone = await ShippingZone.create(data);
  logger.info('Shipping zone created', { name: zone.name, id: zone._id });
  return zone;
};

const updateZone = async (id, data) => {
  const zone = await ShippingZone.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!zone) throw new AppError('Shipping zone not found.', StatusCodes.NOT_FOUND);
  logger.info('Shipping zone updated', { id, changes: Object.keys(data) });
  return zone;
};

// Deactivate instead of deleting.
const deleteZone = async (id) => {
  const zone = await ShippingZone.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!zone) throw new AppError('Shipping zone not found.', StatusCodes.NOT_FOUND);
  logger.info('Shipping zone deactivated', { id, name: zone.name });
  return zone;
};

// Seed defaults on startup.
const seedDefaultZones = async () => {
  try {
    const count = await ShippingZone.countDocuments();
    if (count === 0) {
      await ShippingZone.insertMany(DEFAULT_ZONES);
      logger.info('Default shipping zones seeded', { count: DEFAULT_ZONES.length });
    } else {
      logger.info('Shipping zones already exist — skipping seed', { count });
    }
  } catch (err) {
    logger.error('Failed to seed shipping zones', { err: err.message });
  }
};

module.exports = { getShippingCharge, getShippingZones, createZone, updateZone, deleteZone, seedDefaultZones };

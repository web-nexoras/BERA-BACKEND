'use strict';

const { StatusCodes } = require('http-status-codes');
const User = require('../auth/auth.model');
const Address = require('./user.model');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function getProfile(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError('User not found', StatusCodes.NOT_FOUND);
  return user;
}

async function updateProfile(userId, data) {
  const user = await User.findByIdAndUpdate(userId, data, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', StatusCodes.NOT_FOUND);
  return user;
}

async function getAddresses(userId) {
  return Address.find({ user: userId }).lean();
}

async function addAddress(userId, data) {
  if (data.isDefault) {
    await Address.updateMany({ user: userId }, { isDefault: false });
  }
  const address = await Address.create({ ...data, user: userId });
  return address;
}

async function updateAddress(userId, addressId, data) {
  if (data.isDefault) {
    await Address.updateMany({ user: userId, _id: { $ne: addressId } }, { isDefault: false });
  }
  const address = await Address.findOneAndUpdate(
    { _id: addressId, user: userId },
    data,
    { new: true, runValidators: true },
  );
  if (!address) throw new AppError('Address not found', StatusCodes.NOT_FOUND);
  return address;
}

async function deleteAddress(userId, addressId) {
  const address = await Address.findOneAndDelete({ _id: addressId, user: userId });
  if (!address) throw new AppError('Address not found', StatusCodes.NOT_FOUND);
}

async function setDefaultAddress(userId, addressId) {
  await Address.updateMany({ user: userId }, { isDefault: false });
  const address = await Address.findOneAndUpdate(
    { _id: addressId, user: userId },
    { isDefault: true },
    { new: true },
  );
  if (!address) throw new AppError('Address not found', StatusCodes.NOT_FOUND);
  return address;
}

module.exports = { getProfile, updateProfile, getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress };

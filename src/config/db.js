'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

mongoose.connection.on('connected',    () => logger.info('MongoDB connected'));
mongoose.connection.on('error',    (e) => logger.error('MongoDB error', { error: e.message }));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => logger.info('MongoDB reconnected'));

async function connectDB() {
  logger.info('Connecting to MongoDB…');
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    heartbeatFrequencyMS: 30_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
  });
}

async function disconnectDB() {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

module.exports = { connectDB, disconnectDB };

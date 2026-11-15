'use strict';

const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/modules/auth/auth.model');

const INSECURE_PRODUCTION_PASSWORD = 'Admin@123456';
let connected = false;

async function createOrPromoteAdmin() {
  if (!env.ADMIN_DEFAULT_EMAIL) {
    throw new Error('ADMIN_DEFAULT_EMAIL must be set before running this script.');
  }
  if (!env.ADMIN_DEFAULT_PASSWORD) {
    throw new Error('ADMIN_DEFAULT_PASSWORD must be set before running this script.');
  }
  if (env.ADMIN_DEFAULT_PASSWORD.length < 8) {
    throw new Error('ADMIN_DEFAULT_PASSWORD must be at least 8 characters.');
  }
  if (env.NODE_ENV === 'production' && env.ADMIN_DEFAULT_PASSWORD === INSECURE_PRODUCTION_PASSWORD) {
    throw new Error('Refusing to use the default admin password in production.');
  }

  await connectDB();
  connected = true;
  const email = env.ADMIN_DEFAULT_EMAIL.trim().toLowerCase();
  let user = await User.findOne({ email }).select('+password');
  const created = !user;
  if (!user) user = new User({ name: 'Administrator', email });

  user.password = env.ADMIN_DEFAULT_PASSWORD;
  user.role = 'admin';
  user.isEmailVerified = true;
  await user.save();

  console.log(`${created ? 'Created' : 'Promoted'} admin user: ${email}`);
}

createOrPromoteAdmin()
  .catch((error) => {
    console.error('Failed to create admin user:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (connected) await disconnectDB();
  });

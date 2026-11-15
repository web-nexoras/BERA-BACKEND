'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createProductSchema } = require('../src/modules/product/product.validation');
const { checkoutSchema } = require('../src/modules/order/order.validation');

test('missing SSLCOMMERZ_IS_LIVE defaults to boolean false in the parsed env config', (t) => {
  const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bera-env-zod-'));
  t.after(() => fs.rmSync(isolatedCwd, { recursive: true, force: true }));
  const envModule = path.resolve(__dirname, '../src/config/env.js');
  const childEnv = {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1/test',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    BREVO_API_KEY: 'test-brevo-key',
    SSLCOMMERZ_STORE_ID: 'test-store',
    SSLCOMMERZ_STORE_PASS: 'test-pass',
  };
  const result = spawnSync(process.execPath, ['-e', `const env = require(${JSON.stringify(envModule)}); process.stdout.write(JSON.stringify({ value: env.SSLCOMMERZ_IS_LIVE, type: typeof env.SSLCOMMERZ_IS_LIVE }));`], {
    cwd: isolatedCwd,
    env: childEnv,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { value: false, type: 'boolean' });
});

test('Zod 4 validation keeps custom required and invalid-value messages', () => {
  const productResult = createProductSchema.safeParse({});
  assert.equal(productResult.success, false);
  assert.equal(productResult.error.issues.find((issue) => issue.path[0] === 'name')?.message, 'Product name is required');

  const paymentMethod = checkoutSchema.shape.paymentMethod;
  assert.equal(paymentMethod.safeParse(undefined).error.issues[0].message, 'Payment method is required');
  assert.equal(paymentMethod.safeParse('card').error.issues[0].message, 'Payment method must be "cod" or "sslcommerz"');
});

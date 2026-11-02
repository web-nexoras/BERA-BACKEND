'use strict';

/**
 * @file docs/swagger.js
 * @description OpenAPI 3.0 specification for Nexora Fashions Backend API.
 */

const swaggerUi = require('swagger-ui-express');
const env = require('../config/env');

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Nexora Fashions API',
    version: '1.0.0',
    description:
      'Complete Fashion E-commerce Backend API for Nexora Fashions. Built with Node.js, Express, MongoDB, Redis, and SSLCommerz.',
    contact: {
      name: 'Nexora Fashions Support',
      email: 'support@nexorafashions.com',
    },
  },
  servers: [
    { url: `${env.APP_URL}/api/v1`, description: 'Current Server' },
    { url: 'http://localhost:5000/api/v1', description: 'Local Development' },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication & Authorization' },
    { name: 'Users', description: 'User Profile & Address Management' },
    { name: 'Categories', description: 'Product Category Management' },
    { name: 'Brands', description: 'Brand Management' },
    { name: 'Products', description: 'Product CRUD, Search, Variants & Images' },
    { name: 'Inventory', description: 'Stock Management & History (Admin)' },
    { name: 'Cart', description: 'Shopping Cart' },
    { name: 'Wishlist', description: 'Wishlist Management' },
    { name: 'Coupons', description: 'Coupon & Discount Management' },
    { name: 'Orders', description: 'Order Management' },
    { name: 'Payments', description: 'Payment Processing (COD & SSLCommerz)' },
    { name: 'Shipping', description: 'Shipping Zones & Charges' },
    { name: 'Returns', description: 'Return & Refund Management' },
    { name: 'Admin', description: 'Admin Dashboard & Analytics' },
    { name: 'Health', description: 'Health Check' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
    },
    schemas: {
      // ── Common ──────────────────────────────────────────────────────────────
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: { type: 'object' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'array', items: {} },
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              totalPages: { type: 'integer' },
              hasNextPage: { type: 'boolean' },
              hasPrevPage: { type: 'boolean' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
      // ── Auth ──────────────────────────────────────────────────────────────
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'John Doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          password: { type: 'string', minLength: 8, example: 'MyPass@123' },
          phone: { type: 'string', example: '01712345678' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          password: { type: 'string', example: 'MyPass@123' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
      // ── User ──────────────────────────────────────────────────────────────
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          role: { type: 'string', enum: ['customer', 'admin'] },
          isEmailVerified: { type: 'boolean' },
          isBlocked: { type: 'boolean' },
          avatar: { type: 'string' },
          lastLogin: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Address: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          label: { type: 'string', enum: ['home', 'work', 'other'] },
          recipientName: { type: 'string' },
          phone: { type: 'string' },
          addressLine1: { type: 'string' },
          city: { type: 'string' },
          district: { type: 'string' },
          division: { type: 'string' },
          postalCode: { type: 'string' },
          isDefault: { type: 'boolean' },
        },
      },
      // ── Product ──────────────────────────────────────────────────────────
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Classic Cotton T-Shirt' },
          slug: { type: 'string', example: 'classic-cotton-t-shirt' },
          description: { type: 'string' },
          sku: { type: 'string', example: 'NF-TS-001' },
          category: { $ref: '#/components/schemas/Category' },
          brand: { $ref: '#/components/schemas/Brand' },
          images: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, isMain: { type: 'boolean' } } } },
          basePrice: { type: 'number', example: 799 },
          isFeatured: { type: 'boolean' },
          isNewArrival: { type: 'boolean' },
          isBestSeller: { type: 'boolean' },
          status: { type: 'string', enum: ['draft', 'active', 'inactive', 'out_of_stock'] },
          averageRating: { type: 'number' },
          totalSold: { type: 'number' },
          variants: { type: 'array', items: { $ref: '#/components/schemas/Variant' } },
        },
      },
      Variant: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          size: { type: 'string', example: 'M' },
          color: { type: 'string', example: 'Red' },
          colorCode: { type: 'string', example: '#FF0000' },
          sku: { type: 'string', example: 'NF-TS-001-M-RED' },
          price: { type: 'number', example: 699 },
          regularPrice: { type: 'number', example: 799 },
          stock: { type: 'integer', example: 50 },
          isActive: { type: 'boolean' },
        },
      },
      // ── Category ──────────────────────────────────────────────────────────
      Category: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: "Men's Clothing" },
          slug: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' },
          parent: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
        },
      },
      // ── Brand ──────────────────────────────────────────────────────────
      Brand: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Nexora' },
          slug: { type: 'string' },
          logo: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      // ── Cart ──────────────────────────────────────────────────────────
      Cart: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
          appliedCoupon: { type: 'object', nullable: true },
        },
      },
      // ── Order ──────────────────────────────────────────────────────────
      Order: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          orderNumber: { type: 'string', example: 'NF-2024-A3F7C2' },
          items: { type: 'array', items: { type: 'object' } },
          pricing: {
            type: 'object',
            properties: {
              subtotal: { type: 'number' },
              shippingCharge: { type: 'number' },
              discountAmount: { type: 'number' },
              total: { type: 'number' },
            },
          },
          paymentMethod: { type: 'string', enum: ['cod', 'sslcommerz'] },
          paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
          orderStatus: { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ── Coupon ─────────────────────────────────────────────────────────
      Coupon: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string', example: 'SAVE20' },
          type: { type: 'string', enum: ['percentage', 'fixed'] },
          value: { type: 'number', example: 20 },
          minimumOrderAmount: { type: 'number', example: 500 },
          maximumDiscount: { type: 'number' },
          expiresAt: { type: 'string', format: 'date-time' },
          isActive: { type: 'boolean' },
        },
      },
    },
    responses: {
      Unauthorized: { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Forbidden: { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      NotFound: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      ValidationError: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    },
  },
  paths: {
    // ── Health ────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: { 200: { description: 'API is running' } },
      },
    },
    // ── Auth ─────────────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new customer account',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          201: { description: 'Registered successfully. Verification email sent.' },
          409: { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/verify-email/{token}': {
      get: {
        tags: ['Auth'],
        summary: 'Verify email address',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Email verified successfully' }, 400: { description: 'Invalid or expired token' } },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset email',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { 200: { description: 'Password reset email sent (if account exists)' } },
      },
    },
    '/auth/reset-password/{token}': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with token',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['password', 'confirmPassword'], properties: { password: { type: 'string', minLength: 8 }, confirmPassword: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Password reset successful' }, 400: { description: 'Invalid or expired token' } },
      },
    },
    '/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Get new access token using refresh token',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } } },
        responses: { 200: { description: 'New tokens issued' }, 401: { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (revoke refresh token)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Logged out successfully' } },
      },
    },
    '/auth/change-password': {
      put: {
        tags: ['Auth'],
        summary: 'Change password (authenticated)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['currentPassword', 'newPassword', 'confirmPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 }, confirmPassword: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Password changed' }, 401: { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    // ── Users ─────────────────────────────────────────────────────────────
    '/users/profile': {
      get: {
        tags: ['Users'], summary: 'Get my profile', security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Profile data', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } },
      },
      put: {
        tags: ['Users'], summary: 'Update my profile', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } } } } },
        responses: { 200: { description: 'Profile updated' } },
      },
    },
    '/users/addresses': {
      get: {
        tags: ['Users'], summary: 'Get my addresses', security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'List of addresses' } },
      },
      post: {
        tags: ['Users'], summary: 'Add a new address', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Address' } } } },
        responses: { 201: { description: 'Address added' } },
      },
    },
    '/users/addresses/{addressId}': {
      put: {
        tags: ['Users'], summary: 'Update an address', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'addressId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Address' } } } },
        responses: { 200: { description: 'Address updated' } },
      },
      delete: {
        tags: ['Users'], summary: 'Delete an address', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'addressId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Address deleted' } },
      },
    },
    // ── Categories ─────────────────────────────────────────────────────────
    '/categories': {
      get: { tags: ['Categories'], summary: 'Get all categories (public)', responses: { 200: { description: 'Categories list' } } },
      post: {
        tags: ['Categories'], summary: 'Create category (Admin)', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, parent: { type: 'string' }, isActive: { type: 'boolean' } } } } } },
        responses: { 201: { description: 'Category created' } },
      },
    },
    '/categories/tree': {
      get: { tags: ['Categories'], summary: 'Get hierarchical category tree (public)', responses: { 200: { description: 'Category tree' } } },
    },
    '/categories/{id}': {
      get: {
        tags: ['Categories'], summary: 'Get category by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Category' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      put: {
        tags: ['Categories'], summary: 'Update category (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Category updated' } },
      },
      delete: {
        tags: ['Categories'], summary: 'Delete category (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Category deleted' } },
      },
    },
    // ── Brands ─────────────────────────────────────────────────────────────
    '/brands': {
      get: { tags: ['Brands'], summary: 'Get all brands (public)', responses: { 200: { description: 'Brand list' } } },
      post: {
        tags: ['Brands'], summary: 'Create brand (Admin)', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, website: { type: 'string' } } } } } },
        responses: { 201: { description: 'Brand created' } },
      },
    },
    '/brands/{id}': {
      get: {
        tags: ['Brands'], summary: 'Get brand by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Brand' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      put: {
        tags: ['Brands'], summary: 'Update brand (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: false, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Brand updated' } },
      },
      delete: {
        tags: ['Brands'], summary: 'Delete brand (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Brand deleted' } },
      },
    },
    // ── Products ─────────────────────────────────────────────────────────────
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'Get products with filters & pagination (public)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category ObjectId' },
          { name: 'brand', in: 'query', schema: { type: 'string' }, description: 'Brand ObjectId' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'oldest', 'price_asc', 'price_desc', 'popular', 'rating'] } },
          { name: 'isFeatured', in: 'query', schema: { type: 'boolean' } },
          { name: 'isNewArrival', in: 'query', schema: { type: 'boolean' } },
          { name: 'isBestSeller', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'Paginated product list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: {
        tags: ['Products'], summary: 'Create product (Admin)', security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['name', 'description', 'sku', 'category', 'basePrice'],
                properties: {
                  name: { type: 'string', example: 'Classic Cotton T-Shirt' },
                  description: { type: 'string' },
                  sku: { type: 'string', example: 'NF-TS-001' },
                  category: { type: 'string', description: 'Category ObjectId' },
                  brand: { type: 'string', description: 'Brand ObjectId' },
                  basePrice: { type: 'number', example: 799 },
                  isFeatured: { type: 'boolean' },
                  isNewArrival: { type: 'boolean' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Product created' } },
      },
    },
    '/products/featured': {
      get: { tags: ['Products'], summary: 'Get featured products (public)', responses: { 200: { description: 'Featured products' } } },
    },
    '/products/new-arrivals': {
      get: { tags: ['Products'], summary: 'Get new arrivals (public)', responses: { 200: { description: 'New arrivals' } } },
    },
    '/products/best-sellers': {
      get: { tags: ['Products'], summary: 'Get best sellers (public)', responses: { 200: { description: 'Best sellers' } } },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'], summary: 'Get product by ID with variants (public)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Product detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      put: {
        tags: ['Products'], summary: 'Update product (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Product updated' } },
      },
      delete: {
        tags: ['Products'], summary: 'Delete product (Admin, soft-delete)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Product deleted' } },
      },
    },
    '/products/{id}/related': {
      get: {
        tags: ['Products'], summary: 'Get related products (same category)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 8 } }],
        responses: { 200: { description: 'Related products' } },
      },
    },
    '/products/{id}/variants': {
      post: {
        tags: ['Products'], summary: 'Add variants to product (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  variants: {
                    type: 'array',
                    items: {
                      type: 'object', required: ['sku', 'price', 'regularPrice', 'stock'],
                      properties: {
                        size: { type: 'string', example: 'M' },
                        color: { type: 'string', example: 'Red' },
                        colorCode: { type: 'string', example: '#FF0000' },
                        sku: { type: 'string', example: 'NF-TS-001-M-RED' },
                        price: { type: 'number', example: 699 },
                        regularPrice: { type: 'number', example: 799 },
                        stock: { type: 'integer', example: 100 },
                        lowStockThreshold: { type: 'integer', example: 5 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Variants added' } },
      },
    },
    // ── Inventory ─────────────────────────────────────────────────────────────
    '/inventory': {
      get: {
        tags: ['Inventory'], summary: 'Get paginated inventory (Admin)', security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'lowStock', in: 'query', schema: { type: 'boolean' } },
          { name: 'outOfStock', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'Inventory list' } },
      },
    },
    '/inventory/low-stock': {
      get: { tags: ['Inventory'], summary: 'Get low stock variants (Admin)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Low stock list' } } },
    },
    '/inventory/out-of-stock': {
      get: { tags: ['Inventory'], summary: 'Get out-of-stock variants (Admin)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Out-of-stock list' } } },
    },
    '/inventory/adjust': {
      post: {
        tags: ['Inventory'], summary: 'Manual stock adjustment (Admin)', security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['variantId', 'quantity', 'type'],
                properties: {
                  variantId: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                  type: { type: 'string', enum: ['increment', 'decrement'] },
                  reference: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Stock adjusted' } },
      },
    },
    // ── Cart ─────────────────────────────────────────────────────────────────
    '/cart': {
      get: { tags: ['Cart'], summary: 'Get my cart', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Cart data' } } },
      delete: { tags: ['Cart'], summary: 'Clear cart', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Cart cleared' } } },
    },
    '/cart/summary': {
      get: { tags: ['Cart'], summary: 'Get cart totals summary', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Cart summary' } } },
    },
    '/cart/items': {
      post: {
        tags: ['Cart'], summary: 'Add item to cart', security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['productId', 'variantId', 'quantity'], properties: { productId: { type: 'string' }, variantId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } } } } },
        },
        responses: { 201: { description: 'Item added' }, 409: { description: 'Insufficient stock' } },
      },
    },
    '/cart/items/{variantId}': {
      put: {
        tags: ['Cart'], summary: 'Update cart item quantity', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'variantId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { quantity: { type: 'integer', minimum: 1 } } } } } },
        responses: { 200: { description: 'Cart updated' } },
      },
      delete: {
        tags: ['Cart'], summary: 'Remove item from cart', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'variantId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Item removed' } },
      },
    },
    '/cart/coupon': {
      post: {
        tags: ['Cart'], summary: 'Apply coupon to cart', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { code: { type: 'string', example: 'SAVE20' } } } } } },
        responses: { 200: { description: 'Coupon applied' }, 400: { description: 'Invalid coupon' } },
      },
      delete: { tags: ['Cart'], summary: 'Remove coupon from cart', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Coupon removed' } } },
    },
    // ── Wishlist ─────────────────────────────────────────────────────────────
    '/wishlist': {
      get: { tags: ['Wishlist'], summary: 'Get my wishlist', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Wishlist' } } },
      delete: { tags: ['Wishlist'], summary: 'Clear wishlist', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Cleared' } } },
    },
    '/wishlist/items': {
      post: {
        tags: ['Wishlist'], summary: 'Add product to wishlist', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { productId: { type: 'string' } } } } } },
        responses: { 200: { description: 'Added to wishlist' } },
      },
    },
    '/wishlist/items/{productId}': {
      delete: {
        tags: ['Wishlist'], summary: 'Remove from wishlist', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Removed' } },
      },
    },
    // ── Orders ─────────────────────────────────────────────────────────────
    '/orders/checkout': {
      post: {
        tags: ['Orders'], summary: 'Place an order (checkout)', security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['shippingAddress', 'paymentMethod'],
                properties: {
                  shippingAddress: {
                    type: 'object', required: ['recipientName', 'phone', 'addressLine1', 'city', 'district', 'division'],
                    properties: {
                      recipientName: { type: 'string' }, phone: { type: 'string' },
                      addressLine1: { type: 'string' }, city: { type: 'string' },
                      district: { type: 'string' }, division: { type: 'string' },
                      postalCode: { type: 'string' },
                    },
                  },
                  paymentMethod: { type: 'string', enum: ['cod', 'sslcommerz'] },
                  couponCode: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Order placed. Returns order + paymentUrl (if sslcommerz).' }, 400: { description: 'Cart empty or stock issue' } },
      },
    },
    '/orders': {
      get: {
        tags: ['Orders'], summary: 'Get my orders (paginated)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'status', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'My orders' } },
      },
    },
    '/orders/my/{orderId}': {
      get: {
        tags: ['Orders'], summary: 'Get my order by ID', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Order detail' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/orders/{orderId}/cancel': {
      post: {
        tags: ['Orders'], summary: 'Cancel my order', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } },
        responses: { 200: { description: 'Order cancelled' }, 400: { description: 'Cannot cancel at this stage' } },
      },
    },
    '/orders/admin/all': {
      get: {
        tags: ['Orders'], summary: 'Get all orders (Admin)', security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'paymentStatus', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by order number' },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'All orders' } },
      },
    },
    '/orders/admin/{orderId}/status': {
      put: {
        tags: ['Orders'], summary: 'Update order status (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] }, note: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Status updated' } },
      },
    },
    // ── Payments ─────────────────────────────────────────────────────────────
    '/payments/initiate': {
      post: {
        tags: ['Payments'], summary: 'Initiate SSLCommerz payment for an order', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { orderId: { type: 'string' } } } } } },
        responses: { 200: { description: 'Returns SSLCommerz payment URL' } },
      },
    },
    '/payments/my-transactions': {
      get: { tags: ['Payments'], summary: 'Get my transaction history', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Transactions' } } },
    },
    '/payments/admin/all': {
      get: { tags: ['Payments'], summary: 'Get all transactions (Admin)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'All transactions' } } },
    },
    // ── Shipping ─────────────────────────────────────────────────────────────
    '/shipping/zones': {
      get: { tags: ['Shipping'], summary: 'Get all shipping zones (public)', responses: { 200: { description: 'Zones' } } },
    },
    '/shipping/charge': {
      get: {
        tags: ['Shipping'], summary: 'Get shipping charge for a district (public)',
        parameters: [{ name: 'district', in: 'query', required: true, schema: { type: 'string', example: 'Dhaka' } }],
        responses: { 200: { description: 'Shipping charge' } },
      },
    },
    // ── Coupons ─────────────────────────────────────────────────────────────
    '/coupons/validate': {
      post: {
        tags: ['Coupons'], summary: 'Validate coupon and preview discount', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code', 'orderAmount'], properties: { code: { type: 'string', example: 'SAVE20' }, orderAmount: { type: 'number', example: 1000 } } } } } },
        responses: { 200: { description: 'Coupon valid, discount calculated' }, 400: { description: 'Invalid coupon' } },
      },
    },
    '/coupons': {
      get: { tags: ['Coupons'], summary: 'Get all coupons (Admin)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Coupons list' } } },
      post: {
        tags: ['Coupons'], summary: 'Create coupon (Admin)', security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['code', 'type', 'value', 'expiresAt'],
                properties: {
                  code: { type: 'string', example: 'SAVE20' },
                  type: { type: 'string', enum: ['percentage', 'fixed'] },
                  value: { type: 'number', example: 20 },
                  minimumOrderAmount: { type: 'number', example: 500 },
                  maximumDiscount: { type: 'number' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  usageLimit: { type: 'integer' },
                  isFirstOrderOnly: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Coupon created' } },
      },
    },
    // ── Admin ─────────────────────────────────────────────────────────────
    '/admin/dashboard': {
      get: { tags: ['Admin'], summary: 'Get dashboard analytics stats (Admin)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Dashboard stats' } } },
    },
    '/admin/dashboard/monthly-sales': {
      get: {
        tags: ['Admin'], summary: 'Get monthly sales chart data (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'year', in: 'query', schema: { type: 'integer', example: 2024 } }],
        responses: { 200: { description: '12-month sales data' } },
      },
    },
    '/admin/reports/sales': {
      get: {
        tags: ['Admin'], summary: 'Sales report (Admin)', security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Sales report' } },
      },
    },
    '/admin/reports/inventory': {
      get: { tags: ['Admin'], summary: 'Inventory report (Admin)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Inventory report' } } },
    },
    '/admin/customers': {
      get: {
        tags: ['Admin'], summary: 'Get all customers (Admin)', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'isBlocked', in: 'query', schema: { type: 'boolean' } }],
        responses: { 200: { description: 'Customer list' } },
      },
    },
    '/admin/settings': {
      get: { tags: ['Admin'], summary: 'Get store settings (Admin)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Settings' } } },
      put: {
        tags: ['Admin'], summary: 'Update store settings (Admin)', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Settings updated' } },
      },
    },
  },
};

const swaggerUiOptions = {
  customSiteTitle: 'Nexora Fashions API Docs',
  customCss: `
    .swagger-ui .topbar { background-color: #000; }
    .swagger-ui .topbar-wrapper img { display: none; }
    .swagger-ui .topbar-wrapper::after { content: "Nexora Fashions API"; color: white; font-size: 20px; font-weight: bold; }
  `,
  swaggerOptions: { persistAuthorization: true },
};

module.exports = { swaggerSpec, swaggerUi, swaggerUiOptions };

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Kronos Atelier — Enterprise E-Commerce Platform API',
    version: '1.0.0',
    description:
      'Production REST API for Kronos Atelier E-Commerce Platform. Provides JWT authentication, RBAC authorization (CUSTOMER, ADMIN, SUPER_ADMIN), catalog & inventory management, cart calculations, order orchestration, payment intents, product reviews, health telemetry, and deployment notifications.',
    contact: {
      name: 'Kronos Platform Engineering',
      email: 'engineering@kronos-atelier.internal',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Version 1 Production REST API',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input parameters.' },
            },
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          sku: { type: 'string', example: 'KRN-AUD-001' },
          name: { type: 'string', example: 'Monolith Reference Studio Monitor (Pair)' },
          price: { type: 'number', example: 3450.0 },
          discount_percent: { type: 'number', example: 0 },
          stock_quantity: { type: 'integer', example: 14 },
          is_available: { type: 'boolean', example: true },
          category_id: { type: 'string' },
          brand: { type: 'string' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          order_number: { type: 'string', example: 'KRN-2026-1042' },
          status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
          },
          payment_status: {
            type: 'string',
            enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
          },
          total_amount: { type: 'number', example: 3726.0 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System & DevOps'],
        summary: 'Production health check endpoint',
        responses: {
          '200': { description: 'Application, database, memory, and TLS status are healthy' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new customer account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                  fullName: { type: 'string' },
                  phone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User registered and tokens issued' },
          '400': { description: 'Validation error or duplicate email' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate user and issue JWT access + refresh tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authenticated successfully' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/products': {
      get: {
        tags: ['Catalog'],
        summary: 'List products with search, category filter, sorting, and pagination',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Paginated product catalog response' },
        },
      },
      post: {
        tags: ['Admin Catalog'],
        summary: 'Create a new product (ADMIN / SUPER_ADMIN)',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Product created' },
          '403': { description: 'Forbidden for non-admin users' },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Catalog'],
        summary: 'Get single product details and verified reviews',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Product detail record' },
          '404': { description: 'Product not found' },
        },
      },
    },
    '/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Get authenticated user cart with calculated subtotal, discount, tax, total',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Calculated cart state' } },
      },
      post: {
        tags: ['Cart'],
        summary: 'Add product to cart with live stock validation',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Updated cart state' } },
      },
    },
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List authenticated customer order history',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of customer orders' } },
      },
      post: {
        tags: ['Orders'],
        summary: 'Checkout and create order with atomic inventory deduction',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Order created and confirmed' },
          '400': { description: 'Stock validation or cart error' },
        },
      },
    },
    '/admin/overview': {
      get: {
        tags: ['Admin Console'],
        summary: 'Retrieve executive sales KPIs, inventory alerts, and security logs',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Admin dashboard metrics' },
          '403': { description: 'Forbidden' },
        },
      },
    },
  },
};

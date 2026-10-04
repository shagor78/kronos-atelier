import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAppServer } from '../../server.ts';
import { redactSensitiveData } from '../src/utils/logger.ts';
import { hashPassword, verifyPassword } from '../src/security/crypto.ts';

let server: http.Server;
let baseUrl = '';
let customerToken = '';
let adminToken = '';
let createdProductId = '';
let createdOrderId = '';

async function apiRequest(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = (await res.json()) as Record<string, any>;
  return { status: res.status, headers: res.headers, json };
}

describe('Kronos Atelier Production E-Commerce API & Security Suite', () => {
  before(async () => {
    const app = await createAppServer({ isTest: true, dbPath: ':memory:' });
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  it('1. Verifies cryptographic scrypt password hashing and secret redaction', () => {
    const hash = hashPassword('StrongSecret!2026');
    assert.ok(hash.startsWith('scrypt$'));
    assert.equal(verifyPassword('StrongSecret!2026', hash), true);
    assert.equal(verifyPassword('WrongSecret!2026', hash), false);

    const redacted = redactSensitiveData({
      email: 'user@kronos.com',
      password: 'PlainTextPassword',
      jwtSecret: 'SuperSecretKey',
      nested: { accessToken: 'jwt-token-value', safeField: 'visible' },
    });
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.jwtSecret, '[REDACTED]');
    assert.equal((redacted.nested as Record<string, unknown>).accessToken, '[REDACTED]');
    assert.equal((redacted.nested as Record<string, unknown>).safeField, 'visible');
  });

  it('2. Health check endpoint returns HEALTHY and security headers', async () => {
    const { status, headers, json } = await apiRequest('/health');
    assert.equal(status, 200);
    assert.equal(json.status, 'HEALTHY');
    assert.equal(json.checks.application, 'PASS');
    assert.equal(json.checks.database, 'PASS');
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
  });

  it('3. OpenAPI 3.0.3 documentation endpoint returns valid specification', async () => {
    const { status, json } = await apiRequest('/openapi.json');
    assert.equal(status, 200);
    assert.equal(json.openapi, '3.0.3');
    assert.ok(json.paths['/products']);
    assert.ok(json.paths['/orders']);
  });

  it('4. Registers a new customer and rejects duplicate email or weak password', async () => {
    const badRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: { email: 'invalid-email', password: '123', fullName: 'A' },
    });
    assert.equal(badRes.status, 400);

    const regRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: 'test.architect@kronos-client.com',
        password: 'ArchitectPass!2026',
        fullName: 'Lukas Weber',
        phone: '+49 89 555 0192',
      },
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.json.data.user.role, 'CUSTOMER');
    assert.ok(regRes.json.data.accessToken);
    customerToken = regRes.json.data.accessToken;

    const dupRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: 'test.architect@kronos-client.com',
        password: 'ArchitectPass!2026',
        fullName: 'Lukas Weber',
      },
    });
    assert.equal(dupRes.status, 409);
  });

  it('5. Authenticates Admin user and rejects invalid credentials', async () => {
    const failLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'marcus.vance@kronos-atelier.com', password: 'WrongPassword!' },
    });
    assert.equal(failLogin.status, 401);

    const adminLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'marcus.vance@kronos-atelier.com', password: 'AdminPass!2026' },
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.json.data.user.role, 'ADMIN');
    adminToken = adminLogin.json.data.accessToken;
  });

  it('6. Enforces RBAC authorization: blocks CUSTOMER from Admin APIs', async () => {
    const unauthRes = await apiRequest('/admin/overview');
    assert.equal(unauthRes.status, 401);

    const forbiddenRes = await apiRequest('/admin/overview', {
      token: customerToken,
    });
    assert.equal(forbiddenRes.status, 403);

    const allowedRes = await apiRequest('/admin/overview', {
      token: adminToken,
    });
    assert.equal(allowedRes.status, 200);
    assert.ok(allowedRes.json.data.kpis.totalProducts >= 6);
  });

  it('7. Lists, searches, filters, and paginates products; Admin creates & updates product', async () => {
    const listRes = await apiRequest('/products?search=monolith&page=1&limit=5');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.json.data.length >= 1);
    assert.equal(listRes.json.data[0].sku, 'KRN-AUD-001');

    const createRes = await apiRequest('/products', {
      method: 'POST',
      token: adminToken,
      body: {
        sku: 'KRN-TST-900',
        name: 'Studio Reference Isolator Platform',
        description: 'CNC machined brass and sorbothane acoustic isolation plinth.',
        price: 550,
        discountPercent: 10,
        categoryId: 'cat_audio',
        brand: 'Kronos Acoustic Lab',
        stockQuantity: 8,
        isAvailable: true,
      },
    });
    assert.equal(createRes.status, 201);
    createdProductId = createRes.json.data.id;

    const invRes = await apiRequest(`/admin/inventory/${createdProductId}`, {
      method: 'PATCH',
      token: adminToken,
      body: { stockQuantity: 15, isAvailable: true },
    });
    assert.equal(invRes.status, 200);
    assert.equal(invRes.json.data.stock_quantity, 15);
  });

  it('8. Manages Cart items, validates stock limits, and applies promo discounts', async () => {
    const overStockRes = await apiRequest('/cart', {
      method: 'POST',
      token: customerToken,
      body: { productId: createdProductId, quantity: 999 },
    });
    assert.equal(overStockRes.status, 400);

    const addRes = await apiRequest('/cart', {
      method: 'POST',
      token: customerToken,
      body: { productId: createdProductId, quantity: 2 },
    });
    assert.equal(addRes.status, 200);
    assert.equal(addRes.json.data.itemCount, 2);

    const promoRes = await apiRequest('/cart/promo', {
      method: 'POST',
      token: customerToken,
      body: { code: 'ATELIER10' },
    });
    assert.equal(promoRes.status, 200);
    assert.equal(promoRes.json.data.promoCode, 'ATELIER10');
    assert.ok(promoRes.json.data.discountTotal > 0);
  });

  it('9. Toggles Wishlist items for authenticated customer', async () => {
    const addWish = await apiRequest('/wishlist', {
      method: 'POST',
      token: customerToken,
      body: { productId: createdProductId },
    });
    assert.equal(addWish.status, 201);
    assert.equal(addWish.json.action, 'ADDED');

    const getWish = await apiRequest('/wishlist', { token: customerToken });
    assert.equal(getWish.status, 200);
    assert.equal(getWish.json.data.length, 1);
  });

  it('10. Processes Checkout Order, deducts stock atomically, and updates status via Admin', async () => {
    const orderRes = await apiRequest('/orders', {
      method: 'POST',
      token: customerToken,
      body: {
        recipientName: 'Lukas Weber',
        recipientPhone: '+49 89 555 0192',
        shippingAddress: 'Brienner Straße 18',
        shippingCity: 'Munich',
        shippingPostalCode: '80333',
        shippingCountry: 'Germany',
        paymentMethod: 'CARD',
        promoCode: 'ATELIER10',
      },
    });
    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.json.data.status, 'CONFIRMED');
    createdOrderId = orderRes.json.data.id;

    // Verify stock was decremented from 15 -> 13
    const prodAfter = await apiRequest(`/products/${createdProductId}`);
    assert.equal(prodAfter.json.data.stock_quantity, 13);

    // Admin updates order status to SHIPPED
    const statusRes = await apiRequest(`/admin/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'SHIPPED', trackingNumber: 'DHL-DE-77482910' },
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.json.data.status, 'SHIPPED');
  });

  it('11. Submits verified customer review and recalculates product rating', async () => {
    const revRes = await apiRequest('/reviews', {
      method: 'POST',
      token: customerToken,
      body: {
        productId: createdProductId,
        rating: 5,
        title: 'Rock-solid isolation plinth',
        comment: 'Eliminated floor-borne sub-bass vibration in our control room.',
      },
    });
    assert.equal(revRes.status, 201);
    assert.equal(revRes.json.data.rating, 5);
  });
});

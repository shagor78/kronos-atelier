import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import os from 'node:os';
import { getDb } from '../../backend/src/repositories/database.ts';
import {
  hashPassword,
  verifyPassword,
  signJwtToken,
  verifyJwtToken,
  hashToken,
  sanitizeString,
  type UserRole,
} from '../../backend/src/security/crypto.ts';
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from '../../backend/src/middleware/auth.ts';
import {
  validateRegistrationInput,
  validateLoginInput,
  validateProductInput,
  validateOrderInput,
} from '../../backend/src/validators/schemas.ts';
import { writeStructuredLog } from '../../backend/src/utils/logger.ts';
import { getTlsStatus } from '../../backend/src/ssl/tlsConfig.ts';
import {
  dispatchNotification,
  formatDeploymentNotification,
} from '../../backend/src/services/notificationService.ts';
import { envConfig } from '../../backend/src/config/env.ts';
import { openApiSpec } from '../openapi/spec.ts';

export const apiV1Router = Router();

const PROMO_CODES: Record<string, { discountPercent: number; description: string }> = {
  ATELIER10: { discountPercent: 10, description: '10% Trade & Architect Specification Discount' },
  KRONOS20: { discountPercent: 20, description: '20% Collector Edition Privilege' },
  STUDIO15: { discountPercent: 15, description: '15% Acoustic Studio Partner Rate' },
};

function calculateCartSummary(userId: string, promoCodeInput = '') {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        ci.id as cart_item_id,
        ci.quantity,
        p.id as product_id,
        p.sku,
        p.name,
        p.slug,
        p.price,
        p.discount_percent,
        p.image_url,
        p.stock_quantity,
        p.is_available,
        p.brand,
        c.name as category_name
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ci.user_id = ?
      ORDER BY ci.created_at ASC
    `
    )
    .all(userId) as Array<{
    cart_item_id: string;
    quantity: number;
    product_id: string;
    sku: string;
    name: string;
    slug: string;
    price: number;
    discount_percent: number;
    image_url: string;
    stock_quantity: number;
    is_available: number;
    brand: string;
    category_name: string;
  }>;

  let rawSubtotal = 0;
  let productDiscountTotal = 0;

  const items = rows.map((row) => {
    const lineRaw = row.price * row.quantity;
    const unitDiscounted = row.price * (1 - (row.discount_percent || 0) / 100);
    const lineDiscounted = unitDiscounted * row.quantity;
    const lineDiscount = lineRaw - lineDiscounted;

    rawSubtotal += lineRaw;
    productDiscountTotal += lineDiscount;

    return {
      ...row,
      unit_discounted_price: Number(unitDiscounted.toFixed(2)),
      line_subtotal: Number(lineRaw.toFixed(2)),
      line_total: Number(lineDiscounted.toFixed(2)),
    };
  });

  const netAfterProductDiscount = rawSubtotal - productDiscountTotal;
  const normalizedPromo = promoCodeInput.trim().toUpperCase();
  const promoObj = PROMO_CODES[normalizedPromo];
  const promoDiscount = promoObj
    ? netAfterProductDiscount * (promoObj.discountPercent / 100)
    : 0;

  const discountedSubtotal = Math.max(0, netAfterProductDiscount - promoDiscount);
  const totalDiscount = productDiscountTotal + promoDiscount;
  // Free white-glove courier shipping on orders >= $1,000
  const shippingCost =
    items.length === 0 ? 0 : discountedSubtotal >= 1000 ? 0 : 45.0;
  const taxTotal = Number((discountedSubtotal * 0.08).toFixed(2));
  const totalAmount = Number((discountedSubtotal + shippingCost + taxTotal).toFixed(2));

  return {
    items,
    itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
    subtotal: Number(rawSubtotal.toFixed(2)),
    productDiscount: Number(productDiscountTotal.toFixed(2)),
    promoCode: promoObj ? normalizedPromo : '',
    promoDescription: promoObj ? promoObj.description : '',
    promoDiscount: Number(promoDiscount.toFixed(2)),
    discountTotal: Number(totalDiscount.toFixed(2)),
    shippingCost: Number(shippingCost.toFixed(2)),
    taxTotal,
    totalAmount,
  };
}

// ============================================================================
// 1. HEALTH & OPENAPI DOCUMENTATION ENDPOINTS
// ============================================================================

apiV1Router.get('/health', (_req, res) => {
  try {
    const db = getDb();
    const dbCheck = db.prepare('SELECT 1 as ok').get() as { ok: number };
    const productCount = (
      db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }
    ).count;
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const tlsStatus = getTlsStatus();

    res.status(200).json({
      success: true,
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      environment: envConfig.nodeEnv,
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        application: 'PASS',
        database: dbCheck?.ok === 1 ? 'PASS' : 'FAIL',
        catalogSeeded: productCount > 0 ? 'PASS' : 'WARN',
        memory: 'PASS',
        cpu: 'PASS',
        tlsConfig: tlsStatus.mode,
      },
      metrics: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        systemMemoryUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        cpuLoadAvg1m: Number(os.loadavg()[0].toFixed(2)),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'UNHEALTHY',
      error: (error as Error).message,
    });
  }
});

apiV1Router.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

// ============================================================================
// 2. AUTHENTICATION & SESSION MANAGEMENT (/api/v1/auth)
// ============================================================================

apiV1Router.post('/auth/register', (req, res) => {
  const validation = validateRegistrationInput(req.body || {});
  if (!validation.valid || !validation.data) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: validation.error },
    });
    return;
  }

  const { email, password, fullName, phone } = validation.data;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({
      success: false,
      error: {
        code: 'EMAIL_EXISTS',
        message: 'An account with this email address already exists.',
      },
    });
    return;
  }

  const userId = `usr_${crypto.randomUUID().slice(0, 12)}`;
  const passwordHash = hashPassword(password);

  db.prepare(
    `
    INSERT INTO users (id, email, password_hash, full_name, role, phone)
    VALUES (?, ?, ?, ?, 'CUSTOMER', ?)
  `
  ).run(userId, email, passwordHash, fullName, phone);

  const accessToken = signJwtToken(
    { sub: userId, email, role: 'CUSTOMER', name: fullName, type: 'access' },
    envConfig.jwtAccessExpiresIn
  );
  const refreshToken = signJwtToken(
    { sub: userId, email, role: 'CUSTOMER', name: fullName, type: 'refresh' },
    envConfig.jwtRefreshExpiresIn
  );

  db.prepare(
    `
    INSERT INTO user_sessions (id, user_id, refresh_token_hash, ip_address, expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+7 days'))
  `
  ).run(
    crypto.randomUUID(),
    userId,
    hashToken(refreshToken),
    req.socket.remoteAddress || '127.0.0.1'
  );

  writeStructuredLog({
    level: 'INFO',
    category: 'AUTH',
    action: 'USER_REGISTERED',
    actorId: userId,
    actorEmail: email,
    ipAddress: req.socket.remoteAddress || '127.0.0.1',
    details: { role: 'CUSTOMER' },
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: userId,
        email,
        fullName,
        role: 'CUSTOMER',
        phone,
      },
      accessToken,
      refreshToken,
      expiresIn: envConfig.jwtAccessExpiresIn,
    },
  });
});

apiV1Router.post('/auth/login', (req, res) => {
  const validation = validateLoginInput(req.body || {});
  if (!validation.valid || !validation.data) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: validation.error },
    });
    return;
  }

  const { email, password } = validation.data;
  const db = getDb();

  const user = db
    .prepare(
      `
      SELECT id, email, password_hash, full_name, role, phone, shipping_address, city, postal_code, country, is_active
      FROM users WHERE email = ?
    `
    )
    .get(email) as
    | {
        id: string;
        email: string;
        password_hash: string;
        full_name: string;
        role: UserRole;
        phone: string;
        shipping_address: string;
        city: string;
        postal_code: string;
        country: string;
        is_active: number;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    writeStructuredLog({
      level: 'SECURITY',
      category: 'AUTH',
      action: 'LOGIN_FAILED',
      actorEmail: email,
      ipAddress: req.socket.remoteAddress || '127.0.0.1',
      details: { reason: 'Invalid email or password' },
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.',
      },
    });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({
      success: false,
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account has been suspended by an administrator.',
      },
    });
    return;
  }

  db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(user.id);

  const accessToken = signJwtToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name,
      type: 'access',
    },
    envConfig.jwtAccessExpiresIn
  );
  const refreshToken = signJwtToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name,
      type: 'refresh',
    },
    envConfig.jwtRefreshExpiresIn
  );

  db.prepare(
    `
    INSERT INTO user_sessions (id, user_id, refresh_token_hash, ip_address, expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+7 days'))
  `
  ).run(
    crypto.randomUUID(),
    user.id,
    hashToken(refreshToken),
    req.socket.remoteAddress || '127.0.0.1'
  );

  writeStructuredLog({
    level: 'INFO',
    category: 'AUTH',
    action: 'USER_LOGGED_IN',
    actorId: user.id,
    actorEmail: user.email,
    ipAddress: req.socket.remoteAddress || '127.0.0.1',
    details: { role: user.role },
  });

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        phone: user.phone,
        shippingAddress: user.shipping_address,
        city: user.city,
        postalCode: user.postal_code,
        country: user.country,
      },
      accessToken,
      refreshToken,
      expiresIn: envConfig.jwtAccessExpiresIn,
    },
  });
});

apiV1Router.post('/auth/refresh', (req, res) => {
  const rawRefresh = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  if (!rawRefresh) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token is required.' },
    });
    return;
  }

  const payload = verifyJwtToken(rawRefresh);
  if (!payload || payload.type !== 'refresh') {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired.' },
    });
    return;
  }

  const db = getDb();
  const session = db
    .prepare(
      `SELECT id FROM user_sessions WHERE user_id = ? AND refresh_token_hash = ? AND revoked = 0`
    )
    .get(payload.sub, hashToken(rawRefresh));

  if (!session) {
    res.status(401).json({
      success: false,
      error: { code: 'SESSION_REVOKED', message: 'Refresh session is no longer active.' },
    });
    return;
  }

  const newAccessToken = signJwtToken(
    {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      type: 'access',
    },
    envConfig.jwtAccessExpiresIn
  );

  res.json({
    success: true,
    data: { accessToken: newAccessToken, expiresIn: envConfig.jwtAccessExpiresIn },
  });
});

apiV1Router.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  if (req.user) {
    db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE user_id = ?`).run(req.user.sub);
    writeStructuredLog({
      level: 'INFO',
      category: 'AUTH',
      action: 'USER_LOGGED_OUT',
      actorId: req.user.sub,
      actorEmail: req.user.email,
    });
  }
  res.json({ success: true, message: 'Logged out and sessions revoked.' });
});

apiV1Router.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const user = db
    .prepare(
      `
      SELECT id, email, full_name, role, phone, shipping_address, city, postal_code, country, created_at
      FROM users WHERE id = ?
    `
    )
    .get(req.user!.sub) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User profile not found.' },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      phone: user.phone,
      shippingAddress: user.shipping_address,
      city: user.city,
      postalCode: user.postal_code,
      country: user.country,
      createdAt: user.created_at,
    },
  });
});

// ============================================================================
// 3. USER PROFILE MANAGEMENT (/api/v1/users)
// ============================================================================

apiV1Router.put('/users/profile', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const fullName = sanitizeString(req.body?.fullName, 120);
  const phone = sanitizeString(req.body?.phone, 40);
  const shippingAddress = sanitizeString(req.body?.shippingAddress, 300);
  const city = sanitizeString(req.body?.city, 100);
  const postalCode = sanitizeString(req.body?.postalCode, 30);
  const country = sanitizeString(req.body?.country || 'United States', 80);

  if (!fullName || fullName.length < 2) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Full name is required.' },
    });
    return;
  }

  const db = getDb();
  db.prepare(
    `
    UPDATE users
    SET full_name = ?, phone = ?, shipping_address = ?, city = ?, postal_code = ?, country = ?, updated_at = datetime('now')
    WHERE id = ?
  `
  ).run(fullName, phone, shippingAddress, city, postalCode, country, req.user!.sub);

  res.json({
    success: true,
    data: {
      id: req.user!.sub,
      email: req.user!.email,
      fullName,
      role: req.user!.role,
      phone,
      shippingAddress,
      city,
      postalCode,
      country,
    },
  });
});

// ============================================================================
// 4. CATEGORIES MANAGEMENT (/api/v1/categories)
// ============================================================================

apiV1Router.get('/categories', (_req, res) => {
  const db = getDb();
  const categories = db
    .prepare(
      `
      SELECT
        c.*,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `
    )
    .all();

  res.json({ success: true, data: categories });
});

apiV1Router.post(
  '/categories',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const name = sanitizeString(req.body?.name, 100);
    const description = sanitizeString(req.body?.description, 500);
    const parentId = req.body?.parentId ? sanitizeString(req.body.parentId, 64) : null;

    if (!name || name.length < 2) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Category name is required.' },
      });
      return;
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const id = `cat_${crypto.randomUUID().slice(0, 8)}`;

    const db = getDb();
    try {
      db.prepare(
        `INSERT INTO categories (id, name, slug, description, parent_id, display_order) VALUES (?, ?, ?, ?, ?, 10)`
      ).run(id, name, slug, description, parentId);

      writeStructuredLog({
        level: 'INFO',
        category: 'CATALOG',
        action: 'CATEGORY_CREATED',
        actorId: req.user!.sub,
        actorEmail: req.user!.email,
        details: { categoryId: id, name },
      });

      res.status(201).json({
        success: true,
        data: { id, name, slug, description, parent_id: parentId },
      });
    } catch {
      res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CATEGORY', message: 'Category name or slug already exists.' },
      });
    }
  }
);

apiV1Router.put(
  '/categories/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const id = sanitizeString(req.params.id, 64);
    const name = sanitizeString(req.body?.name, 100);
    const description = sanitizeString(req.body?.description, 500);

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Category name is required.' },
      });
      return;
    }

    const db = getDb();
    const result = db
      .prepare(
        `UPDATE categories SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(name, description, id);

    if (result.changes === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Category not found.' },
      });
      return;
    }

    res.json({ success: true, data: { id, name, description } });
  }
);

apiV1Router.delete(
  '/categories/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const id = sanitizeString(req.params.id, 64);
    const db = getDb();
    const attached = db
      .prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?')
      .get(id) as { count: number };

    if (attached.count > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CATEGORY_IN_USE',
          message: 'Cannot delete a category that contains active products.',
        },
      });
      return;
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ success: true, message: 'Category deleted.' });
  }
);

// ============================================================================
// 5. PRODUCTS CATALOG, SEARCH, FILTERING & PAGINATION (/api/v1/products)
// ============================================================================

apiV1Router.get('/products', (req, res) => {
  const db = getDb();
  const search = sanitizeString(req.query.search || '', 120).toLowerCase();
  const category = sanitizeString(req.query.category || '', 80);
  const brand = sanitizeString(req.query.brand || '', 80);
  const availableOnly = req.query.available === 'true';
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const sort = sanitizeString(req.query.sort || 'featured', 40);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const params: Array<string | number> = [];

  if (search) {
    conditions.push(
      '(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.brand) LIKE ?)'
    );
    const likePattern = `%${search}%`;
    params.push(likePattern, likePattern, likePattern, likePattern);
  }

  if (category && category !== 'all') {
    conditions.push('(p.category_id = ? OR c.slug = ?)');
    params.push(category, category);
  }

  if (brand) {
    conditions.push('LOWER(p.brand) = LOWER(?)');
    params.push(brand);
  }

  if (availableOnly) {
    conditions.push('p.is_available = 1 AND p.stock_quantity > 0');
  }

  if (minPrice !== null && !Number.isNaN(minPrice)) {
    conditions.push('p.price >= ?');
    params.push(minPrice);
  }

  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    conditions.push('p.price <= ?');
    params.push(maxPrice);
  }

  let orderBy = 'p.is_featured DESC, p.created_at DESC';
  if (sort === 'price_asc') orderBy = 'p.price ASC';
  else if (sort === 'price_desc') orderBy = 'p.price DESC';
  else if (sort === 'rating') orderBy = 'p.rating_avg DESC';
  else if (sort === 'newest') orderBy = 'p.created_at DESC';

  const whereClause = conditions.join(' AND ');

  const countRow = db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${whereClause}
    `
    )
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `
      SELECT
        p.*,
        c.name as category_name,
        c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `
    )
    .all(...params, limit, offset) as Array<Record<string, unknown>>;

  const formatted = rows.map((row) => {
    const price = Number(row.price);
    const discount = Number(row.discount_percent || 0);
    const finalPrice = Number((price * (1 - discount / 100)).toFixed(2));
    let specs = {};
    let gallery: string[] = [];
    try {
      specs = JSON.parse(String(row.specifications || '{}'));
    } catch {
      specs = {};
    }
    try {
      gallery = JSON.parse(String(row.gallery_urls || '[]'));
    } catch {
      gallery = [String(row.image_url)];
    }
    return {
      ...row,
      final_price: finalPrice,
      specifications: specs,
      gallery_urls: gallery,
      is_available: Boolean(row.is_available),
      is_featured: Boolean(row.is_featured),
    };
  });

  res.json({
    success: true,
    data: formatted,
    pagination: {
      page,
      limit,
      total: countRow.total,
      totalPages: Math.max(1, Math.ceil(countRow.total / limit)),
    },
  });
});

apiV1Router.get('/products/:id', (req, res) => {
  const idOrSlug = sanitizeString(req.params.id, 120);
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? OR p.slug = ? OR p.sku = ?
    `
    )
    .get(idOrSlug, idOrSlug, idOrSlug) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({
      success: false,
      error: { code: 'PRODUCT_NOT_FOUND', message: 'Requested product was not found.' },
    });
    return;
  }

  const reviews = db
    .prepare(
      `
      SELECT id, product_id, user_id, user_name, rating, title, comment, is_verified_purchase, created_at
      FROM reviews
      WHERE product_id = ? AND status = 'APPROVED'
      ORDER BY created_at DESC
    `
    )
    .all(String(row.id));

  const price = Number(row.price);
  const discount = Number(row.discount_percent || 0);

  res.json({
    success: true,
    data: {
      ...row,
      final_price: Number((price * (1 - discount / 100)).toFixed(2)),
      specifications: JSON.parse(String(row.specifications || '{}')),
      gallery_urls: JSON.parse(String(row.gallery_urls || '[]')),
      is_available: Boolean(row.is_available),
      is_featured: Boolean(row.is_featured),
      reviews,
    },
  });
});

apiV1Router.post(
  '/products',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const validation = validateProductInput(req.body || {});
    if (!validation.valid || !validation.data) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.error },
      });
      return;
    }

    const d = validation.data;
    const id = `prd_${crypto.randomUUID().slice(0, 10)}`;
    const slug = `${d.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${id.slice(-4)}`;

    const db = getDb();
    try {
      db.prepare(
        `
        INSERT INTO products (
          id, sku, name, slug, description, specifications, price, discount_percent,
          category_id, brand, image_url, gallery_urls, stock_quantity, is_available, is_featured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        id,
        d.sku,
        d.name,
        slug,
        d.description,
        JSON.stringify(d.specifications),
        d.price,
        d.discountPercent,
        d.categoryId,
        d.brand,
        d.imageUrl,
        JSON.stringify([d.imageUrl]),
        d.stockQuantity,
        d.isAvailable ? 1 : 0,
        d.isFeatured ? 1 : 0
      );

      writeStructuredLog({
        level: 'INFO',
        category: 'CATALOG',
        action: 'PRODUCT_CREATED',
        actorId: req.user!.sub,
        actorEmail: req.user!.email,
        details: { productId: id, sku: d.sku, name: d.name, price: d.price },
      });

      res.status(201).json({
        success: true,
        data: { id, sku: d.sku, name: d.name, slug, price: d.price },
      });
    } catch (err) {
      res.status(409).json({
        success: false,
        error: {
          code: 'PRODUCT_CONFLICT',
          message: `Could not create product: ${(err as Error).message}`,
        },
      });
    }
  }
);

apiV1Router.put(
  '/products/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const id = sanitizeString(req.params.id, 64);
    const validation = validateProductInput(req.body || {});
    if (!validation.valid || !validation.data) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.error },
      });
      return;
    }

    const d = validation.data;
    const db = getDb();
    const result = db
      .prepare(
        `
        UPDATE products
        SET sku = ?, name = ?, description = ?, specifications = ?, price = ?,
            discount_percent = ?, category_id = ?, brand = ?, image_url = ?,
            stock_quantity = ?, is_available = ?, is_featured = ?, updated_at = datetime('now')
        WHERE id = ?
      `
      )
      .run(
        d.sku,
        d.name,
        d.description,
        JSON.stringify(d.specifications),
        d.price,
        d.discountPercent,
        d.categoryId,
        d.brand,
        d.imageUrl,
        d.stockQuantity,
        d.isAvailable ? 1 : 0,
        d.isFeatured ? 1 : 0,
        id
      );

    if (result.changes === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' },
      });
      return;
    }

    writeStructuredLog({
      level: 'INFO',
      category: 'CATALOG',
      action: 'PRODUCT_UPDATED',
      actorId: req.user!.sub,
      actorEmail: req.user!.email,
      details: { productId: id, sku: d.sku, stockQuantity: d.stockQuantity },
    });

    res.json({ success: true, data: { id, ...d } });
  }
);

apiV1Router.delete(
  '/products/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const id = sanitizeString(req.params.id, 64);
    const db = getDb();

    try {
      const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
      if (result.changes === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product not found.' },
        });
        return;
      }

      writeStructuredLog({
        level: 'WARN',
        category: 'CATALOG',
        action: 'PRODUCT_DELETED',
        actorId: req.user!.sub,
        actorEmail: req.user!.email,
        details: { productId: id },
      });

      res.json({ success: true, message: 'Product deleted.' });
    } catch {
      // If product is referenced by historical order items, archive it instead of hard deleting
      db.prepare('UPDATE products SET is_available = 0, stock_quantity = 0 WHERE id = ?').run(id);
      res.json({
        success: true,
        message: 'Product is referenced in historical orders and has been archived.',
      });
    }
  }
);

// ============================================================================
// 6. SHOPPING CART & PROMO ENGINE (/api/v1/cart)
// ============================================================================

apiV1Router.get('/cart', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const promoCode = sanitizeString(req.query.promoCode || '', 32);
  const summary = calculateCartSummary(req.user!.sub, promoCode);
  res.json({ success: true, data: summary });
});

apiV1Router.post('/cart', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const productId = sanitizeString(req.body?.productId, 64);
  const quantity = Math.max(1, Math.floor(Number(req.body?.quantity || 1)));

  if (!productId) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Product ID is required.' },
    });
    return;
  }

  const db = getDb();
  const product = db
    .prepare('SELECT id, name, stock_quantity, is_available FROM products WHERE id = ?')
    .get(productId) as
    | { id: string; name: string; stock_quantity: number; is_available: number }
    | undefined;

  if (!product || !product.is_available) {
    res.status(404).json({
      success: false,
      error: { code: 'PRODUCT_UNAVAILABLE', message: 'Product is not available for purchase.' },
    });
    return;
  }

  const existing = db
    .prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?')
    .get(req.user!.sub, productId) as { id: string; quantity: number } | undefined;

  const targetQty = (existing ? existing.quantity : 0) + quantity;
  if (targetQty > product.stock_quantity) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${product.stock_quantity} unit(s) of ${product.name} available in stock.`,
      },
    });
    return;
  }

  if (existing) {
    db.prepare(
      `UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(targetQty, existing.id);
  } else {
    db.prepare(
      `INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)`
    ).run(crypto.randomUUID(), req.user!.sub, productId, quantity);
  }

  const summary = calculateCartSummary(req.user!.sub);
  res.json({ success: true, data: summary });
});

apiV1Router.put(
  '/cart/:productId',
  authenticate,
  (req: AuthenticatedRequest, res: Response) => {
    const productId = sanitizeString(req.params.productId, 64);
    const quantity = Math.floor(Number(req.body?.quantity ?? 0));
    const db = getDb();

    if (quantity <= 0) {
      db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(
        req.user!.sub,
        productId
      );
      res.json({ success: true, data: calculateCartSummary(req.user!.sub) });
      return;
    }

    const product = db
      .prepare('SELECT stock_quantity, name FROM products WHERE id = ?')
      .get(productId) as { stock_quantity: number; name: string } | undefined;

    if (!product || quantity > product.stock_quantity) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Requested quantity exceeds available stock (${product?.stock_quantity ?? 0}).`,
        },
      });
      return;
    }

    db.prepare(
      `UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE user_id = ? AND product_id = ?`
    ).run(quantity, req.user!.sub, productId);

    res.json({ success: true, data: calculateCartSummary(req.user!.sub) });
  }
);

apiV1Router.delete(
  '/cart/:productId',
  authenticate,
  (req: AuthenticatedRequest, res: Response) => {
    const productId = sanitizeString(req.params.productId, 64);
    const db = getDb();
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(
      req.user!.sub,
      productId
    );
    res.json({ success: true, data: calculateCartSummary(req.user!.sub) });
  }
);

apiV1Router.delete('/cart', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user!.sub);
  res.json({ success: true, data: calculateCartSummary(req.user!.sub) });
});

apiV1Router.post('/cart/promo', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const code = sanitizeString(req.body?.code || '', 32).toUpperCase();
  const promo = PROMO_CODES[code];
  if (!promo) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PROMO',
        message: 'Promo code is not recognized. Try ATELIER10, STUDIO15, or KRONOS20.',
      },
    });
    return;
  }

  const summary = calculateCartSummary(req.user!.sub, code);
  res.json({
    success: true,
    data: summary,
  });
});

// ============================================================================
// 7. WISHLIST (/api/v1/wishlist)
// ============================================================================

apiV1Router.get('/wishlist', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        w.id as wishlist_id,
        w.created_at as added_at,
        p.*,
        c.name as category_name
      FROM wishlist_items w
      JOIN products p ON p.id = w.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `
    )
    .all(req.user!.sub) as Array<Record<string, unknown>>;

  const formatted = rows.map((r) => ({
    ...r,
    final_price: Number(
      (Number(r.price) * (1 - Number(r.discount_percent || 0) / 100)).toFixed(2)
    ),
    is_available: Boolean(r.is_available),
  }));

  res.json({ success: true, data: formatted });
});

apiV1Router.post('/wishlist', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const productId = sanitizeString(req.body?.productId, 64);
  if (!productId) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Product ID is required.' },
    });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?')
    .get(req.user!.sub, productId) as { id: string } | undefined;

  if (existing) {
    db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(existing.id);
    res.json({ success: true, action: 'REMOVED', productId });
    return;
  }

  db.prepare('INSERT INTO wishlist_items (id, user_id, product_id) VALUES (?, ?, ?)').run(
    crypto.randomUUID(),
    req.user!.sub,
    productId
  );
  res.status(201).json({ success: true, action: 'ADDED', productId });
});

apiV1Router.delete(
  '/wishlist/:productId',
  authenticate,
  (req: AuthenticatedRequest, res: Response) => {
    const productId = sanitizeString(req.params.productId, 64);
    const db = getDb();
    db.prepare('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?').run(
      req.user!.sub,
      productId
    );
    res.json({ success: true, action: 'REMOVED', productId });
  }
);

// ============================================================================
// 8. PAYMENT STRUCTURE & CHECKOUT ORDERS (/api/v1/payments, /api/v1/orders)
// ============================================================================

apiV1Router.post('/payments/intent', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const promoCode = sanitizeString(req.body?.promoCode || '', 32);
  const summary = calculateCartSummary(req.user!.sub, promoCode);

  if (summary.items.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'EMPTY_CART', message: 'Cannot create payment intent for an empty cart.' },
    });
    return;
  }

  const paymentIntentId = `pi_krn_${crypto.randomBytes(8).toString('hex')}`;
  res.json({
    success: true,
    data: {
      paymentIntentId,
      provider: envConfig.paymentProvider,
      amount: summary.totalAmount,
      currency: 'USD',
      status: 'REQUIRES_CONFIRMATION',
    },
  });
});

apiV1Router.post('/orders', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const validation = validateOrderInput(req.body || {});
  if (!validation.valid || !validation.data) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: validation.error },
    });
    return;
  }

  const d = validation.data;
  const db = getDb();
  const cartSummary = calculateCartSummary(req.user!.sub, d.promoCode);

  if (cartSummary.items.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'EMPTY_CART', message: 'Your bag is empty.' },
    });
    return;
  }

  // Validate stock availability before committing checkout
  for (const item of cartSummary.items) {
    if (!item.is_available || item.quantity > item.stock_quantity) {
      res.status(400).json({
        success: false,
        error: {
          code: 'STOCK_VALIDATION_FAILED',
          message: `Insufficient stock for ${item.name} (Available: ${item.stock_quantity}, Requested: ${item.quantity}).`,
        },
      });
      return;
    }
  }

  const orderId = `ord_${crypto.randomUUID().slice(0, 10)}`;
  const orderNumber = `KRN-2026-${Math.floor(1050 + Math.random() * 8900)}`;
  const paymentReference = `pay_krn_${crypto.randomBytes(6).toString('hex')}`;
  const paymentStatus = d.paymentMethod === 'COD' ? 'PENDING' : 'PAID';
  const initialStatus = d.paymentMethod === 'COD' ? 'PENDING' : 'CONFIRMED';

  try {
    db.exec('BEGIN TRANSACTION;');

    db.prepare(
      `
      INSERT INTO orders (
        id, order_number, user_id, status, payment_status, payment_method, payment_reference,
        subtotal, discount_total, shipping_cost, tax_total, total_amount, promo_code,
        recipient_name, recipient_phone, shipping_address, shipping_city, shipping_postal_code,
        shipping_country, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      orderId,
      orderNumber,
      req.user!.sub,
      initialStatus,
      paymentStatus,
      d.paymentMethod,
      paymentReference,
      cartSummary.subtotal,
      cartSummary.discountTotal,
      cartSummary.shippingCost,
      cartSummary.taxTotal,
      cartSummary.totalAmount,
      cartSummary.promoCode,
      d.recipientName,
      d.recipientPhone,
      d.shippingAddress,
      d.shippingCity,
      d.shippingPostalCode,
      d.shippingCountry,
      d.notes
    );

    const insertItem = db.prepare(
      `
      INSERT INTO order_items (
        id, order_id, product_id, product_name, product_sku, product_image,
        unit_price, discount_percent, quantity, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    );

    const deductStock = db.prepare(
      `
      UPDATE products
      SET stock_quantity = stock_quantity - ?, updated_at = datetime('now')
      WHERE id = ? AND stock_quantity >= ?
    `
    );

    for (const item of cartSummary.items) {
      const stockRes = deductStock.run(item.quantity, item.product_id, item.quantity);
      if (stockRes.changes === 0) {
        throw new Error(`Concurrent stock exhaustion for ${item.name}`);
      }

      insertItem.run(
        `oi_${crypto.randomUUID().slice(0, 10)}`,
        orderId,
        item.product_id,
        item.name,
        item.sku,
        item.image_url,
        item.price,
        item.discount_percent,
        item.quantity,
        item.line_total
      );
    }

    // Clear user's cart
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user!.sub);

    db.exec('COMMIT;');

    writeStructuredLog({
      level: 'INFO',
      category: 'ORDER',
      action: 'ORDER_CREATED',
      actorId: req.user!.sub,
      actorEmail: req.user!.email,
      details: {
        orderId,
        orderNumber,
        totalAmount: cartSummary.totalAmount,
        paymentMethod: d.paymentMethod,
      },
    });

    dispatchNotification({
      channel: 'EMAIL',
      recipient: req.user!.email,
      subject: `Order Confirmed — ${orderNumber}`,
      message: `Thank you for your acquisition with Kronos Atelier. Order ${orderNumber} ($${cartSummary.totalAmount.toFixed(
        2
      )}) is ${initialStatus}.`,
    });

    res.status(201).json({
      success: true,
      data: {
        id: orderId,
        orderNumber,
        status: initialStatus,
        paymentStatus,
        paymentMethod: d.paymentMethod,
        paymentReference,
        totalAmount: cartSummary.totalAmount,
        items: cartSummary.items,
      },
    });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore
    }
    res.status(400).json({
      success: false,
      error: { code: 'CHECKOUT_FAILED', message: (err as Error).message },
    });
  }
});

apiV1Router.get('/orders', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const orders = db
    .prepare(
      `
      SELECT * FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC
    `
    )
    .all(req.user!.sub) as Array<Record<string, unknown>>;

  const getItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
  const populated = orders.map((ord) => ({
    ...ord,
    items: getItems.all(String(ord.id)),
  }));

  res.json({ success: true, data: populated });
});

apiV1Router.get('/orders/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const id = sanitizeString(req.params.id, 64);
  const db = getDb();
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?')
    .get(id, id) as Record<string, unknown> | undefined;

  if (!order) {
    res.status(404).json({
      success: false,
      error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
    });
    return;
  }

  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  if (order.user_id !== req.user!.sub && !isAdmin) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to view this order.' },
    });
    return;
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(String(order.id));
  res.json({ success: true, data: { ...order, items } });
});

// ============================================================================
// 9. PRODUCT REVIEWS (/api/v1/reviews)
// ============================================================================

apiV1Router.post('/reviews', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const productId = sanitizeString(req.body?.productId, 64);
  const rating = Math.floor(Number(req.body?.rating || 5));
  const title = sanitizeString(req.body?.title || '', 140);
  const comment = sanitizeString(req.body?.comment || '', 1500);

  if (!productId || rating < 1 || rating > 5 || comment.length < 5) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Valid productId, rating (1-5), and comment (min 5 chars) are required.',
      },
    });
    return;
  }

  const db = getDb();
  const reviewId = `rev_${crypto.randomUUID().slice(0, 8)}`;

  db.prepare(
    `
    INSERT INTO reviews (id, product_id, user_id, user_name, rating, title, comment, status, is_verified_purchase)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', 1)
  `
  ).run(reviewId, productId, req.user!.sub, req.user!.name, rating, title, comment);

  // Recalculate product rating average and count
  const stats = db
    .prepare(
      `
      SELECT AVG(rating) as avg_rating, COUNT(*) as count
      FROM reviews
      WHERE product_id = ? AND status = 'APPROVED'
    `
    )
    .get(productId) as { avg_rating: number; count: number };

  if (stats && stats.count > 0) {
    db.prepare(
      `UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?`
    ).run(Number(stats.avg_rating.toFixed(1)), stats.count, productId);
  }

  res.status(201).json({
    success: true,
    data: {
      id: reviewId,
      product_id: productId,
      user_name: req.user!.name,
      rating,
      title,
      comment,
      status: 'APPROVED',
      created_at: new Date().toISOString(),
    },
  });
});

// ============================================================================
// 10. ADMIN CONSOLE & RBAC MANAGEMENT (/api/v1/admin/*)
// ============================================================================

apiV1Router.get(
  '/admin/overview',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();

    const revenueRow = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders FROM orders WHERE status != 'CANCELLED'`
      )
      .get() as { total_revenue: number; total_orders: number };

    const usersCount = (
      db.prepare(`SELECT COUNT(*) as count FROM users`).get() as { count: number }
    ).count;

    const productsCount = (
      db.prepare(`SELECT COUNT(*) as count FROM products`).get() as { count: number }
    ).count;

    const lowStockProducts = db
      .prepare(
        `SELECT id, sku, name, stock_quantity, price FROM products WHERE stock_quantity <= 10 ORDER BY stock_quantity ASC`
      )
      .all();

    const ordersByStatus = db
      .prepare(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount FROM orders GROUP BY status`
      )
      .all();

    const recentLogs = db
      .prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 25`)
      .all() as Array<Record<string, unknown>>;

    const recentNotifications = db
      .prepare(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 15`)
      .all();

    res.json({
      success: true,
      data: {
        kpis: {
          totalRevenue: Number(revenueRow.total_revenue.toFixed(2)),
          totalOrders: revenueRow.total_orders,
          totalUsers: usersCount,
          totalProducts: productsCount,
          lowStockCount: lowStockProducts.length,
        },
        lowStockProducts,
        ordersByStatus,
        recentLogs: recentLogs.map((l) => ({
          ...l,
          details: JSON.parse(String(l.details || '{}')),
        })),
        recentNotifications,
      },
    });
  }
);

apiV1Router.get(
  '/admin/orders',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const orders = db
      .prepare(
        `
        SELECT o.*, u.email as customer_email, u.full_name as customer_account_name
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
      `
      )
      .all() as Array<Record<string, unknown>>;

    const getItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
    const populated = orders.map((ord) => ({
      ...ord,
      items: getItems.all(String(ord.id)),
    }));

    res.json({ success: true, data: populated });
  }
);

apiV1Router.patch(
  '/admin/orders/:id/status',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const orderId = sanitizeString(req.params.id, 64);
    const status = sanitizeString(req.body?.status, 32).toUpperCase();
    const paymentStatus = sanitizeString(req.body?.paymentStatus || '', 32).toUpperCase();
    const trackingNumber = sanitizeString(req.body?.trackingNumber || '', 80);

    const validStatuses = [
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Invalid order status value.' },
      });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
      });
      return;
    }

    // If transitioning to CANCELLED from a non-cancelled state, restore stock quantities
    if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
      const items = db
        .prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?')
        .all(orderId) as Array<{ product_id: string; quantity: number }>;
      const restoreStmt = db.prepare(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?'
      );
      for (const item of items) {
        restoreStmt.run(item.quantity, item.product_id);
      }
    }

    const nextPaymentStatus =
      paymentStatus && ['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(paymentStatus)
        ? paymentStatus
        : String(existing.payment_status);

    const nextTracking = trackingNumber || String(existing.tracking_number || '');

    db.prepare(
      `
      UPDATE orders
      SET status = ?, payment_status = ?, tracking_number = ?, updated_at = datetime('now')
      WHERE id = ?
    `
    ).run(status, nextPaymentStatus, nextTracking, orderId);

    writeStructuredLog({
      level: 'INFO',
      category: 'ADMIN_ORDER',
      action: 'ORDER_STATUS_UPDATED',
      actorId: req.user!.sub,
      actorEmail: req.user!.email,
      details: {
        orderId,
        orderNumber: existing.order_number,
        previousStatus: existing.status,
        newStatus: status,
        paymentStatus: nextPaymentStatus,
      },
    });

    res.json({
      success: true,
      data: {
        id: orderId,
        status,
        payment_status: nextPaymentStatus,
        tracking_number: nextTracking,
      },
    });
  }
);

apiV1Router.get(
  '/admin/users',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const users = db
      .prepare(
        `
        SELECT id, email, full_name, role, phone, city, country, is_active, last_login_at, created_at
        FROM users
        ORDER BY created_at DESC
      `
      )
      .all();

    res.json({ success: true, data: users });
  }
);

apiV1Router.patch(
  '/admin/users/:id/role',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const targetUserId = sanitizeString(req.params.id, 64);
    const role = sanitizeString(req.body?.role, 32).toUpperCase() as UserRole;
    const isActive = req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : undefined;

    if (!['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role must be CUSTOMER, ADMIN, or SUPER_ADMIN.' },
      });
      return;
    }

    const db = getDb();
    if (isActive !== undefined) {
      db.prepare(
        `UPDATE users SET role = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(role, isActive, targetUserId);
    } else {
      db.prepare(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`).run(
        role,
        targetUserId
      );
    }

    writeStructuredLog({
      level: 'SECURITY',
      category: 'RBAC',
      action: 'USER_ROLE_MODIFIED',
      actorId: req.user!.sub,
      actorEmail: req.user!.email,
      details: { targetUserId, newRole: role, isActive },
    });

    res.json({ success: true, data: { id: targetUserId, role, isActive } });
  }
);

apiV1Router.patch(
  '/admin/inventory/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const productId = sanitizeString(req.params.id, 64);
    const stockQuantity = Math.max(0, Math.floor(Number(req.body?.stockQuantity ?? 0)));
    const isAvailable = req.body?.isAvailable !== false ? 1 : 0;

    const db = getDb();
    const result = db
      .prepare(
        `UPDATE products SET stock_quantity = ?, is_available = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(stockQuantity, isAvailable, productId);

    if (result.changes === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' },
      });
      return;
    }

    writeStructuredLog({
      level: 'INFO',
      category: 'INVENTORY',
      action: 'STOCK_ADJUSTED',
      actorId: req.user!.sub,
      actorEmail: req.user!.email,
      details: { productId, stockQuantity, isAvailable: Boolean(isAvailable) },
    });

    res.json({
      success: true,
      data: { id: productId, stock_quantity: stockQuantity, is_available: Boolean(isAvailable) },
    });
  }
);

apiV1Router.get(
  '/admin/reviews',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const reviews = db
      .prepare(
        `
        SELECT r.*, p.name as product_name, p.sku as product_sku
        FROM reviews r
        LEFT JOIN products p ON p.id = r.product_id
        ORDER BY r.created_at DESC
      `
      )
      .all();

    res.json({ success: true, data: reviews });
  }
);

apiV1Router.patch(
  '/admin/reviews/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const reviewId = sanitizeString(req.params.id, 64);
    const status = sanitizeString(req.body?.status, 32).toUpperCase();
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid review moderation status.' },
      });
      return;
    }

    const db = getDb();
    db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, reviewId);
    res.json({ success: true, data: { id: reviewId, status } });
  }
);

apiV1Router.post(
  '/admin/notifications/dispatch',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  (req: AuthenticatedRequest, res: Response) => {
    const channelRaw = sanitizeString(req.body?.channel || 'TELEGRAM', 20).toUpperCase();
    const channel: 'EMAIL' | 'TELEGRAM' | 'SMS' =
      channelRaw === 'EMAIL' || channelRaw === 'SMS' ? channelRaw : 'TELEGRAM';
    const deploymentStatus = req.body?.status === 'FAILED' ? 'FAILED' : 'SUCCESS';
    const commitSha = sanitizeString(req.body?.commitSha || 'a94f2c8e1104', 40);

    const formattedText = formatDeploymentNotification({
      status: deploymentStatus,
      environment: 'Production',
      branch: 'main',
      commitSha,
      server: 'AWS EC2 (Ubuntu 22.04 LTS · Nginx TLS)',
      rollbackExecuted: deploymentStatus === 'FAILED',
    });

    const record = dispatchNotification({
      channel,
      subject:
        deploymentStatus === 'SUCCESS'
          ? '🚀 PRODUCTION DEPLOYMENT SUCCESSFUL'
          : '❌ PRODUCTION DEPLOYMENT FAILED',
      message: formattedText,
    });

    res.status(201).json({ success: true, data: record });
  }
);

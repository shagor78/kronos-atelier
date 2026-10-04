import { sanitizeString } from '../security/crypto.ts';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistrationInput(body: Record<string, unknown>): ValidationResult<{
  email: string;
  password: string;
  fullName: string;
  phone: string;
}> {
  const email = sanitizeString(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = sanitizeString(body.fullName, 120);
  const phone = sanitizeString(body.phone || '', 40);

  if (!email || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Please provide a valid email address.' };
  }
  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters long.',
    };
  }
  if (!fullName || fullName.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters.' };
  }

  return { valid: true, data: { email, password, fullName, phone } };
}

export function validateLoginInput(body: Record<string, unknown>): ValidationResult<{
  email: string;
  password: string;
}> {
  const email = sanitizeString(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return { valid: false, error: 'Email and password are required.' };
  }
  return { valid: true, data: { email, password } };
}

export function validateProductInput(body: Record<string, unknown>): ValidationResult<{
  sku: string;
  name: string;
  description: string;
  price: number;
  discountPercent: number;
  categoryId: string;
  brand: string;
  imageUrl: string;
  stockQuantity: number;
  isAvailable: boolean;
  isFeatured: boolean;
  specifications: Record<string, string>;
}> {
  const sku = sanitizeString(body.sku, 64).toUpperCase();
  const name = sanitizeString(body.name, 180);
  const description = sanitizeString(body.description, 4000);
  const price = Number(body.price);
  const discountPercent = Number(body.discountPercent ?? 0);
  const categoryId = sanitizeString(body.categoryId, 64);
  const brand = sanitizeString(body.brand || 'Kronos Atelier', 100);
  const imageUrl = sanitizeString(
    body.imageUrl || '/src/assets/images/product_monolith_speaker_1791096498209.jpg',
    500
  );
  const stockQuantity = Math.floor(Number(body.stockQuantity ?? 0));
  const isAvailable = body.isAvailable !== false;
  const isFeatured = Boolean(body.isFeatured);
  const specifications =
    body.specifications && typeof body.specifications === 'object'
      ? (body.specifications as Record<string, string>)
      : {};

  if (!sku || sku.length < 3) {
    return { valid: false, error: 'Valid product SKU (min 3 chars) is required.' };
  }
  if (!name || name.length < 3) {
    return { valid: false, error: 'Product name (min 3 chars) is required.' };
  }
  if (!description || description.length < 10) {
    return { valid: false, error: 'Product description (min 10 chars) is required.' };
  }
  if (Number.isNaN(price) || price < 0) {
    return { valid: false, error: 'Price must be a non-negative number.' };
  }
  if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 90) {
    return { valid: false, error: 'Discount percent must be between 0 and 90.' };
  }
  if (!categoryId) {
    return { valid: false, error: 'Category ID is required.' };
  }
  if (Number.isNaN(stockQuantity) || stockQuantity < 0) {
    return { valid: false, error: 'Stock quantity must be a non-negative integer.' };
  }

  return {
    valid: true,
    data: {
      sku,
      name,
      description,
      price,
      discountPercent,
      categoryId,
      brand,
      imageUrl,
      stockQuantity,
      isAvailable,
      isFeatured,
      specifications,
    },
  };
}

export function validateOrderInput(body: Record<string, unknown>): ValidationResult<{
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  paymentMethod: 'CARD' | 'WIRE_TRANSFER' | 'COD';
  promoCode: string;
  notes: string;
}> {
  const recipientName = sanitizeString(body.recipientName, 120);
  const recipientPhone = sanitizeString(body.recipientPhone, 40);
  const shippingAddress = sanitizeString(body.shippingAddress, 300);
  const shippingCity = sanitizeString(body.shippingCity, 100);
  const shippingPostalCode = sanitizeString(body.shippingPostalCode, 30);
  const shippingCountry = sanitizeString(body.shippingCountry || 'United States', 80);
  const rawPayment = sanitizeString(body.paymentMethod || 'CARD', 30).toUpperCase();
  const paymentMethod: 'CARD' | 'WIRE_TRANSFER' | 'COD' =
    rawPayment === 'COD' || rawPayment === 'WIRE_TRANSFER' ? rawPayment : 'CARD';
  const promoCode = sanitizeString(body.promoCode || '', 32).toUpperCase();
  const notes = sanitizeString(body.notes || '', 500);

  if (!recipientName || recipientName.length < 2) {
    return { valid: false, error: 'Recipient full name is required.' };
  }
  if (!recipientPhone || recipientPhone.length < 5) {
    return { valid: false, error: 'Recipient phone number is required.' };
  }
  if (!shippingAddress || shippingAddress.length < 5) {
    return { valid: false, error: 'Street shipping address is required.' };
  }
  if (!shippingCity || shippingCity.length < 2) {
    return { valid: false, error: 'Shipping city is required.' };
  }
  if (!shippingPostalCode || shippingPostalCode.length < 3) {
    return { valid: false, error: 'Postal / ZIP code is required.' };
  }

  return {
    valid: true,
    data: {
      recipientName,
      recipientPhone,
      shippingAddress,
      shippingCity,
      shippingPostalCode,
      shippingCountry,
      paymentMethod,
      promoCode,
      notes,
    },
  };
}

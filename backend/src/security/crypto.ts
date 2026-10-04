import crypto from 'node:crypto';
import { envConfig } from '../config/env.ts';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/**
 * Hashes a plain-text password using Node's native cryptographic scrypt KDF with a 16-byte random salt.
 * Never stores plain-text passwords.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Verifies a password against a stored scrypt hash using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const [, salt, originalHex] = parts;
    const derivedBuffer = crypto.scryptSync(password, salt, 64);
    const originalBuffer = Buffer.from(originalHex, 'hex');
    if (derivedBuffer.length !== originalBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedBuffer, originalBuffer);
  } catch {
    return false;
  }
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a stateless HMAC-SHA256 JWT token.
 */
export function signJwtToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresInSeconds = envConfig.jwtAccessExpiresIn
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const headerSegment = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadSegment = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = crypto
    .createHmac('sha256', envConfig.jwtSecret)
    .update(signingInput)
    .digest();
  const signatureSegment = base64UrlEncode(signature);
  return `${signingInput}.${signatureSegment}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 JWT token using constant-time signature comparison.
 */
export function verifyJwtToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const [headerSegment, payloadSegment, signatureSegment] = parts;
    const signingInput = `${headerSegment}.${payloadSegment}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', envConfig.jwtSecret).update(signingInput).digest()
    );
    const sigBuf = Buffer.from(signatureSegment);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Hashes a refresh token for database storage so raw tokens are never persisted.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Sanitizes untrusted string input to prevent XSS script injection.
 */
export function sanitizeString(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/javascript:/gi, '')
    .replace(/onerror=/gi, '')
    .replace(/onload=/gi, '');
}

/**
 * Generates a signed CSRF token bound to a session/request context.
 */
export function generateCsrfToken(sessionHint = 'anonymous'): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const mac = crypto
    .createHmac('sha256', envConfig.csrfSecret)
    .update(`${sessionHint}:${nonce}`)
    .digest('hex');
  return `${nonce}.${mac}`;
}

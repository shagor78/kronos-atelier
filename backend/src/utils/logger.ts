import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export interface StructuredLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string;
  details: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwtSecret',
  'apiKey',
  'authorization',
  'creditCard',
  'cvv',
  'privateKey',
]);

/**
 * Recursively redacts any sensitive keys from log metadata so credentials are never logged.
 */
export function redactSensitiveData(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_KEYS.has(key) ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('private_key')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

type DbAuditPersister = (entry: StructuredLogEntry) => void;
let dbPersister: DbAuditPersister | null = null;

export function registerAuditPersister(fn: DbAuditPersister): void {
  dbPersister = fn;
}

export function writeStructuredLog(params: {
  level: LogLevel;
  category: string;
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string;
  details?: Record<string, unknown>;
}): StructuredLogEntry {
  const safeDetails = redactSensitiveData(params.details || {});
  const entry: StructuredLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level: params.level,
    category: params.category,
    action: params.action,
    actorId: params.actorId || null,
    actorEmail: params.actorEmail || null,
    ipAddress: params.ipAddress || '127.0.0.1',
    details: safeDetails,
  };

  try {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'application.log');
    fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Non-fatal if filesystem is read-only
  }

  if (dbPersister) {
    try {
      dbPersister(entry);
    } catch {
      // Non-fatal if database is initializing
    }
  }

  return entry;
}

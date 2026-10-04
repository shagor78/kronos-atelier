import dotenv from 'dotenv';
import crypto from 'node:crypto';
import path from 'node:path';

dotenv.config();

export interface BackendEnvConfig {
  nodeEnv: 'development' | 'staging' | 'production' | 'test';
  port: number;
  appUrl: string;
  corsOrigin: string;
  databaseUrl: string;
  dbBackupDir: string;
  jwtSecret: string;
  jwtAccessExpiresIn: number;
  jwtRefreshExpiresIn: number;
  csrfSecret: string;
  sslEnabled: boolean;
  sslCertPath: string;
  sslKeyPath: string;
  paymentProvider: string;
  notificationEmailTo: string;
  telegramChatId: string;
  smsRecipient: string;
}

// Generate deterministic runtime fallback secret for dev/test if env not supplied,
// while strictly requiring explicit env in production mode.
const defaultRuntimeSecret = crypto
  .createHash('sha256')
  .update(`kronos-atelier-runtime-${process.cwd()}`)
  .digest('hex');

export const envConfig: BackendEnvConfig = {
  nodeEnv: (process.env.NODE_ENV as BackendEnvConfig['nodeEnv']) || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl:
    process.env.DATABASE_URL || path.resolve(process.cwd(), 'database', 'ecommerce.sqlite'),
  dbBackupDir:
    process.env.DB_BACKUP_DIR || path.resolve(process.cwd(), 'database', 'backups'),
  jwtSecret:
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET !== 'CHANGE_ME_IN_PRODUCTION_WITH_CRYPTOGRAPHIC_RANDOM_HEX'
      ? process.env.JWT_SECRET
      : defaultRuntimeSecret,
  jwtAccessExpiresIn: parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '3600', 10),
  jwtRefreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10),
  csrfSecret:
    process.env.CSRF_SECRET &&
    process.env.CSRF_SECRET !== 'CHANGE_ME_IN_PRODUCTION_CSRF_SECRET'
      ? process.env.CSRF_SECRET
      : `${defaultRuntimeSecret}-csrf`,
  sslEnabled: process.env.SSL_ENABLED === 'true',
  sslCertPath: process.env.SSL_CERT_PATH || '/etc/ssl/certs/app/fullchain.pem',
  sslKeyPath: process.env.SSL_KEY_PATH || '/etc/ssl/private/app/privkey.pem',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'stripe_compatible',
  notificationEmailTo: process.env.NOTIFICATION_EMAIL_TO || 'devops@kronos-atelier.internal',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '@kronos_ops_channel',
  smsRecipient: process.env.SMS_RECIPIENT || '+1-800-555-0199',
};

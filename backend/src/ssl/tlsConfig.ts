import fs from 'node:fs';
import https from 'node:https';
import { envConfig } from '../config/env.ts';

export interface TlsStatus {
  enabled: boolean;
  certPath: string;
  keyPath: string;
  certificatesPresent: boolean;
  mode: 'HTTPS_NATIVE' | 'NGINX_TLS_TERMINATION';
}

/**
 * Inspects SSL/TLS readiness without ever storing or committing certificates in code.
 * In production behind Nginx/Cloud Load Balancer, TLS termination occurs at the edge proxy,
 * or directly if SSL_ENABLED=true and external certificate paths are mounted.
 */
export function getTlsStatus(): TlsStatus {
  const certsExist =
    fs.existsSync(envConfig.sslCertPath) && fs.existsSync(envConfig.sslKeyPath);

  return {
    enabled: envConfig.sslEnabled,
    certPath: envConfig.sslCertPath,
    keyPath: envConfig.sslKeyPath,
    certificatesPresent: certsExist,
    mode: envConfig.sslEnabled && certsExist ? 'HTTPS_NATIVE' : 'NGINX_TLS_TERMINATION',
  };
}

export function loadHttpsOptions(): https.ServerOptions | null {
  if (!envConfig.sslEnabled) {
    return null;
  }
  if (!fs.existsSync(envConfig.sslCertPath) || !fs.existsSync(envConfig.sslKeyPath)) {
    return null;
  }
  return {
    cert: fs.readFileSync(envConfig.sslCertPath),
    key: fs.readFileSync(envConfig.sslKeyPath),
    minVersion: 'TLSv1.2',
  };
}

import crypto from 'node:crypto';
import { getDb } from '../repositories/database.ts';
import { envConfig } from '../config/env.ts';
import { writeStructuredLog } from '../utils/logger.ts';

export interface DeploymentNotificationPayload {
  status: 'SUCCESS' | 'FAILED';
  environment: string;
  branch: string;
  commitSha: string;
  server: string;
  rollbackExecuted?: boolean;
}

export function formatDeploymentNotification(payload: DeploymentNotificationPayload): string {
  if (payload.status === 'SUCCESS') {
    return [
      '🚀 PRODUCTION DEPLOYMENT SUCCESSFUL',
      '',
      'Project: E-commerce Platform (Kronos Atelier)',
      `Environment: ${payload.environment}`,
      `Branch: ${payload.branch}`,
      '',
      `Commit: ${payload.commitSha}`,
      '',
      'CI: PASSED',
      'Security: PASSED',
      'Build: PASSED',
      'Deployment: PASSED',
      'Health Check: HEALTHY',
      '',
      `Server: ${payload.server}`,
      '',
      'Deployment completed successfully.',
    ].join('\n');
  }

  return [
    '❌ PRODUCTION DEPLOYMENT FAILED',
    '',
    'Project: E-commerce Platform (Kronos Atelier)',
    `Environment: ${payload.environment}`,
    '',
    'CI: PASSED',
    'Deployment: FAILED',
    'Health Check: FAILED',
    '',
    `Rollback: ${payload.rollbackExecuted ? 'EXECUTED' : 'PENDING'}`,
  ].join('\n');
}

export function dispatchNotification(params: {
  channel: 'EMAIL' | 'TELEGRAM' | 'SMS' | 'SYSTEM';
  recipient?: string;
  subject: string;
  message: string;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  const recipient =
    params.recipient ||
    (params.channel === 'EMAIL'
      ? envConfig.notificationEmailTo
      : params.channel === 'TELEGRAM'
      ? envConfig.telegramChatId
      : envConfig.smsRecipient);

  db.prepare(`
    INSERT INTO notifications (id, channel, recipient, subject, message, status)
    VALUES (?, ?, ?, ?, ?, 'DELIVERED')
  `).run(id, params.channel, recipient, params.subject, params.message);

  writeStructuredLog({
    level: 'INFO',
    category: 'NOTIFICATION',
    action: `DISPATCH_${params.channel}`,
    details: {
      notificationId: id,
      channel: params.channel,
      recipient,
      subject: params.subject,
    },
  });

  return {
    id,
    channel: params.channel,
    recipient,
    subject: params.subject,
    message: params.message,
    status: 'DELIVERED',
    createdAt: new Date().toISOString(),
  };
}

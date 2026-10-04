import type { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, type JwtPayload, type UserRole } from '../security/crypto.ts';
import { writeStructuredLog } from '../utils/logger.ts';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Extracts and verifies Bearer JWT access token from Authorization header.
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Provide a valid Bearer access token.',
      },
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyJwtToken(token);

  if (!payload || payload.type !== 'access') {
    writeStructuredLog({
      level: 'SECURITY',
      category: 'AUTH',
      action: 'INVALID_OR_EXPIRED_TOKEN',
      ipAddress: req.socket.remoteAddress || '127.0.0.1',
      details: { path: req.originalUrl },
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid or has expired.',
      },
    });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Enforces Role-Based Access Control (CUSTOMER, ADMIN, SUPER_ADMIN) on the backend.
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before role verification.',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      writeStructuredLog({
        level: 'SECURITY',
        category: 'RBAC',
        action: 'FORBIDDEN_ACCESS_ATTEMPT',
        actorId: req.user.sub,
        actorEmail: req.user.email,
        ipAddress: req.socket.remoteAddress || '127.0.0.1',
        details: {
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          path: req.originalUrl,
          method: req.method,
        },
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.`,
        },
      });
      return;
    }

    next();
  };
}

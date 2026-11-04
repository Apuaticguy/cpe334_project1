import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyToken, AuthUserPayload } from '../utils/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired session token' }
    });
    return;
  }
}

export function requireRole(allowedRole: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    if (req.user.role !== allowedRole) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Access restricted to ${allowedRole} role` }
      });
      return;
    }

    next();
  };
}

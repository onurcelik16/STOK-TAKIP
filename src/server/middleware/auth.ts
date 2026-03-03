import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../data/db';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Role and verification lookup
  try {
    const user = db.prepare('SELECT role, is_verified FROM users WHERE id = ?').get(req.userId) as { role: string, is_verified: number } | undefined;

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Verification check removed by user request
    req.userRole = user.role || 'user';

    req.userRole = user.role || 'user';
  } catch (e) {
    req.userRole = 'user';
  }

  next();
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Must be used after authMiddleware
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'ADMIN_ONLY' });
  }
  next();
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}


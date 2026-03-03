import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../data/db';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail } from '../utils/email';
import { authLimiter } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

router.post('/register', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password, name } = parsed.data;

  try {
    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Assign role: first user = admin, rest = user
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
    const role = userCount === 0 ? 'admin' : 'user';
    const isVerified = role === 'admin' ? 1 : 0;

    // Create user
    const stmt = db.prepare(
      "INSERT INTO users (email, password_hash, name, role, verification_code, is_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))"
    );
    const info = stmt.run(email, passwordHash, name, role, verificationCode, isVerified);
    const userId = Number(info.lastInsertRowid);

    // Send email (non-blocking for response, but logged)
    sendVerificationEmail(email, verificationCode);

    const token = generateToken(userId);

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name,
        role,
      },
    });
  } catch (e: any) {
    console.error('[auth] register failed', e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  logger.info({ email }, '[auth] Login attempt');

  try {
    const user = db.prepare('SELECT id, email, password_hash, name, role FROM users WHERE email = ?').get(email) as
      | { id: number; email: string; password_hash: string; name: string | null; role: string }
      | undefined;

    if (!user) {
      logger.warn({ email }, '[auth] Login failed: User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.debug('[auth] User found, comparing password');
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      logger.warn({ email }, '[auth] Login failed: Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info({ userId: user.id }, '[auth] Login successful');
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: !!(user as any).is_verified
      },
    });
  } catch (e: any) {
    logger.error(e, '[auth] login failed');
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify account
router.post('/verify', authMiddleware, async (req: AuthRequest, res) => {
  const schema = z.object({
    code: z.string().length(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Geçersiz kod formatı' });
  }

  const { code } = parsed.data;

  try {
    const user = db.prepare('SELECT verification_code FROM users WHERE id = ?').get(req.userId!) as { verification_code: string } | undefined;

    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Hatalı doğrulama kodu' });
    }

    db.prepare('UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?').run(req.userId!);

    res.json({ success: true, message: 'Hesabınız başarıyla doğrulandı' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Resend verification code
router.post('/resend-code', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = db.prepare('SELECT email, is_verified FROM users WHERE id = ?').get(req.userId!) as { email: string, is_verified: number } | undefined;

    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    if (user.is_verified) return res.status(400).json({ error: 'Hesap zaten doğrulanmış' });

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    db.prepare('UPDATE users SET verification_code = ? WHERE id = ?').run(newCode, req.userId!);

    sendVerificationEmail(user.email, newCode);
    logger.info({ userId: req.userId }, '[auth] Verification code resent');

    res.json({ success: true, message: 'Yeni doğrulama kodu e-postanıza gönderildi' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user profile
router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, role, telegram_chat_id, telegram_verify_code, created_at FROM users WHERE id = ?').get(req.userId!) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Generate Telegram connection code
router.get('/telegram/connect', authMiddleware, (req: AuthRequest, res) => {
  try {
    const code = crypto.randomBytes(4).toString('hex'); // 8 chars
    db.prepare('UPDATE users SET telegram_verify_code = ? WHERE id = ?').run(code, req.userId!);

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'StoreStockTrackerBot';
    const link = `https://t.me/${botUsername}?start=${code}`;

    res.json({ code, link });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update user profile (name, telegram_chat_id)
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const { name, telegram_chat_id } = req.body;
  try {
    db.prepare('UPDATE users SET name = ?, telegram_chat_id = ? WHERE id = ?').run(
      name || null,
      telegram_chat_id || null,
      req.userId!
    );
    const user = db.prepare('SELECT id, email, name, telegram_chat_id FROM users WHERE id = ?').get(req.userId!) as any;
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

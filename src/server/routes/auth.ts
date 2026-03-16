import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../data/db';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email';
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
    const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    const isVerified = requireVerification ? 0 : 1;

    // Create user
    const stmt = db.prepare(
      "INSERT INTO users (email, password_hash, name, role, verification_code, is_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))"
    );
    const info = stmt.run(email, passwordHash, name, role, verificationCode, isVerified);
    const userId = Number(info.lastInsertRowid);

    if (requireVerification) {
      await sendVerificationEmail(email, verificationCode);
      logger.info({ userId, email }, '[auth] Verification email sent');
    } else {
      await sendWelcomeEmail(email, name);
      logger.info({ userId, email }, '[auth] Welcome email sent');
    }

    const token = generateToken(userId);

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name,
        role,
        is_verified: isVerified === 1,
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
    const user = db.prepare('SELECT id, email, password_hash, name, role, is_verified FROM users WHERE email = ?').get(email) as
      | { id: number; email: string; password_hash: string; name: string | null; role: string; is_verified: number }
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
        is_verified: user.is_verified === 1,
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

    const u = db.prepare('SELECT email, name FROM users WHERE id = ?').get(req.userId!) as { email: string; name: string | null };
    if (u) await sendWelcomeEmail(u.email, u.name || '');

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
    const user = db.prepare('SELECT id, email, name, role, telegram_chat_id, telegram_verify_code, email_notifications, created_at FROM users WHERE id = ?').get(req.userId!) as any;
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

// Update user profile (name, telegram_chat_id, email_notifications)
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const { name, telegram_chat_id, email_notifications } = req.body;
  try {
    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name || null); }
    if (telegram_chat_id !== undefined) { updates.push('telegram_chat_id = ?'); params.push(telegram_chat_id || null); }
    if (email_notifications !== undefined) { updates.push('email_notifications = ?'); params.push(email_notifications ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: 'no_changes' });
    params.push(req.userId!);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const user = db.prepare('SELECT id, email, name, telegram_chat_id, email_notifications FROM users WHERE id = ?').get(req.userId!) as any;
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Forgot password – request reset link
router.post('/forgot-password', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin' });
  }

  const { email } = parsed.data;

  try {
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as { id: number; email: string } | undefined;

    if (user) {
      // Generate a secure token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?')
        .run(tokenHash, expires, user.id);

      const panelUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '';
      const resetUrl = `${panelUrl}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail(user.email, resetUrl);
      logger.info({ userId: user.id }, '[auth] Password reset email sent');
    } else {
      logger.info({ email }, '[auth] Forgot password: email not found (silent)');
    }

    // Always return success to avoid email enumeration
    res.json({ success: true, message: 'Eğer bu e-posta adresiyle bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.' });
  } catch (e: any) {
    logger.error(e, '[auth] forgot-password failed');
    res.status(500).json({ error: 'İşlem sırasında bir hata oluştu' });
  }
});

// Reset password – use token to set new password
router.post('/reset-password', authLimiter, async (req, res) => {
  const schema = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Geçersiz istek. Şifre en az 8 karakter olmalıdır.' });
  }

  const { token, newPassword } = parsed.data;

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = db.prepare(
      'SELECT id, password_reset_expires FROM users WHERE password_reset_token = ?'
    ).get(tokenHash) as { id: number; password_reset_expires: string } | undefined;

    if (!user) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş bağlantı. Lütfen tekrar şifre sıfırlama talebinde bulunun.' });
    }

    // Check expiry
    if (new Date(user.password_reset_expires) < new Date()) {
      // Clear expired token
      db.prepare('UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?').run(user.id);
      return res.status(400).json({ error: 'Bağlantının süresi dolmuş. Lütfen tekrar şifre sıfırlama talebinde bulunun.' });
    }

    // Hash new password and clear token
    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?')
      .run(passwordHash, user.id);

    logger.info({ userId: user.id }, '[auth] Password reset successful');
    res.json({ success: true, message: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
  } catch (e: any) {
    logger.error(e, '[auth] reset-password failed');
    res.status(500).json({ error: 'İşlem sırasında bir hata oluştu' });
  }
});

export default router;

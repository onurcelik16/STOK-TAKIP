import { Router } from 'express';
import { db } from '../data/db';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import { restartStockChecks } from '../jobs/checkStock';

const router = Router();

// Dashboard endpoint - gerçek verilerle
router.get('/dashboard', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // 1. Total products for this user
    const totalProducts = (db.prepare('SELECT COUNT(*) as count FROM products WHERE user_id = ?').get(userId) as any).count;

    // 2. In-stock vs out-of-stock based on latest check per product
    const inStockCount = (db.prepare(`
      SELECT COUNT(*) as count FROM products p
      WHERE p.user_id = ? AND EXISTS (
        SELECT 1 FROM stock_history sh
        WHERE sh.product_id = p.id AND sh.in_stock = 1
        AND sh.id = (SELECT s2.id FROM stock_history s2 WHERE s2.product_id = p.id ORDER BY s2.id DESC LIMIT 1)
      )
    `).get(userId) as any).count;

    const outOfStockCount = totalProducts - inStockCount;

    // 3. Products with price drops in last 24h (compare current price vs highest price in last 24h)
    const priceDrops = db.prepare(`
      SELECT p.id, p.url, p.store, p.name, p.image_url,
             latest.price as current_price,
             max_hist.max_price as previous_price,
             ROUND(max_hist.max_price - latest.price, 2) as drop_amount
      FROM products p
      JOIN stock_history latest ON latest.product_id = p.id
        AND latest.id = (SELECT s1.id FROM stock_history s1 WHERE s1.product_id = p.id ORDER BY s1.checked_at DESC LIMIT 1)
      JOIN (
        SELECT product_id, MAX(price) as max_price
        FROM stock_history
        WHERE price IS NOT NULL
          AND checked_at > datetime('now', 'localtime', '-24 hours')
        GROUP BY product_id
      ) max_hist ON max_hist.product_id = p.id
      WHERE p.user_id = ?
        AND latest.price IS NOT NULL
        AND latest.price < max_hist.max_price
      ORDER BY drop_amount DESC
      LIMIT 5
    `).all(userId) as any[];

    // 4. Recent stock changes (stock transitions in last 24h)
    const recentChanges = db.prepare(`
      SELECT p.id, p.url, p.store, p.name, p.image_url, sh.in_stock, sh.price, sh.checked_at, sh.source
      FROM stock_history sh
      JOIN products p ON p.id = sh.product_id
      WHERE p.user_id = ?
        AND sh.checked_at > datetime('now', 'localtime', '-24 hours')
      ORDER BY sh.id DESC
      LIMIT 10
    `).all(userId) as any[];

    // 5. Total checks in last 24h
    const checksToday = (db.prepare(`
      SELECT COUNT(*) as count FROM stock_history sh
      JOIN products p ON p.id = sh.product_id
      WHERE p.user_id = ? AND sh.checked_at > datetime('now', 'localtime', '-24 hours')
    `).get(userId) as any).count;

    // 6. Cron interval
    const cronExpr = process.env.CRON || '*/10 * * * *';

    res.json({
      totalProducts,
      inStockCount,
      outOfStockCount,
      priceDrops,
      recentChanges,
      checksToday,
      cronExpr,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Basit admin paneli - sadece authenticated kullanıcılar
router.get('/stats', authMiddleware, (req: AuthRequest, res) => {
  try {
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
      products: db.prepare('SELECT COUNT(*) as count FROM products WHERE user_id = ?').get(req.userId!) as { count: number },
      totalProducts: db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number },
      history: db.prepare('SELECT COUNT(*) as count FROM stock_history').get() as { count: number },
      recentHistory: db.prepare(`
        SELECT COUNT(*) as count 
        FROM stock_history 
        WHERE checked_at > datetime('now', 'localtime', '-24 hours')
      `).get() as { count: number },
    };

    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Kullanıcının kendi ürünlerini listele
router.get('/my-products', authMiddleware, (req: AuthRequest, res) => {
  try {
    const products = db.prepare(`
      SELECT p.id, p.url, p.store, p.size, p.created_at, 
             COUNT(sh.id) as check_count,
             MAX(sh.checked_at) as last_check
      FROM products p
      LEFT JOIN stock_history sh ON p.id = sh.product_id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.id DESC
    `).all(req.userId!);

    res.json(products);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Veritabanı dosya bilgisi
router.get('/db-info', authMiddleware, (req: AuthRequest, res) => {
  try {
    const info = db.prepare('PRAGMA database_list').get() as any;
    const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number };
    const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number };

    res.json({
      database: info?.name || 'app.sqlite',
      pageSize: pageSize?.page_size || 0,
      pageCount: pageCount?.page_count || 0,
      sizeKB: Math.round((pageSize?.page_size || 0) * (pageCount?.page_count || 0) / 1024),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Analytics endpoint for Statistics page
router.get('/analytics', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Top price increases (comparing last 2 checks)
    const priceIncreases = db.prepare(`
      SELECT p.id, p.url, p.store, curr.price as current_price, prev.price as previous_price,
             ROUND(curr.price - prev.price, 2) as change_amount,
             ROUND((curr.price - prev.price) / prev.price * 100, 1) as change_percent
      FROM products p
      JOIN stock_history curr ON curr.product_id = p.id
      JOIN stock_history prev ON prev.product_id = p.id
      WHERE p.user_id = ?
        AND curr.id = (SELECT s1.id FROM stock_history s1 WHERE s1.product_id = p.id ORDER BY s1.checked_at DESC LIMIT 1)
        AND prev.id = (SELECT s2.id FROM stock_history s2 WHERE s2.product_id = p.id AND s2.id != curr.id ORDER BY s2.checked_at DESC LIMIT 1)
        AND curr.price IS NOT NULL AND prev.price IS NOT NULL AND prev.price > 0
        AND curr.price > prev.price
      ORDER BY change_percent DESC
      LIMIT 5
    `).all(userId);

    // Top price decreases
    const priceDecreases = db.prepare(`
      SELECT p.id, p.url, p.store, curr.price as current_price, prev.price as previous_price,
             ROUND(prev.price - curr.price, 2) as change_amount,
             ROUND((prev.price - curr.price) / prev.price * 100, 1) as change_percent
      FROM products p
      JOIN stock_history curr ON curr.product_id = p.id
      JOIN stock_history prev ON prev.product_id = p.id
      WHERE p.user_id = ?
        AND curr.id = (SELECT s1.id FROM stock_history s1 WHERE s1.product_id = p.id ORDER BY s1.checked_at DESC LIMIT 1)
        AND prev.id = (SELECT s2.id FROM stock_history s2 WHERE s2.product_id = p.id AND s2.id != curr.id ORDER BY s2.checked_at DESC LIMIT 1)
        AND curr.price IS NOT NULL AND prev.price IS NOT NULL AND prev.price > 0
        AND curr.price < prev.price
      ORDER BY change_percent DESC
      LIMIT 5
    `).all(userId);

    // Total checks all time
    const totalChecks = (db.prepare(`
      SELECT COUNT(*) as count FROM stock_history sh
      JOIN products p ON p.id = sh.product_id
      WHERE p.user_id = ?
    `).get(userId) as any).count;

    // Checks last 24h
    const checks24h = (db.prepare(`
      SELECT COUNT(*) as count FROM stock_history sh
      JOIN products p ON p.id = sh.product_id
      WHERE p.user_id = ? AND sh.checked_at > datetime('now', 'localtime', '-24 hours')
    `).get(userId) as any).count;

    // Checks per day for last 7 days (for chart)
    const dailyChecks = db.prepare(`
      SELECT date(sh.checked_at) as day, COUNT(*) as count 
      FROM stock_history sh 
      JOIN products p ON p.id = sh.product_id
      WHERE p.user_id = ? AND sh.checked_at > datetime('now', 'localtime', '-7 days')
      GROUP BY date(sh.checked_at) 
      ORDER BY day ASC
    `).all(userId);

    // Store distribution
    const storeDistribution = db.prepare(`
      SELECT store, COUNT(*) as count FROM products WHERE user_id = ? GROUP BY store
    `).all(userId);

    // Active alerts count
    const activeAlerts = (db.prepare(`
      SELECT COUNT(*) as count FROM price_alerts WHERE user_id = ? AND is_active = 1
    `).get(userId) as any).count;

    res.json({
      priceIncreases,
      priceDecreases,
      totalChecks,
      checks24h,
      dailyChecks,
      storeDistribution,
      activeAlerts,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// User Management (Admin Only)
// ==========================================

// List all users (admin only)
router.get('/users', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at,
        (SELECT COUNT(*) FROM products p WHERE p.user_id = u.id) as product_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Change user role (admin only)
router.put('/users/:id/role', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "user"' });
  }

  // Prevent self-demotion (last admin protection)
  if (targetId === req.userId && role === 'user') {
    const adminCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any).count;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Son admin kullanıcının rolü değiştirilemez' });
    }
  }

  try {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
    const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(targetId);
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);

  // Prevent self-delete
  if (targetId === req.userId) {
    return res.status(400).json({ error: 'Kendini silemezsin' });
  }

  try {
    // Delete user's data cascade
    const products = db.prepare('SELECT id FROM products WHERE user_id = ?').all(targetId) as { id: number }[];
    for (const p of products) {
      db.prepare('DELETE FROM price_alerts WHERE product_id = ?').run(p.id);
      db.prepare('DELETE FROM stock_history WHERE product_id = ?').run(p.id);
    }
    db.prepare('DELETE FROM products WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// Admin: View User's Products
// ==========================================

router.get('/users/:id/products', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const products = db.prepare(`
      SELECT p.*, 
        (SELECT sh.in_stock FROM stock_history sh WHERE sh.product_id = p.id ORDER BY sh.checked_at DESC LIMIT 1) as last_stock,
        (SELECT sh.price FROM stock_history sh WHERE sh.product_id = p.id ORDER BY sh.checked_at DESC LIMIT 1) as last_price,
        (SELECT sh.checked_at FROM stock_history sh WHERE sh.product_id = p.id ORDER BY sh.checked_at DESC LIMIT 1) as last_check,
        (SELECT COUNT(*) FROM stock_history sh WHERE sh.product_id = p.id) as check_count
      FROM products p WHERE p.user_id = ? ORDER BY p.created_at DESC
    `).all(userId);

    res.json({ user, products });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// CSV Export (Admin Only)
// ==========================================

// Export all products as CSV
router.get('/export/products', authMiddleware, (req: AuthRequest, res) => {
  try {
    const targetUserId = req.query.userId ? Number(req.query.userId) : null;

    // Only admin can export all or other users
    if (targetUserId === null || targetUserId !== req.userId) {
      if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Access denied. You can only export your own products.' });
      }
    }

    const products = db.prepare(`
      SELECT p.id, p.url, p.store, p.name, p.category, p.tags, p.size, p.created_at,
        u.email as owner_email, u.name as owner_name,
        (SELECT sh.in_stock FROM stock_history sh WHERE sh.product_id = p.id ORDER BY sh.checked_at DESC LIMIT 1) as in_stock,
        (SELECT sh.price FROM stock_history sh WHERE sh.product_id = p.id ORDER BY sh.checked_at DESC LIMIT 1) as price,
        (SELECT sh.checked_at FROM stock_history sh WHERE sh.product_id = p.id ORDER BY sh.checked_at DESC LIMIT 1) as last_check,
        (SELECT COUNT(*) FROM stock_history sh WHERE sh.product_id = p.id) as check_count
      FROM products p
      LEFT JOIN users u ON p.user_id = u.id
      ${targetUserId ? 'WHERE p.user_id = ?' : ''}
      ORDER BY p.id
    `).all(req.query.userId ? [req.query.userId] : []) as any[];

    const header = 'ID,URL,Mağaza,Ürün Adı,Kategori,Etiketler,Beden,Sahip,Stok Durumu,Fiyat,Son Kontrol,Kontrol Sayısı,Eklenme\n';
    const rows = products.map(p =>
      `${p.id},"${(p.url || '').replace(/"/g, '""')}","${p.store}","${(p.name || '').replace(/"/g, '""')}","${p.category || ''}","${(p.tags || '').replace(/"/g, '""')}","${p.size || ''}","${p.owner_email || ''}","${p.in_stock === 1 ? 'Stokta' : 'Tükendi'}","${p.price?.toFixed(2) || ''}","${p.last_check || ''}","${p.check_count}","${p.created_at}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=products_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send('\uFEFF' + header + rows); // BOM for Excel UTF-8
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Export product stock history as CSV
router.get('/export/history/:productId', authMiddleware, (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Only owner or admin can export
    if (product.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = db.prepare(
      'SELECT in_stock, price, checked_at, source, size FROM stock_history WHERE product_id = ? ORDER BY checked_at DESC'
    ).all(productId) as any[];

    const header = 'Tarih,Stok Durumu,Fiyat,Kaynak,Beden\n';
    const rows = history.map(h =>
      `"${h.checked_at}","${h.in_stock === 1 ? 'Stokta' : 'Tükendi'}","${h.price?.toFixed(2) || ''}","${h.source || ''}","${h.size || ''}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=history_${productId}_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send('\uFEFF' + header + rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// System Settings (Admin Only)
// ==========================================

const DEFAULT_SETTINGS: Record<string, string> = {
  cron_interval: '*/10 * * * *',
  product_limit: '10',
  notification_email: '',
};

function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
}

function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run(key, value);
}

// Get all system settings + system info
router.get('/system-settings', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'app.sqlite');
    let dbSize = 0;
    try { dbSize = fs.statSync(dbPath).size; } catch { }

    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const totalProducts = (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count;
    const totalChecks = (db.prepare('SELECT COUNT(*) as count FROM stock_history').get() as any).count;
    const totalAlerts = (db.prepare('SELECT COUNT(*) as count FROM price_alerts').get() as any).count;
    const activeAlerts = (db.prepare('SELECT COUNT(*) as count FROM price_alerts WHERE is_active = 1').get() as any).count;

    const settings = {
      cron_interval: getSetting('cron_interval'),
      product_limit: getSetting('product_limit'),
      notification_email: getSetting('notification_email'),
    };

    const systemInfo = {
      dbSize,
      totalUsers,
      totalProducts,
      totalChecks,
      totalAlerts,
      activeAlerts,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
    };

    res.json({ settings, systemInfo });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update system settings
router.put('/system-settings', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  try {
    const { cron_interval, product_limit, notification_email } = req.body;

    let cronChanged = false;
    if (cron_interval !== undefined) {
      const old = getSetting('cron_interval');
      if (old !== cron_interval) {
        setSetting('cron_interval', cron_interval);
        cronChanged = true;
      }
    }

    if (product_limit !== undefined) setSetting('product_limit', String(product_limit));
    if (notification_email !== undefined) setSetting('notification_email', notification_email);

    if (cronChanged) {
      try {
        restartStockChecks();
      } catch (err: any) {
        console.error('[cron] failed to restart:', err.message);
      }
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// Notifications
// ==========================================

// Get user notifications
router.get('/notifications', authMiddleware, (req: AuthRequest, res) => {
  try {
    const notifications = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.userId!);
    const unreadCount = (db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.userId!) as any).count;
    res.json({ notifications, unreadCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Mark notifications as read
router.post('/notifications/read', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { ids } = req.body; // array of notification IDs, or 'all'
    if (ids === 'all') {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId!);
    } else if (Array.isArray(ids)) {
      const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?');
      for (const id of ids) stmt.run(id, req.userId!);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get user's notification count (for header badge)
router.get('/notifications/count', authMiddleware, (req: AuthRequest, res) => {
  try {
    const count = (db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.userId!) as any).count;
    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { getSetting };
export default router;

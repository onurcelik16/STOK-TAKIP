import { Router } from 'express';
import { z } from 'zod';
import { db } from '../data/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getSetting } from './admin';

const router = Router();

const productCreateSchema = z.object({
  url: z.string().url(),
  store: z.string().min(2),
  selector: z.string().min(1).optional(),
  size: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
});

const productUpdateSchema = z.object({
  url: z.string().url().optional(),
  store: z.string().min(1).optional(),
  name: z.string().optional().nullable(),
  selector: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});

// Get all products for current user
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  try {
    const showAll = req.query.all === 'true' && req.userRole === 'admin';
    const products = db
      .prepare(
        `SELECT 
          p.id, p.url, p.store, p.selector, p.size, p.name, p.image_url, p.category, p.tags, p.created_at, p.user_id,
          u.email as owner_email,
          sh.in_stock AS last_in_stock,
          sh.price AS last_price,
          sh.checked_at AS last_checked_at,
          sh.source AS last_source
        FROM products p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN stock_history sh ON sh.id = (
          SELECT s2.id FROM stock_history s2 WHERE s2.product_id = p.id ORDER BY s2.checked_at DESC LIMIT 1
        )
        ${showAll ? '' : 'WHERE p.user_id = ?'}
        ORDER BY p.id DESC`
      )
      .all(showAll ? [] : [req.userId!]);
    res.json(products);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get single product detail
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const product = db.prepare('SELECT id, url, store, selector, size, name, image_url, category, tags, user_id, created_at FROM products WHERE id = ?').get(id) as any;

    if (!product) return res.status(404).json({ error: 'product_not_found' });

    // Access check: only owner or admin
    if (product.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Support time range filtering via ?days=7|30|90|all
    const daysParam = req.query.days as string;
    let historyQuery = 'SELECT id, in_stock, price, checked_at, source, size FROM stock_history WHERE product_id = ?';
    const queryParams: any[] = [id];

    if (daysParam && daysParam !== 'all') {
      const days = parseInt(daysParam, 10);
      if (!isNaN(days) && days > 0) {
        historyQuery += ` AND checked_at > datetime('now', 'localtime', '-${days} days')`;
      }
    }

    historyQuery += ' ORDER BY checked_at DESC LIMIT 2000';

    const history = db.prepare(historyQuery).all(...queryParams) as any[];

    const current_status = history.length > 0 ? {
      value: history[0].in_stock === 1,
      method: history[0].source || 'http',
      samples: history.slice(0, 5).map(h => ({
        in_stock: h.in_stock,
        source: h.source,
        checked_at: h.checked_at
      }))
    } : null;

    res.json({ product, history, current_status });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Add new product
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  // Enforce product limit for regular users
  const PRODUCT_LIMIT = parseInt(getSetting('product_limit') || '10', 10);
  if (req.userRole !== 'admin') {
    const currentCount = (db.prepare('SELECT COUNT(*) as count FROM products WHERE user_id = ?').get(req.userId!) as any).count;
    if (currentCount >= PRODUCT_LIMIT) {
      return res.status(403).json({
        error: `Ürün limitinize ulaştınız (${PRODUCT_LIMIT}). Daha fazla ürün eklemek için admin ile iletişime geçin.`,
        code: 'PRODUCT_LIMIT_REACHED',
        limit: PRODUCT_LIMIT,
        current: currentCount,
      });
    }
  }

  try {
    const { url, store, selector, size, name, image_url, category, tags } = parsed.data;
    const info = db.prepare(
      "INSERT INTO products (user_id, url, store, selector, size, name, image_url, category, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))"
    ).run(req.userId!, url, store, selector ?? null, size ?? null, name ?? null, image_url ?? null, category ?? null, tags ?? null);

    const created = db.prepare('SELECT id, url, store, selector, size, name, image_url, category, tags, created_at FROM products WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: 'create_failed', message: e.message });
  }
});

// Update product
router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const product = db.prepare('SELECT user_id FROM products WHERE id = ?').get(id) as any;

    if (!product) return res.status(404).json({ error: 'product_not_found' });
    if (product.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'access_denied' });
    }

    const parsed = productUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const data = parsed.data;
    const updates: string[] = [];
    const params: any[] = [];

    const fields = ['url', 'store', 'name', 'selector', 'size', 'category', 'tags', 'image_url'];
    for (const field of fields) {
      if ((data as any)[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push((data as any)[field]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'no_changes' });

    params.push(id);
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT id, url, store, selector, size, name, image_url, category, tags, created_at FROM products WHERE id = ?').get(id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete product
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const product = db.prepare('SELECT user_id FROM products WHERE id = ?').get(id) as any;

    if (!product) return res.status(404).json({ error: 'product_not_found' });
    if (product.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'access_denied' });
    }

    db.prepare('DELETE FROM price_alerts WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM stock_history WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Product search/preview
router.get('/preview', authMiddleware, async (req: AuthRequest, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'url required' });

  let store = 'generic';
  if (url.includes('trendyol.com')) store = 'trendyol';
  else if (url.includes('hepsiburada.com')) store = 'generic';
  else if (url.includes('amazon.com.tr') || url.includes('amazon.tr')) store = 'amazon';

  try {
    let scraper: any;
    if (store === 'trendyol') {
      const mod = await import('../stores/trendyol/TrendyolStore');
      scraper = mod.TrendyolStore;
    } else if (store === 'amazon') {
      const mod = await import('../stores/amazon/AmazonStore');
      scraper = mod.AmazonStore;
    } else {
      const mod = await import('../stores/generic/GenericStore');
      scraper = mod.GenericStore;
    }

    if (!scraper) return res.json({ store, name: null, imageUrl: null, price: null });

    const result = await scraper.checkProduct({ url });
    res.json({
      store,
      name: result.productName || null,
      imageUrl: result.imageUrl || null,
      price: result.price || null,
      inStock: result.inStock,
    });
  } catch (e: any) {
    res.json({ store, name: null, imageUrl: null, price: null, error: e.message });
  }
});

// === Price Alerts ===

router.get('/:id/alerts', authMiddleware, (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const product = db.prepare('SELECT user_id FROM products WHERE id = ?').get(productId) as any;
    if (!product) return res.status(404).json({ error: 'not_found' });
    if (product.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const alerts = db.prepare(
      'SELECT id, target_price, direction, is_active, created_at, triggered_at FROM price_alerts WHERE product_id = ? ORDER BY created_at DESC'
    ).all(productId);
    res.json(alerts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/alerts', authMiddleware, (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const product = db.prepare('SELECT user_id FROM products WHERE id = ?').get(productId) as any;
    if (!product) return res.status(404).json({ error: 'not_found' });
    if (product.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { target_price, direction } = req.body;
    if (!target_price || typeof target_price !== 'number') {
      return res.status(400).json({ error: 'target_price is required and must be a number' });
    }
    const dir = direction === 'above' ? 'above' : 'below';

    const info = db.prepare(
      "INSERT INTO price_alerts (user_id, product_id, target_price, direction, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime('now', 'localtime'))"
    ).run(req.userId!, productId, target_price, dir);

    const created = db.prepare('SELECT * FROM price_alerts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/alerts/:alertId', authMiddleware, (req: AuthRequest, res) => {
  try {
    const alertId = Number(req.params.alertId);
    const alert = db.prepare('SELECT user_id FROM price_alerts WHERE id = ?').get(alertId) as any;
    if (!alert) return res.status(404).json({ error: 'not_found' });
    if (alert.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    db.prepare('DELETE FROM price_alerts WHERE id = ?').run(alertId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// === Bulk Operations ===

router.post('/bulk-delete', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids_required' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const checkSql = req.userRole === 'admin'
      ? `SELECT id FROM products WHERE id IN (${placeholders})`
      : `SELECT id FROM products WHERE id IN (${placeholders}) AND user_id = ?`;

    const params = req.userRole === 'admin' ? ids : [...ids, req.userId];
    const validIds = db.prepare(checkSql).all(...params).map((p: any) => p.id);

    if (validIds.length === 0) return res.json({ count: 0 });

    const vPlaceholders = validIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM price_alerts WHERE product_id IN (${vPlaceholders})`).run(...validIds);
    db.prepare(`DELETE FROM stock_history WHERE product_id IN (${vPlaceholders})`).run(...validIds);
    const info = db.prepare(`DELETE FROM products WHERE id IN (${vPlaceholders})`).run(...validIds);

    res.json({ count: info.changes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/bulk-category', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { ids, category } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids_required' });

    const placeholders = ids.map(() => '?').join(',');
    const updateSql = req.userRole === 'admin'
      ? `UPDATE products SET category = ? WHERE id IN (${placeholders})`
      : `UPDATE products SET category = ? WHERE id IN (${placeholders}) AND user_id = ?`;

    const params = req.userRole === 'admin' ? [category, ...ids] : [category, ...ids, req.userId];
    const info = db.prepare(updateSql).run(...params);

    res.json({ count: info.changes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/bulk-tags', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { ids, tags, mode } = req.body; // mode: 'replace' | 'add'
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids_required' });

    let count = 0;
    for (const id of ids) {
      const product = db.prepare('SELECT id, user_id, tags FROM products WHERE id = ?').get(id) as any;
      if (!product) continue;
      if (product.user_id !== req.userId && req.userRole !== 'admin') continue;

      let newTags = tags;
      if (mode === 'add' && product.tags) {
        const existing = (product.tags as string).split(',').map(t => t.trim()).filter(Boolean);
        const toAdd = (tags as string).split(',').map(t => t.trim()).filter(Boolean);
        newTags = Array.from(new Set([...existing, ...toAdd])).join(', ');
      }

      const info = db.prepare('UPDATE products SET tags = ? WHERE id = ?').run(newTags, id);
      count += info.changes;
    }

    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../utils/logger';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'app.sqlite');

function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export let db: Database.Database;

export function ensureDatabaseInitialized() {
  logger.info({ dbPath }, '[db] Initializing database');
  try {
    ensureDirExists(dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    logger.info('[db] Database connection established');
  } catch (err: any) {
    logger.fatal(err, '[db] CRITICAL: Failed to initialize database');
    throw err;
  }

  try {
    // 1. Create tables first if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        telegram_chat_id TEXT,
        telegram_verify_code TEXT UNIQUE,
        is_verified INTEGER NOT NULL DEFAULT 0,
        verification_code TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        url TEXT NOT NULL,
        store TEXT NOT NULL,
        selector TEXT,
        size TEXT,
        name TEXT,
        image_url TEXT,
        category TEXT,
        tags TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS stock_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        in_stock INTEGER NOT NULL,
        price REAL,
        checked_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        source TEXT,
        size TEXT,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS price_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        target_price REAL NOT NULL,
        direction TEXT NOT NULL DEFAULT 'below',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        triggered_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        product_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_stock_history_product_time ON stock_history(product_id, checked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
      CREATE INDEX IF NOT EXISTS idx_price_alerts_product ON price_alerts(product_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
    `);

    // 2. Run migrations for older versions (Add missing columns)
    const productCols = db.prepare("PRAGMA table_info(products)").all() as any[];
    const productColNames = productCols.map(c => c.name);

    if (!productColNames.includes('user_id')) {
      db.exec("ALTER TABLE products ADD COLUMN user_id INTEGER DEFAULT 1;");
      logger.info('[db] migrated: added user_id to products');
    }
    if (!productColNames.includes('size')) {
      db.exec("ALTER TABLE products ADD COLUMN size TEXT;");
      logger.info('[db] migrated: added size to products');
    }
    if (!productColNames.includes('category')) {
      db.exec("ALTER TABLE products ADD COLUMN category TEXT;");
      logger.info('[db] migrated: added category to products');
    }
    if (!productColNames.includes('tags')) {
      db.exec("ALTER TABLE products ADD COLUMN tags TEXT;");
      logger.info('[db] migrated: added tags to products');
    }

    const userCols = db.prepare("PRAGMA table_info(users)").all() as any[];
    const userColNames = userCols.map(c => c.name);

    if (!userColNames.includes('role')) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';");
      logger.info('[db] migrated: added role to users');
    }
    if (!userColNames.includes('is_verified')) {
      db.exec("ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;");
      logger.info('[db] migrated: added is_verified to users');
    }

    // 3. Ensure users are verified (Verification disabled by user request)
    db.exec("UPDATE users SET is_verified = 1");
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (!admin) {
      const firstUser = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get() as any;
      if (firstUser) {
        db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(firstUser.id);
        logger.info({ userId: firstUser.id }, '[db] Promoted first user to admin');
      }
    }

    logger.info('[db] Schema synchronization complete');
  } catch (err) {
    logger.error(err, '[db] Initialization/Migration error');
  }
}

export function getLastStatus(productId: number): { in_stock: number; price: number | null } | null {
  const row = db
    .prepare(
      'SELECT in_stock, price FROM stock_history WHERE product_id = ? ORDER BY checked_at DESC LIMIT 1'
    )
    .get(productId) as { in_stock: number; price: number | null } | undefined;
  return row ?? null;
}

export function pruneOldStockHistory(retentionDays: number = 90): number {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return 0;
  }

  const stmt = db.prepare(
    `DELETE FROM stock_history 
     WHERE checked_at < datetime('now', 'localtime', ?)`
  );
  const info = stmt.run(`-${Math.floor(retentionDays)} days`);
  return info.changes ?? 0;
}

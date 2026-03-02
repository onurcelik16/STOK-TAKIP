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
    logger.debug('[db] Directory checked/created');

    db = new Database(dbPath);
    logger.info('[db] Database connection established');

    db.pragma('journal_mode = WAL');
    logger.debug('[db] WAL mode enabled');
  } catch (err: any) {
    logger.fatal(err, '[db] CRITICAL: Failed to initialize database');
    if (err.code === 'EACCES' || err.code === 'EROFS') {
      logger.error('[db] SUGGESTION: This looks like a permissions or read-only filesystem error. Check Railway Volumes!');
    }
    throw err;
  }

  // First, check and migrate existing tables
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    // Create users table if not exists
    if (!tableNames.includes('users')) {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          telegram_chat_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );
      `);
      console.log('[db] migrated: created users table');
    }

    // Migrate products table (add user_id, size)
    if (tableNames.includes('products')) {
      try {
        const productColumns = db.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
        const columnNames = productColumns.map((c) => c.name);

        if (!columnNames.includes('user_id')) {
          db.exec(`ALTER TABLE products ADD COLUMN user_id INTEGER DEFAULT 1;`);
          db.exec(`UPDATE products SET user_id = 1 WHERE user_id IS NULL;`);
          console.log('[db] migrated: added user_id to products');
        }

        if (!columnNames.includes('size')) {
          db.exec(`ALTER TABLE products ADD COLUMN size TEXT;`);
          console.log('[db] migrated: added size to products');
        }

        if (!columnNames.includes('name')) {
          db.exec(`ALTER TABLE products ADD COLUMN name TEXT;`);
          console.log('[db] migrated: added name to products');
        }

        if (!columnNames.includes('image_url')) {
          db.exec(`ALTER TABLE products ADD COLUMN image_url TEXT;`);
          console.log('[db] migrated: added image_url to products');
        }

        if (!columnNames.includes('category')) {
          db.exec(`ALTER TABLE products ADD COLUMN category TEXT;`);
          console.log('[db] migrated: added category to products');
        }

        if (!columnNames.includes('tags')) {
          db.exec(`ALTER TABLE products ADD COLUMN tags TEXT;`);
          console.log('[db] migrated: added tags to products');
        }
      } catch (e: any) {
        console.warn('[db] products migration error:', e.message);
      }
    }

    // Migrate users table (add role, name)
    if (tableNames.includes('users')) {
      try {
        const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
        const columnNames = userColumns.map((c) => c.name);

        if (!columnNames.includes('role')) {
          db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`);
          // First user becomes admin
          const firstUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
          if (firstUser) {
            db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(firstUser.id);
          }
          console.log('[db] migrated: added role to users (first user = admin)');
        }

        if (!columnNames.includes('name')) {
          db.exec(`ALTER TABLE users ADD COLUMN name TEXT;`);
          console.log('[db] migrated: added name to users');
        }

        if (!columnNames.includes('telegram_verify_code')) {
          db.exec(`ALTER TABLE users ADD COLUMN telegram_verify_code TEXT;`);
          db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_verify_code ON users(telegram_verify_code);`);
          console.log('[db] migrated: added telegram_verify_code to users');
        }

        if (!columnNames.includes('is_verified')) {
          db.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;`);
          db.exec(`UPDATE users SET is_verified = 1;`); // Existing users are already "trusted"
          console.log('[db] migrated: added is_verified to users (verified existing users)');
        }

        if (!columnNames.includes('verification_code')) {
          db.exec(`ALTER TABLE users ADD COLUMN verification_code TEXT;`);
          console.log('[db] migrated: added verification_code to users');
        }
      } catch (e: any) {
        console.warn('[db] users migration error:', e.message);
      }
    }

    // ALWAYS ensure at least one admin exists (regardless of migration)
    try {
      const adminCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any)?.count || 0;
      if (adminCount === 0) {
        const firstUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
        if (firstUser) {
          db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(firstUser.id);
          console.log(`[db] promoted user #${firstUser.id} to admin (no admin existed)`);
        }
      }
    } catch (e: any) {
      console.warn('[db] admin check failed:', e.message);
    }

    // Migrate stock_history table (add source, size)
    if (tableNames.includes('stock_history')) {
      try {
        const historyColumns = db.prepare("PRAGMA table_info(stock_history)").all() as Array<{ name: string }>;
        const columnNames = historyColumns.map((c) => c.name);

        if (!columnNames.includes('source')) {
          db.exec(`ALTER TABLE stock_history ADD COLUMN source TEXT;`);
          db.exec(`UPDATE stock_history SET source = 'http' WHERE source IS NULL;`);
          console.log('[db] migrated: added source to stock_history');
        }

        if (!columnNames.includes('size')) {
          db.exec(`ALTER TABLE stock_history ADD COLUMN size TEXT;`);
          console.log('[db] migrated: added size to stock_history');
        }
      } catch (e: any) {
        console.warn('[db] stock_history migration error:', e.message);
      }
    }
  } catch (e: any) {
    console.warn('[db] migration check failed:', e.message);
  }

  // Now create tables with correct schema
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
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      in_stock INTEGER NOT NULL,
      price REAL,
      checked_at TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_stock_history_product_time
      ON stock_history(product_id, checked_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_products_user_id
      ON products(user_id);

    CREATE INDEX IF NOT EXISTS idx_price_alerts_product
      ON price_alerts(product_id, is_active);

    CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications(user_id, is_read, created_at DESC);
  `);

  // Ensure default user exists
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number } | undefined;
    if (userCount && userCount.count === 0) {
      console.log('[db] users table ready, waiting for first registration');
    }
  } catch (e) {
    // Ignore
  }

  // Migrations: add new columns to existing tables
  try {
    db.prepare("SELECT name FROM products LIMIT 1").get();
  } catch (e) {
    db.prepare("ALTER TABLE products ADD COLUMN name TEXT").run();
    console.log('[db] migration: added name column to products');
  }
  try {
    db.prepare("SELECT image_url FROM products LIMIT 1").get();
  } catch (e) {
    db.prepare("ALTER TABLE products ADD COLUMN image_url TEXT").run();
    console.log('[db] migration: added image_url column to products');
  }
  try {
    db.prepare("SELECT role FROM users LIMIT 1").get();
  } catch (e) {
    db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'").run();
    // Make the first user admin
    db.prepare("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)").run();
    console.log('[db] migration: added role column to users');
  }
}

export function getLastStatus(productId: number): { in_stock: number; price: number | null } | null {
  const row = db
    .prepare(
      'SELECT in_stock, price FROM stock_history WHERE product_id = ? ORDER BY id DESC LIMIT 1'
    )
    .get(productId) as { in_stock: number; price: number | null } | undefined;
  return row ?? null;
}




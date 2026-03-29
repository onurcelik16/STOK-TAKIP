import cron from 'node-cron';
import { db, getLastStatus, pruneOldStockHistory } from '../data/db';
import { DemoStore } from '../stores/examples/DemoStore';
import { TrendyolStore } from '../stores/trendyol/TrendyolStore';
import { GenericStore } from '../stores/generic/GenericStore';
import { AmazonStore } from '../stores/amazon/AmazonStore';
import { GratisStore } from '../stores/gratis/GratisStore';
import { notifyChange } from '../services/notifier';
import { logger } from '../utils/logger';

function getScraperByName(name: string, url?: string) {
  // URL-based auto-detection takes priority (catches products saved as 'generic')
  if (url) {
    if (/gratis\.com/i.test(url)) return GratisStore;
  }
  const key = name.toLowerCase();
  if (key === 'trendyol') return TrendyolStore;
  if (key === 'hepsiburada' || key === 'generic' || key === 'other') return GenericStore;
  if (key === 'amazon') return AmazonStore;
  if (key === 'gratis') return GratisStore;
  return DemoStore;
}

let isChecking = false;
let currentJob: cron.ScheduledTask | null = null;
const DEFAULT_SCRAPER_TIMEOUT_MS = 60_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, context: { productId: number; url: string; store: string }): Promise<T> {
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_SCRAPER_TIMEOUT_MS;

  return await Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`[scraper-timeout] Timed out after ${timeoutMs}ms for product #${context.productId} (${context.store})`));
      }, timeoutMs);
    }),
  ]);
}

export function scheduleStockChecks() {
  if (currentJob) {
    currentJob.stop();
  }

  // Get interval from DB or env
  const dbInterval = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('cron_interval') as { value: string } | undefined;
  const cronExpr = dbInterval?.value || process.env.CRON || '*/10 * * * *';

  logger.info({ cronExpr }, '[cron] scheduling stock checks');

  currentJob = cron.schedule(cronExpr, async () => {
    if (isChecking) {
      logger.warn('[cron] Previous stock check still running, skipping this interval to prevent overlap and memory exhaustion.');
      return;
    }

    isChecking = true;
    try {
      const cycleStart = process.hrtime.bigint();
      logger.info('[cron] starting stock check cycle...');
      const products: Array<{
        id: number;
        url: string;
        store: string;
        selector: string | null;
        size: string | null;
        name: string | null;
        image_url: string | null;
      }> = db
        .prepare('SELECT id, url, store, selector, size, name, image_url FROM products')
        .all() as any;

      for (const p of products) {
        const productStart = process.hrtime.bigint();
        const scraper = getScraperByName(p.store, p.url);
        try {
          const timeoutMs = process.env.SCRAPER_TIMEOUT_MS ? Number(process.env.SCRAPER_TIMEOUT_MS) : DEFAULT_SCRAPER_TIMEOUT_MS;
          const result = await withTimeout(
            scraper.checkProduct({ url: p.url, selector: p.selector ?? undefined, size: p.size ?? undefined }),
            timeoutMs,
            { productId: p.id, url: p.url, store: p.store },
          );
          const inStock = result.inStock ? 1 : 0;
          const price = result.price ?? null;
          const source = result.source ?? 'http';
          const size = result.size ?? p.size ?? null;

          // IMPORTANT: Read previous status BEFORE inserting the new record
          const last = getLastStatus(p.id);

          db.prepare(
            "INSERT INTO stock_history (product_id, in_stock, price, checked_at, source, size) VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?)"
          ).run(
            p.id,
            inStock,
            price ?? null,
            source ?? 'http',
            size ?? null
          );

          // Update product name and image if scraped and not yet set
          if (result.productName || result.imageUrl) {
            const updates: string[] = [];
            const params: any[] = [];
            if (result.productName && !result.productName.includes('Attention Required')) {
              const nameStr = typeof result.productName === 'string' ? result.productName : String(result.productName);
              if (!p.name || p.name.includes('Attention Required')) {
                updates.push('name = ?');
                params.push(nameStr);
              }
            }
            if (result.imageUrl) {
              let imgStr: string | null = null;
              if (typeof result.imageUrl === 'string') imgStr = result.imageUrl;
              else if (Array.isArray(result.imageUrl)) imgStr = result.imageUrl[0];
              else if (result.imageUrl && (result.imageUrl as any).contentUrl) {
                const cUrl = (result.imageUrl as any).contentUrl;
                imgStr = Array.isArray(cUrl) ? cUrl[0] : cUrl;
              }

              if (imgStr && typeof imgStr === 'string' && (!p.image_url || p.image_url.startsWith('{'))) {
                updates.push('image_url = ?');
                params.push(imgStr);
              }
            }
            if (updates.length > 0) {
              params.push(p.id);
              db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);
            }
          }

          const prev = last ? last.in_stock === 1 : null;
          const now = inStock === 1;

          if (prev === null || prev !== now) {
            await notifyChange({
              productId: p.id,
              url: p.url,
              store: p.store,
              fromInStock: prev,
              toInStock: now,
              price,
            });
          }

          // Check price alerts
          if (price != null) {
            const activeAlerts = db.prepare(
              'SELECT id, target_price, direction FROM price_alerts WHERE product_id = ? AND is_active = 1'
            ).all(p.id) as Array<{ id: number; target_price: number; direction: string }>;

            for (const alert of activeAlerts) {
              const triggered =
                (alert.direction === 'below' && price <= alert.target_price) ||
                (alert.direction === 'above' && price >= alert.target_price);

              if (triggered) {
                db.prepare("UPDATE price_alerts SET is_active = 0, triggered_at = datetime('now', 'localtime') WHERE id = ?").run(alert.id);

                try {
                  const { notifyPriceAlert } = await import('../services/notifier');
                  await notifyPriceAlert({
                    productId: p.id,
                    url: p.url,
                    store: p.store,
                    targetPrice: alert.target_price,
                    currentPrice: price,
                    direction: alert.direction,
                  });
                } catch (notifyErr: any) {
                  logger.error({ err: notifyErr, productId: p.id }, '[cron] price alert notify failed');
                }
              }
            }
          }
          const productEnd = process.hrtime.bigint();
          const productDurationMs = Number(productEnd - productStart) / 1_000_000;
          logger.info(
            {
              productId: p.id,
              store: p.store,
              url: p.url,
              durationMs: Number(productDurationMs.toFixed(2)),
            },
            '[cron] product check completed',
          );
        } catch (e: any) {
          const productEnd = process.hrtime.bigint();
          const productDurationMs = Number(productEnd - productStart) / 1_000_000;
          logger.error(
            {
              err: e,
              productId: p.id,
              store: p.store,
              url: p.url,
              durationMs: Number(productDurationMs.toFixed(2)),
            },
            '[cron] check failed for product',
          );
        }
      }

      // Prune very old stock history to keep DB size under control
      const retentionDays = process.env.STOCK_HISTORY_RETENTION_DAYS
        ? Number(process.env.STOCK_HISTORY_RETENTION_DAYS)
        : 90;
      const pruned = pruneOldStockHistory(retentionDays);

      const cycleEnd = process.hrtime.bigint();
      const cycleDurationMs = Number(cycleEnd - cycleStart) / 1_000_000;
      logger.info(
        {
          productCount: products.length,
          durationMs: Number(cycleDurationMs.toFixed(2)),
          prunedHistoryRows: pruned,
          retentionDays: Number.isFinite(retentionDays) && retentionDays > 0 ? Math.floor(retentionDays) : null,
        },
        '[cron] finished stock check cycle',
      );
    } finally {
      isChecking = false;
    }
  });
}

export function restartStockChecks() {
  console.log('[cron] restarting with new settings...');
  scheduleStockChecks();
}

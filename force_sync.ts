import 'dotenv/config';
import Database from 'better-sqlite3';
import { TrendyolStore } from './src/server/stores/trendyol/TrendyolStore';
import { HepsiburadaStore } from './src/server/stores/hepsiburada/HepsiburadaStore';
import { AmazonStore } from './src/server/stores/amazon/AmazonStore';

const db = new Database('data/app.sqlite');

function getScraper(store: string) {
    if (store === 'trendyol') return TrendyolStore;
    if (store === 'hepsiburada') return HepsiburadaStore;
    if (store === 'amazon') return AmazonStore;
    return null;
}

async function forceSync() {
    const products = db.prepare("SELECT id, url, store, selector, size, name, image_url FROM products").all();
    console.log(`Found ${products.length} products to refresh`);

    for (const p of products as any[]) {
        const scraper = getScraper(p.store);
        if (!scraper) continue;

        console.log(`[${p.store.toUpperCase()}] Checking product ${p.id}: ${p.url}`);
        try {
            const result = await scraper.checkProduct({
                url: p.url,
                selector: p.selector ?? undefined,
                size: p.size ?? undefined
            });

            const inStock = result.inStock ? 1 : 0;
            const price = result.price ?? null;
            const source = result.source ?? 'http';

            // 1. Save history
            db.prepare(
                "INSERT INTO stock_history (product_id, in_stock, price, checked_at, source, size) VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?)"
            ).run(
                p.id,
                inStock ?? 0,
                price ?? null,
                source ?? 'http',
                p.size ?? null
            );

            // 2. Update missing metadata (image, name)
            if (result.productName || result.imageUrl) {
                const updates: string[] = [];
                const params: any[] = [];

                if (result.productName && !result.productName.includes('Attention Required')) {
                    if (!p.name || p.name.includes('Attention Required')) {
                        updates.push('name = ?');
                        params.push(result.productName);
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
                    console.log(`Updated metadata for product ${p.id}`);
                }
            }

            console.log(`Done product ${p.id}.`);
        } catch (e: any) {
            console.error(`Error checking product ${p.id}:`, e?.message || 'Unknown error');
        }
    }

    db.close();
    console.log('Force sync finished.');
}

forceSync();

import Database from 'better-sqlite3';
import { TrendyolStore } from './src/server/stores/trendyol/TrendyolStore.js';

const db = new Database('data/app.sqlite');
const rows = db.prepare("SELECT * FROM products WHERE store='trendyol' LIMIT 2").all();

async function run() {
    for (const row of rows as any[]) {
        console.log('Testing:', row.url);
        try {
            const res = await TrendyolStore.checkProduct({ url: row.url });
            console.log('Result:', res);
        } catch (e: any) {
            console.error('Error:', e?.message || 'Unknown error');
        }
    }
}
run();

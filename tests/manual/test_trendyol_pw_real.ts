import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function testTrendyolSize() {
    try {
        const url = 'https://www.trendyol.com/stradivarius/hakim-yaka-dugmeli-triko-hirka-p-835697330'; // Actual generic link for this cardigan
        console.log(`Testing URL: ${url}`);
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            locale: 'tr-TR',
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        const html = await page.content();
        const $ = cheerio.load(html);
        
        console.log("=== JSON-LD ITEM NAMES & SKUs ===");
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const data = JSON.parse($(el).html() || '{}');
                let items = Array.isArray(data) ? data : (data.hasVariant ? [data, ...data.hasVariant] : [data]);
                for (const item of items) {
                    if (item.name) {
                        console.log(`Name: ${item.name}`);
                        console.log(`SKU: ${item.sku}`);
                        console.log(`Availability: ${item.offers?.availability}`);
                        console.log('---');
                    }
                }
            } catch(e) {}
        });

        await browser.close();
    } catch(e: any) { console.error("Error:", e.message); }
}
testTrendyolSize();

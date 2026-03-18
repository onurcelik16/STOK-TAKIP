import { chromium } from 'playwright';

async function testTrendyolSize() {
    try {
        const url = 'https://www.trendyol.com/stradivarius/hakim-yaka-dugmeli-triko-hirka-p-838640106'; // Example from previous run
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            locale: 'tr-TR',
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const configData = await page.evaluate(() => {
            // @ts-ignore
            return window.__PRODUCT_DETAIL_APP_CONF__;
        });

        if (configData && configData.product) {
            console.log(`Global inStock: ${configData.product.inStock}`);
            if (configData.product.variants) {
                configData.product.variants.forEach((v: any) => {
                    console.log(`Variant: ${v.attributeName}=${v.attributeValue || v.value}, inStock: ${v.inStock}`);
                });
            }
        } else {
             console.log("No config data found :(");
        }

        const data = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            return scripts.map(s => s.innerHTML);
        });

        console.log("=== JSON-LD ===");
        data.forEach(jsonStr => {
            try {
                const parsed = JSON.parse(jsonStr);
                const items = Array.isArray(parsed) ? parsed : (parsed.hasVariant ? [parsed, ...parsed.hasVariant] : [parsed]);
                for (const item of items) {
                    if (item.name) {
                        console.log(`Name: ${item.name}, SKU: ${item.sku}, Stock: ${item.offers?.availability}`);
                    }
                }
            } catch(e) {}
        });

        await browser.close();
    } catch(e: any) { console.error("Error:", e.message); }
}
testTrendyolSize();

import { chromium } from 'playwright';

async function extract() {
    const url = 'https://www.trendyol.com/stradivarius/hakim-yaka-dugmeli-triko-hirka-p-1110815148';
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check config
    const configData = await page.evaluate(() => {
        // @ts-ignore
        const conf = typeof window !== 'undefined' ? window.__PRODUCT_DETAIL_APP_CONF__ : null;
        if (!conf) return null;
        return {
           variants: conf.product?.variants,
           inStock: conf.product?.inStock
        };
    });
    console.log("=== CONFIG ===");
    console.log(JSON.stringify(configData, null, 2));

    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('./trendyol_new.html', html);
    
    await browser.close();
}
extract();

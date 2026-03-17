import { chromium } from 'playwright';

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
        
        await page.waitForTimeout(2000); // Give JS time to execute

        // Extract raw HTML to check if the fallback regex finds the variants
        const html = await page.content();
        const configMatch = html.match(/window\.__PRODUCT_DETAIL_APP_CONF__\s*=\s*({[\s\S]*?});/);
        if (configMatch) {
            try {
                const config = JSON.parse(configMatch[1]);
                if (config.product && config.product.variants) {
                    config.product.variants.forEach((v: any) => {
                        console.log(`Variant config: attributeValue=${v.attributeValue}, value=${v.value}, inStock: ${v.inStock}`);
                    });
                } else {
                     console.log("No variants array found in config.product");
                }
            } catch(e) { console.log('Parse error'); }
        } else {
            console.log('No __PRODUCT_DETAIL_APP_CONF__ found in HTML');
        }

        await browser.close();
    } catch(e: any) { console.error("Error:", e.message); }
}
testTrendyolSize();

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function testBrowser() {
    const url = 'https://www.trendyol.com/vodens/kahverengi-kayik-yaka-uzun-kol-top-100-pamuk-p-996372050';
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        locale: 'tr-TR',
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const content = await page.content();
    await browser.close();

    const $$ = cheerio.load(content);
    console.log('BROWSER add-to-basket-button:', $$('.add-to-basket-button').length);
    console.log('BROWSER add-to-bs-tx:', $$('.add-to-bs-tx').length);
    console.log('BROWSER sold-out:', $$('.sold-out').length);
    console.log('BROWSER prc-dsc:', $$('.prc-dsc').text());
}
testBrowser().catch(console.error);

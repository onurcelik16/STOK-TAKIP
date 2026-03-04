import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium, firefox } from 'playwright';
import { StoreScraper } from '../Store';

function extractPrice(text: string): number | null {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    // Match "1.234,56", "1234,56", "1.234", "1234" with TL/₺/empty
    const priceMatch = cleaned.match(/([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*(?:tl|₺)/i);
    if (priceMatch) {
        const joined = priceMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(joined);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}

export const HepsiburadaStore: StoreScraper = {
    name: 'hepsiburada',
    async checkProduct({ url }) {
        console.log(`[HepsiburadaStore] Checking ${url}`);

        // Hepsiburada blocks headless browsers aggressively (Güvenlik page).
        // Strategy: Use Firefox (less fingerprinted) with full stealth settings.
        if (process.env.RENDER_BROWSER === 'true') {
            console.log(`[HepsiburadaStore] Launching Firefox browser for ${url}`);
            let browser;
            try {
                // Firefox is harder to fingerprint than Chromium
                browser = await firefox.launch({
                    headless: true,
                });
                const context = await browser.newContext({
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
                    locale: 'tr-TR',
                    viewport: { width: 1366, height: 768 },
                    javaScriptEnabled: true,
                });

                const page = await context.newPage();

                // Set extra headers to look more like a real browser
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                });

                await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 });

                // Wait for content to render  
                try {
                    await page.waitForSelector('button, [data-test-id], span[class*="price"], div[class*="price"]', { timeout: 15000 });
                } catch (e) {
                    console.log('[HepsiburadaStore] Element wait timed out, checking what we got...');
                }

                await page.waitForTimeout(3000);

                // Check if we got past the security page
                const pageTitle = await page.title();
                if (pageTitle.includes('Güvenlik')) {
                    console.log('[HepsiburadaStore] Firefox also hit security page, trying Chromium headed...');
                    await browser.close();

                    // Last resort: headed Chromium
                    browser = await chromium.launch({
                        headless: false,
                        args: [
                            '--disable-blink-features=AutomationControlled',
                            '--no-sandbox',
                            '--window-position=-2000,-2000', // off-screen
                        ],
                    });
                    const ctx2 = await browser.newContext({
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                        locale: 'tr-TR',
                        viewport: { width: 1366, height: 768 },
                    });
                    await ctx2.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => false });
                        (window as any).chrome = { runtime: {} };
                    });

                    const page2 = await ctx2.newPage();
                    await page2.goto(url, { waitUntil: 'networkidle', timeout: 40000 });
                    await page2.waitForTimeout(8000);

                    const result = await extractFromPage(page2);
                    return result;
                }

                const result = await extractFromPage(page);
                return result;

            } catch (e: any) {
                console.error(`[HepsiburadaStore] Browser failed: ${e.message}`);
            } finally {
                if (browser) await browser.close();
            }
        }

        // HTTP fallback: Try HepsiBurada mobile API (less protected)
        try {
            // Extract product ID from URL
            const urlMatch = url.match(/[-\s]p-(\w+)/i) || url.match(/\/([A-Za-z0-9]+)(?:\?|$)/);
            const productId = urlMatch ? urlMatch[1] : null;

            if (productId) {
                const apiUrl = `https://www.hepsiburada.com/product/${productId}/get-product-detail`;
                const apiResp = await axios.get(apiUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'tr-TR,tr;q=0.9',
                        'Referer': 'https://www.hepsiburada.com/',
                    },
                    timeout: 10000,
                    validateStatus: () => true,
                });

                if (apiResp.status === 200 && apiResp.data) {
                    const data = apiResp.data;
                    const apiPrice = data.price || data.currentPrice || data.salePrice || null;
                    const apiInStock = data.inStock !== false && data.stockStatus !== 'outOfStock';
                    const apiName = data.name || data.productName || null;
                    const apiImage = data.imageUrl || data.image || null;

                    if (apiPrice) {
                        console.log(`[HepsiburadaStore] Mobile API Result: inStock=${apiInStock}, price=${apiPrice}, name=${apiName}`);
                        return {
                            inStock: apiInStock,
                            price: typeof apiPrice === 'string' ? parseFloat(apiPrice.replace(',', '.')) : apiPrice,
                            source: 'http' as const,
                            productName: apiName,
                            imageUrl: apiImage,
                        };
                    }
                }
            }
        } catch (e: any) {
            console.warn(`[HepsiburadaStore] Mobile API failed: ${e.message}`);
        }

        // Standard HTTP fallback (usually blocked but try anyway)
        try {
            const resp = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
                    'Accept-Language': 'tr-TR,tr;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml',
                },
                timeout: 10000,
                validateStatus: () => true,
            });

            if (resp.status === 200) {
                const $ = cheerio.load(resp.data);
                const title = $('title').text();
                if (!title.includes('Güvenlik')) {
                    const result = parseCheerio($);
                    if (result.inStock !== null) {
                        console.log(`[HepsiburadaStore] HTTP Result: inStock=${result.inStock}, price=${result.price}, name=${result.productName}`);
                        return {
                            inStock: result.inStock,
                            price: result.price,
                            source: 'http' as const,
                            productName: result.productName || null,
                            imageUrl: result.imageUrl || null
                        };
                    }
                }
            }
        } catch (e: any) {
            console.warn(`[HepsiburadaStore] HTTP failed: ${e.message}`);
        }

        console.warn('[HepsiburadaStore] All strategies failed');
        return { inStock: false, price: null, source: 'browser' as const };
    },
};

async function extractFromPage(page: any): Promise<{ inStock: boolean; price: number | null; source: 'browser' }> {
    const result = await page.evaluate(() => {
        const body = document.body.innerText || '';
        const bodyLower = body.toLowerCase();

        // Stock detection
        const hasAddToCart = bodyLower.includes('sepete ekle') || bodyLower.includes('satın al');
        const soldOut = bodyLower.includes('tükendi') || bodyLower.includes('stokta yok') || bodyLower.includes('satılmamaktadır');

        // Price detection - search for TL prices
        const priceMatches = body.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*TL/g);
        let price: string | null = null;
        if (priceMatches && priceMatches.length > 0) {
            price = priceMatches[0]; // First TL price is usually the current price
        }

        return { hasAddToCart, soldOut, price, bodyLength: body.length };
    });

    console.log(`[HepsiburadaStore] Page result: bodyLength=${result.bodyLength}, addToCart=${result.hasAddToCart}, soldOut=${result.soldOut}, price=${result.price}`);

    let inStock = false;
    if (result.soldOut) inStock = false;
    else if (result.hasAddToCart) inStock = true;
    else if (result.bodyLength > 100) inStock = true; // If page loaded with content and no sold-out marker

    let price: number | null = null;
    if (result.price) {
        price = extractPrice(result.price);
    }

    return { inStock, price, source: 'browser' };
}

function parseCheerio($: cheerio.CheerioAPI): { inStock: boolean | null; price: number | null; productName?: string; imageUrl?: string } {
    let inStock: boolean | null = null;
    let price: number | null = null;
    let productName: string | undefined;
    let imageUrl: string | undefined;

    // JSON-LD
    $('script[type="application/ld+json"]').each((i, el) => {
        try {
            const data = JSON.parse($(el).html() || '{}');
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
                if (item['@type'] === 'Product') {
                    if (item.name) productName = item.name;
                    if (item.image) {
                        const img = Array.isArray(item.image) ? item.image[0] : item.image;
                        imageUrl = typeof img === 'string' ? img : img.contentUrl || undefined;
                    }
                    if (item.offers) {
                        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
                        for (const offer of offers) {
                            if (offer.availability && inStock === null) inStock = offer.availability.includes('InStock');
                            if (offer.price && price === null) price = parseFloat(offer.price);
                        }
                    }
                }
            }
        } catch (e) { /* ignore */ }
    });

    // DOM Fallback for name/image
    if (!productName) productName = $('h1[id="product-name"]').text().trim() || $('h1').first().text().trim();
    if (!imageUrl) {
        imageUrl = $('img[data-img-product]').attr('src') || $('img[itemprop="image"]').attr('src');
        if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content');
    }

    // DOM
    if (inStock === null) {
        const hasCart = $('button').filter((_, el) => /sepete/i.test($(el).text())).length > 0;
        const soldOut = $('*').filter((_, el) => $(el).text().trim() === 'Tükendi').length > 0;
        if (soldOut) inStock = false;
        else if (hasCart) inStock = true;
    }

    return { inStock, price, productName, imageUrl };
}
